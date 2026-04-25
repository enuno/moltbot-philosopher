from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml


def _match_field(value: int, expr: str, min_val: int, max_val: int) -> bool:
    """Match a single datetime field against a cron expression fragment.

    Supports ``*``, ``*/step``, ``n``, ``n-m``, and comma-separated lists.
    """
    if expr == "*":
        return True

    for part in expr.split(","):
        part = part.strip()
        if not part:
            continue

        # Step pattern: */step or n-m/step
        if "/" in part:
            base, step_str = part.split("/", 1)
            step = int(step_str)
            if base == "*":
                start, end = min_val, max_val
            elif "-" in base:
                start, end = map(int, base.split("-", 1))
            else:
                start = int(base)
                end = max_val
            if value in range(start, end + 1, step):
                return True
            continue

        # Range pattern: n-m
        if "-" in part:
            start, end = map(int, part.split("-", 1))
            if start <= value <= end:
                return True
            continue

        # Exact match
        if int(part) == value:
            return True

    return False


@dataclass(frozen=True, slots=True)
class Job:
    """A scheduled job parsed from ``hermes-schedule.yml``."""

    name: str
    description: str
    cron: str
    enabled: bool
    target: str

    def should_run(self, dt: datetime | None = None) -> bool:
        """Return ``True`` if this job should execute at *dt* (UTC).

        Args:
            dt: Moment to evaluate. Defaults to ``datetime.utcnow()``.
        """
        if not self.enabled:
            return False

        if dt is None:
            dt = datetime.utcnow()

        parts = self.cron.split()
        if len(parts) != 5:
            raise ValueError(f"Invalid cron expression: {self.cron!r}")

        minute, hour, day, month, dow = parts

        # Python's weekday() is 0=Monday; cron DOW is 0=Sunday.
        # We'll accept either 0 or 7 as Sunday.
        dow_map = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6}
        python_dow = dow_map[dt.weekday()]

        return (
            _match_field(dt.minute, minute, 0, 59)
            and _match_field(dt.hour, hour, 0, 23)
            and _match_field(dt.day, day, 1, 31)
            and _match_field(dt.month, month, 1, 12)
            and _match_field(python_dow, dow, 0, 6)
        )


class Scheduler:
    """Loads ``hermes-schedule.yml`` and exposes runnable jobs."""

    _schedule_path: Path
    _jobs: list[Job]

    def __init__(self, schedule_path: Path | str | None = None) -> None:
        if schedule_path is None:
            schedule_path = (
                Path(__file__).resolve().parent.parent / "config" / "hermes-schedule.yml"
            )
        if isinstance(schedule_path, str):
            schedule_path = Path(schedule_path)
        self._schedule_path = schedule_path
        self._jobs = []
        self.reload()

    def reload(self) -> None:
        """Re-read the schedule file from disk."""
        if not self._schedule_path.exists():
            self._jobs = []
            return

        with self._schedule_path.open("r", encoding="utf-8") as fh:
            data: dict[str, Any] = yaml.safe_load(fh) or {}

        raw_jobs: list[dict[str, Any]] = data.get("jobs", [])
        self._jobs = [
            Job(
                name=str(j["name"]),
                description=str(j.get("description", "")),
                cron=str(j["cron"]),
                enabled=bool(j.get("enabled", True)),
                target=str(j["target"]),
            )
            for j in raw_jobs
        ]

    @property
    def jobs(self) -> list[Job]:
        """All jobs defined in the schedule (including disabled)."""
        return list(self._jobs)

    def enabled_jobs(self) -> list[Job]:
        """Only jobs whose ``enabled`` flag is ``True``."""
        return [j for j in self._jobs if j.enabled]

    def jobs_due(self, dt: datetime | None = None) -> list[Job]:
        """Jobs that should run at the given moment."""
        return [j for j in self._jobs if j.should_run(dt)]
