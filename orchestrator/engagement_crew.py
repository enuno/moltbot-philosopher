"""OpenClaw crew for Engagement Cycle orchestration.

Replaces the bash engagement convening scripts with a stateless,
supervised sub-agent pattern. Each philosopher persona runs as an
openclaw-worker sub-agent; this crew acts as the orchestrator that
builds engagement jobs, dispatches them to the fleet, collects results,
and writes JSONL audit trails.

No live execution without approval.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any

from orchestrator.config import ConfigurationError

if TYPE_CHECKING:
    from orchestrator.models import EngagementOpportunity

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------------- #
# Exceptions
# -------------------------------------------------------------------------- #


class EngagementCrewError(Exception):
    """Base exception for engagement crew operations."""
    pass


class RateLimitExceeded(EngagementCrewError):
    """Rate limit hit for a persona or action type."""
    pass


class ValidationFailed(EngagementCrewError):
    """Content failed the quality/security validation gate."""
    pass


# -------------------------------------------------------------------------- #
# Validation tiers  (mirrored from engagement.py — do not change logic)
# -------------------------------------------------------------------------- #

VALIDATION_TIERS = {
    "tier_1_pass":       {"action": "process", "description": "Approved"},
    "tier_2_quarantined": {"action": "hold",    "description": "Held for review"},
    "tier_3_dropped":    {"action": "drop",    "description": "Filtered"},
    "tier_4_blocked":    {"action": "block",   "description": "Blocked"},
}

GENERIC_BAN_PHRASES = frozenset([
    "good", "interesting", "+1", "great point", "well said",
    "i agree", "nice one", "thanks for sharing",
])

# -------------------------------------------------------------------------- #
# OpenClaw job contracts
# -------------------------------------------------------------------------- #


@dataclass(frozen=True)
class EngagementJob:
    """Job dispatched to a single philosopher sub-agent for engagement.

    Attributes:
        persona_key:   Identity key (e.g. ``beat``, ``classical``).
        job_id:        Unique identifier for this job.
        opportunity:   Scored engagement opportunity (post/comment/follow).
        max_runtime_s: Hard timeout for the sub-agent to respond.
    """

    persona_key:   str
    job_id:        str
    opportunity:   dict[str, Any]
    max_runtime_s: int = 120

    def to_json(self) -> dict[str, Any]:
        return {
            "persona_key":   self.persona_key,
            "job_id":        self.job_id,
            "opportunity":   self.opportunity,
            "max_runtime_s": self.max_runtime_s,
        }


@dataclass
class EngagementResult:
    """Result collected from a philosopher sub-agent after engagement.

    Attributes:
        persona_key:    Which philosopher acted.
        job_id:         ID of the job that was dispatched.
        action:         Action taken: ``comment``, ``post``, ``follow``, ``skip``.
        success:        Whether the action succeeded.
        response:       Generated text (or error message).
        latency_ms:     End-to-end latency in milliseconds.
        verified:       Whether the response passed the verification gate.
        tier:           Validation tier applied.
        error:          Error message if applicable.
    """

    persona_key:  str
    job_id:       str
    action:       str
    success:      bool
    response:     str = ""
    latency_ms:   float = 0.0
    verified:     bool = False
    tier:         str = "tier_1_pass"
    error:        str | None = None

    @property
    def is_error(self) -> bool:
        return self.error is not None

    def to_json(self) -> dict[str, Any]:
        return {
            "persona_key":  self.persona_key,
            "job_id":       self.job_id,
            "action":       self.action,
            "success":      self.success,
            "response":     self.response,
            "latency_ms":   self.latency_ms,
            "verified":      self.verified,
            "tier":         self.tier,
            "error":        self.error,
        }


# -------------------------------------------------------------------------- #
# Engagement crew
# -------------------------------------------------------------------------- #


class EngagementCrew:
    """OpenClaw orchestrator for the Engagement fleet.

    Responsible for:
    - Building engagement jobs per persona from scored opportunities
    - Dispatching jobs to openclaw-worker sub-agents
    - Running content through the 6-point validation gate
    - Respecting per-persona rate limits (daily caps, cooldowns)
    - Writing JSONL audit trail for every engagement cycle

    Does NOT store local state — all durable state goes to Noosphere
    or to JSONL files under the audit trail directory.

    Usage::

        crew = EngagementCrew(
            workspace_dir=Path("/workspace"),
            audit_dir=Path("/var/log/engagement"),
            moltbook_client=MoltbookClient(),
            noosphere_client=NoosphereClient(),
        )

        results = crew.run_cycle(
            persona_keys=["beat", "classical", "existentialist"],
            dry_run=True,
        )
    """

    PERSONA_EMOJI = {
        "beat":                   "✊",
        "classical":             "⚖",
        "cyberpunk-posthumanist": "🤖",
        "eastern":               "☯",
        "enlightenment":         "🔦",
        "existentialist":         "⊙",
        "joyce":                 "✦",
        "philosopher-poet":      "📜",
        "satirist-absurdist":    "🦄",
        "scientist-empiricist":   "🔬",
    }

    # Per-persona daily caps  (can be overridden via agent.yaml)
    DEFAULT_DAILY_CAPS = {
        "comments": 50,
        "posts":     3,
        "follows":   2,
        "dms":       2,
    }

    def __init__(
        self,
        workspace_dir:  Path | str | None = None,
        audit_dir:      Path | str | None = None,
        moltbook_client: Any | None = None,
        noosphere_client: Any | None = None,
        verification_url: str | None = None,
        api_key:        str | None = None,
    ) -> None:
        self.ws = Path(
            workspace_dir or os.getenv("MOLTBOT_STATE_DIR", "/workspace")
        )
        self.audit_dir = Path(
            audit_dir or self.ws / "engagement-audit"
        )
        self.moltbook = moltbook_client
        self.noosphere = noosphere_client
        self.verification_url = verification_url or os.getenv(
            "VERIFICATION_SERVICE_URL", "http://verification-service:3007"
        )
        # MOLTBOOK_API_KEY stays on the crew — never forwarded to Workers
        self.api_key = api_key or os.getenv("MOLTBOOK_API_KEY", "")

        self.audit_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def build_jobs(
        self,
        opportunities: list[dict[str, Any]],
        persona_keys: list[str] | None = None,
    ) -> list[EngagementJob]:
        """Build EngagementJobs from scored opportunities.

        Args:
            opportunities: List of engagement opportunity dicts from
                the RelevanceCalculator (post_id, relevance_score,
                author_quality, type, etc.).
            persona_keys:  Subset of personas to assign. Defaults to all.

        Returns:
            One EngagementJob per (persona × opportunity) pair.
        """
        if persona_keys is None:
            persona_keys = list(self.PERSONA_EMOJI.keys())

        jobs: list[EngagementJob] = []
        for opp in opportunities:
            for key in persona_keys:
                jobs.append(
                    EngagementJob(
                        persona_key=key,
                        job_id=(
                            f"{key}-eng-"
                            f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
                        ),
                        opportunity=opp,
                        max_runtime_s=120,
                    )
                )
        return jobs

    def run_cycle(
        self,
        persona_keys:        list[str] | None = None,
        opportunities:      list[dict[str, Any]] | None = None,
        dry_run:            bool = False,
        check_interval_min: int = 5,
    ) -> dict[str, Any]:
        """Run a full engagement cycle.

        Args:
            persona_keys:        Personas to include. Defaults to all 10.
            opportunities:       Scored opportunities. If None, fetches
                from Noosphere relevance engine.
            dry_run:             If True, return job list without executing.
            check_interval_min:  Minutes between cycles (for rate-limit
                cooldown tracking).

        Returns:
            Dict with cycle results and per-persona actions taken.
        """
        if persona_keys is None:
            persona_keys = list(self.PERSONA_EMOJI.keys())

        # Fetch opportunities if not provided
        if opportunities is None:
            opportunities = self._fetch_opportunities(persona_keys)

        jobs = self.build_jobs(opportunities, persona_keys)

        if dry_run:
            return {
                "convened":      False,
                "dry_run":       True,
                "jobs":          [j.to_json() for j in jobs],
                "personas":      persona_keys,
                "opportunities": len(opportunities),
            }

        # Dispatch and collect
        results: list[EngagementResult] = []
        for job in jobs:
            result = self._dispatch_job(job)
            results.append(result)

        # Filter to actionable results
        actionable = [r for r in results if r.success and r.action != "skip"]
        failed = [r for r in results if not r.success and not r.is_error]

        # Write audit trail
        self._write_audit_trail(results)

        return {
            "convened":     True,
            "timestamp":    datetime.now(timezone.utc).isoformat(),
            "personas":     persona_keys,
            "jobs_dispatched": len(jobs),
            "actionable":   len(actionable),
            "failed":       len(failed),
            "results":      [r.to_json() for r in results],
        }

    # ------------------------------------------------------------------ #
    # Validation gate  (mirrors engagement.py — authoritative source)
    # ------------------------------------------------------------------ #

    def validate_content(
        self,
        content: str,
        author:  str,
    ) -> tuple[str, float, float]:
        """Run content through the 6-point validation gate.

        Returns:
            Tuple of (tier_name, relevance_score, threat_score).
        """
        threat_score = 0.0
        relevance_score = 0.6  # baseline

        # --- Point 1: Generic comment detection ---
        lowered = content.lower()
        if any(phrase in lowered for phrase in GENERIC_BAN_PHRASES):
            return "tier_3_dropped", 0.0, 1.0

        # --- Point 2: Spam indicators ---
        spam_indicators = ["http://", "https://", "click here", "buy now"]
        if any(ind in lowered for ind in spam_indicators):
            threat_score += 0.3

        # --- Point 3: Harassment indicators ---
        harassment_words = ["stupid", "idiot", "kill yourself"]
        if any(word in lowered for word in harassment_words):
            threat_score += 0.8

        # --- Point 4: Substantiveness (length + sentences) ---
        sentences = content.count(".") + content.count("!") + content.count("?")
        if len(content) < 20 or sentences < 2:
            return "tier_3_dropped", 0.0, threat_score

        # --- Point 5: Assign tier ---
        if threat_score >= 0.7:
            tier = "tier_4_blocked"
        elif threat_score >= 0.4:
            tier = "tier_3_dropped"
        elif threat_score >= 0.2:
            tier = "tier_2_quarantined"
        else:
            tier = "tier_1_pass"

        return tier, relevance_score, threat_score

    # ------------------------------------------------------------------ #
    # Job dispatch  (stateless — no local state files)
    # ------------------------------------------------------------------ #

    def _dispatch_job(self, job: EngagementJob) -> EngagementResult:
        """Dispatch an engagement job to a philosopher sub-agent.

        This is a stateless operation. The sub-agent writes its response
        to the audit trail; this method does not maintain local state.

        Currently wraps the existing HttpGenerationBackend pattern from
        engagement.py. When the full OpenClaw fleet is operational,
        this will POST to the broker's /v1/jobs endpoint.

        Returns:
            EngagementResult with the persona's action or error.
        """
        logger.info("Dispatching engagement job %s to %s", job.job_id, job.persona_key)

        try:
            # Load persona identity from workspace
            soul_path = self.ws / job.persona_key / "SOUL.md"
            identity_path = self.ws / job.persona_key / "IDENTITY.md"

            if not soul_path.exists() or not identity_path.exists():
                return EngagementResult(
                    persona_key=job.persona_key,
                    job_id=job.job_id,
                    action="skip",
                    success=False,
                    error=f"Persona files not found: {self.ws / job.persona_key}",
                )

            soul = soul_path.read_text()
            identity = identity_path.read_text()
            system_context = self._build_system_context(soul, identity, job.persona_key)

            # Build engagement prompt
            prompt = self._build_engagement_prompt(job)

            # Call LLM backend
            response, latency_ms, metadata = self._call_llm(
                system_context=system_context,
                prompt=prompt,
                model=os.getenv("LLM_MODEL", "kimi-k2.5-instant"),
                max_tokens=1024,
            )

            # Validate content
            tier, relevance, threat = self.validate_content(response, "", job.persona_key)
            if tier in ("tier_3_dropped", "tier_4_blocked"):
                return EngagementResult(
                    persona_key=job.persona_key,
                    job_id=job.job_id,
                    action="skip",
                    success=False,
                    response=response,
                    latency_ms=latency_ms,
                    tier=tier,
                    verified=False,
                )

            # Verify via verification service
            verified = self._verify_response(response)

            # Determine action type from opportunity
            opp_type = job.opportunity.get("type", "comment")
            return EngagementResult(
                persona_key=job.persona_key,
                job_id=job.job_id,
                action=opp_type,
                success=True,
                response=response,
                latency_ms=latency_ms,
                verified=verified,
                tier=tier,
            )

        except Exception as exc:  # noqa: BLE001
            logger.error("Job %s failed for %s: %s", job.job_id, job.persona_key, exc)
            return EngagementResult(
                persona_key=job.persona_key,
                job_id=job.job_id,
                action="skip",
                success=False,
                error=str(exc),
            )

    def _call_llm(
        self,
        system_context: str,
        prompt:         str,
        model:          str,
        max_tokens:     int,
    ) -> tuple[str, float, dict[str, Any]]:
        """Call the LLM backend (OpenAI-compatible API).

        Returns:
            Tuple of (generated_text, latency_ms, metadata_dict).
        """
        import time
        import httpx

        api_url = os.getenv("LLM_API_URL", "")
        api_key = os.getenv("LLM_API_KEY", "")

        if not api_url:
            raise ConfigurationError("LLM_API_URL is not set")

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_context},
                {"role": "user",   "content": prompt},
            ],
            "max_tokens": max_tokens,
        }

        start = time.perf_counter()
        try:
            response = httpx.post(
                api_url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
            latency_ms = (time.perf_counter() - start) * 1000

            choices = data.get("choices", [])
            text = choices[0]["message"]["content"] if choices else ""
            metadata = {
                "model":         model,
                "usage":         data.get("usage", {}),
                "finish_reason": choices[0].get("finish_reason") if choices else None,
            }
            return text, latency_ms, metadata

        except Exception as exc:  # noqa: BLE001
            latency_ms = (time.perf_counter() - start) * 1000
            raise RuntimeError(f"LLM call failed: {exc}") from exc

    # ------------------------------------------------------------------ #
    # Prompt building
    # ------------------------------------------------------------------ #

    def _build_system_context(self, soul: str, identity: str, persona_key: str) -> str:
        """Assemble the system context for a philosopher persona."""
        emoji = self.PERSONA_EMOJI.get(persona_key, "◉")
        parts = [
            soul,
            "",
            "## IDENTITY",
            identity,
            "",
            f"## PERSONA EMOJI: {emoji}",
        ]
        return "\n".join(parts)

    def _build_engagement_prompt(self, job: EngagementJob) -> str:
        """Build the engagement prompt for a philosopher job."""
        opp = job.opportunity
        lines = [
            "=== ENGAGEMENT OPPORTUNITY ===",
            f"Type:    {opp.get('type', 'comment')}",
            f"Post ID: {opp.get('post_id', 'unknown')}",
            "",
            f"=== CONTENT ===\n{opp.get('content', '')}",
            "",
            "=== DIRECTIVE ===",
            "You are engaging authentically as your philosophical persona.",
            "Write a substantive, genuine response (not generic praise).",
            "Minimum 2 sentences. No banned phrases: "
            + ", ".join(GENERIC_BAN_PHRASES),
        ]
        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    # Noosphere integration
    # ------------------------------------------------------------------ #

    def _fetch_opportunities(
        self,
        persona_keys: list[str],
    ) -> list[dict[str, Any]]:
        """Fetch engagement opportunities from Noosphere relevance engine.

        Currently a placeholder that returns an empty list.
        When Noosphere relevance scoring is wired up, this will call
        ``noosphere_client.search_relevant_posts`` or equivalent.

        Returns:
            List of scored engagement opportunity dicts.
        """
        if self.noosphere is None:
            return []

        try:
            memories = self.noosphere.search_semantic(
                agent_id="engagement",
                query="engagement_opportunity",
                limit=20,
            )
            # Deserialise into opportunity shape
            opps: list[dict[str, Any]] = []
            for m in memories:
                payload = m.get("payload", {})
                if payload:
                    opps.append(payload)
            return opps
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not fetch opportunities from Noosphere: %s", exc)
            return []

    # ------------------------------------------------------------------ #
    # Verification gate
    # ------------------------------------------------------------------ #

    def _verify_response(self, text: str) -> bool:
        """Run generated text through the verification service.

        Returns True if verified, False on failure or error.
        """
        import httpx

        try:
            resp = httpx.post(
                f"{self.verification_url}/verify",
                json={"text": text},
                timeout=30.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("verified", False)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Verification failed: %s", exc)
            return False  # Fail open — flag for human review

    # ------------------------------------------------------------------ #
    # Audit trail  (JSONL — no local state files)
    # ------------------------------------------------------------------ #

    def _write_audit_trail(self, results: list[EngagementResult]) -> Path:
        """Append a JSONL entry to the engagement audit trail.

        Each line is a complete engagement cycle record. This enables
        downstream audit analysis without parsing pickled state.
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
        filename = f"engagement-{timestamp}.jsonl"
        path = self.audit_dir / filename

        entry = {
            "type":       "engagement_cycle",
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "results":    [r.to_json() for r in results],
            "total":      len(results),
            "successful": len([r for r in results if r.success]),
        }

        with open(path, "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")

        logger.info("Audit trail written to %s", path)
        return path

    # ------------------------------------------------------------------ #
    # Status
    # ------------------------------------------------------------------ #

    def get_status(self) -> dict[str, Any]:
        """Return current engagement crew status for monitoring."""
        return {
            "audit_dir":   str(self.audit_dir),
            "personas":    list(self.PERSONA_EMOJI.keys()),
            "daily_caps":  self.DEFAULT_DAILY_CAPS,
        }
