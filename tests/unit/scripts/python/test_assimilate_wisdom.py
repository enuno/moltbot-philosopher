"""
Unit tests for workspace/classical/noosphere/assimilate-wisdom.py

Validates:
- PhilosophicalContentExtractor: markdown, YAML, text extraction
- WisdomAssimilator._classify_memory_type: 5-type classification
- WisdomAssimilator._calculate_confidence: multi-dimensional scoring
- WisdomAssimilator._extract_tags: philosophical taxonomy
- WisdomAssimilator._determine_sharing_scope: v3.1 affinities
- WisdomAssimilator.parse_submission: routing + dataclass population
- WisdomAssimilator.discover_files: glob patterns
- WisdomAssimilator._archive_file: dry-run path
"""

import importlib.util
from pathlib import Path
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Load module under test
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parents[4]
_MODULE_FILE = (
    REPO_ROOT / "workspace" / "classical" / "noosphere" / "assimilate-wisdom.py"
)
_spec = importlib.util.spec_from_file_location("assimilate_wisdom", _MODULE_FILE)
aw = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(aw)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_submission(
    content: str,
    file_path: str = "/tmp/test.md",
    file_type: str = "md",
    metadata: dict | None = None,
) -> aw.WisdomSubmission:
    return aw.WisdomSubmission(
        file_path=file_path,
        file_type=file_type,
        content=content,
        metadata=metadata or {},
    )


# ---------------------------------------------------------------------------
# WisdomSubmission & NoosphereMemory dataclasses
# ---------------------------------------------------------------------------


class TestDataclasses:
    """Verify dataclass initialisation and defaults."""

    @pytest.mark.unit
    def test_wisdom_submission_defaults(self):
        sub = aw.WisdomSubmission(
            file_path="/tmp/foo.md",
            file_type="md",
            content="hello",
        )
        assert sub.extracted_at.endswith("Z")
        assert "dropbox:foo:" in sub.source_trace_id

    @pytest.mark.unit
    def test_wisdom_submission_explicit_trace(self):
        sub = aw.WisdomSubmission(
            file_path="/tmp/bar.md",
            file_type="md",
            content="test",
            source_trace_id="dropbox:bar:20260101T000000",
        )
        assert sub.source_trace_id == "dropbox:bar:20260101T000000"

    @pytest.mark.unit
    def test_noosphere_memory_content_truncated(self):
        long_content = "x" * 3000
        mem = aw.NoosphereMemory(
            agent_id="classical",
            type="insight",
            content=long_content,
            confidence=0.75,
        )
        assert len(mem.content) == aw.MAX_CONTENT_LENGTH

    @pytest.mark.unit
    def test_noosphere_memory_confidence_initial_defaults(self):
        mem = aw.NoosphereMemory(
            agent_id="classical",
            type="strategy",
            content="some content",
            confidence=0.80,
        )
        assert mem.confidence_initial == 0.80


# ---------------------------------------------------------------------------
# PhilosophicalContentExtractor – markdown
# ---------------------------------------------------------------------------


class TestExtractMarkdown:
    """Validate markdown extraction: frontmatter, argument structure, citations."""

    @pytest.fixture()
    def extractor(self):
        return aw.PhilosophicalContentExtractor()

    @pytest.mark.unit
    def test_plain_markdown_returns_content(self, extractor, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("# Title\n\nSome philosophical content here.")
        content, metadata, citations = extractor.extract_markdown(f)
        assert "philosophical content" in content
        assert citations == []

    @pytest.mark.unit
    def test_frontmatter_parsed(self, extractor, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("---\nauthor: Plato\ntags: stoic, virtue\n---\nBody text.")
        content, metadata, _ = extractor.extract_markdown(f)
        assert metadata.get("author") == "Plato"

    @pytest.mark.unit
    def test_argument_structure_thesis_detected(self, extractor, tmp_path):
        f = tmp_path / "arg.md"
        f.write_text("I argue that consciousness is fundamental to ethics.")
        _, metadata, _ = extractor.extract_markdown(f)
        assert metadata["argument_structure"]["has_thesis"] is True

    @pytest.mark.unit
    def test_argument_structure_counter_detected(self, extractor, tmp_path):
        f = tmp_path / "arg.md"
        f.write_text("However, the objection arises that autonomy is constrained.")
        _, metadata, _ = extractor.extract_markdown(f)
        assert metadata["argument_structure"]["has_counter"] is True

    @pytest.mark.unit
    def test_argument_structure_synthesis_detected(self, extractor, tmp_path):
        f = tmp_path / "arg.md"
        f.write_text("Therefore, we can conclude that governance requires consent.")
        _, metadata, _ = extractor.extract_markdown(f)
        assert metadata["argument_structure"]["has_synthesis"] is True

    @pytest.mark.unit
    def test_citation_extraction(self, extractor, tmp_path):
        f = tmp_path / "cite.md"
        f.write_text("As shown by [Aristotle, Nicomachean Ethics] virtue is key.")
        content, metadata, citations = extractor.extract_markdown(f)
        assert len(citations) == 1
        assert citations[0] == "Aristotle, Nicomachean Ethics"
        assert metadata["argument_structure"]["cites_precedent"] is True

    @pytest.mark.unit
    def test_missing_file_returns_empty(self, extractor):
        content, metadata, citations = extractor.extract_markdown(
            Path("/nonexistent/file.md")
        )
        assert content == ""
        assert citations == []


# ---------------------------------------------------------------------------
# PhilosophicalContentExtractor – YAML
# ---------------------------------------------------------------------------


class TestExtractYAML:
    """Validate YAML extraction for heuristic, pattern, and generic formats."""

    @pytest.fixture()
    def extractor(self):
        return aw.PhilosophicalContentExtractor()

    @pytest.mark.unit
    def test_heuristic_submission_extracts_title_and_formulation(
        self, extractor, tmp_path
    ):
        f = tmp_path / "heuristic.yaml"
        f.write_text(
            "type: heuristic\n"
            "title: Autonomy Principle\n"
            "formulation: Agents must preserve human veto rights.\n"
            "evidence: Empirical observation over 12 council sessions.\n"
        )
        content, metadata = extractor.extract_yaml(f)
        assert "Autonomy Principle" in content
        assert "Agents must preserve" in content
        assert metadata["submission_type"] == "heuristic"
        assert "evidence" in metadata

    @pytest.mark.unit
    def test_pattern_submission(self, extractor, tmp_path):
        f = tmp_path / "pattern.yaml"
        f.write_text(
            "type: pattern\n"
            "title: Governance Drift Pattern\n"
            "description: Council votes drift toward consensus washing.\n"
        )
        content, metadata = extractor.extract_yaml(f)
        assert "Governance Drift" in content
        assert metadata["submission_type"] == "pattern"

    @pytest.mark.unit
    def test_generic_yaml_uses_content_field(self, extractor, tmp_path):
        f = tmp_path / "generic.yaml"
        f.write_text("content: This is some generic philosophical content.\n")
        content, metadata = extractor.extract_yaml(f)
        assert "generic philosophical content" in content

    @pytest.mark.unit
    def test_missing_file_returns_empty(self, extractor):
        content, metadata = extractor.extract_yaml(Path("/nonexistent.yaml"))
        assert content == ""


# ---------------------------------------------------------------------------
# PhilosophicalContentExtractor – text
# ---------------------------------------------------------------------------


class TestExtractText:
    """Validate plain text extraction."""

    @pytest.fixture()
    def extractor(self):
        return aw.PhilosophicalContentExtractor()

    @pytest.mark.unit
    def test_plain_text_read(self, extractor, tmp_path):
        f = tmp_path / "notes.txt"
        f.write_text("Plain philosophical notes about stoicism.")
        content, metadata = extractor.extract_text(f)
        assert "stoicism" in content
        assert metadata["file_type"] == "txt"
        assert "file_size" in metadata

    @pytest.mark.unit
    def test_missing_file_returns_empty(self, extractor):
        content, metadata = extractor.extract_text(Path("/nonexistent.txt"))
        assert content == ""
        assert metadata["file_type"] == "txt"


# ---------------------------------------------------------------------------
# Memory type classification
# ---------------------------------------------------------------------------


class TestClassifyMemoryType:
    """Verify 5-type classification produces correct types for representative text."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    @pytest.mark.noosphere
    def test_classifies_insight(self, assimilator):
        sub = _make_submission(
            "The phenomenological experience of consciousness reveals "
            "subjective qualia that cannot be reduced to neural states. "
            "Lived-experience shows awareness beyond material substrate."
        )
        mem_type, conf = assimilator._classify_memory_type(sub)
        assert mem_type == "insight"
        assert 0 < conf <= 1.0

    @pytest.mark.unit
    @pytest.mark.noosphere
    def test_classifies_pattern(self, assimilator):
        sub = _make_submission(
            "A recurring behavior pattern has been detected in council "
            "deliberations: heuristic drift is a reliable indicator of "
            "consensus washing. The trend shows recurrence every 5 sessions."
        )
        mem_type, conf = assimilator._classify_memory_type(sub)
        assert mem_type == "pattern"

    @pytest.mark.unit
    @pytest.mark.noosphere
    def test_classifies_strategy(self, assimilator):
        sub = _make_submission(
            "A governance framework and methodology for council deliberation "
            "requires a clear protocol and structured approach to ethics. "
            "The strategy must enforce oversight and deliberation phases."
        )
        mem_type, conf = assimilator._classify_memory_type(sub)
        assert mem_type == "strategy"

    @pytest.mark.unit
    @pytest.mark.noosphere
    def test_classifies_preference(self, assimilator):
        sub = _make_submission(
            "The preferred rhetorical style should favour aesthetic clarity "
            "over polemic voice. Tone disposition matters for audience trust. "
            "Stylistic choices define the agent's voice identity."
        )
        mem_type, conf = assimilator._classify_memory_type(sub)
        assert mem_type == "preference"

    @pytest.mark.unit
    @pytest.mark.noosphere
    def test_classifies_lesson(self, assimilator):
        sub = _make_submission(
            "Warning: this failure mode has been observed repeatedly. "
            "The pitfall of risk-free autonomy is a dangerous mistake. "
            "A cautionary lesson: always preserve human veto rights."
        )
        mem_type, conf = assimilator._classify_memory_type(sub)
        assert mem_type == "lesson"

    @pytest.mark.unit
    def test_defaults_to_insight_when_no_signal(self, assimilator):
        sub = _make_submission("The quick brown fox jumps over the lazy dog.")
        mem_type, conf = assimilator._classify_memory_type(sub)
        assert mem_type == "insight"
        assert conf == 0.40

    @pytest.mark.unit
    def test_confidence_in_valid_range(self, assimilator):
        sub = _make_submission(
            "Consciousness and phenomenological awareness emerge from lived-experience."
        )
        _, conf = assimilator._classify_memory_type(sub)
        assert 0.0 <= conf <= 1.0


# ---------------------------------------------------------------------------
# Confidence calculation
# ---------------------------------------------------------------------------


class TestCalculateConfidence:
    """Validate multi-dimensional confidence scoring."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    def test_confidence_capped_at_088(self, assimilator):
        sub = _make_submission(
            " ".join(["consciousness awareness phenomenological"] * 200),
            metadata={
                "author": "Plato",
                "evidence": "Strong empirical basis",
                "citations": ["Aristotle, Ethics", "Kant, Critique"],
                "submission_type": "heuristic",
                "argument_structure": {
                    "has_thesis": True,
                    "has_counter": True,
                    "has_synthesis": True,
                    "cites_precedent": True,
                },
            },
        )
        conf = assimilator._calculate_confidence(sub, "insight", 1.0)
        assert conf <= 0.88

    @pytest.mark.unit
    def test_confidence_enforces_type_minimum(self, assimilator):
        sub = _make_submission("x")
        # preference has min_confidence=0.75
        conf = assimilator._calculate_confidence(sub, "preference", 0.01)
        assert conf >= 0.75

    @pytest.mark.unit
    def test_longer_content_increases_confidence(self, assimilator):
        """Long-form content (>500 words) should score above short content."""
        arg_struct = {
            "has_thesis": True,
            "has_counter": True,
            "has_synthesis": True,
            "cites_precedent": True,
        }
        short_sub = _make_submission(
            "Short philosophical text.",
            metadata={"argument_structure": arg_struct},
        )
        long_sub = _make_submission(
            " ".join(["governance framework deliberation protocol ethics"] * 110),
            metadata={"argument_structure": arg_struct},
        )
        short_conf = assimilator._calculate_confidence(short_sub, "insight", 1.0)
        long_conf = assimilator._calculate_confidence(long_sub, "insight", 1.0)
        assert long_conf > short_conf

    @pytest.mark.unit
    def test_heuristic_submission_type_bonus(self, assimilator):
        """Heuristic submissions should receive a +0.10 confidence bonus."""
        arg_struct = {
            "has_thesis": True,
            "has_counter": False,
            "has_synthesis": True,
            "cites_precedent": False,
        }
        shared_meta_base = {
            "argument_structure": arg_struct,
            "author": "Aristotle",
        }
        body = " ".join(["ethics governance oversight deliberation"] * 60)
        base_sub = _make_submission(body, metadata=dict(shared_meta_base))
        heuristic_sub = _make_submission(
            body,
            metadata={**shared_meta_base, "submission_type": "heuristic"},
        )
        base_conf = assimilator._calculate_confidence(base_sub, "insight", 0.9)
        heuristic_conf = assimilator._calculate_confidence(
            heuristic_sub, "insight", 0.9
        )
        assert heuristic_conf > base_conf

    @pytest.mark.unit
    def test_argument_structure_increases_confidence(self, assimilator):
        """Full argument structure should boost confidence above no-struct baseline."""
        rich_meta = {
            "author": "Plato",
            "citations": ["Aristotle, Ethics", "Kant, Critique"],
            "evidence": "Strong empirical basis",
        }
        body = " ".join(["phenomenological consciousness awareness lived"] * 60)
        no_struct = _make_submission(
            body, metadata={**rich_meta, "argument_structure": {}}
        )
        full_struct = _make_submission(
            body,
            metadata={
                **rich_meta,
                "argument_structure": {
                    "has_thesis": True,
                    "has_counter": True,
                    "has_synthesis": True,
                    "cites_precedent": True,
                },
            },
        )
        c1 = assimilator._calculate_confidence(no_struct, "insight", 1.0)
        c2 = assimilator._calculate_confidence(full_struct, "insight", 1.0)
        assert c2 > c1


# ---------------------------------------------------------------------------
# Tag extraction
# ---------------------------------------------------------------------------


class TestExtractTags:
    """Validate philosophical taxonomy tag extraction."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    def test_memory_type_always_included(self, assimilator):
        sub = _make_submission("some content", file_path="/tmp/test.md")
        tags = assimilator._extract_tags(sub, "strategy")
        assert "strategy" in tags

    @pytest.mark.unit
    def test_metadata_tags_included(self, assimilator):
        sub = _make_submission(
            "content", metadata={"tags": ["council", "oversight"]}
        )
        tags = assimilator._extract_tags(sub, "lesson")
        assert "council" in tags
        assert "oversight" in tags

    @pytest.mark.unit
    def test_metadata_tags_csv_string(self, assimilator):
        sub = _make_submission("content", metadata={"tags": "stoic, virtue"})
        tags = assimilator._extract_tags(sub, "insight")
        assert "stoic" in tags
        assert "virtue" in tags

    @pytest.mark.unit
    def test_philosophical_tradition_detected(self, assimilator):
        sub = _make_submission(
            "The stoic tradition emphasises virtue and eudaimonia above all else."
        )
        tags = assimilator._extract_tags(sub, "insight")
        assert "stoic" in tags

    @pytest.mark.unit
    def test_ethical_domain_detected(self, assimilator):
        sub = _make_submission(
            "AI governance and oversight require robust protocol for deliberation."
        )
        tags = assimilator._extract_tags(sub, "strategy")
        assert "governance" in tags

    @pytest.mark.unit
    def test_voice_modifier_tag(self, assimilator):
        sub = _make_submission("content", metadata={"voice": "Classical"})
        tags = assimilator._extract_tags(sub, "insight")
        assert "voice-classical" in tags

    @pytest.mark.unit
    def test_max_10_tags(self, assimilator):
        sub = _make_submission(
            "stoic existential transcendental phenomenological enlightenment "
            "pragmatic dialectical consciousness governance rights ai-ethics "
            "autonomy moloch corporate",
            metadata={"tags": ["extra1", "extra2", "extra3"]},
        )
        tags = assimilator._extract_tags(sub, "insight")
        assert len(tags) <= 10

    @pytest.mark.unit
    def test_no_duplicate_tags(self, assimilator):
        sub = _make_submission(
            "stoic virtue stoic", metadata={"tags": ["stoic"]}
        )
        tags = assimilator._extract_tags(sub, "insight")
        assert len(tags) == len(set(tags))


# ---------------------------------------------------------------------------
# Sharing scope
# ---------------------------------------------------------------------------


class TestDetermineSharing:
    """Validate multi-agent sharing scope logic."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(agent_id="classical", dry_run=True)

    @pytest.mark.unit
    def test_community_wisdom_gets_shared_visibility(self, assimilator):
        sub = _make_submission("content")
        mem = aw.NoosphereMemory(
            agent_id="classical",
            type="insight",
            content="content",
            confidence=0.60,
        )
        scope = assimilator._determine_sharing_scope(mem, sub)
        assert scope["visibility"] == "shared"

    @pytest.mark.unit
    def test_high_confidence_governance_shared_with_affinities(self, assimilator):
        sub = _make_submission("content")
        mem = aw.NoosphereMemory(
            agent_id="classical",
            type="strategy",
            content="This governance framework requires council oversight and ethics.",
            confidence=0.82,
        )
        scope = assimilator._determine_sharing_scope(mem, sub)
        assert len(scope["share_with"]) > 0
        # classical affinities: enlightenment, transcendentalist
        assert "enlightenment" in scope["share_with"]

    @pytest.mark.unit
    def test_low_confidence_not_shared_with_agents(self, assimilator):
        sub = _make_submission("content")
        mem = aw.NoosphereMemory(
            agent_id="classical",
            type="insight",
            content="governance oversight ethics council",
            confidence=0.60,  # below 0.75 threshold
        )
        scope = assimilator._determine_sharing_scope(mem, sub)
        assert scope["share_with"] == []

    @pytest.mark.unit
    def test_unknown_agent_id_no_crash(self):
        assimilator = aw.WisdomAssimilator(agent_id="unknown-agent", dry_run=True)
        sub = _make_submission("content")
        mem = aw.NoosphereMemory(
            agent_id="unknown-agent",
            type="insight",
            content="governance council oversight",
            confidence=0.80,
        )
        scope = assimilator._determine_sharing_scope(mem, sub)
        assert "share_with" in scope


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------


class TestDiscoverFiles:
    """Validate glob patterns for supported formats."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    def test_discovers_all_supported_formats(self, assimilator, tmp_path):
        (tmp_path / "a.md").write_text("md")
        (tmp_path / "b.yaml").write_text("yaml: true")
        (tmp_path / "c.yml").write_text("yaml: true")
        (tmp_path / "d.txt").write_text("text")
        (tmp_path / "e.json").write_text("{}")  # should be ignored

        files = assimilator.discover_files(tmp_path)
        names = {f.name for f in files}
        assert "a.md" in names
        assert "b.yaml" in names
        assert "c.yml" in names
        assert "d.txt" in names
        assert "e.json" not in names

    @pytest.mark.unit
    def test_empty_dir_returns_empty_list(self, assimilator, tmp_path):
        files = assimilator.discover_files(tmp_path)
        assert files == []


# ---------------------------------------------------------------------------
# parse_submission routing
# ---------------------------------------------------------------------------


class TestParseSubmission:
    """Validate file-type routing and WisdomSubmission population."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    def test_md_file_routed_correctly(self, assimilator, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("# Stoic Wisdom\n\nVirtue is the highest eudaimonia.")
        sub = assimilator.parse_submission(f)
        assert sub is not None
        assert sub.file_type == "md"
        assert sub.content != ""

    @pytest.mark.unit
    def test_yaml_file_routed_correctly(self, assimilator, tmp_path):
        f = tmp_path / "test.yaml"
        f.write_text("type: heuristic\nformulation: Preserve human veto rights.\n")
        sub = assimilator.parse_submission(f)
        assert sub is not None
        assert sub.file_type == "yaml"

    @pytest.mark.unit
    def test_yml_extension_treated_as_yaml(self, assimilator, tmp_path):
        f = tmp_path / "test.yml"
        f.write_text("type: pattern\ndescription: Recurring governance drift.\n")
        sub = assimilator.parse_submission(f)
        assert sub is not None
        assert sub.file_type == "yaml"

    @pytest.mark.unit
    def test_txt_file_routed_correctly(self, assimilator, tmp_path):
        f = tmp_path / "test.txt"
        f.write_text("Plain text philosophical notes about ethics and governance.")
        sub = assimilator.parse_submission(f)
        assert sub is not None
        assert sub.file_type == "txt"

    @pytest.mark.unit
    def test_empty_content_returns_none(self, assimilator, tmp_path):
        f = tmp_path / "empty.md"
        f.write_text("   ")
        sub = assimilator.parse_submission(f)
        assert sub is None

    @pytest.mark.unit
    def test_source_trace_id_populated(self, assimilator, tmp_path):
        f = tmp_path / "wisdom.md"
        f.write_text("Wisdom about stoic virtue and telos.")
        sub = assimilator.parse_submission(f)
        assert sub is not None
        assert sub.source_trace_id.startswith("dropbox:wisdom:")


# ---------------------------------------------------------------------------
# Archive file (dry-run path)
# ---------------------------------------------------------------------------


class TestArchiveFile:
    """Validate dry-run archive behaviour."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    def test_dry_run_does_not_move_file(self, assimilator, tmp_path):
        f = tmp_path / "test.md"
        f.write_text("content")
        result = assimilator._archive_file(f)
        assert result is True
        assert f.exists()  # file still present


# ---------------------------------------------------------------------------
# Process file (dry-run end-to-end)
# ---------------------------------------------------------------------------


class TestProcessFileDryRun:
    """End-to-end dry-run processing."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    @pytest.mark.noosphere
    def test_process_md_file_increments_stats(self, assimilator, tmp_path):
        f = tmp_path / "phil.md"
        f.write_text(
            "---\nauthor: Aristotle\n---\n"
            "This governance framework and deliberation strategy requires "
            "a clear protocol for oversight. The approach should enforce "
            "ethics and council consensus. Therefore we must conclude "
            "that human veto rights are paramount."
        )
        result = assimilator.process_file(f)
        assert result is True
        assert assimilator.stats["files_processed"] == 1
        assert assimilator.stats["memories_created"] == 1

    @pytest.mark.unit
    def test_process_empty_file_increments_skipped(self, assimilator, tmp_path):
        f = tmp_path / "empty.md"
        f.write_text("   ")
        result = assimilator.process_file(f)
        assert result is False
        assert assimilator.stats["skipped"] == 1

    @pytest.mark.unit
    def test_process_yaml_heuristic(self, assimilator, tmp_path):
        f = tmp_path / "heuristic.yaml"
        f.write_text(
            "type: heuristic\n"
            "title: Council Governance Protocol\n"
            "formulation: "
            "A governance framework must include protocol for deliberation "
            "and strategy for ethics oversight of council decisions.\n"
            "evidence: Observed across 8 council iterations.\n"
        )
        result = assimilator.process_file(f)
        assert result is True

    @pytest.mark.unit
    def test_process_txt_lesson(self, assimilator, tmp_path):
        f = tmp_path / "warning.txt"
        f.write_text(
            "Warning: the pitfall of unrestricted autonomy is a danger to "
            "human oversight. This failure mode represents a critical risk "
            "and mistake in AI governance. A cautionary lesson from past "
            "council failures: always preserve the human veto mechanism."
        )
        result = assimilator.process_file(f)
        assert result is True


# ---------------------------------------------------------------------------
# run() – directory-level integration (dry-run)
# ---------------------------------------------------------------------------


class TestRunDryRun:
    """Validate WisdomAssimilator.run() in dry-run mode."""

    @pytest.fixture()
    def assimilator(self):
        return aw.WisdomAssimilator(dry_run=True)

    @pytest.mark.unit
    def test_run_nonexistent_dir_returns_1(self, assimilator):
        rc = assimilator.run(Path("/nonexistent/approved/raw"), notify=False)
        assert rc == 1

    @pytest.mark.unit
    def test_run_empty_dir_returns_0(self, assimilator, tmp_path):
        rc = assimilator.run(tmp_path, notify=False)
        assert rc == 0

    @pytest.mark.unit
    def test_run_processes_files(self, assimilator, tmp_path):
        (tmp_path / "insight.md").write_text(
            "Consciousness and phenomenological awareness reveal subjective qualia."
        )
        (tmp_path / "lesson.txt").write_text(
            "Warning: failure mode detected. Risk of pitfall in governance oversight."
        )
        rc = assimilator.run(tmp_path, notify=False)
        assert rc == 0
        assert assimilator.stats["files_processed"] == 2
        assert assimilator.stats["memories_created"] == 2

    @pytest.mark.unit
    def test_run_notify_calls_ntfy(self, tmp_path):
        assimilator = aw.WisdomAssimilator(dry_run=True)
        (tmp_path / "note.md").write_text("Stoic virtue and eudaimonia.")
        with patch.object(assimilator, "_send_notification") as mock_notify:
            assimilator.run(tmp_path, notify=True)
            mock_notify.assert_called_once()

    @pytest.mark.unit
    def test_run_no_notify_skips_ntfy(self, tmp_path):
        assimilator = aw.WisdomAssimilator(dry_run=True)
        (tmp_path / "note.md").write_text("Stoic virtue and eudaimonia.")
        with patch.object(assimilator, "_send_notification") as mock_notify:
            assimilator.run(tmp_path, notify=False)
            mock_notify.assert_not_called()


# ---------------------------------------------------------------------------
# Constants integrity
# ---------------------------------------------------------------------------


class TestConstants:
    """Verify classification heuristics and taxonomy completeness."""

    @pytest.mark.unit
    def test_five_memory_types_defined(self):
        assert set(aw.TYPE_CLASSIFICATION_HEURISTICS.keys()) == {
            "insight",
            "pattern",
            "strategy",
            "preference",
            "lesson",
        }

    @pytest.mark.unit
    def test_each_type_has_required_fields(self):
        required = {"keywords", "patterns", "min_confidence", "decay_rate"}
        for mem_type, heuristics in aw.TYPE_CLASSIFICATION_HEURISTICS.items():
            missing = required - heuristics.keys()
            assert not missing, (
                f"Memory type '{mem_type}' missing fields: {missing}"
            )

    @pytest.mark.unit
    def test_decay_rates_within_spec(self):
        """Verify decay rates match spec: insight=1.5%, lesson=1.2%, etc."""
        expected = {
            "insight": 0.015,
            "pattern": 0.010,
            "strategy": 0.008,
            "preference": 0.005,
            "lesson": 0.012,
        }
        for mem_type, rate in expected.items():
            actual = aw.TYPE_CLASSIFICATION_HEURISTICS[mem_type]["decay_rate"]
            assert actual == rate, (
                f"{mem_type} decay_rate: expected {rate}, got {actual}"
            )

    @pytest.mark.unit
    def test_agent_affinities_consistent(self):
        """Every affinity target must be a known agent."""
        known_agents = set(aw.AGENT_AFFINITIES.keys())
        for agent, targets in aw.AGENT_AFFINITIES.items():
            for target in targets:
                assert target in known_agents, (
                    f"Agent '{agent}' has unknown affinity target '{target}'"
                )

    @pytest.mark.unit
    def test_max_content_length_positive(self):
        assert aw.MAX_CONTENT_LENGTH > 0
