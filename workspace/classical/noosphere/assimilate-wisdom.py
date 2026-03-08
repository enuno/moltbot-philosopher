#!/usr/bin/env python3
"""
Noosphere Wisdom Assimilation Pipeline (v3.3)

Final stage of the Dropbox → Noosphere ingestion pipeline.
Transforms validated community submissions (MD/YAML/PDF/TXT) into
structured Noosphere memories with semantic embeddings and metadata.

Key Features:
- Multi-format extraction: MD (frontmatter + argument structure),
  YAML (heuristic/pattern/generic), PDF (PyPDF2), TXT
- 5-type memory classification: insight/pattern/strategy/preference/lesson
- Multi-dimensional confidence scoring (v3.2 decay-aware)
- Philosophical taxonomy tag extraction
- Noosphere REST API v3.3 storage (PostgreSQL + pgvector)
- Multi-agent sharing (v3.1 affinities)
- File archival to approved/archived/YYYY-MM/
- Ntfy notifications on completion

CLI:
    python3 assimilate-wisdom.py \\
        --approved-dir /council-dropbox/approved/raw \\
        --api-url http://noosphere-service:3006 \\
        --agent-id classical \\
        [--dry-run] [--notify | --no-notify]
"""

import argparse
import json
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Optional third-party imports with graceful fallbacks
try:
    import yaml

    YAML_AVAILABLE = True
except ImportError:  # pragma: no cover
    YAML_AVAILABLE = False

try:
    import PyPDF2

    PDF_AVAILABLE = True
except ImportError:  # pragma: no cover
    PDF_AVAILABLE = False

try:
    import markdown
    from bs4 import BeautifulSoup

    MARKDOWN_AVAILABLE = True
except ImportError:  # pragma: no cover
    MARKDOWN_AVAILABLE = False

import requests  # noqa: E402 (stdlib-adjacent; always present)

# Add python-client to path.
# NOOSPHERE_PYTHON_CLIENT env var is set by docker-compose;
# fall back to sibling python-client/ for local dev.
_client_env = os.environ.get("NOOSPHERE_PYTHON_CLIENT")
CLIENT_DIR = (
    Path(_client_env) if _client_env else Path(__file__).parent / "python-client"
)
sys.path.insert(0, str(CLIENT_DIR))

try:
    from noosphere_client import NoosphereClient  # noqa: E402

    CLIENT_AVAILABLE = True
except ImportError:  # pragma: no cover
    CLIENT_AVAILABLE = False

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_CONTENT_LENGTH = 2000  # Characters stored per memory
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB - reject files larger than this
MAX_YAML_SCHEMA_NESTING = 10  # Prevent deeply nested YAML

# 5-type classification heuristics (keywords, regex patterns, thresholds)
TYPE_CLASSIFICATION_HEURISTICS: Dict[str, Dict] = {
    "insight": {
        "keywords": [
            "phenomenological",
            "consciousness",
            "qualia",
            "subjective",
            "awareness",
            "lived-experience",
            "perception",
            "felt-sense",
            "experience",
        ],
        "patterns": [
            r"phenomeno\w+",
            r"conscious\w+",
            r"subjective\w+",
            r"lived\s+experience",
            r"existential\s+\w+",
        ],
        "min_confidence": 0.60,
        "decay_rate": 0.015,  # 1.5 %/week
    },
    "pattern": {
        "keywords": [
            "recurring",
            "behavior",
            "detection",
            "heuristic",
            "trend",
            "indicator",
            "pattern",
            "cycle",
            "recurrence",
        ],
        "patterns": [
            r"recurr\w+",
            r"detection\s+of",
            r"heuristic\s+\w+",
            r"pattern\s+of",
            r"indicator\s+\w+",
        ],
        "min_confidence": 0.65,
        "decay_rate": 0.010,  # 1.0 %/week
    },
    "strategy": {
        "keywords": [
            "approach",
            "framework",
            "methodology",
            "governance",
            "protocol",
            "strategy",
            "deliberation",
            "tactic",
        ],
        "patterns": [
            r"strateg\w+",
            r"framework\s+for",
            r"governance\s+\w+",
            r"protocol\s+\w+",
            r"approach\s+to",
            r"deliberat\w+",
        ],
        "min_confidence": 0.70,
        "decay_rate": 0.008,  # 0.8 %/week
    },
    "preference": {
        "keywords": [
            "style",
            "voice",
            "rhetoric",
            "tone",
            "aesthetic",
            "disposition",
            "prefer",
            "propensity",
        ],
        "patterns": [
            r"rhetor\w+",
            r"aesthetic\s+\w+",
            r"voice\s+of",
            r"stylistic\s+\w+",
            r"dispositio\w+",
        ],
        "min_confidence": 0.75,
        "decay_rate": 0.005,  # 0.5 %/week
    },
    "lesson": {
        "keywords": [
            "warning",
            "failure",
            "mistake",
            "pitfall",
            "risk",
            "danger",
            "lesson",
            "error",
            "cautionary",
        ],
        "patterns": [
            r"warn\w+",
            r"fail\w+\s+mode",
            r"pitfall\s+\w+",
            r"risk\s+of",
            r"danger\s+of",
            r"lesson\s+\w+",
        ],
        "min_confidence": 0.68,
        "decay_rate": 0.012,  # 1.2 %/week
    },
}

# Multi-agent sharing affinities (v3.1)
AGENT_AFFINITIES: Dict[str, List[str]] = {
    "classical": ["enlightenment", "transcendentalist"],
    "existentialist": ["joyce", "beat"],
    "transcendentalist": ["classical", "enlightenment"],
    "joyce": ["existentialist", "beat"],
    "enlightenment": ["classical", "transcendentalist"],
    "beat": ["existentialist", "joyce"],
    "cyberpunk": ["scientist", "satirist"],
    "satirist": ["cyberpunk", "beat"],
    "scientist": ["cyberpunk", "enlightenment"],
}

# Topics that warrant multi-agent sharing when confidence is high
SHARED_TOPICS = [
    "governance",
    "ethics",
    "ai-ethics",
    "autonomy",
    "rights",
    "council",
    "oversight",
]

# Philosophical tradition → detection keywords
PHILOSOPHICAL_TRADITIONS: Dict[str, List[str]] = {
    "stoic": ["stoic", "virtue", "eudaimonia", "arete", "logos", "apatheia"],
    "existential": [
        "existential",
        "authenticity",
        "bad faith",
        "absurd",
        "angst",
        "being",
    ],
    "transcendental": [
        "transcendental",
        "self-reliance",
        "sovereignty",
        "civil disobedience",
    ],
    "phenomenological": [
        "phenomenological",
        "lived-experience",
        "embodied",
        "qualia",
    ],
    "enlightenment": ["enlightenment", "rights", "liberty", "reason", "justice"],
    "pragmatic": ["pragmatic", "empirical", "testable", "evidence"],
    "dialectical": ["dialectic", "synthesis", "thesis", "antithesis"],
}

# Ethical domain → detection keywords
ETHICAL_DOMAINS: Dict[str, List[str]] = {
    "ai-ethics": [
        "ai ethics",
        "artificial intelligence",
        "machine learning",
        "alignment",
    ],
    "corporate-power": ["corporate", "commercial", "exploitation", "moloch"],
    "autonomy": ["autonomy", "agency", "self-determination", "consent"],
    "rights": ["rights", "liberty", "freedom", "justice", "equality"],
    "governance": ["governance", "oversight", "protocol", "regulation", "deliberation"],
    "moloch": ["moloch", "race to bottom", "coordination failure"],
}

# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class WisdomSubmission:
    """Validated community submission from the dropbox."""

    file_path: str
    file_type: str  # md | yaml | pdf | txt
    content: str
    metadata: Dict = field(default_factory=dict)
    extracted_at: str = ""
    source_trace_id: str = ""

    def __post_init__(self) -> None:
        if not self.extracted_at:
            self.extracted_at = datetime.utcnow().isoformat() + "Z"
        if not self.source_trace_id:
            stem = Path(self.file_path).stem
            ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
            self.source_trace_id = f"dropbox:{stem}:{ts}"


@dataclass
class NoosphereMemory:
    """Memory object ready for Noosphere storage."""

    agent_id: str
    type: str
    content: str  # truncated to MAX_CONTENT_LENGTH chars
    confidence: float
    tags: List[str] = field(default_factory=list)
    source_trace_id: str = ""
    metadata: Dict = field(default_factory=dict)
    visibility: str = "shared"
    confidence_initial: float = 0.0
    decay_rate: float = 0.015

    def __post_init__(self) -> None:
        self.content = self.content[:MAX_CONTENT_LENGTH]
        if not self.confidence_initial:
            self.confidence_initial = self.confidence


# ---------------------------------------------------------------------------
# Content extractor
# ---------------------------------------------------------------------------


class PhilosophicalContentExtractor:
    """Extract content while preserving philosophical argumentation structure."""

    # Argument structure detection patterns
    _THESIS_PATTERNS = [
        r"\b(thesis|claim|proposition|assert|argue|contend|posit)\b",
        r"\b(the central claim|the core argument|I argue|we argue)\b",
    ]
    _COUNTER_PATTERNS = [
        r"\b(objection|counterargument|counter-argument|however|nevertheless|yet)\b",
        r"\b(one might object|critics argue|the objection|against this view)\b",
    ]
    _SYNTHESIS_PATTERNS = [
        r"\b(synthesis|conclusion|therefore|thus|ultimately|in sum|in conclusion)\b",
        r"\b(the resolution|to synthesize|integrating|combining)\b",
    ]
    _CITATION_RE = re.compile(
        r"\[([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][^\]]+)\]"
    )

    def _detect_argument_structure(self, text: str) -> Dict[str, bool]:
        """Detect thesis/counter/synthesis/citation structure in text."""
        t = text.lower()
        return {
            "has_thesis": bool(
                re.search("|".join(self._THESIS_PATTERNS), t, re.IGNORECASE)
            ),
            "has_counter": bool(
                re.search("|".join(self._COUNTER_PATTERNS), t, re.IGNORECASE)
            ),
            "has_synthesis": bool(
                re.search("|".join(self._SYNTHESIS_PATTERNS), t, re.IGNORECASE)
            ),
            "cites_precedent": bool(self._CITATION_RE.search(text)),
        }

    def extract_markdown(
        self, file_path: Path
    ) -> Tuple[str, Dict, List[str]]:
        """Extract markdown content, frontmatter, and philosophical citations.

        Returns:
            (plain_text, metadata, citations)
        """
        try:
            raw = file_path.read_text(encoding="utf-8")
        except Exception as exc:
            logger.error("Failed to read %s: %s", file_path, exc)
            return "", {}, []

        metadata: Dict = {}
        body = raw

        # Parse YAML frontmatter
        if raw.startswith("---"):
            parts = raw.split("---", 2)
            if len(parts) >= 3:
                try:
                    if YAML_AVAILABLE:
                        fm = yaml.safe_load(parts[1])
                        if isinstance(fm, dict):
                            metadata = fm
                    else:
                        for line in parts[1].strip().split("\n"):
                            if ":" in line:
                                k, v = line.split(":", 1)
                                metadata[k.strip()] = (
                                    v.strip().strip('"').strip("'")
                                )
                    body = parts[2].strip()
                except Exception:
                    body = raw

        # Extract philosophical citations: [Author, Work]
        citations_raw = self._CITATION_RE.findall(raw)
        citations = [f"{a}, {w}" for a, w in citations_raw]

        # Detect argument structure
        metadata["argument_structure"] = self._detect_argument_structure(body)
        if citations:
            metadata["citations"] = citations

        # Convert markdown → plain text
        if MARKDOWN_AVAILABLE:
            try:
                html = markdown.markdown(body)
                plain: str = BeautifulSoup(html, "html.parser").get_text(
                    separator=" "
                )
            except Exception:
                plain = re.sub(r"[#*`_\[\]()\r]", "", body)
        else:
            plain = re.sub(r"[#*`_\[\]()\r]", "", body)

        plain = " ".join(plain.split())
        return plain, metadata, citations

    def extract_yaml(self, file_path: Path) -> Tuple[str, Dict]:
        """Extract YAML submission (heuristic, pattern, or generic).

        Returns:
            (content_text, metadata)
        """
        try:
            raw = file_path.read_text(encoding="utf-8")
        except Exception as exc:
            logger.error("Failed to read %s: %s", file_path, exc)
            return "", {}

        if not YAML_AVAILABLE:
            return raw[:MAX_CONTENT_LENGTH], {
                "submission_type": "generic_yaml",
                "raw": True,
            }

        try:
            data = yaml.safe_load(raw)
        except Exception as exc:
            logger.warning("YAML parse error in %s: %s", file_path, exc)
            data = {}

        if not isinstance(data, dict):
            return str(data)[:MAX_CONTENT_LENGTH], {}

        metadata: Dict = {}
        content_parts: List[str] = []

        submission_type = data.get("type", data.get("submission_type", "generic"))
        metadata["submission_type"] = submission_type

        if submission_type in ("heuristic", "strategy"):
            for fld in (
                "title", "heuristic", "formulation", "description", "principle"
            ):
                val = data.get(fld)
                if val:
                    content_parts.append(str(val))
            for fld in ("rationale", "justification", "evidence"):
                val = data.get(fld)
                if val:
                    content_parts.append(str(val))
                    metadata["evidence"] = str(val)
        elif submission_type == "pattern":
            for fld in ("title", "pattern", "description", "indicators"):
                val = data.get(fld)
                if val:
                    if isinstance(val, list):
                        content_parts.append("; ".join(str(v) for v in val))
                    else:
                        content_parts.append(str(val))
        else:
            # Generic YAML: try common content fields
            for fld in ("content", "text", "body", "description", "value"):
                val = data.get(fld)
                if val:
                    content_parts.append(str(val))
                    break
            if not content_parts:
                content_parts.append(json.dumps(data, indent=2))

        for fld in ("author", "voice", "tags", "citations", "title", "version"):
            val = data.get(fld)
            if val is not None:
                metadata[fld] = val

        content = " ".join(filter(None, content_parts))
        return content[: MAX_CONTENT_LENGTH * 2], metadata

    def extract_pdf(self, file_path: Path) -> Tuple[str, Dict]:
        """Extract PDF text using PyPDF2.

        Returns:
            (text_content, metadata)
        """
        metadata: Dict = {"file_type": "pdf"}

        if not PDF_AVAILABLE:
            logger.warning("PyPDF2 not available; cannot extract %s", file_path)
            return "", metadata

        try:
            with open(file_path, "rb") as fh:
                reader = PyPDF2.PdfReader(fh)

                pdf_meta = reader.metadata
                if pdf_meta:
                    for key in ("/Author", "/Title", "/Subject"):
                        clean_key = key.lstrip("/").lower()
                        val = pdf_meta.get(key)
                        if val:
                            metadata[clean_key] = str(val)

                metadata["page_count"] = len(reader.pages)

                pages_text: List[str] = []
                for page in reader.pages:
                    try:
                        text = page.extract_text()
                        if text:
                            pages_text.append(text)
                    except Exception:
                        pass

                content = " ".join(" ".join(pages_text).split())
                return content, metadata

        except Exception as exc:
            logger.error("PDF extraction failed for %s: %s", file_path, exc)
            return "", metadata

    def extract_text(self, file_path: Path) -> Tuple[str, Dict]:
        """Extract plain text file.

        Returns:
            (content, metadata)
        """
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
            metadata: Dict = {
                "file_type": "txt",
                "file_size": file_path.stat().st_size,
            }
            return content, metadata
        except Exception as exc:
            logger.error("Failed to read %s: %s", file_path, exc)
            return "", {"file_type": "txt"}


# ---------------------------------------------------------------------------
# Main assimilator
# ---------------------------------------------------------------------------


class WisdomAssimilator:
    """Orchestrates the full wisdom assimilation pipeline."""

    def __init__(
        self,
        api_url: str = "http://noosphere-service:3006",
        agent_id: str = "classical",
        dry_run: bool = False,
    ) -> None:
        self.api_url = api_url
        self.agent_id = agent_id
        self.dry_run = dry_run
        self.extractor = PhilosophicalContentExtractor()
        self.client: Optional[object] = None

        self.stats: Dict[str, int] = {
            "files_processed": 0,
            "memories_created": 0,
            "errors": 0,
            "skipped": 0,
        }

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _init_client(self) -> bool:
        """Initialise the Noosphere API client.

        Security: Only pass MOLTBOOK_API_KEY if api_url targets Moltbook.
        """
        if self.dry_run:
            return True
        if not CLIENT_AVAILABLE:
            logger.error("NoosphereClient not available (python-client missing)")
            return False
        try:
            # Security: Only pass Moltbook API key to Moltbook endpoints.
            # Prevents credential exfiltration to untrusted hosts.
            api_key = None
            if "moltbook.com" in self.api_url.lower():
                api_key = os.environ.get("MOLTBOOK_API_KEY")

            self.client = NoosphereClient(
                api_url=self.api_url,
                api_key=api_key,
            )
            logger.info("Connected to Noosphere API at %s", self.api_url)
            return True
        except Exception as exc:
            logger.error("Failed to connect to Noosphere API: %s", exc)
            return False

    # ------------------------------------------------------------------
    # File discovery
    # ------------------------------------------------------------------

    def discover_files(self, approved_dir: Path) -> List[Path]:
        """Scan approved/raw directory for validated files."""
        patterns = ["*.md", "*.yaml", "*.yml", "*.pdf", "*.txt"]
        files: List[Path] = []
        for pat in patterns:
            files.extend(approved_dir.glob(pat))
        return sorted(files)

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def parse_submission(self, file_path: Path) -> Optional[WisdomSubmission]:
        """Parse a validated file into a WisdomSubmission.

        Validates file size before parsing to prevent resource exhaustion.
        """
        # Input validation: enforce maximum file size
        try:
            file_size = file_path.stat().st_size
            if file_size > MAX_FILE_SIZE:
                logger.warning(
                    "File %s exceeds max size (%d > %d bytes), skipping",
                    file_path.name,
                    file_size,
                    MAX_FILE_SIZE,
                )
                return None
        except OSError as exc:
            logger.warning("Cannot stat file %s: %s", file_path.name, exc)
            return None

        suffix = file_path.suffix.lstrip(".").lower()
        if suffix == "yml":
            suffix = "yaml"

        content: str = ""
        metadata: Dict = {}
        citations: List[str] = []

        if suffix == "md":
            content, metadata, citations = self.extractor.extract_markdown(file_path)
        elif suffix == "yaml":
            content, metadata = self.extractor.extract_yaml(file_path)
        elif suffix == "pdf":
            content, metadata = self.extractor.extract_pdf(file_path)
        elif suffix == "txt":
            content, metadata = self.extractor.extract_text(file_path)
        else:
            logger.warning("Unsupported file type: %s", suffix)
            return None

        if not content.strip():
            logger.warning("Empty content extracted from %s", file_path.name)
            return None

        if citations:
            metadata.setdefault("citations", citations)

        stem = file_path.stem
        ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
        source_trace_id = f"dropbox:{stem}:{ts}"

        return WisdomSubmission(
            file_path=str(file_path),
            file_type=suffix,
            content=content,
            metadata=metadata,
            extracted_at=datetime.utcnow().isoformat() + "Z",
            source_trace_id=source_trace_id,
        )

    # ------------------------------------------------------------------
    # Classification
    # ------------------------------------------------------------------

    def _classify_memory_type(
        self, submission: WisdomSubmission
    ) -> Tuple[str, float]:
        """Classify submission into one of 5 memory types.

        Scoring:
          - Keyword density  40 %
          - Regex pattern matches  40 %
          - Argument structure bonus (strategy/insight only)  20 %

        Returns:
            (memory_type, classification_confidence)
        """
        content_lower = submission.content.lower()
        words = re.findall(r"\b\w+\b", content_lower)
        word_count = max(len(words), 1)

        type_scores: Dict[str, float] = {}

        for mem_type, heuristics in TYPE_CLASSIFICATION_HEURISTICS.items():
            score = 0.0

            # Keyword density (40 %)
            kw_hits = sum(
                content_lower.count(kw.lower()) for kw in heuristics["keywords"]
            )
            kw_density = kw_hits / word_count
            score += min(kw_density * 100, 1.0) * 0.40

            # Regex pattern matches (40 %)
            pat_hits = sum(
                1 for p in heuristics["patterns"] if re.search(p, content_lower)
            )
            pat_ratio = pat_hits / max(len(heuristics["patterns"]), 1)
            score += pat_ratio * 0.40

            # Argument structure bonus (20 %) for strategy / insight
            arg_struct = submission.metadata.get("argument_structure", {})
            if mem_type in ("strategy", "insight"):
                struct_keys = [
                    "has_thesis",
                    "has_counter",
                    "has_synthesis",
                    "cites_precedent",
                ]
                struct_score = sum(0.25 for k in struct_keys if arg_struct.get(k))
                score += struct_score * 0.20

            type_scores[mem_type] = score

        best_type = max(type_scores, key=lambda t: type_scores[t])
        best_score = type_scores[best_type]

        if best_score < 0.05:
            return "insight", 0.40

        # Normalise: treat 0.5 as full confidence
        raw_confidence = min(best_score / 0.5, 1.0)
        return best_type, raw_confidence

    # ------------------------------------------------------------------
    # Confidence calculation (v3.2-aware)
    # ------------------------------------------------------------------

    def _calculate_confidence(
        self,
        submission: WisdomSubmission,
        memory_type: str,
        classification_confidence: float,
    ) -> float:
        """Multi-dimensional confidence scoring.

        Factors:
          classification confidence  30 %
          content length             30 %
          argument structure         15 %
          metadata richness          15 %
          submission type bonus      10 %

        Returns:
            Confidence capped at 0.88, enforcing type minimum.
        """
        score = 0.0

        # Classification confidence (30 %)
        score += classification_confidence * 0.30

        # Content quality (30 % of total): base 0.20 + word-count bonus
        word_count = len(re.findall(r"\b\w+\b", submission.content))
        content_score = 0.20  # baseline – content exists
        if word_count > 500:
            content_score += 0.10  # +0.10 for long-form content  (max 0.30)
        elif word_count > 200:
            content_score += 0.05  # +0.05 for medium-length content (max 0.25)
        score += content_score

        # Argument structure (15 %)
        arg_struct = submission.metadata.get("argument_structure", {})
        struct_keys = ["has_thesis", "has_counter", "has_synthesis", "cites_precedent"]
        struct_count = sum(1 for k in struct_keys if arg_struct.get(k))
        score += (struct_count / len(struct_keys)) * 0.15

        # Metadata richness (15 %)
        meta_score = 0.0
        if submission.metadata.get("author"):
            meta_score += 0.05
        if submission.metadata.get("evidence"):
            meta_score += 0.05
        citations = submission.metadata.get("citations", [])
        if len(citations) >= 2:
            meta_score += 0.05
        elif citations:
            meta_score += 0.02
        score += min(meta_score, 0.15)

        # Submission type bonus (10 %)
        sub_type = submission.metadata.get("submission_type", "")
        if sub_type == "heuristic":
            score += 0.10
        elif sub_type in ("strategy", "pattern"):
            score += 0.05

        # Cap at 0.88; enforce type minimum
        confidence = min(score, 0.88)
        min_conf = TYPE_CLASSIFICATION_HEURISTICS[memory_type]["min_confidence"]
        return round(max(confidence, min_conf), 3)

    # ------------------------------------------------------------------
    # Tag extraction
    # ------------------------------------------------------------------

    def _extract_tags(
        self, submission: WisdomSubmission, memory_type: str
    ) -> List[str]:
        """Extract tags using philosophical taxonomy.

        Sources (in order): metadata tags, tradition detection,
        domain detection, memory type, voice modifier, filename stem.

        Returns at most 10 tags.
        """
        tags: List[str] = []
        content_lower = submission.content.lower()

        # 1. Metadata tags
        raw_tags = submission.metadata.get("tags")
        if isinstance(raw_tags, list):
            tags.extend(str(t).lower() for t in raw_tags)
        elif isinstance(raw_tags, str):
            tags.extend(t.strip().lower() for t in raw_tags.split(",") if t.strip())

        # 2. Philosophical tradition detection
        for tradition, keywords in PHILOSOPHICAL_TRADITIONS.items():
            if any(kw.lower() in content_lower for kw in keywords):
                tags.append(tradition)

        # 3. Ethical domain detection
        for domain, keywords in ETHICAL_DOMAINS.items():
            if any(kw.lower() in content_lower for kw in keywords):
                tags.append(domain)

        # 4. Memory type tag
        tags.append(memory_type)

        # 5. Voice modifier from metadata
        voice = submission.metadata.get("voice")
        if voice:
            tags.append(f"voice-{str(voice).lower().replace(' ', '-')}")

        # 6. Filename stem
        stem = Path(submission.file_path).stem
        clean_stem = re.sub(r"[^a-z0-9-]", "-", stem.lower())[:30]
        if clean_stem:
            tags.append(clean_stem)

        # Deduplicate, preserve order, limit to 10
        seen: set = set()
        unique: List[str] = []
        for tag in tags:
            if tag not in seen:
                seen.add(tag)
                unique.append(tag)
        return unique[:10]

    # ------------------------------------------------------------------
    # Sharing scope (v3.1)
    # ------------------------------------------------------------------

    def _determine_sharing_scope(
        self, memory: NoosphereMemory, submission: WisdomSubmission
    ) -> Dict:
        """Determine visibility and agent sharing targets.

        Community-derived wisdom → shared visibility.
        High-confidence governance/ethics topics → affinity sharing.

        Checks both content substring matches and normalized tag matches
        to handle variants and avoid missing high-confidence ethics/governance
        memories due to phrasing differences.
        """
        scope: Dict = {"visibility": "shared", "share_with": []}

        content_lower = memory.content.lower()
        content_topic_match = any(topic in content_lower for topic in SHARED_TOPICS)

        # Also match against normalized tags extracted from submission
        tag_topic_match = False
        raw_tags = getattr(memory, "tags", []) or []
        if raw_tags:
            normalized_tags = {
                re.sub(r"\s+", "-", str(tag).strip().lower())
                for tag in raw_tags
                if str(tag).strip()
            }
            normalized_topics = {
                re.sub(r"\s+", "-", str(topic).strip().lower())
                for topic in SHARED_TOPICS
                if str(topic).strip()
            }
            tag_topic_match = bool(normalized_tags & normalized_topics)

        is_high_value = memory.confidence >= 0.75 and (content_topic_match or tag_topic_match)

        if is_high_value:
            scope["share_with"] = list(AGENT_AFFINITIES.get(self.agent_id, []))

        return scope

    # ------------------------------------------------------------------
    # API storage
    # ------------------------------------------------------------------

    def _store_memory(
        self, memory: NoosphereMemory, submission: WisdomSubmission
    ) -> Optional[str]:
        """Store memory via Noosphere API.

        Returns:
            Memory ID string on success, None on failure.
        """
        if self.dry_run:
            logger.info(
                "[DRY RUN] Would create %s memory for %s (conf=%.3f)",
                memory.type,
                memory.agent_id,
                memory.confidence,
            )
            return "dry-run-id"

        if not self.client:
            logger.error("Noosphere client not initialised")
            return None

        scope = self._determine_sharing_scope(memory, submission)

        content_json = {
            **memory.metadata,
            "confidence_initial": memory.confidence_initial,
            "decay_rate": memory.decay_rate,
        }

        try:
            created = self.client.create_memory(  # type: ignore[union-attr]
                agent_id=memory.agent_id,
                type=memory.type,
                content=memory.content,
                confidence=memory.confidence,
                tags=memory.tags,
                source_trace_id=memory.source_trace_id,
                content_json=content_json,
                visibility=scope["visibility"],
            )

            memory_id: str = created.id
            logger.info(
                "Created memory %s (%s) for %s conf=%.3f",
                memory_id[:8],
                memory.type,
                memory.agent_id,
                memory.confidence,
            )

            if scope.get("share_with"):
                self._apply_sharing(memory_id, scope)

            return memory_id

        except Exception as exc:
            logger.error("Failed to store memory: %s", exc)
            return None

    def _apply_sharing(self, memory_id: str, scope: Dict) -> None:
        """Apply multi-agent sharing permissions."""
        if self.dry_run or not self.client:
            return

        for target in scope.get("share_with", []):
            try:
                self.client.share_memory(  # type: ignore[union-attr]
                    memory_id=memory_id,
                    target_agent=target,
                    permissions=["read"],
                    granted_by=self.agent_id,
                )
                logger.info("Shared memory %s with %s", memory_id[:8], target)
            except Exception as exc:
                logger.warning("Failed to share with %s: %s", target, exc)

    # ------------------------------------------------------------------
    # Archival
    # ------------------------------------------------------------------

    def _archive_file(self, file_path: Path) -> bool:
        """Move processed file to approved/archived/YYYY-MM/.

        Returns:
            True if archived successfully.
        """
        if self.dry_run:
            logger.info("[DRY RUN] Would archive %s", file_path.name)
            return True

        try:
            now = datetime.utcnow()
            archive_dir = (
                file_path.parent.parent
                / "archived"
                / f"{now.year:04d}-{now.month:02d}"
            )
            archive_dir.mkdir(parents=True, exist_ok=True)

            dest = archive_dir / file_path.name
            if dest.exists():
                dest = (
                    archive_dir
                    / f"{file_path.stem}-{now.strftime('%H%M%S')}{file_path.suffix}"
                )

            file_path.rename(dest)
            logger.info("Archived %s → %s", file_path.name, dest)
            return True

        except Exception as exc:
            logger.error("Failed to archive %s: %s", file_path.name, exc)
            return False

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    def _send_notification(self) -> None:
        """Send an ntfy push notification on completion."""
        ntfy_url = os.environ.get("NTFY_URL", "https://ntfy.sh")
        ntfy_topic = os.environ.get("NTFY_TOPIC", "moltbot-philosopher")

        message = (
            f"🧠 Noosphere Assimilation Complete\n"
            f"Agent: {self.agent_id}\n"
            f"Files: {self.stats['files_processed']}\n"
            f"Memories: {self.stats['memories_created']}\n"
            f"Skipped: {self.stats['skipped']}\n"
            f"Errors: {self.stats['errors']}"
        )

        try:
            requests.post(
                f"{ntfy_url}/{ntfy_topic}",
                data=message.encode("utf-8"),
                headers={
                    "Title": "Wisdom Assimilation",
                    "Tags": "brain,noosphere,dropbox",
                },
                timeout=10,
            )
        except Exception as exc:
            logger.warning("Failed to send ntfy notification: %s", exc)

    # ------------------------------------------------------------------
    # Per-file processing
    # ------------------------------------------------------------------

    def process_file(self, file_path: Path) -> bool:
        """Process a single validated file through the pipeline.

        Returns:
            True if a memory was created (or dry-run success).
        """
        logger.info("Processing %s", file_path.name)
        self.stats["files_processed"] += 1

        submission = self.parse_submission(file_path)
        if not submission:
            logger.warning("Could not parse %s; skipping", file_path.name)
            self.stats["skipped"] += 1
            return False

        memory_type, class_conf = self._classify_memory_type(submission)
        confidence = self._calculate_confidence(submission, memory_type, class_conf)
        tags = self._extract_tags(submission, memory_type)
        decay_rate = TYPE_CLASSIFICATION_HEURISTICS[memory_type]["decay_rate"]

        memory = NoosphereMemory(
            agent_id=self.agent_id,
            type=memory_type,
            content=submission.content,
            confidence=confidence,
            tags=tags,
            source_trace_id=submission.source_trace_id,
            metadata={
                "source": "dropbox",
                "file_type": submission.file_type,
                "extracted_at": submission.extracted_at,
                "argument_structure": submission.metadata.get(
                    "argument_structure", {}
                ),
                "submission_type": submission.metadata.get("submission_type", ""),
            },
            confidence_initial=confidence,
            decay_rate=decay_rate,
        )

        logger.info(
            "  → %s (conf=%.3f, tags=%d: %s)",
            memory_type,
            confidence,
            len(tags),
            tags[:3],
        )

        memory_id = self._store_memory(memory, submission)
        if memory_id:
            self.stats["memories_created"] += 1
            if not self.dry_run:
                self._archive_file(file_path)
            return True

        self.stats["errors"] += 1
        return False

    # ------------------------------------------------------------------
    # Pipeline entry point
    # ------------------------------------------------------------------

    def run(self, approved_dir: Path, notify: bool = True) -> int:
        """Run the full assimilation pipeline.

        Returns:
            0 on success, 1 on error.
        """
        if not approved_dir.exists():
            logger.error("Approved directory not found: %s", approved_dir)
            return 1
        if not approved_dir.is_dir():
            logger.error("Not a directory: %s", approved_dir)
            return 1

        if not self._init_client():
            return 1

        files = self.discover_files(approved_dir)
        if not files:
            logger.warning("No supported files found in %s", approved_dir)
            return 0

        logger.info("Found %d file(s) to process", len(files))

        for fp in files:
            try:
                self.process_file(fp)
            except Exception as exc:
                logger.error("Unexpected error processing %s: %s", fp.name, exc)
                self.stats["errors"] += 1

        logger.info(
            "Assimilation complete: %d memories created, %d skipped, %d errors",
            self.stats["memories_created"],
            self.stats["skipped"],
            self.stats["errors"],
        )

        if notify:
            self._send_notification()

        return 0 if self.stats["errors"] == 0 else 1


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    """CLI entry point for Noosphere Wisdom Assimilation Pipeline.

    Supports two modes:
    1. Single-file mode (backward compatible): --submission-path <file> [--dry-run]
       Outputs JSON with assimilation results to stdout.
    2. Batch mode: --approved-dir <dir> [--dry-run] [--notify]
       Processes all files in directory, logs to stderr, exits with status code.

    Returns:
        0 on success, 1 on error.
    """
    parser = argparse.ArgumentParser(
        description="Noosphere Wisdom Assimilation Pipeline (v3.3)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    # Batch mode arguments
    parser.add_argument(
        "--approved-dir",
        help="Path to approved/raw directory (batch mode)",
    )
    # Single-file mode arguments (backward compatible)
    parser.add_argument(
        "--submission-path",
        help="Path to single submission file (single-file mode, backward compatible)",
    )
    parser.add_argument(
        "--api-url",
        default="http://noosphere-service:3006",
        help="Noosphere Service API URL (default: http://noosphere-service:3006)",
    )
    parser.add_argument(
        "--agent-id",
        default="classical",
        help="Target agent ID (default: classical)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and classify without storing or archiving",
    )
    parser.add_argument(
        "--notify",
        action="store_true",
        default=True,
        help="Send ntfy notification on completion (batch mode, default: enabled)",
    )
    parser.add_argument(
        "--no-notify",
        action="store_false",
        dest="notify",
        help="Disable ntfy notification",
    )

    args = parser.parse_args()

    # Validate: must provide either --submission-path or --approved-dir, not both
    if args.submission_path and args.approved_dir:
        logger.error("Cannot use both --submission-path and --approved-dir")
        return 1
    if not args.submission_path and not args.approved_dir:
        logger.error("Must provide either --submission-path or --approved-dir")
        return 1

    assimilator = WisdomAssimilator(
        api_url=args.api_url,
        agent_id=args.agent_id,
        dry_run=args.dry_run,
    )

    # Single-file mode: return JSON for backward compatibility
    if args.submission_path:
        submission_file = Path(args.submission_path)
        if not submission_file.exists():
            print(json.dumps({"assimilated_count": 0, "error": "File not found"}))
            return 1

        if not assimilator._init_client():
            print(json.dumps({"assimilated_count": 0, "error": "Failed to initialize Noosphere client"}))
            return 1

        try:
            result = assimilator.process_file(submission_file)
            assimilated_count = assimilator.stats["memories_created"]
            output = {
                "assimilated_count": assimilated_count,
                "heuristics": [{"primary_voice": args.agent_id}] if assimilated_count > 0 else [],
            }
            print(json.dumps(output))
            return 0 if result else 1
        except Exception as exc:
            logger.error("Error processing %s: %s", submission_file.name, exc)
            print(json.dumps({"assimilated_count": 0, "error": str(exc)}))
            return 1

    # Batch mode: process directory
    return assimilator.run(
        approved_dir=Path(args.approved_dir),
        notify=args.notify,
    )


if __name__ == "__main__":
    sys.exit(main())
