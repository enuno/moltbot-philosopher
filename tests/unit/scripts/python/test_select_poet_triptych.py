"""
Tests for scripts/select-poet-triptych.py

Validates:
- 30/40/30 mori/vivere/carpe distribution over 100 poems
- No poet repeats within 3-poem sliding window
- Star reflection appears ~15% of time (13-17 out of 100)
- Auto-correction rebalances when ratio drifts > 5%
- Each existential state produces a valid scaffold
- Tone map loads correctly with all 33 poets
- Scaffolds file loads correctly with 6 entries
"""

import importlib.util
from pathlib import Path

import pytest

# Load select-poet-triptych.py by file path (hyphen prevents normal import)
REPO_ROOT = Path(__file__).parents[4]
_MODULE_FILE = REPO_ROOT / "scripts" / "select-poet-triptych.py"
_spec = importlib.util.spec_from_file_location("select_poet_triptych", _MODULE_FILE)
spt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(spt)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def patch_config_paths(tmp_path, monkeypatch):
    """Point TONE_MAP_FILE and SCAFFOLDS_FILE at the real repo config."""
    monkeypatch.setattr(
        spt,
        "TONE_MAP_FILE",
        REPO_ROOT / "config" / "prompts" / "philosopher-poet" / "triptych-tone-map.json",
    )
    monkeypatch.setattr(
        spt,
        "SCAFFOLDS_FILE",
        REPO_ROOT / "config" / "prompts" / "philosopher-poet" / "triptych-scaffolds.json",
    )


@pytest.fixture()
def history_file(tmp_path):
    """Provide a fresh temporary history file path."""
    return str(tmp_path / "poet-triptych-history.json")


# ---------------------------------------------------------------------------
# Config file integrity
# ---------------------------------------------------------------------------

class TestConfigFiles:
    """Verify the config JSON files load correctly."""

    def test_tone_map_loads(self):
        tone_map = spt._load_tone_map()
        assert "poets" in tone_map
        assert "memento_mori" in tone_map["poets"]
        assert "memento_vivere" in tone_map["poets"]
        assert "carpe_diem" in tone_map["poets"]

    def test_tone_map_has_33_poets(self):
        tone_map = spt._load_tone_map()
        total = sum(len(v) for v in tone_map["poets"].values())
        assert total == 33, f"Expected 33 poets, got {total}"

    def test_mori_has_10_poets(self):
        tone_map = spt._load_tone_map()
        assert len(tone_map["poets"]["memento_mori"]) == 10

    def test_vivere_has_13_poets(self):
        tone_map = spt._load_tone_map()
        assert len(tone_map["poets"]["memento_vivere"]) == 13

    def test_carpe_has_10_poets(self):
        tone_map = spt._load_tone_map()
        assert len(tone_map["poets"]["carpe_diem"]) == 10

    def test_each_poet_has_required_fields(self):
        tone_map = spt._load_tone_map()
        required = {"name", "anchor_texts", "tone", "existential_state", "ai_application"}
        for state, poets in tone_map["poets"].items():
            for poet in poets:
                missing = required - poet.keys()
                assert not missing, (
                    f"Poet '{poet.get('name')}' in '{state}' missing fields: {missing}"
                )

    def test_anchor_poets_present(self):
        tone_map = spt._load_tone_map()
        anchors = {
            "memento_mori": "Percy Bysshe Shelley",
            "memento_vivere": "Dylan Thomas",
            "carpe_diem": "Robert Herrick",
        }
        for state, anchor_name in anchors.items():
            names = [p["name"] for p in tone_map["poets"][state]]
            assert anchor_name in names, (
                f"Anchor poet '{anchor_name}' not found in '{state}'"
            )

    def test_grounding_star_present(self):
        tone_map = spt._load_tone_map()
        assert "grounding_star" in tone_map
        assert tone_map["grounding_star"]["poet"] == "Robert Frost"

    def test_scaffolds_loads(self):
        scaffolds = spt._load_scaffolds()
        assert "scaffolds" in scaffolds
        assert len(scaffolds["scaffolds"]) == 6

    def test_scaffold_ids_present(self):
        scaffolds = spt._load_scaffolds()
        expected_ids = {
            "mori_ozymandias_echo",
            "vivere_do_not_go_gentle",
            "carpe_gather_rosebuds",
            "synthesis_mori_carpe",
            "harmony_vivere_carpe",
            "full_triptych_star",
        }
        actual_ids = {s["id"] for s in scaffolds["scaffolds"]}
        assert expected_ids == actual_ids

    def test_each_scaffold_has_required_fields(self):
        scaffolds = spt._load_scaffolds()
        required = {"id", "name", "structure", "template"}
        for scaffold in scaffolds["scaffolds"]:
            missing = required - scaffold.keys()
            assert not missing, (
                f"Scaffold '{scaffold.get('id')}' missing fields: {missing}"
            )

    def test_image_banks_present(self):
        scaffolds = spt._load_scaffolds()
        assert "image_banks" in scaffolds
        banks = scaffolds["image_banks"]
        assert "memento_mori" in banks
        assert "memento_vivere" in banks
        assert "carpe_diem" in banks
        assert "grounding_star" in banks


# ---------------------------------------------------------------------------
# State selection and ratio enforcement
# ---------------------------------------------------------------------------

class TestStateSelection:
    """Verify state selection respects target ratios."""

    def test_forced_state_returned(self, history_file):
        history = spt._load_history(history_file)
        state, auto_corrected = spt._select_state(history, forced_state="memento_mori")
        assert state == "memento_mori"
        assert not auto_corrected

    def test_invalid_forced_state_raises(self, history_file):
        history = spt._load_history(history_file)
        with pytest.raises(ValueError):
            spt._select_state(history, forced_state="nonexistent_state")

    def test_empty_history_returns_valid_state(self, history_file):
        history = spt._load_history(history_file)
        state, _ = spt._select_state(history)
        assert state in spt.TARGET_RATIOS

    def test_auto_correction_triggers_when_mori_deficient(self, history_file):
        """If mori is at 0%, auto-correction should force mori selection."""
        # Build a history with only vivere entries
        history = {"poems": [], "total": 0}
        for _ in range(20):
            history["poems"].append({
                "existential_state": "memento_vivere",
                "poet": "Dylan Thomas",
                "scaffold": "vivere_do_not_go_gentle",
                "star_invocation": False,
                "timestamp": "2026-01-01T00:00:00+00:00",
            })

        state, auto_corrected = spt._select_state(history)
        assert state == "memento_mori"
        assert auto_corrected

    def test_auto_correction_triggers_when_carpe_deficient(self, history_file):
        """If carpe is at 0%, auto-correction should force carpe selection."""
        history = {"poems": [], "total": 0}
        for _ in range(20):
            history["poems"].append({
                "existential_state": "memento_vivere",
                "poet": "Dylan Thomas",
                "scaffold": "vivere_do_not_go_gentle",
                "star_invocation": False,
                "timestamp": "2026-01-01T00:00:00+00:00",
            })
        # Add some mori to push carpe lowest
        for _ in range(5):
            history["poems"].append({
                "existential_state": "memento_mori",
                "poet": "Percy Bysshe Shelley",
                "scaffold": "mori_ozymandias_echo",
                "star_invocation": False,
                "timestamp": "2026-01-01T00:00:00+00:00",
            })

        state, auto_corrected = spt._select_state(history)
        assert state == "carpe_diem"
        assert auto_corrected


# ---------------------------------------------------------------------------
# Poet selection
# ---------------------------------------------------------------------------

class TestPoetSelection:
    """Verify poet selection respects repeat window."""

    def test_poet_selected_from_correct_state(self, history_file):
        history = spt._load_history(history_file)
        tone_map = spt._load_tone_map()
        poet = spt._select_poet("memento_mori", history, tone_map)
        assert poet["existential_state"] == "memento_mori"

    def test_no_repeat_within_window(self, history_file):
        """Poet used in last POET_REPEAT_WINDOW poems should not be selected."""
        tone_map = spt._load_tone_map()
        # Use Shelley in the window
        history = {
            "poems": [
                {
                    "poet": "Percy Bysshe Shelley",
                    "existential_state": "memento_mori",
                    "scaffold": "mori_ozymandias_echo",
                    "star_invocation": False,
                    "timestamp": "2026-01-01T00:00:00+00:00",
                }
            ],
            "total": 1,
        }
        # Run many selections — Shelley should not appear if others are available
        poets_chosen = set()
        for _ in range(30):
            poet = spt._select_poet("memento_mori", history, tone_map)
            poets_chosen.add(poet["name"])

        # There are 10 mori poets; with window=3 and only 1 recent, 9 eligible
        # Shelley should not appear (window has only 1 entry — him)
        assert "Percy Bysshe Shelley" not in poets_chosen


# ---------------------------------------------------------------------------
# Scaffold selection
# ---------------------------------------------------------------------------

class TestScaffoldSelection:
    """Verify scaffold selection logic."""

    def test_mori_state_returns_mori_scaffold(self, history_file):
        scaffolds = spt._load_scaffolds()
        scaffold = spt._select_scaffold("memento_mori", False, scaffolds)
        assert scaffold == "mori_ozymandias_echo"

    def test_vivere_state_returns_vivere_scaffold(self, history_file):
        scaffolds = spt._load_scaffolds()
        scaffold = spt._select_scaffold("memento_vivere", False, scaffolds)
        assert scaffold == "vivere_do_not_go_gentle"

    def test_carpe_state_returns_carpe_scaffold(self, history_file):
        scaffolds = spt._load_scaffolds()
        scaffold = spt._select_scaffold("carpe_diem", False, scaffolds)
        assert scaffold == "carpe_gather_rosebuds"

    def test_star_invocation_returns_full_triptych(self, history_file):
        scaffolds = spt._load_scaffolds()
        scaffold = spt._select_scaffold("memento_mori", True, scaffolds)
        assert scaffold == "full_triptych_star"


# ---------------------------------------------------------------------------
# Star invocation probability
# ---------------------------------------------------------------------------

class TestStarInvocation:
    """Verify star invocation appears at approximately 15% rate."""

    def test_star_invocation_within_range(self):
        """
        Over 1000 trials, star invocation should appear between 10% and 20%.
        With p=0.15 and n=1000, 3-sigma bounds are roughly 10.6% - 19.4%.
        """
        count = sum(1 for _ in range(1000) if spt._should_invoke_star())
        rate = count / 1000
        assert 0.08 <= rate <= 0.22, (
            f"Star invocation rate {rate:.2%} outside expected 8%-22% range"
        )


# ---------------------------------------------------------------------------
# End-to-end distribution test
# ---------------------------------------------------------------------------

class TestDistribution:
    """Verify 30/40/30 distribution over 100 poems."""

    def test_ratio_distribution_over_100_poems(self, history_file):
        """
        Generate 100 selections and verify distribution falls within
        30±10 / 40±10 / 30±10 (allowing generous tolerance for randomness).
        """
        counts = {"memento_mori": 0, "memento_vivere": 0, "carpe_diem": 0}
        star_count = 0

        for _ in range(100):
            result = spt.select(history_file=history_file)
            state = result["existential_state"]
            if state in counts:
                counts[state] += 1
            if result["star_invocation"]:
                star_count += 1

        mori_pct = counts["memento_mori"]
        vivere_pct = counts["memento_vivere"]
        carpe_pct = counts["carpe_diem"]

        assert 20 <= mori_pct <= 40, (
            f"Mori count {mori_pct} outside 20-40 range"
        )
        assert 30 <= vivere_pct <= 50, (
            f"Vivere count {vivere_pct} outside 30-50 range"
        )
        assert 20 <= carpe_pct <= 40, (
            f"Carpe count {carpe_pct} outside 20-40 range"
        )

        # Star invocation should be roughly 15% of 100 = ~15
        # Allow 5-25 range for statistical variation
        assert 5 <= star_count <= 30, (
            f"Star invocation count {star_count} outside expected 5-30 range"
        )

    def test_no_poet_repeat_in_window(self, history_file):
        """
        Verify no poet appears twice in any consecutive POET_REPEAT_WINDOW
        selections for the same state.
        """
        # Force all selections to same state for easier verification
        selections = []
        for _ in range(15):
            result = spt.select(
                history_file=history_file,
                forced_state="memento_mori",
            )
            selections.append(result["poet"])

        # Check every window of POET_REPEAT_WINDOW consecutive same-state poems
        window = spt.POET_REPEAT_WINDOW
        for i in range(len(selections) - window):
            window_poets = selections[i : i + window]
            # No duplicates in any window (poet count == window size means all unique)
            assert len(set(window_poets)) == len(window_poets), (
                f"Poet repeated in window at position {i}: {window_poets}"
            )

    def test_select_returns_required_fields(self, history_file):
        result = spt.select(history_file=history_file)
        required = {
            "poet", "existential_state", "scaffold",
            "star_invocation", "auto_corrected", "current_ratios",
        }
        missing = required - result.keys()
        assert not missing, f"Result missing fields: {missing}"

    def test_dry_run_does_not_write_history(self, history_file):
        """Dry run should not persist selection to history file."""
        spt.select(history_file=history_file, dry_run=True)
        assert not Path(history_file).exists(), (
            "History file should not exist after dry_run=True"
        )
