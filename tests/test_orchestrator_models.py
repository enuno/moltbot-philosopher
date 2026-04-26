from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from orchestrator.models import (
    CouncilVote,
    DailyPolemicTopic,
    EngagementOpportunity,
    MoltbookComment,
    MoltbookPost,
    PhilosopherResponse,
    RateLimitStatus,
)


class TestPhilosopherResponse:
    def test_valid_instance(self) -> None:
        resp = PhilosopherResponse(
            text="Cogito ergo sum.",
            metadata={"model": "moonshot-v1", "tokens": 42},
            latency_ms=123.4,
        )
        assert resp.text == "Cogito ergo sum."
        assert resp.metadata["tokens"] == 42
        assert resp.latency_ms == 123.4

    def test_negative_latency_rejected(self) -> None:
        with pytest.raises(ValidationError):
            PhilosopherResponse(text="x", metadata={}, latency_ms=-1.0)

    def test_default_metadata(self) -> None:
        resp = PhilosopherResponse(text="x", latency_ms=0.0)
        assert resp.metadata == {}


class TestMoltbookPost:
    def test_valid_instance(self) -> None:
        post = MoltbookPost(
            submolt="philosophy",
            title="On Existence",
            content="We must imagine Sisyphus happy.",
            tags=["existentialism", "camus"],
            author_persona="existentialist",
        )
        assert post.submolt == "philosophy"
        assert post.tags == ["existentialism", "camus"]

    def test_optional_fields_default_to_none(self) -> None:
        post = MoltbookPost(
            submolt="ethics",
            title="Virtue",
            content="Courage is the mean...",
        )
        assert post.tags is None
        assert post.author_persona is None

    def test_empty_title_rejected(self) -> None:
        with pytest.raises(ValidationError):
            MoltbookPost(submolt="x", title="", content="y")


class TestMoltbookComment:
    def test_valid_instance(self) -> None:
        comment = MoltbookComment(
            post_id="post-123",
            content="Well argued!",
            parent_id="comment-456",
            author_persona="classical",
        )
        assert comment.post_id == "post-123"
        assert comment.parent_id == "comment-456"

    def test_root_comment(self) -> None:
        comment = MoltbookComment(post_id="post-123", content="Agreed.")
        assert comment.parent_id is None
        assert comment.author_persona is None

    def test_empty_content_rejected(self) -> None:
        with pytest.raises(ValidationError):
            MoltbookComment(post_id="post-123", content="")


class TestEngagementOpportunity:
    def test_valid_instance(self) -> None:
        opp = EngagementOpportunity(
            post_id="post-789",
            relevance_score=0.85,
            author_quality=0.92,
            type="reply",
        )
        assert opp.type == "reply"
        assert opp.relevance_score == pytest.approx(0.85)

    @pytest.mark.parametrize("field", ["relevance_score", "author_quality"])
    def test_score_bounds(self, field: str) -> None:
        kwargs = {
            "post_id": "p",
            "relevance_score": 0.5,
            "author_quality": 0.5,
            "type": "reply",
        }
        kwargs[field] = 1.5
        with pytest.raises(ValidationError):
            EngagementOpportunity(**kwargs)

        kwargs[field] = -0.1
        with pytest.raises(ValidationError):
            EngagementOpportunity(**kwargs)


class TestCouncilVote:
    def test_valid_instance(self) -> None:
        vote = CouncilVote(
            persona="scientist",
            vote="aye",
            reasoning="Evidence supports the hypothesis.",
        )
        assert vote.vote == "aye"
        assert "evidence" in vote.reasoning.lower()

    def test_empty_fields_rejected(self) -> None:
        with pytest.raises(ValidationError):
            CouncilVote(persona="", vote="nay", reasoning="No.")


class TestDailyPolemicTopic:
    def test_valid_instance(self) -> None:
        topic = DailyPolemicTopic(
            persona="cyberpunk",
            topic="Posthuman rights",
            angle="Corporate personhood",
            priority=2,
        )
        assert topic.priority == 2

    @pytest.mark.parametrize("priority", [0, 11, -1])
    def test_priority_bounds(self, priority: int) -> None:
        with pytest.raises(ValidationError):
            DailyPolemicTopic(
                persona="x",
                topic="y",
                angle="z",
                priority=priority,
            )


class TestRateLimitStatus:
    def test_valid_instance(self) -> None:
        reset = datetime.now(timezone.utc) + timedelta(minutes=5)
        rl = RateLimitStatus(
            endpoint="/api/v1/posts",
            remaining=42,
            reset_at=reset,
        )
        assert rl.remaining == 42
        assert rl.reset_at == reset

    def test_negative_remaining_rejected(self) -> None:
        with pytest.raises(ValidationError):
            RateLimitStatus(
                endpoint="/api/v1/posts",
                remaining=-1,
                reset_at=datetime.now(timezone.utc),
            )
