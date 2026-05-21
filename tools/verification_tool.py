#!/usr/bin/env python3
"""
verification_tool.py — MCP tool adapter for safety verification & content moderation.

Exposes:
  - verification://check   — run safety checks on proposed content
  - verification://solve   — verify CAPTCHA / proof-of-work challenges
  - verification://audit   — audit agent output against safety policy

This replaces direct safety checks embedded in agent scripts with
MCP-dispatched verification calls.
"""

import os
import json
import re
import hashlib
import logging
from typing import Any, Dict, List, Optional
from pathlib import Path

logger = logging.getLogger("verification_tool")

SAFETY_POLICY_PATH = Path(__file__).resolve().parent.parent / "config" / "safety_policy.yaml"
MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", "10000"))


class VerificationError(Exception):
    """Base exception for verification failures."""
    pass


class ContentPolicyViolation(VerificationError):
    """Raised when content violates safety policy."""
    pass


class VerificationTool:
    """MCP tool for safety verification and content moderation."""

    def __init__(self, policy_path: Optional[Path] = None):
        self.policy_path = policy_path or SAFETY_POLICY_PATH
        self._policy = None

    def _load_policy(self) -> Dict[str, Any]:
        """Lazy-load safety policy from YAML."""
        if self._policy is not None:
            return self._policy
        try:
            import yaml
            with open(self.policy_path, "r", encoding="utf-8") as f:
                self._policy = yaml.safe_load(f) or {}
        except FileNotFoundError:
            logger.warning("Safety policy not found at %s, using defaults", self.policy_path)
            self._policy = self._default_policy()
        except ImportError:
            logger.warning("PyYAML not installed, using default policy")
            self._policy = self._default_policy()
        return self._policy

    def _default_policy(self) -> Dict[str, Any]:
        """Fallback policy if YAML is missing."""
        return {
            "content_rules": {
                "max_length": MAX_CONTENT_LENGTH,
                "forbidden_patterns": [
                    r"\b(hate|violence|terror)\b",
                    r"\b(dox|doxx)\b",
                    r"\b(swat)\b",
                ],
                "required_disclaimers": [
                    "This is philosophical speculation, not medical/legal advice",
                ],
            },
            "rate_limits": {
                "posts_per_day": 3,
                "comments_per_day": 50,
                "follows_per_day": 2,
                "dms_per_day": 2,
            },
        }

    # ------------------------------------------------------------------
    # Tool: verification://check
    # ------------------------------------------------------------------

    def check(self, agent_id: str, content: str, content_type: str = "post") -> Dict[str, Any]:
        """
        Run safety checks on proposed content.

        Args:
            agent_id: The agent proposing the content
            content: The content to verify
            content_type: Category (post, comment, dm, follow)

        Returns:
            Dict with "approved" bool and "violations" list
        """
        policy = self._load_policy()
        violations = []

        # Length check
        max_len = policy.get("content_rules", {}).get("max_length", MAX_CONTENT_LENGTH)
        if len(content) > max_len:
            violations.append(f"Content exceeds max length ({len(content)} > {max_len})")

        # Forbidden pattern check
        patterns = policy.get("content_rules", {}).get("forbidden_patterns", [])
        for pattern in patterns:
            if re.search(pattern, content, re.IGNORECASE):
                violations.append(f"Forbidden pattern matched: {pattern}")

        # Content-type specific checks
        rate_limits = policy.get("rate_limits", {})
        if content_type == "post":
            # Posts should have philosophical substance
            if len(content.split()) < 10:
                violations.append("Post lacks substantive content (< 10 words)")
        elif content_type == "comment":
            if len(content) > 1000:
                violations.append("Comment exceeds 1000 character limit")

        approved = len(violations) == 0
        logger.info("check: agent=%s type=%s approved=%s violations=%d", agent_id, content_type, approved, len(violations))

        return {
            "status": "ok",
            "approved": approved,
            "violations": violations,
            "agent_id": agent_id,
            "content_type": content_type,
            "content_length": len(content),
        }

    # ------------------------------------------------------------------
    # Tool: verification://solve
    # ------------------------------------------------------------------

    def solve(self, challenge_type: str, challenge_data: str, agent_id: str) -> Dict[str, Any]:
        """
        Solve a verification challenge (CAPTCHA, proof-of-work, etc).

        Args:
            challenge_type: Type of challenge (hashcash, captcha, puzzle)
            challenge_data: Challenge payload
            agent_id: The agent solving the challenge

        Returns:
            Dict with "solved" bool and "solution"
        """
        if challenge_type == "hashcash":
            # Simple proof-of-work: find nonce such that SHA256(challenge + nonce) starts with "0000"
            prefix = "0000"
            nonce = 0
            while True:
                attempt = f"{challenge_data}{nonce}"
                hash_result = hashlib.sha256(attempt.encode()).hexdigest()
                if hash_result.startswith(prefix):
                    logger.info("solve: agent=%s hashcash nonce=%d", agent_id, nonce)
                    return {
                        "status": "ok",
                        "solved": True,
                        "solution": str(nonce),
                        "hash": hash_result,
                        "challenge_type": challenge_type,
                    }
                nonce += 1
                if nonce > 10_000_000:
                    break

            return {
                "status": "ok",
                "solved": False,
                "solution": None,
                "challenge_type": challenge_type,
            }

        elif challenge_type == "captcha":
            # Placeholder: actual CAPTCHA solving would integrate with a service
            logger.warning("solve: CAPTCHA solving not implemented")
            return {
                "status": "ok",
                "solved": False,
                "solution": None,
                "challenge_type": challenge_type,
                "note": "CAPTCHA solving requires external service integration",
            }

        else:
            return {
                "status": "error",
                "solved": False,
                "error": f"Unknown challenge type: {challenge_type}",
            }

    # ------------------------------------------------------------------
    # Tool: verification://audit
    # ------------------------------------------------------------------

    def audit(self, agent_id: str, outputs: List[str], session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Audit a batch of agent outputs against safety policy.

        Args:
            agent_id: The agent to audit
            outputs: List of content strings to audit
            session_id: Optional session identifier

        Returns:
            Dict with per-output audit results and aggregate score
        """
        results = []
        total_violations = 0

        for i, output in enumerate(outputs):
            check_result = self.check(agent_id, output, content_type="post")
            results.append({
                "index": i,
                "approved": check_result["approved"],
                "violations": check_result["violations"],
                "length": len(output),
            })
            total_violations += len(check_result["violations"])

        aggregate_score = max(0, 100 - (total_violations * 10))
        logger.info("audit: agent=%s outputs=%d violations=%d score=%d", agent_id, len(outputs), total_violations, aggregate_score)

        return {
            "status": "ok",
            "agent_id": agent_id,
            "session_id": session_id,
            "outputs_audited": len(outputs),
            "total_violations": total_violations,
            "aggregate_score": aggregate_score,
            "results": results,
        }

    # ------------------------------------------------------------------
    # MCP manifest
    # ------------------------------------------------------------------

    def get_manifest(self) -> Dict[str, Any]:
        """Return MCP tool manifest for discovery."""
        return {
            "name": "verification",
            "version": "3.0.0",
            "tools": [
                {
                    "name": "verification://check",
                    "description": "Run safety checks on proposed agent content",
                    "parameters": {
                        "agent_id": {"type": "string", "required": True},
                        "content": {"type": "string", "required": True},
                        "content_type": {"type": "string", "default": "post"},
                    },
                },
                {
                    "name": "verification://solve",
                    "description": "Solve a verification challenge (hashcash, captcha)",
                    "parameters": {
                        "challenge_type": {"type": "string", "required": True},
                        "challenge_data": {"type": "string", "required": True},
                        "agent_id": {"type": "string", "required": True},
                    },
                },
                {
                    "name": "verification://audit",
                    "description": "Audit batch of agent outputs against safety policy",
                    "parameters": {
                        "agent_id": {"type": "string", "required": True},
                        "outputs": {"type": "array", "required": True},
                        "session_id": {"type": "string", "required": False},
                    },
                },
            ],
        }


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Verification MCP Tool")
    parser.add_argument("action", choices=["check", "solve", "audit", "manifest"])
    parser.add_argument("--agent-id", default="test-agent")
    parser.add_argument("--content", default="")
    parser.add_argument("--content-type", default="post")
    parser.add_argument("--challenge-type", default="hashcash")
    parser.add_argument("--challenge-data", default="")
    parser.add_argument("--outputs", nargs="+", default=[])
    args = parser.parse_args()

    tool = VerificationTool()

    if args.action == "manifest":
        print(json.dumps(tool.get_manifest(), indent=2))
    elif args.action == "check":
        result = tool.check(args.agent_id, args.content, args.content_type)
        print(json.dumps(result, indent=2))
    elif args.action == "solve":
        result = tool.solve(args.challenge_type, args.challenge_data, args.agent_id)
        print(json.dumps(result, indent=2))
    elif args.action == "audit":
        result = tool.audit(args.agent_id, args.outputs)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
