#!/usr/bin/env python3
"""Import completed translations from missing-translations.csv into per-language baselines."""

import argparse
import csv
from datetime import datetime
from pathlib import Path
from typing import Any

from _profile_paths import discover_baselines, load_baseline, save_baseline

SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed-data"
MISSING_FILE = SEED_DATA_DIR / "missing-translations.csv"


def load_missing_translations() -> list[dict[str, str]]:
    if not MISSING_FILE.exists():
        raise FileNotFoundError(f"Missing translations file not found: {MISSING_FILE}")
    with open(MISSING_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def merge_into_baseline(
    lang_code: str, master: dict[str, Any], missing_rows: list[dict[str, str]]
) -> int:
    updated_count = 0
    for row in missing_rows:
        entity_name = row["Entity"]
        entity_id = int(row["ID"])
        new_value = row.get(lang_code, "").strip()
        if not new_value:
            continue

        if entity_name not in master["entities"]:
            continue

        entity_data = master["entities"][entity_name]
        entry = next((e for e in entity_data["translations"] if e["id"] == entity_id), None)
        if not entry:
            continue

        if new_value != entry.get(lang_code, ""):
            entry[lang_code] = new_value
            updated_count += 1

    return updated_count


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import completed translations from missing-translations.csv."
    )
    parser.add_argument(
        "--baseline", metavar="LANG",
        help="Only update this language (e.g. es). Omit to update all languages."
    )
    args = parser.parse_args()

    if not MISSING_FILE.exists():
        print(f"Error: Missing translations file not found: {MISSING_FILE}")
        print("Run check_translations.py first to generate it.")
        return

    available = discover_baselines(SEED_DATA_DIR)
    langs_to_update = [args.baseline] if args.baseline else available

    print("=" * 60)
    print("SITMUN Translation Importer")
    print("=" * 60)
    print()

    missing_rows = load_missing_translations()
    print(f"Found {len(missing_rows)} rows in CSV")

    total_updated = 0
    for lang_code in langs_to_update:
        master = load_baseline(lang_code, SEED_DATA_DIR)
        updated = merge_into_baseline(lang_code, master, missing_rows)
        if updated > 0:
            save_baseline(lang_code, master, SEED_DATA_DIR)
            print(f"  {lang_code}: updated {updated} translations -> master-i18n.{lang_code}.json")
            total_updated += updated
        else:
            print(f"  {lang_code}: no new translations")

    if total_updated > 0:
        print(f"\nTotal updated: {total_updated} translations")
        print("\nNext steps:")
        print("1. Run check_translations.py to verify completeness")
        print("2. Run generate_translation_files.py to create Liquibase CSVs")
    else:
        print("\nNo new translations found in CSV file")


if __name__ == "__main__":
    main()
