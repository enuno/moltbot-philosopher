"""Pytest configuration for Moltbot tests."""

import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Verify orchestrator modules can be imported
try:
    from orchestrator import council, polemic, engagement
except ImportError as e:
    print(f"Warning: Could not import orchestrator modules: {e}")
