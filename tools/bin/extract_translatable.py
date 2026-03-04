#!/usr/bin/env python3
"""
Extract translatable content from seed data CSV files.
Populates per-language baselines (master-i18n.<lang>.json).
Scenario (profile) for seed data via --scenario or SITMUN_PROFILE.
"""

import argparse
import csv
from datetime import datetime
from pathlib import Path
from typing import Any

from _profile_paths import (
    get_liquibase_root,
    get_scenario_from_env,
    discover_scenarios,
    discover_baselines,
    load_baseline,
    save_baseline,
)

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed-data"

# Paths for existing translation sources (development profile, lower-case names)
TRANSLATION_SOURCES = {
    "es": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_es.csv",
    "ca": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_ca.csv",
    "fr": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_fr.csv",
    "oc-aranes": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_oc.csv",
}

ENTITY_CONFIG = {
    "Language": {
        "field": "name",
        "id_column": "LAN_ID",
        "value_column": "LAN_NAME",
        "column_name": "Language.name",
    },
    "CodeListValue": {
        "field": "description",
        "id_column": "COD_ID",
        "value_column": "COD_DESCRIPTION",
        "column_name": "CodeListValue.description",
    },
    "TerritoryType": {
        "field": "name",
        "id_column": "TET_ID",
        "value_column": "TET_NAME",
        "column_name": "TerritoryType.name",
    },
    "User": {
        "field": "firstName",
        "id_column": "USE_ID",
        "value_column": "USE_NAME",
        "column_name": "User.firstName",
    },
    "Task": {
        "field": "name",
        "id_column": "TAS_ID",
        "value_column": "TAS_NAME",
        "column_name": "Task.name",
    },
}


def get_seed_data_paths(workspace_root: Path, scenario: str) -> dict[str, Path]:
    root = get_liquibase_root(workspace_root, scenario)
    return {
        "Language": root / "changelog/05_translations/STM_LANGUAGE.csv",
        "CodeListValue": root / "changelog/02_codelists/STM_CODELIST.csv",
        "TerritoryType": root / "changelog/04_seed_data/STM_TER_TYP.csv",
        "User": root / "changelog/04_seed_data/STM_USER.csv",
        "Task": root / "changelog/04_seed_data/STM_TASK.csv",
    }


def read_csv_file(filepath: Path) -> list[dict[str, str]]:
    if not filepath.exists():
        print(f"Warning: File not found: {filepath}")
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def load_existing_translations(lang_code: str) -> dict[tuple[int, str], str]:
    translations: dict[tuple[int, str], str] = {}
    filepath = TRANSLATION_SOURCES.get(lang_code)
    if not filepath or not filepath.exists():
        return translations
    for row in read_csv_file(filepath):
        key = (int(row["TRA_ELEID"]), row["TRA_COLUMN"])
        translations[key] = row["TRA_NAME"]
    return translations


def extract_for_language(
    lang_code: str,
    seed_data_paths: dict[str, Path],
) -> dict[str, list[dict[str, Any]]]:
    """Extract entity translations for a single language. Returns {entity_name: [{id, lang: val}]}."""
    existing = load_existing_translations(lang_code) if lang_code != "en" else {}

    result: dict[str, list[dict[str, Any]]] = {}
    for entity_name, config in ENTITY_CONFIG.items():
        filepath = seed_data_paths.get(entity_name)
        if not filepath or not filepath.exists():
            print(f"Warning: Seed data not found for {entity_name}: {filepath}")
            result[entity_name] = []
            continue

        rows = read_csv_file(filepath)
        entity_rows = []
        for row in rows:
            entity_id = int(row[config["id_column"]])
            if lang_code == "en":
                value = row.get(config["value_column"], "")
            else:
                key = (entity_id, config["column_name"])
                value = existing.get(key, "")
            entity_rows.append({"id": entity_id, lang_code: value})
        result[entity_name] = entity_rows

    return result


def update_baseline(
    lang_code: str,
    baseline: dict[str, Any],
    extracted: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    for entity_name, config in ENTITY_CONFIG.items():
        new_rows = extracted.get(entity_name, [])
        existing_entries = {
            e["id"]: e for e in baseline["entities"].get(entity_name, {}).get("translations", [])
        }
        merged = []
        for row in new_rows:
            eid = row["id"]
            prev = existing_entries.get(eid, {})
            value = row.get(lang_code) or prev.get(lang_code, "")
            merged.append({"id": eid, lang_code: value})

        entity_meta = baseline["entities"].get(entity_name, {})
        baseline["entities"][entity_name] = {
            "field": config["field"],
            "column": config["column_name"],
            "translations": merged,
        }
        if entity_meta.get("seedDataOnly"):
            baseline["entities"][entity_name]["seedDataOnly"] = True

    baseline["metadata"]["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
    return baseline


def main() -> None:
    scenarios = discover_scenarios(WORKSPACE_ROOT)

    parser = argparse.ArgumentParser(
        description="Extract translatable content into master-i18n.<lang>.json files"
    )
    parser.add_argument(
        "--scenario",
        choices=scenarios,
        default=get_scenario_from_env(),
        help="Profile for seed data (default: SITMUN_PROFILE or postgres)",
    )
    parser.add_argument(
        "--baseline", metavar="LANG",
        help="Only update this language baseline (e.g. en). Omit to update all."
    )
    args = parser.parse_args()

    available = discover_baselines(SEED_DATA_DIR)
    langs_to_update = [args.baseline] if args.baseline else available
    seed_data_paths = get_seed_data_paths(WORKSPACE_ROOT, args.scenario)

    print("=" * 60)
    print("SITMUN Translation Extractor")
    print("=" * 60)
    print(f"Scenario (seed data): {args.scenario}")
    print(f"Languages: {langs_to_update}")
    print()

    for lang_code in langs_to_update:
        print(f"Extracting for {lang_code}...")
        extracted = extract_for_language(lang_code, seed_data_paths)
        baseline = load_baseline(lang_code, SEED_DATA_DIR)
        updated = update_baseline(lang_code, baseline, extracted)
        save_baseline(lang_code, updated, SEED_DATA_DIR)
        for entity_name, rows in extracted.items():
            print(f"  {entity_name}: {len(rows)} entries")
        print(f"  -> master-i18n.{lang_code}.json saved")

    print("\nNext steps:")
    print("1. Review the updated master-i18n.*.json files")
    print("2. Complete missing translations")
    print("3. Run generate_translation_files.py to create Liquibase CSVs")


if __name__ == "__main__":
    main()
