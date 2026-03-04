#!/usr/bin/env python3
"""Import translations from generated STM_TRANSLATION_*.csv files into a baseline."""

import argparse
import csv
from datetime import datetime
from pathlib import Path
from typing import Any

from _profile_paths import (
    get_liquibase_root,
    get_scenario_from_env,
    discover_scenarios,
    load_baseline,
    save_baseline,
)

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed-data"

LANG_ID_TO_CODE = {1: "en", 2: "es", 3: "ca", 4: "oc-aranes", 5: "fr"}


def get_translation_files(workspace_root: Path, scenario: str) -> dict[str, Path]:
    trans = get_liquibase_root(workspace_root, scenario) / "changelog/05_translations"
    return {
        "es": trans / "STM_TRANSLATION_ES.csv",
        "ca": trans / "STM_TRANSLATION_CA.csv",
        "fr": trans / "STM_TRANSLATION_FR.csv",
        "oc-aranes": trans / "STM_TRANSLATION_OC_ARANES.csv",
    }


def read_csv_file(filepath: Path) -> list[dict[str, str]]:
    if not filepath.exists():
        print(f"Warning: File not found: {filepath}")
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def import_translations_from_csv(
    master: dict[str, Any], lang_code: str, csv_path: Path
) -> int:
    rows = read_csv_file(csv_path)
    if not rows:
        return 0

    updated_count = 0
    for row in rows:
        element_id = int(row["TRA_ELEID"])
        column = row["TRA_COLUMN"]
        translation = row["TRA_NAME"]

        entity_name = column.split(".")[0]
        if entity_name not in master["entities"]:
            print(f"Warning: Entity {entity_name} not found in master data")
            continue

        entity_data = master["entities"][entity_name]
        entry = next((e for e in entity_data["translations"] if e["id"] == element_id), None)
        if not entry:
            print(f"Warning: Entry ID {element_id} not found in {entity_name}")
            continue

        if entry.get(lang_code) != translation:
            entry[lang_code] = translation
            updated_count += 1

    return updated_count


def main() -> None:
    scenarios = discover_scenarios(WORKSPACE_ROOT)
    parser = argparse.ArgumentParser(description="Import from generated STM_TRANSLATION_*.csv.")
    parser.add_argument(
        "--scenario",
        choices=scenarios,
        default=get_scenario_from_env(),
        help="Profile where CSVs live (default: SITMUN_PROFILE or postgres)",
    )
    parser.add_argument("--baseline", metavar="LANG", help="Baseline to update (e.g. es). Required.")
    args = parser.parse_args()

    if not args.baseline:
        parser.error("--baseline is required (e.g. --baseline es)")

    baseline_code = args.baseline.strip()
    master = load_baseline(baseline_code, SEED_DATA_DIR)
    translation_files = get_translation_files(WORKSPACE_ROOT, args.scenario)

    print("=" * 60)
    print(f"SITMUN Generated CSV Translation Importer (baseline: {baseline_code})")
    print("=" * 60)
    print(f"Scenario: {args.scenario}")
    print()

    total_updated = 0
    for lang_code, csv_path in translation_files.items():
        print(f"\nImporting {lang_code} from {csv_path.name}...")
        count = import_translations_from_csv(master, lang_code, csv_path)
        print(f"  Updated {count} translations")
        total_updated += count

    if total_updated > 0:
        master["metadata"]["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
        save_baseline(baseline_code, master, SEED_DATA_DIR)
        print(f"\nTotal updated: {total_updated} translations")
        print(f"Baseline saved: master-i18n.{baseline_code}.json")
        print("\nNext steps:")
        print("1. Run check_translations.py --baseline <lang> to verify")
    else:
        print("\nNo translations were updated")


if __name__ == "__main__":
    main()
