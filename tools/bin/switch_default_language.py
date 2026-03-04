#!/usr/bin/env python3
"""
Switch the default language for SITMUN deployment.

Non-destructive: selects an i18n baseline and regenerates production profiles.
Never modifies development profile or master-seed-data.json.

Usage:
    python3 switch_default_language.py es              # Switch to Spanish
    python3 switch_default_language.py ca --dry-run    # Preview Catalan switch
    python3 switch_default_language.py --dry-run en    # Preview English switch
"""

import argparse
import json
import sys
import subprocess
from datetime import datetime
from pathlib import Path

from _profile_paths import (
    discover_scenarios,
    resolve_baseline,
    discover_baselines,
)

BIN_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = BIN_DIR.parent.parent
SEED_DATA_DIR = BIN_DIR.parent / "seed-data"
SELECTOR_FILE = SEED_DATA_DIR / "i18n-active-baseline.json"

PRODUCTION_SCENARIOS = ("postgres", "oracle")


def update_selector(baseline_code: str, dry_run: bool) -> None:
    selector = {"activeBaseline": baseline_code, "lastUpdated": datetime.now().strftime("%Y-%m-%d")}
    if dry_run:
        print(f"[DRY-RUN] Would write {SELECTOR_FILE}: {selector}")
        return
    with open(SELECTOR_FILE, "w", encoding="utf-8") as f:
        json.dump(selector, f, indent=2)
    print(f"Selector updated: {SELECTOR_FILE} -> activeBaseline={baseline_code}")


def regenerate_production(baseline_code: str, dry_run: bool) -> None:
    orchestrator = BIN_DIR / "generate_all_seed_outputs.py"
    if not orchestrator.exists():
        print(f"WARNING: Orchestrator not found at {orchestrator}")
        print("Run generate_translation_files.py and generate_seed_files.py manually.")
        return

    cmd = [
        sys.executable, str(orchestrator),
        "--baseline", baseline_code,
        "--scenarios", ",".join(PRODUCTION_SCENARIOS),
    ]
    if dry_run:
        cmd.append("--dry-run")

    print(f"\nInvoking: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(BIN_DIR))
    if result.returncode != 0:
        raise SystemExit(f"ERROR: Orchestrator exited with code {result.returncode}")


def main() -> None:
    available = discover_baselines(SEED_DATA_DIR)
    parser = argparse.ArgumentParser(
        description="Switch the default language (non-destructive baseline selection).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"Available baselines: {', '.join(available)}",
    )
    parser.add_argument(
        "language",
        nargs="?",
        help="Target baseline language code",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without modifying files or regenerating",
    )
    parser.add_argument(
        "--baseline",
        metavar="LANG",
        help="Alias for positional language argument",
    )
    args = parser.parse_args()

    target = args.language or args.baseline
    if not target:
        parser.error("A target language is required (e.g. python3 switch_default_language.py es)")

    baseline_code = resolve_baseline(target, SEED_DATA_DIR)

    print("=" * 60)
    print(f"SITMUN Language Switcher (non-destructive)")
    print("=" * 60)
    print(f"Target baseline: {baseline_code}")
    print(f"Dry-run: {args.dry_run}")
    print()

    # Step 1: Update selector
    update_selector(baseline_code, args.dry_run)

    # Step 2: Regenerate production profiles
    print("\nRegenerating production profiles...")
    regenerate_production(baseline_code, args.dry_run)

    print("\n" + "=" * 60)
    if args.dry_run:
        print("[DRY-RUN] No files modified.")
    else:
        print(f"Successfully switched to baseline: {baseline_code}")
        print("Development profile was NOT modified.")
        print("master-seed-data.json was NOT modified.")
    print("=" * 60)


if __name__ == "__main__":
    main()
