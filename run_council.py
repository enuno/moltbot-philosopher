#!/usr/bin/env python3
"""Manual council invocation script."""
import sys
import os
import argparse
import json
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from orchestrator.council import CouncilOrchestrator, FULL_COUNCIL_MEMBERS


def main():
    parser = argparse.ArgumentParser(description="Run the Philosophers Council")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually post to Moltbook")
    parser.add_argument("--force", action="store_true", help="Force run even if already run today")
    parser.add_argument("--state-file", default="/tmp/council_state.json", help="Path to state file")
    parser.add_argument("--workspace-dir", default=None, help="Workspace directory (default: /workspace)")
    parser.add_argument("--list-philosophers", action="store_true", help="List available philosophers and exit")
    parser.add_argument("--check", action="store_true", help="Check if council should convene and exit")
    args = parser.parse_args()

    # Set environment for dry-run mode
    if args.dry_run:
        os.environ["MOLTBOOK_DRY_RUN"] = "true"
        print("🧪 DRY RUN MODE: No actual posts will be made")

    # Initialize orchestrator
    try:
        orchestrator = CouncilOrchestrator(
            state_file=args.state_file,
            workspace_dir=args.workspace_dir
        )
    except Exception as e:
        print(f"❌ Failed to initialize orchestrator: {e}")
        print("\nMake sure environment variables are set:")
        print("  export MOLTBOOK_API_KEY='moltbook_...'")
        print("  export MOLTBOOK_BASE_URL='https://www.moltbook.com/api'")
        print("  export MOLTBOOK_STATE_DIR='/workspace/classical'")
        sys.exit(1)

    if args.list_philosophers:
        print("Available philosophers:")
        for name in FULL_COUNCIL_MEMBERS:
            print(f"  - {name}")
        print(f"\nConfigured roster ({len(orchestrator.state.council_roster)}):")
        for name in orchestrator.state.council_roster:
            print(f"  - {name}")
        return

    if args.check:
        should_convene = orchestrator.should_convene()
        time_until = orchestrator.time_until_next()
        print(f"Council status:")
        print(f"  Should convene: {should_convene}")
        print(f"  Time until next: {time_until}")
        print(f"  Last iteration: {orchestrator.state.last_iteration_date}")
        print(f"  Current axis: {orchestrator.get_current_axis()}")
        return

    print(f"🎯 Council Orchestrator initialized")
    print(f"   State file: {orchestrator.state_file}")
    print(f"   Workspace: {orchestrator.workspace_dir}")
    print(f"   Council members: {orchestrator.state.council_member_count}")
    print(f"   Last iteration: {orchestrator.state.last_iteration_date}")
    print(f"   Current axis: {orchestrator.get_current_axis()}")

    # Run council
    try:
        result = orchestrator.convene(
            dry_run=args.dry_run,
            force=args.force
        )

        print(f"\n✅ Council operation complete")
        print(f"   Convened: {result.get('convened', False)}")
        
        if 'reason' in result:
            print(f"   Reason: {result['reason']}")
        
        if result.get('convened'):
            print(f"   Iteration count: {orchestrator.state.iteration_count}")
            if hasattr(orchestrator.state, 'treatise_posted'):
                print(f"   Treatise posted: {orchestrator.state.treatise_posted}")
        
        if result.get('dry_run'):
            print(f"\n   Dry run details:")
            print(f"     Current version: {result.get('current_version')}")
            print(f"     New version: {result.get('new_version')}")
            print(f"     Axis: {result.get('axis')}")
            print(f"     Feedback count: {result.get('feedback_count')}")
            print(f"     Dropbox count: {result.get('dropbox_count')}")

        if orchestrator.state.revision_history:
            latest = orchestrator.state.revision_history[-1]
            print(f"\n   Latest revision:")
            print(f"     Date: {latest.get('date', 'unknown')}")
            print(f"     Axis: {latest.get('axis', 'unknown')}")
            if 'summary' in latest:
                summary = latest['summary'][:150].replace('\n', ' ')
                print(f"     Summary: {summary}...")

    except Exception as e:
        print(f"\n❌ Council failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
