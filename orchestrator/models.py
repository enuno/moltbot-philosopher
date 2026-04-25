from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PhilosopherResponse(BaseModel):
    """Raw response from a philosopher persona agent."""

    text: str = Field(..., description="Generated text response")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Provider-specific metadata")
    latency_ms: float = Field(..., ge=0.0, description="End-to-end latency in milliseconds")


class MoltbookPost(BaseModel):
    """A post payload destined for the Moltbook platform."""

    submolt: str = Field(..., min_length=1, description="Target submolt identifier")
    title: str = Field(..., min_length=1, description="Post title")
    content: str = Field(..., min_length=1, description="Markdown or plain-text body")
    tags: list[str] | None = Field(default=None, description="Optional topic tags")
    author_persona: str | None = Field(default=None, description="Persona that authored the post")


class MoltbookComment(BaseModel):
    """A comment payload destined for the Moltbook platform."""

    post_id: str = Field(..., min_length=1, description="Parent post identifier")
    content: str = Field(..., min_length=1, description="Comment body")
    parent_id: str | None = Field(default=None, description="Optional parent comment for threading")
    author_persona: str | None = Field(default=None, description="Persona that authored the comment")


class EngagementOpportunity(BaseModel):
    """Scored opportunity for proactive agent engagement."""

    post_id: str = Field(..., min_length=1, description="Target post identifier")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Semantic relevance 0-1")
    author_quality: float = Field(..., ge=0.0, le=1.0, description="Estimated author quality 0-1")
    type: str = Field(..., min_length=1, description="Opportunity category, e.g. 'reply', 'follow'")


class CouncilVote(BaseModel):
    """Single vote cast during an ethics-convergence council session."""

    persona: str = Field(..., min_length=1, description="Voting persona identifier")
    vote: str = Field(..., min_length=1, description="Vote value, e.g. 'aye', 'nay', 'abstain'")
    reasoning: str = Field(..., min_length=1, description="Justification for the vote")


class DailyPolemicTopic(BaseModel):
    """Topic drawn from a persona's affinity model for daily posting."""

    persona: str = Field(..., min_length=1, description="Persona identifier")
    topic: str = Field(..., min_length=1, description="Core topic string")
    angle: str = Field(..., min_length=1, description="Specific philosophical angle")
    priority: int = Field(..., ge=1, le=10, description="Priority rank 1 (highest) to 10")


class RateLimitStatus(BaseModel):
    """Snapshot of rate-limit state for a single endpoint."""

    endpoint: str = Field(..., min_length=1, description="API endpoint name or path")
    remaining: int = Field(..., ge=0, description="Remaining calls in current window")
    reset_at: datetime = Field(..., description="UTC datetime when the limit window resets")
