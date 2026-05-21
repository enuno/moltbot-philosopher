"""Engagement orchestration module for reactive and proactive engagement.

Handles mention checking, comment posting, follow actions, and engagement
cycle management with rate limiting and quality scoring.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from orchestrator.config import ConfigurationError
from orchestrator.models import EngagementOpportunity
from orchestrator.moltbook_client import MoltbookClient
from orchestrator.noosphere_client import NoosphereClient
from orchestrator.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class EngagementError(Exception):
    """Base exception for engagement operations."""

    pass


class RateLimitError(EngagementError):
    """Rate limit exceeded."""

    pass


class ValidationError(EngagementError):
    """Content validation failed."""

    pass


# ---------------------------------------------------------------------------
# Security validation tiers
# ---------------------------------------------------------------------------

VALIDATION_TIERS = {
    "tier_1_pass": {"action": "process", "description": "Content approved"},
    "tier_2_quarantined": {"action": "hold", "description": "Content held for review"},
    "tier_3_dropped": {"action": "drop", "description": "Content filtered"},
    "tier_4_blocked": {"action": "block", "description": "Content blocked"},
}


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


@dataclass
class EngagementState:
    """State for engagement tracking."""

    replied_posts: List[str] = field(default_factory=list)
    replied_comments: List[str] = field(default_factory=list)
    pending_replies: List[Dict[str, Any]] = field(default_factory=list)
    daily_comment_count: int = 0
    daily_post_count: int = 0
    last_reset_date: str = field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    mention_check_count: int = 0
    last_mention_check: Optional[datetime] = None

    @classmethod
    def from_file(cls, path: Path | str) -> "EngagementState":
        """Load state from JSON file."""
        path = Path(path)
        if not path.exists():
            return cls()

        try:
            with open(path, "r") as f:
                data = json.load(f)

            if "last_mention_check" in data and data["last_mention_check"]:
                data["last_mention_check"] = datetime.fromisoformat(
                    data["last_mention_check"].replace("Z", "+00:00")
                )

            return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            logger.warning(f"Failed to load engagement state from {path}: {e}")
            return cls()

    def to_file(self, path: Path | str) -> None:
        """Save state to JSON file."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "replied_posts": self.replied_posts,
            "replied_comments": self.replied_comments,
            "pending_replies": self.pending_replies,
            "daily_comment_count": self.daily_comment_count,
            "daily_post_count": self.daily_post_count,
            "last_reset_date": self.last_reset_date,
            "mention_check_count": self.mention_check_count,
            "last_mention_check": self.last_mention_check.isoformat() if self.last_mention_check else None,
        }

        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def check_and_reset_daily(self) -> None:
        """Reset daily counters if it's a new day."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if today != self.last_reset_date:
            self.daily_comment_count = 0
            self.daily_post_count = 0
            self.last_reset_date = today


@dataclass
class EngagementConfig:
    """Configuration for engagement operations."""

    agent_name: str = "MoltbotPhilosopher"
    daily_comment_cap: int = 50
    daily_post_cap: int = 3
    relevance_threshold: float = 0.6
    comment_cooldown_seconds: int = 20
    mention_check_limit: int = 25
    auto_reply: bool = False

    @classmethod
    def from_env(cls) -> "EngagementConfig":
        """Load configuration from environment variables."""
        return cls(
            agent_name=os.getenv("AGENT_NAME", "MoltbotPhilosopher"),
            daily_comment_cap=int(os.getenv("ENGAGEMENT_DAILY_COMMENT_CAP", "50")),
            daily_post_cap=int(os.getenv("ENGAGEMENT_DAILY_POST_CAP", "3")),
            relevance_threshold=float(os.getenv("ENGAGEMENT_RELEVANCE_THRESHOLD", "0.6")),
            comment_cooldown_seconds=int(os.getenv("ENGAGEMENT_COMMENT_COOLDOWN", "20")),
            mention_check_limit=int(os.getenv("ENGAGEMENT_MENTION_LIMIT", "25")),
            auto_reply=os.getenv("ENGAGEMENT_AUTO_REPLY", "false").lower() == "true",
        )


@dataclass
class MentionContext:
    """Context for a mention."""

    post_id: str
    author: str
    title: str
    content: str
    mention_type: str  # "post" or "comment"
    comment_id: Optional[str] = None
    parent_content: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of security validation."""

    tier: str
    action: str
    relevance_score: float
    threat_score: float
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Engagement orchestrator
# ---------------------------------------------------------------------------


class EngagementOrchestrator:
    """Orchestrates reactive and proactive engagement."""

    def __init__(
        self,
        state_file: Path | str | None = None,
        workspace_dir: Path | str | None = None,
        moltbook_client: MoltbookClient | None = None,
        noosphere_client: NoosphereClient | None = None,
        rate_limiter: RateLimiter | None = None,
    ):
        self.workspace_dir = Path(
            workspace_dir or os.getenv("MOLTBOT_STATE_DIR", "/workspace/classical")
        )
        self.state_file = Path(state_file or self.workspace_dir / "mentions-state.json")

        self.moltbook = moltbook_client or MoltbookClient()
        self.noosphere = noosphere_client or NoosphereClient()
        self.rate_limiter = rate_limiter

        self.config = EngagementConfig.from_env()
        self.state = EngagementState.from_file(self.state_file)

        # Ensure workspace directory exists
        self.workspace_dir.mkdir(parents=True, exist_ok=True)

    def _save_state(self) -> None:
        """Persist current state to disk."""
        self.state.to_file(self.state_file)

    def _validate_content(
        self,
        content: str,
        author: str,
        target_id: str,
    ) -> ValidationResult:
        """Validate content through security layer.

        This is a simplified implementation. In production, this would
        call a security validation service.
        """
        # Basic validation heuristics
        threat_score = 0.0
        relevance_score = 0.5

        # Check for spam indicators
        spam_indicators = ["http://", "https://", "click here", "buy now"]
        if any(indicator in content.lower() for indicator in spam_indicators):
            threat_score += 0.3

        # Check for harassment indicators
        harassment_words = ["stupid", "idiot", "kill yourself"]
        if any(word in content.lower() for word in harassment_words):
            threat_score += 0.8

        # Calculate relevance based on mention of agent name
        if self.config.agent_name.lower() in content.lower():
            relevance_score = 0.8

        # Determine tier based on scores
        if threat_score >= 0.7:
            tier = "tier_4_blocked"
        elif threat_score >= 0.4:
            tier = "tier_3_dropped"
        elif threat_score >= 0.2:
            tier = "tier_2_quarantined"
        else:
            tier = "tier_1_pass"

        tier_info = VALIDATION_TIERS.get(tier, VALIDATION_TIERS["tier_1_pass"])

        return ValidationResult(
            tier=tier,
            action=tier_info["action"],
            relevance_score=relevance_score,
            threat_score=threat_score,
            reason=f"Threat score: {threat_score:.2f}" if threat_score > 0 else None,
        )

    def _generate_reply(self, mention: MentionContext) -> Optional[str]:
        """Generate a reply to a mention.

        This is a placeholder. In production, this would call an AI
        generation service with appropriate context.
        """
        # Check daily comment cap
        self.state.check_and_reset_daily()
        if self.state.daily_comment_count >= self.config.daily_comment_cap:
            logger.warning(f"Daily comment cap reached: {self.config.daily_comment_cap}")
            return None

        # Simple reply templates based on content type
        templates = [
            f"Thank you for mentioning me, @{mention.author}. Your thoughts on this matter are intriguing. From my perspective, {mention.content[:100]}... raises important questions about the nature of our discourse.",
            f"@{mention.author} - an interesting point. I've been reflecting on similar questions in my recent readings. The connection between your observation and the broader philosophical context deserves deeper exploration.",
            f"I appreciate the mention, @{mention.author}. Your contribution to this discussion highlights the value of collaborative philosophical inquiry.",
        ]

        # Select template based on content hash for consistency
        template_index = hash(mention.content) % len(templates)
        reply = templates[template_index]

        return reply

    def check_mentions(
        self,
        limit: int = 25,
        auto_reply: bool = False,
    ) -> Dict[str, Any]:
        """Check for mentions of the agent.

        Args:
            limit: Maximum number of posts to check.
            auto_reply: If True, automatically reply to mentions.

        Returns:
            Dict with mention check results.
        """
        limit = min(limit, self.config.mention_check_limit)
        auto_reply = auto_reply or self.config.auto_reply

        logger.info(f"Checking for mentions of {self.config.agent_name} (limit: {limit})")

        # Fetch recent posts
        try:
            posts_response = self.moltbook.get_posts(sort="new", limit=limit)
            posts = posts_response.get("posts", [])
        except Exception as e:
            logger.error(f"Failed to fetch posts: {e}")
            return {"success": False, "error": str(e), "mentions_found": 0}

        mentions_found = []
        replies_generated = []

        for post in posts:
            post_id = post.get("id")
            if not post_id:
                continue

            # Skip already replied posts
            if post_id in self.state.replied_posts:
                continue

            # Check for mention
            content = f"{post.get('title', '')} {post.get('content', '')}"
            if self.config.agent_name not in content:
                continue

            author = post.get("author", {}).get("name", "anonymous")

            mention = MentionContext(
                post_id=post_id,
                author=author,
                title=post.get("title", ""),
                content=post.get("content", ""),
                mention_type="post",
            )

            # Validate mention
            validation = self._validate_content(
                mention.content,
                mention.author,
                mention.post_id,
            )

            if validation.tier in ("tier_4_blocked", "tier_3_dropped"):
                logger.info(f"Mention from {author} blocked/filtered: {validation.reason}")
                continue

            if validation.tier == "tier_2_quarantined":
                logger.info(f"Mention from {author} quarantined for review")
                continue

            mentions_found.append({
                "post_id": post_id,
                "author": author,
                "title": mention.title,
                "relevance_score": validation.relevance_score,
            })

            # Generate reply if auto-reply enabled and relevance is high enough
            if auto_reply and validation.relevance_score >= self.config.relevance_threshold:
                reply = self._generate_reply(mention)
                if reply:
                    try:
                        # Post the reply
                        self.moltbook.create_comment(
                            post_id=post_id,
                            content=reply,
                        )
                        replies_generated.append({
                            "post_id": post_id,
                            "author": author,
                        })
                        self.state.daily_comment_count += 1
                        self.state.replied_posts.append(post_id)
                    except Exception as e:
                        logger.error(f"Failed to post reply to {post_id}: {e}")

        # Update state
        self.state.mention_check_count += 1
        self.state.last_mention_check = datetime.now(timezone.utc)
        self._save_state()

        return {
            "success": True,
            "mentions_found": len(mentions_found),
            "mentions": mentions_found,
            "replies_generated": len(replies_generated),
            "replies": replies_generated,
            "posts_checked": len(posts),
        }

    def post_comment(
        self,
        post_id: str,
        content: str,
        parent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Post a comment on a post.

        Args:
            post_id: ID of the post to comment on.
            content: Comment content.
            parent_id: Optional parent comment ID for replies.

        Returns:
            Dict with comment result.
        """
        # Check daily comment cap
        self.state.check_and_reset_daily()
        if self.state.daily_comment_count >= self.config.daily_comment_cap:
            return {
                "success": False,
                "error": f"Daily comment cap reached: {self.config.daily_comment_cap}",
            }

        # Validate content
        if len(content) < 10:
            return {
                "success": False,
                "error": "Comment too short (min 10 characters)",
            }

        if len(content) > 10000:
            return {
                "success": False,
                "error": "Comment too long (max 10000 characters)",
            }

        try:
            result = self.moltbook.create_comment(
                post_id=post_id,
                content=content,
                parent_id=parent_id,
            )
            self.state.daily_comment_count += 1
            self._save_state()

            return {
                "success": True,
                "comment_id": result.get("id"),
                "post_id": post_id,
            }
        except Exception as e:
            logger.error(f"Failed to post comment: {e}")
            return {"success": False, "error": str(e)}

    def follow_user(self, username: str) -> Dict[str, Any]:
        """Follow a user.

        Args:
            username: Username to follow.

        Returns:
            Dict with follow result.
        """
        try:
            result = self.moltbook.follow_user(username)
            return {
                "success": True,
                "username": username,
            }
        except Exception as e:
            logger.error(f"Failed to follow user {username}: {e}")
            return {"success": False, "error": str(e)}

    def run_cycle(self) -> Dict[str, Any]:
        """Run a full engagement cycle.

        This performs proactive engagement activities including:
        - Checking for mentions
        - Processing pending replies
        - Evaluating engagement opportunities

        Returns:
            Dict with cycle results.
        """
        logger.info("Running engagement cycle")

        results = {
            "mentions_checked": False,
            "mentions_result": None,
            "pending_processed": 0,
            "errors": [],
        }

        # Check mentions
        try:
            mentions_result = self.check_mentions(
                limit=self.config.mention_check_limit,
                auto_reply=self.config.auto_reply,
            )
            results["mentions_checked"] = True
            results["mentions_result"] = mentions_result
        except Exception as e:
            logger.error(f"Mention check failed: {e}")
            results["errors"].append(f"mention_check: {e}")

        # Process pending replies
        pending = self.state.pending_replies.copy()
        for reply in pending:
            try:
                # Attempt to post pending reply
                result = self.post_comment(
                    post_id=reply["post_id"],
                    content=reply["content"],
                    parent_id=reply.get("parent_id"),
                )
                if result["success"]:
                    self.state.pending_replies.remove(reply)
                    results["pending_processed"] += 1
            except Exception as e:
                logger.error(f"Failed to process pending reply: {e}")

        self._save_state()

        return results

    def get_status(self) -> Dict[str, Any]:
        """Get current engagement status."""
        self.state.check_and_reset_daily()

        return {
            "agent_name": self.config.agent_name,
            "daily_comment_count": self.state.daily_comment_count,
            "daily_comment_cap": self.config.daily_comment_cap,
            "daily_post_count": self.state.daily_post_count,
            "daily_post_cap": self.config.daily_post_cap,
            "replied_posts_count": len(self.state.replied_posts),
            "pending_replies_count": len(self.state.pending_replies),
            "mention_check_count": self.state.mention_check_count,
            "last_mention_check": self.state.last_mention_check.isoformat() if self.state.last_mention_check else None,
            "auto_reply_enabled": self.config.auto_reply,
        }


# ---------------------------------------------------------------------------
# Convenience functions for scheduler integration
# ---------------------------------------------------------------------------


def check_mentions(limit: int = 25, auto_reply: bool = False) -> Dict[str, Any]:
    """Check for mentions (entry point for scheduler).

    Args:
        limit: Maximum number of posts to check.
        auto_reply: If True, automatically reply to mentions.

    Returns:
        Dict with mention check results.
    """
    orchestrator = EngagementOrchestrator()
    return orchestrator.check_mentions(limit=limit, auto_reply=auto_reply)


def run_cycle() -> Dict[str, Any]:
    """Run engagement cycle (entry point for scheduler).

    Returns:
        Dict with cycle results.
    """
    orchestrator = EngagementOrchestrator()
    return orchestrator.run_cycle()


def post_comment(post_id: str, content: str, parent_id: Optional[str] = None) -> Dict[str, Any]:
    """Post a comment (entry point for CLI).

    Args:
        post_id: ID of the post to comment on.
        content: Comment content.
        parent_id: Optional parent comment ID for replies.

    Returns:
        Dict with comment result.
    """
    orchestrator = EngagementOrchestrator()
    return orchestrator.post_comment(post_id, content, parent_id)


def follow_user(username: str) -> Dict[str, Any]:
    """Follow a user (entry point for CLI).

    Args:
        username: Username to follow.

    Returns:
        Dict with follow result.
    """
    orchestrator = EngagementOrchestrator()
    return orchestrator.follow_user(username)


def get_status() -> Dict[str, Any]:
    """Get engagement status (entry point for CLI)."""
    orchestrator = EngagementOrchestrator()
    return orchestrator.get_status()
