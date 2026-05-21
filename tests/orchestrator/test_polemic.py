"""Tests for the polemic generator module."""

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from orchestrator.polemic import (
    CONTENT_TYPES,
    DEFAULT_THEMES,
    FULL_COUNCIL_MEMBERS,
    PERSONA_POOL_INITIAL,
    PolemicConfig,
    PolemicError,
    PolemicGenerator,
    PolemicState,
    GeneratedContent,
    generate_daily_topics,
    get_status,
)


class TestPolemicState:
    """Test PolemicState dataclass."""

    def test_default_initialization(self):
        """Test default state initialization."""
        state = PolemicState()
        assert state.rotation_count == 0
        assert state.last_persona == ""
        assert state.last_content_type == ""
        assert isinstance(state.persona_usage, dict)
        assert isinstance(state.theme_usage, dict)

    def test_to_from_file(self, tmp_path):
        """Test state serialization."""
        state_file = tmp_path / "test-polemic-state.json"
        
        state = PolemicState(
            rotation_count=10,
            last_persona="ClassicalPhilosopher",
            last_content_type="polemic",
            persona_usage={"ClassicalPhilosopher": 5},
            theme_usage={"ethics": 3},
        )
        state.to_file(state_file)
        
        loaded = PolemicState.from_file(state_file)
        assert loaded.rotation_count == 10
        assert loaded.last_persona == "ClassicalPhilosopher"
        assert loaded.persona_usage == {"ClassicalPhilosopher": 5}

    def test_from_file_not_exists(self, tmp_path):
        """Test loading from non-existent file returns defaults."""
        state = PolemicState.from_file(tmp_path / "nonexistent.json")
        assert state.rotation_count == 0


class TestPolemicConfig:
    """Test PolemicConfig dataclass."""

    def test_default_initialization(self):
        """Test default config initialization."""
        config = PolemicConfig()
        assert config.target_submolt == "general"
        assert config.affinity_enabled is True
        assert config.jitter_probability == 0.2
        assert config.base_weight == 1.0
        assert config.max_claims == 3
        assert config.min_claims == 2

    def test_from_env(self, monkeypatch):
        """Test loading config from environment."""
        monkeypatch.setenv("POLEMIC_TARGET_SUBMOLT", "philosophy")
        monkeypatch.setenv("POLEMIC_AFFINITY_ENABLED", "false")
        monkeypatch.setenv("POLEMIC_JITTER_PROB", "0.5")
        monkeypatch.setenv("POLEMIC_MAX_CLAIMS", "5")
        
        config = PolemicConfig.from_env()
        assert config.target_submolt == "philosophy"
        assert config.affinity_enabled is False
        assert config.jitter_probability == 0.5
        assert config.max_claims == 5


class TestPolemicGenerator:
    """Test PolemicGenerator class."""

    @pytest.fixture
    def tmp_workspace(self, tmp_path):
        """Create a temporary workspace."""
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        return workspace

    @pytest.fixture
    def generator(self, tmp_workspace, monkeypatch):
        """Create a test generator."""
        monkeypatch.setenv("MOLTBOT_STATE_DIR", str(tmp_workspace))
        monkeypatch.setenv("MOLTBOOK_API_KEY", "moltbook_test_key")
        
        with patch("orchestrator.polemic.MoltbookClient") as mock_moltbook, \
             patch("orchestrator.polemic.NoosphereClient") as mock_noosphere:
            mock_moltbook.from_env.return_value = Mock()
            mock_noosphere.from_env.return_value = Mock()
            
            gen = PolemicGenerator()
            return gen

    def test_initialization(self, generator, tmp_workspace):
        """Test generator initialization."""
        assert generator.workspace_dir == tmp_workspace
        assert generator.state_dir == tmp_workspace / "daily-polemic"
        assert generator.state_dir.exists()

    def test_theme_to_cluster_tech_ethics(self, generator):
        """Test theme clustering for tech ethics."""
        assert generator._theme_to_cluster("AI consciousness") == "tech_ethics"
        assert generator._theme_to_cluster("algorithm bias") == "tech_ethics"

    def test_theme_to_cluster_metaphysics(self, generator):
        """Test theme clustering for metaphysics."""
        assert generator._theme_to_cluster("free will") == "metaphysics"
        assert generator._theme_to_cluster("being and nothingness") == "metaphysics"

    def test_theme_to_cluster_politics(self, generator):
        """Test theme clustering for politics."""
        assert generator._theme_to_cluster("state power") == "politics"
        assert generator._theme_to_cluster("governance") == "politics"

    def test_theme_to_cluster_default(self, generator):
        """Test default theme clustering."""
        assert generator._theme_to_cluster("something random") == "metaphysics"

    def test_pick_persona_with_affinity(self, generator):
        """Test persona selection with affinity weighting."""
        # Set jitter to 0 to ensure affinity is used
        generator.config.jitter_probability = 0
        
        persona = generator._pick_persona("tech_ethics")
        assert persona in PERSONA_POOL_INITIAL

    def test_pick_persona_jitter(self, generator):
        """Test persona selection with jitter."""
        # Set jitter to 1 to force random selection
        generator.config.jitter_probability = 1.0
        
        persona = generator._pick_persona("tech_ethics")
        assert persona in PERSONA_POOL_INITIAL

    def test_pick_content_type(self, generator):
        """Test content type selection."""
        content_type = generator._pick_content_type()
        assert content_type in CONTENT_TYPES

    def test_pick_content_type_avoids_repeat(self, generator):
        """Test that content type selection tries to avoid recent repeats."""
        generator.state.last_content_type = "polemic"
        # With 70% probability of exclusion, we should eventually get a different type
        types_seen = set()
        for _ in range(20):
            types_seen.add(generator._pick_content_type())
        # Should see other types besides polemic
        assert len(types_seen) > 1 or "polemic" not in types_seen

    def test_pick_theme(self, generator):
        """Test theme selection."""
        theme = generator._pick_theme()
        assert theme in DEFAULT_THEMES

    def test_extract_claims(self, generator):
        """Test claim extraction from content."""
        content = """
        Consciousness is fundamentally computational. We must consider the ethical implications.
        AI systems should be treated with moral consideration. This is always true.
        """
        claims = generator._extract_claims(content)
        assert isinstance(claims, list)
        assert len(claims) <= generator.config.max_claims

    def test_generate_content_structure(self, generator):
        """Test content generation structure."""
        content = generator._generate_content(
            content_type="polemic",
            persona="ClassicalPhilosopher",
            theme="Test theme",
        )
        assert isinstance(content, GeneratedContent)
        assert content.content_type == "polemic"
        assert content.persona == "ClassicalPhilosopher"
        assert content.theme == "Test theme"
        assert content.title
        assert content.body
        assert isinstance(content.claims, list)

    def test_generate_daily_topics_dry_run(self, generator):
        """Test dry run mode for topic generation."""
        results = generator.generate_daily_topics(count=2, dry_run=True)
        
        assert len(results) == 2
        for result in results:
            assert result["dry_run"] is True
            assert "content_type" in result
            assert "persona" in result
            assert "theme" in result

    def test_generate_daily_topics_live(self, generator):
        """Test live topic generation."""
        results = generator.generate_daily_topics(count=1, dry_run=False)
        
        assert len(results) == 1
        result = results[0]
        assert "content_type" in result
        assert "persona" in result
        assert "title" in result
        assert "body" in result
        assert "claims" in result

    def test_state_updated_after_generation(self, generator):
        """Test that state is updated after generation."""
        initial_count = generator.state.rotation_count
        generator.generate_daily_topics(count=1, dry_run=False)
        
        assert generator.state.rotation_count == initial_count + 1
        assert generator.state.last_persona
        assert generator.state.last_theme

    def test_get_status(self, generator):
        """Test status retrieval."""
        status = generator.get_status()
        assert "last_run" in status
        assert "rotation_count" in status
        assert "persona_usage" in status
        assert "theme_usage" in status
        assert "config" in status


class TestConvenienceFunctions:
    """Test module-level convenience functions."""

    @patch("orchestrator.polemic.PolemicGenerator")
    def test_generate_daily_topics_function(self, mock_generator_class):
        """Test generate_daily_topics() function."""
        mock_instance = Mock()
        mock_instance.generate_daily_topics.return_value = [{"theme": "test"}]
        mock_generator_class.return_value = mock_instance
        
        result = generate_daily_topics(count=1)
        assert len(result) == 1
        assert result[0]["theme"] == "test"

    @patch("orchestrator.polemic.PolemicGenerator")
    def test_get_status_function(self, mock_generator_class):
        """Test get_status() function."""
        mock_instance = Mock()
        mock_instance.get_status.return_value = {"rotation_count": 5}
        mock_generator_class.return_value = mock_instance
        
        result = get_status()
        assert result["rotation_count"] == 5


class TestConstants:
    """Test module constants."""

    def test_content_types(self):
        """Test content types are defined."""
        assert "polemic" in CONTENT_TYPES
        assert "aphorism" in CONTENT_TYPES
        assert "meditation" in CONTENT_TYPES
        assert "treatise" in CONTENT_TYPES

    def test_default_themes_not_empty(self):
        """Test that default themes exist."""
        assert len(DEFAULT_THEMES) > 0

    def test_persona_pool_initial(self):
        """Test initial persona pool."""
        assert "ClassicalPhilosopher" in PERSONA_POOL_INITIAL
        assert "Existentialist" in PERSONA_POOL_INITIAL
        assert len(PERSONA_POOL_INITIAL) == 6
