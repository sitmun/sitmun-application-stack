#!/usr/bin/env python3
"""
Single orchestration command to generate all production seed + translation outputs.
Invokes generate_translation_files.py and generate_seed_files.py for each target scenario.
"""

import argparse
import subprocess
import sys
from pathlib import Path

from _profile_paths import discover_scenarios, resolve_baseline, _TOOLS_DIR

BIN_DIR = Path(__file__).resolve().parent
WORKSPACE_ROOT = BIN_DIR.parent.parent

DEFAULT_SCENARIOS = "postgres,oracle"


def run(cmd: list[str], dry_run: bool) -> None:
    display = " ".join(str(c) for c in cmd)
    if dry_run:
        print(f"  [DRY-RUN] Would run: {display}")
        return
    print(f"  Running: {display}")
    result = subprocess.run(cmd, cwd=str(BIN_DIR))
    if result.returncode != 0:
        raise SystemExit(f"Command failed (exit {result.returncode}): {display}")


def main() -> None:
    all_scenarios = discover_scenarios(WORKSPACE_ROOT)

    parser = argparse.ArgumentParser(
        description="Generate translation + seed outputs for production profiles in one command."
    )
    parser.add_argument(
        "--scenarios",
        default=DEFAULT_SCENARIOS,
        help=f"Comma-separated list of scenarios (default: {DEFAULT_SCENARIOS})",
    )
    parser.add_argument(
        "--baseline",
        metavar="LANG",
        help="Baseline language code (e.g. en, es); falls back to i18n-active-baseline.json",
    )
    parser.add_argument(
        "--only",
        choices=["translations", "seed"],
        help="Run only one generator type (default: both)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing them",
    )
    args = parser.parse_args()

    # Resolve and validate scenarios
    requested = [s.strip() for s in args.scenarios.split(",") if s.strip()]
    unknown = [s for s in requested if s not in all_scenarios]
    if unknown:
        parser.error(f"Unknown scenarios: {unknown}. Known: {list(all_scenarios)}")
    rejected = [s for s in requested if s == "development"]
    if rejected:
        parser.error("development is not a valid target for seed generation.")

    # Resolve baseline (may raise if not available)
    baseline_code = resolve_baseline(args.baseline, _TOOLS_DIR)

    print("=" * 60)
    print("SITMUN Seed Output Orchestrator")
    print("=" * 60)
    print(f"Scenarios : {requested}")
    print(f"Baseline  : {baseline_code}")
    print(f"Only      : {args.only or 'both'}")
    print(f"Dry-run   : {args.dry_run}")
    print()

    for scenario in requested:
        print(f"--- Scenario: {scenario} ---")

        if args.only != "seed":
            run(
                [
                    sys.executable, str(BIN_DIR / "generate_translation_files.py"),
                    "--scenario", scenario,
                    "--baseline", baseline_code,
                ],
                dry_run=args.dry_run,
            )

        if args.only != "translations":
            run(
                [
                    sys.executable, str(BIN_DIR / "generate_seed_files.py"),
                    "--scenario", scenario,
                ],
                dry_run=args.dry_run,
            )

        print()

    print("=" * 60)
    if args.dry_run:
        print("[DRY-RUN] No files were modified.")
    else:
        print("All outputs generated successfully.")
    print("=" * 60)


if __name__ == "__main__":
    main()
