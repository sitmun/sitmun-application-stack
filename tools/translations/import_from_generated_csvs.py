#!/usr/bin/env python3
"""
Import translations from generated STM_TRANSLATION_*.csv files into master-translations.json.
Scenario via --scenario or SITMUN_PROFILE; default: postgres.
"""

import argparse
import json
import csv
from pathlib import Path
from typing import Dict, Any

from _profile_paths import get_liquibase_root, get_scenario_from_env, SCENARIOS

WORKSPACE_ROOT = Path(__file__).parent.parent.parent
MASTER_FILE = Path(__file__).parent / "master-translations.json"


def get_translation_files(workspace_root: Path, scenario: str) -> Dict[str, Path]:
    """Paths to generated STM_TRANSLATION_*.csv for the given scenario."""
    trans = get_liquibase_root(workspace_root, scenario) / "changelog/05_translations"
    return {
        "es": trans / "STM_TRANSLATION_ES.csv",
        "ca": trans / "STM_TRANSLATION_CA.csv",
        "fr": trans / "STM_TRANSLATION_FR.csv",
        "oc-aranes": trans / "STM_TRANSLATION_OC_ARANES.csv",
    }

# Language ID mapping
LANG_ID_TO_CODE = {
    1: "en",
    2: "es",
    3: "ca",
    4: "oc-aranes",
    5: "fr"
}


def load_master_translations() -> Dict[str, Any]:
    """Load master translations file."""
    with open(MASTER_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def read_csv_file(filepath: Path):
    """Read CSV file and return list of dictionaries."""
    if not filepath.exists():
        print(f"Warning: File not found: {filepath}")
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)


def import_translations_from_csv(master: Dict[str, Any], lang_code: str, csv_path: Path):
    """Import translations from a CSV file into the master data."""
    rows = read_csv_file(csv_path)
    if not rows:
        return 0
    
    updated_count = 0
    
    for row in rows:
        element_id = int(row["TRA_ELEID"])
        column = row["TRA_COLUMN"]
        translation = row["TRA_NAME"]
        
        # Determine entity name from column
        entity_name = column.split('.')[0]
        
        if entity_name not in master["entities"]:
            print(f"Warning: Entity {entity_name} not found in master data")
            continue
        
        entity_data = master["entities"][entity_name]
        
        # Find the entry in master data
        entry = next((e for e in entity_data["translations"] if e["id"] == element_id), None)
        
        if not entry:
            print(f"Warning: Entry ID {element_id} not found in {entity_name}")
            continue
        
        # Update translation
        if entry.get(lang_code) != translation:
            entry[lang_code] = translation
            updated_count += 1
    
    return updated_count


def save_master_translations(data: Dict[str, Any]):
    """Save master translations to JSON file."""
    from datetime import datetime
    data["metadata"]["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
    
    with open(MASTER_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    """Main import process."""
    parser = argparse.ArgumentParser(description="Import from generated STM_TRANSLATION_*.csv")
    parser.add_argument(
        "--scenario",
        choices=SCENARIOS,
        default=get_scenario_from_env(),
        help="Profile where CSVs live (default: SITMUN_PROFILE or postgres)",
    )
    args = parser.parse_args()
    translation_files = get_translation_files(WORKSPACE_ROOT, args.scenario)

    print("=" * 60)
    print("SITMUN Generated CSV Translation Importer")
    print("=" * 60)
    print(f"Scenario: {args.scenario}")
    print()
    
    print("Loading master translations...")
    master = load_master_translations()
    
    total_updated = 0
    for lang_code, csv_path in translation_files.items():
        print(f"\nImporting {lang_code} from {csv_path.name}...")
        count = import_translations_from_csv(master, lang_code, csv_path)
        print(f"  Updated {count} translations")
        total_updated += count
    
    if total_updated > 0:
        print(f"\nTotal updated: {total_updated} translations")
        save_master_translations(master)
        print(f"Master translations saved to: {MASTER_FILE}")
        print("\nNext steps:")
        print("1. Run check_translations.py to verify completeness")
    else:
        print("\nNo translations were updated")


if __name__ == "__main__":
    main()
