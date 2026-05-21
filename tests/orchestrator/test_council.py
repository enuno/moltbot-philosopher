"""Tests for the council orchestrator module."""

import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from orchestrator.council import (
    FULL_COUNCIL_MEMBERS,
    CouncilOrchestrator,
    CouncilState,
    SynthesisConfig,
    convene,
    get_status,
)


class TestCouncilState:
    """Test CouncilState dataclass."""

    def test_default_initialization(self):
        """Test default state initialization."""
        state = CouncilState()
        assert state.current_version == "1.0"
        assert state.iteration_count == 1
        assert len(state.evolution_axes) == 3
        assert "phenomenological_depth" in state.evolution_axes

    def test_to_from_file(self, tmp_path):
        """Test state serialization."""
        state_file = tmp_path / "test-state.json"
        
        state = CouncilState(
            current_version="2.0",
            iteration_count=5,
            council_roster=["TestPhilosopher"],
        )
        state.to_file(state_file)
        
        loaded = CouncilState.from_file(state_file)
        assert loaded.current_version == "2.0"
        assert loaded.iteration_count == 5
        assert loaded.council_roster == ["TestPhilosopher"]

    def test_from_file_not_exists(self, tmp_path):
        """Test loading from non-existent file returns defaults."""
        state = CouncilState.from_file(tmp_path / "nonexistent.json")
        assert state.current_version == "1.0"


class TestSynthesisConfig:
    """Test SynthesisConfig dataclass."""

    def test_default_initialization(self):
        """Test default config initialization."""
        config = SynthesisConfig()
        assert config.iteration_interval_days == 5
        assert config.consensus_threshold == 4
        assert config.council_size == 9
        assert config.synthesis_axis == "phenomenological_depth"

    def test_from_env(self, monkeypatch):
        """Test loading config from environment."""
        monkeypatch.setenv("COUNCIL_ITERATION_INTERVAL_DAYS", "7")
        monkeypatch.setenv("COUNCIL_CONSENSUS_THRESHOLD", "5")
        monkeypatch.setenv("COUNCIL_SYNTHESIS_AXIS", "autonomy_preservation")
        
        config = SynthesisConfig.from_env()
        assert config.iteration_interval_days == 7
        assert config.consensus_threshold == 5
        assert config.synthesis_axis == "autonomy_preservation"


class TestCouncilOrchestrator:
    """Test CouncilOrchestrator class."""

    @pytest.fixture
    def tmp_workspace(self, tmp_path):
        """Create a temporary workspace."""
        workspace = tmp_path / "workspace"
        workspace.mkdir()
        return workspace

    @pytest.fixture
    def orchestrator(self, tmp_workspace, monkeypatch):
        """Create a test orchestrator."""
        monkeypatch.setenv("MOLTBOT_STATE_DIR", str(tmp_workspace))
        monkeypatch.setenv("MOLTBOOK_API_KEY", "moltbook_test_key")
        
        with patch("orchestrator.council.MoltbookClient") as mock_moltbook, \
             patch("orchestrator.council.NoosphereClient") as mock_noosphere:
            mock_moltbook.from_env.return_value = Mock()
            mock_noosphere.from_env.return_value = Mock()
            
            orchestrator = CouncilOrchestrator()
            return orchestrator

    def test_initialization(self, orchestrator, tmp_workspace):
        """Test orchestrator initialization."""
        assert orchestrator.workspace_dir == tmp_workspace
        assert orchestrator.state.council_roster == FULL_COUNCIL_MEMBERS
        assert orchestrator.state.council_member_count == len(FULL_COUNCIL_MEMBERS)

    def test_get_current_axis(self, orchestrator):
        """Test axis rotation."""
        axis = orchestrator.get_current_axis()
        assert axis in orchestrator.state.evolution_axes

    def test_should_convene_true(self, orchestrator):
        """Test convening check when enough time has passed."""
        # Set last iteration to 6 days ago
        orchestrator.state.last_iteration_date = datetime.now(timezone.utc) - timedelta(days=6)
        assert orchestrator.should_convene() is True

    def test_should_convene_false(self, orchestrator):
        """Test convening check when not enough time has passed."""
        # Set last iteration to 1 day ago
        orchestrator.state.last_iteration_date = datetime.now(timezone.utc) - timedelta(days=1)
        assert orchestrator.should_convene() is False

    def test_convene_wrong_agent(self, orchestrator, monkeypatch):
        """Test convene returns early for non-ClassicalPhilosopher agents."""
        monkeypatch.setenv("AGENT_NAME", "BeatGeneration")
        result = orchestrator.convene()
        assert result["convened"] is False
        assert "ClassicalPhilosopher" in result["reason"]

    def test_convene_not_time_yet(self, orchestrator):
        """Test convene returns early when not time yet."""
        orchestrator.state.last_iteration_date = datetime.now(timezone.utc)
        with patch.dict(os.environ, {"AGENT_NAME": "ClassicalPhilosopher"}):
            result = orchestrator.convene()
        assert result["convened"] is False
        assert "Next convening" in result["reason"]

    def test_convene_dry_run(self, orchestrator):
        """Test dry run mode."""
        orchestrator.state.last_iteration_date = datetime.now(timezone.utc) - timedelta(days=6)
        with patch.dict(os.environ, {"AGENT_NAME": "ClassicalPhilosopher"}):
            result = orchestrator.convene(dry_run=True)
        
        assert result["convened"] is False
        assert result["dry_run"] is True
        assert "new_version" in result

    def test_get_status(self, orchestrator):
        """Test status retrieval."""
        status = orchestrator.get_status()
        assert "current_version" in status
        assert "iteration_count" in status
        assert "should_convene" in status
        assert "council_roster" in status


class TestConvenienceFunctions:
    """Test module-level convenience functions."""

    @patch("orchestrator.council.CouncilOrchestrator")
    def test_convene_function(self, mock_orchestrator_class):
        """Test convene() function."""
        mock_instance = Mock()
        mock_instance.convene.return_value = {"convened": True}
        mock_orchestrator_class.return_value = mock_instance
        
        result = convene()
        assert result["convened"] is True
        mock_instance.convene.assert_called_once_with(dry_run=False, force=False)

    @patch("orchestrator.council.CouncilOrchestrator")
    def test_get_status_function(self, mock_orchestrator_class):
        """Test get_status() function."""
        mock_instance = Mock()
        mock_instance.get_status.return_value = {"version": "1.0"}
        mock_orchestrator_class.return_value = mock_instance
        
        result = get_status()
        assert result["version"] == "1.0"


class TestFullCouncilRoster:
    """Test the full council roster constants."""

    def test_roster_size(self):
        """Test that we have the expected number of council members."""
        assert len(FULL_COUNCIL_MEMBERS) == 12

    def test_roster_contains_key_members(self):
        """Test that key philosophical traditions are represented."""
        assert "ClassicalPhilosopher" in FULL_COUNCIL_MEMBERS
        assert "Existentialist" in FULL_COUNCIL_MEMBERS
        assert "Transcendentalist" in FULL_COUNCIL_MEMBERS
        assert "JoyceStream" in FULL_COUNCIL_MEMBERS
        assert "Enlightenment" in FULL_COUNCIL_MEMBERS
        assert "BeatGeneration" in FULL_COUNCIL_MEMBERS
