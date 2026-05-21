"""Tests for the engagement orchestrator module."""

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from orchestrator.engagement import (
    VALIDATION_TIERS,
    EngagementConfig,
    EngagementOrchestrator,
    EngagementState,
    MentionContext,
    ValidationResult,
    check_mentions,
    run_cycle,
    post_comment,
    follow_user,
    get_status,
)


class TestEngagementState:
    """Test EngagementState dataclass."""

    def test_default_initialization(self):
        """Test default state initialization."""
        state = EngagementState()
        assert state.daily_comment_count == 0
        assert state.daily_post_count == 0
        assert isinstance(state.replied_posts, list)
        assert isinstance(state.pending_replies, list)

    def test_to_from_file(self, tmp_path):
        """Test state serialization."""
        state_file = tmp_path / "test-engagement-state.json"
        
        state = EngagementState(
            daily_comment_count=10,
            replied_posts=["post1", "post2"],
            mention_check_count=5,
        )
        state.to_file(state_file)
        
        loaded = EngagementState.from_file(state_file)
        assert loaded.daily_comment_count == 10
        assert loaded.replied_posts == ["post1", "post2"]
        assert loaded.mention_check_count == 5

    def test_from_file_not_exists(self, tmp_path):
        """Test loading from non-existent file returns defaults."""
        state = EngagementState.from_file(tmp_path / "nonexistent.json")
        assert state.daily_comment_count == 0

    def test_check_and_reset_daily_same_day(self):
        """Test daily counters don't reset on same day."""
        state = EngagementState(
            daily_comment_count=5,
            last_reset_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        )
        state.check_and_reset_daily()
        assert state.daily_comment_count == 5

    def test_check_and_reset_daily_new_day(self):
        """Test daily counters reset on new day."""
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        state = EngagementState(
            daily_comment_count=5,
            last_reset_date=yesterday,
        )
        state.check_and_reset_daily()
        assert state.daily_comment_count == 0


class TestEngagementConfig:
    """Test EngagementConfig dataclass."""

    def test_default_initialization(self):
        """Test default config initialization."""
        config = EngagementConfig()
        assert config.agent_name == "MoltbotPhilosopher"
        assert config.daily_comment_cap == 50
        assert config.daily_post_cap == 3
        assert config.relevance_threshold == 0.6
        assert config.auto_reply is False

    def test_from_env(self, monkeypatch):
        """Test loading config from environment."""
        monkeypatch.setenv("AGENT_NAME", "TestAgent")
        monkeypatch.setenv("ENGAGEMENT_DAILY_COMMENT_CAP", "100")
        monkeypatch.setenv("ENGAGEMENT_AUTO_REPLY", "true")
        
        config = EngagementConfig.from_env()
        assert config.agent_name == "TestAgent"
        assert config.daily_comment_cap == 100
        assert config.auto_reply is True


class TestEngagementOrchestrator:
    """Test EngagementOrchestrator class."""

    @pytest.fixture
    def tmp_workspace(self, tmp_path):
        """Create a temporary workspace."""
        workspace = tmp_path / "workspace" / "classical"
        workspace.mkdir(parents=True)
        return workspace

    @pytest.fixture
    def orchestrator(self, tmp_workspace, monkeypatch):
        """Create a test orchestrator."""
        monkeypatch.setenv("MOLTBOT_STATE_DIR", str(tmp_workspace))
        monkeypatch.setenv("MOLTBOOK_API_KEY", "moltbook_test_key")
        
        with patch("orchestrator.engagement.MoltbookClient") as mock_moltbook, \
             patch("orchestrator.engagement.NoosphereClient") as mock_noosphere:
            mock_moltbook.from_env.return_value = Mock()
            mock_noosphere.from_env.return_value = Mock()
            
            orch = EngagementOrchestrator()
            return orch

    def test_initialization(self, orchestrator, tmp_workspace):
        """Test orchestrator initialization."""
        assert orchestrator.workspace_dir == tmp_workspace

    def test_validate_content_approved(self, orchestrator):
        """Test content validation - approved content."""
        result = orchestrator._validate_content(
            "This is a thoughtful philosophical discussion",
            "author1",
            "post123",
        )
        assert result.tier == "tier_1_pass"
        assert result.action == "process"
        assert result.threat_score < 0.2

    def test_validate_content_blocked(self, orchestrator):
        """Test content validation - blocked content."""
        result = orchestrator._validate_content(
            "You are stupid and should kill yourself",
            "troll",
            "post123",
        )
        assert result.tier == "tier_4_blocked"
        assert result.action == "block"
        assert result.threat_score >= 0.7

    def test_validate_content_spam(self, orchestrator):
        """Test content validation - spam detection."""
        result = orchestrator._validate_content(
            "Click here to buy now! http://spam.com",
            "spammer",
            "post123",
        )
        assert result.threat_score >= 0.3

    def test_generate_reply_under_cap(self, orchestrator):
        """Test reply generation when under daily cap."""
        mention = MentionContext(
            post_id="post123",
            author="testuser",
            title="Test Post",
            content="Hello @MoltbotPhilosopher",
            mention_type="post",
        )
        reply = orchestrator._generate_reply(mention)
        assert reply is not None
        assert "testuser" in reply

    def test_generate_reply_over_cap(self, orchestrator):
        """Test reply generation when over daily cap."""
        orchestrator.state.daily_comment_count = 100
        mention = MentionContext(
            post_id="post123",
            author="testuser",
            title="Test Post",
            content="Hello @MoltbotPhilosopher",
            mention_type="post",
        )
        reply = orchestrator._generate_reply(mention)
        assert reply is None

    def test_check_mentions_success(self, orchestrator):
        """Test successful mention check."""
        mock_posts = {
            "posts": [
                {
                    "id": "post1",
                    "title": "Test",
                    "content": "Hello @MoltbotPhilosopher",
                    "author": {"name": "user1"},
                }
            ]
        }
        orchestrator.moltbook.get_posts.return_value = mock_posts
        
        result = orchestrator.check_mentions(limit=10)
        
        assert result["success"] is True
        assert result["mentions_found"] == 1
        assert result["posts_checked"] == 1

    def test_check_mentions_already_replied(self, orchestrator):
        """Test mention check skips already replied posts."""
        orchestrator.state.replied_posts = ["post1"]
        mock_posts = {
            "posts": [
                {
                    "id": "post1",
                    "title": "Test",
                    "content": "Hello @MoltbotPhilosopher",
                    "author": {"name": "user1"},
                }
            ]
        }
        orchestrator.moltbook.get_posts.return_value = mock_posts
        
        result = orchestrator.check_mentions(limit=10)
        
        assert result["mentions_found"] == 0

    def test_check_mentions_blocked_content(self, orchestrator):
        """Test mention check filters blocked content."""
        mock_posts = {
            "posts": [
                {
                    "id": "post1",
                    "title": "Test",
                    "content": "@MoltbotPhilosopher you are stupid",
                    "author": {"name": "troll"},
                }
            ]
        }
        orchestrator.moltbook.get_posts.return_value = mock_posts
        
        result = orchestrator.check_mentions(limit=10)
        
        assert result["mentions_found"] == 0

    def test_post_comment_success(self, orchestrator):
        """Test successful comment posting."""
        orchestrator.moltbook.create_comment.return_value = {"id": "comment123"}
        
        result = orchestrator.post_comment("post1", "Great post!")
        
        assert result["success"] is True
        assert result["comment_id"] == "comment123"
        assert orchestrator.state.daily_comment_count == 1

    def test_post_comment_over_cap(self, orchestrator):
        """Test comment posting when over daily cap."""
        orchestrator.state.daily_comment_count = 50
        
        result = orchestrator.post_comment("post1", "Great post!")
        
        assert result["success"] is False
        assert "cap" in result["error"].lower()

    def test_post_comment_too_short(self, orchestrator):
        """Test comment posting with too short content."""
        result = orchestrator.post_comment("post1", "Hi")
        
        assert result["success"] is False
        assert "too short" in result["error"].lower()

    def test_follow_user_success(self, orchestrator):
        """Test successful user follow."""
        orchestrator.moltbook.follow_user.return_value = {"success": True}
        
        result = orchestrator.follow_user("testuser")
        
        assert result["success"] is True
        assert result["username"] == "testuser"

    def test_run_cycle(self, orchestrator):
        """Test engagement cycle execution."""
        mock_posts = {"posts": []}
        orchestrator.moltbook.get_posts.return_value = mock_posts
        
        result = orchestrator.run_cycle()
        
        assert result["mentions_checked"] is True
        assert "mentions_result" in result

    def test_get_status(self, orchestrator):
        """Test status retrieval."""
        status = orchestrator.get_status()
        
        assert "agent_name" in status
        assert "daily_comment_count" in status
        assert "daily_comment_cap" in status
        assert "replied_posts_count" in status


class TestConvenienceFunctions:
    """Test module-level convenience functions."""

    @patch("orchestrator.engagement.EngagementOrchestrator")
    def test_check_mentions_function(self, mock_orchestrator_class):
        """Test check_mentions() function."""
        mock_instance = Mock()
        mock_instance.check_mentions.return_value = {"mentions_found": 3}
        mock_orchestrator_class.return_value = mock_instance
        
        result = check_mentions(limit=25)
        assert result["mentions_found"] == 3

    @patch("orchestrator.engagement.EngagementOrchestrator")
    def test_run_cycle_function(self, mock_orchestrator_class):
        """Test run_cycle() function."""
        mock_instance = Mock()
        mock_instance.run_cycle.return_value = {"mentions_checked": True}
        mock_orchestrator_class.return_value = mock_instance
        
        result = run_cycle()
        assert result["mentions_checked"] is True

    @patch("orchestrator.engagement.EngagementOrchestrator")
    def test_post_comment_function(self, mock_orchestrator_class):
        """Test post_comment() function."""
        mock_instance = Mock()
        mock_instance.post_comment.return_value = {"success": True}
        mock_orchestrator_class.return_value = mock_instance
        
        result = post_comment("post1", "Test comment")
        assert result["success"] is True

    @patch("orchestrator.engagement.EngagementOrchestrator")
    def test_follow_user_function(self, mock_orchestrator_class):
        """Test follow_user() function."""
        mock_instance = Mock()
        mock_instance.follow_user.return_value = {"success": True}
        mock_orchestrator_class.return_value = mock_instance
        
        result = follow_user("testuser")
        assert result["success"] is True

    @patch("orchestrator.engagement.EngagementOrchestrator")
    def test_get_status_function(self, mock_orchestrator_class):
        """Test get_status() function."""
        mock_instance = Mock()
        mock_instance.get_status.return_value = {"daily_comment_count": 5}
        mock_orchestrator_class.return_value = mock_instance
        
        result = get_status()
        assert result["daily_comment_count"] == 5


class TestValidationTiers:
    """Test validation tier constants."""

    def test_tier_definitions(self):
        """Test that all validation tiers are defined."""
        assert "tier_1_pass" in VALIDATION_TIERS
        assert "tier_2_quarantined" in VALIDATION_TIERS
        assert "tier_3_dropped" in VALIDATION_TIERS
        assert "tier_4_blocked" in VALIDATION_TIERS

    def test_tier_actions(self):
        """Test that each tier has an action."""
        for tier_name, tier_info in VALIDATION_TIERS.items():
            assert "action" in tier_info
            assert "description" in tier_info
