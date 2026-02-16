#!/usr/bin/env python3
"""
Extract translatable content from seed data CSV files and existing translations.
Populates master-translations.json. Scenario (profile) for seed data via --scenario or SITMUN_PROFILE.
"""

import argparse
import json
import csv
import os
from pathlib import Path
from typing import Dict, List, Any

from _profile_paths import get_liquibase_root, get_scenario_from_env, SCENARIOS

# Configuration
WORKSPACE_ROOT = Path(__file__).parent.parent.parent
MASTER_FILE = Path(__file__).parent / "master-translations.json"


def get_seed_data_paths(workspace_root: Path, scenario: str) -> Dict[str, Path]:
    """Seed data CSV paths for the given scenario (postgres/oracle layout)."""
    root = get_liquibase_root(workspace_root, scenario)
    return {
        "Language": root / "changelog/05_translations/STM_LANGUAGE.csv",
        "CodeListValue": root / "changelog/02_codelists/STM_CODELIST.csv",
        "TerritoryType": root / "changelog/04_seed_data/STM_TER_TYP.csv",
        "User": root / "changelog/04_seed_data/STM_USER.csv",
        "Task": root / "changelog/04_seed_data/STM_TASK.csv",
    }

# Existing translation sources (development profile)
TRANSLATION_SOURCES = {
    "es": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_es.csv",
    "ca": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_ca.csv",
    "fr": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_fr.csv",
    "oc-aranes": WORKSPACE_ROOT / "profiles/development/backend/liquibase/changelog/12_translations/stm_translation_oc.csv",
}

# Entity configuration
ENTITY_CONFIG = {
    "Language": {
        "field": "name",
        "id_column": "LAN_ID",
        "value_column": "LAN_NAME",
        "column_name": "Language.name"
    },
    "CodeListValue": {
        "field": "description",
        "id_column": "COD_ID",
        "value_column": "COD_DESCRIPTION",
        "column_name": "CodeListValue.description"
    },
    "TerritoryType": {
        "field": "name",
        "id_column": "TET_ID",
        "value_column": "TET_NAME",
        "column_name": "TerritoryType.name"
    },
    "User": {
        "field": "firstName",
        "id_column": "USE_ID",
        "value_column": "USE_NAME",
        "column_name": "User.firstName"
    },
    "Task": {
        "field": "name",
        "id_column": "TAS_ID",
        "value_column": "TAS_NAME",
        "column_name": "Task.name"
    }
}


def load_master_translations() -> Dict[str, Any]:
    """Load existing master translations file."""
    if MASTER_FILE.exists():
        with open(MASTER_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "metadata": {
            "version": "1.0",
            "lastUpdated": "",
            "languages": ["en", "es", "ca", "oc-aranes", "fr"],
            "languageIds": {"en": 1, "es": 2, "ca": 3, "oc-aranes": 4, "fr": 5},
            "defaultLanguage": "en"
        },
        "entities": {}
    }


def read_csv_file(filepath: Path) -> List[Dict[str, str]]:
    """Read CSV file and return list of dictionaries."""
    if not filepath.exists():
        print(f"Warning: File not found: {filepath}")
        return []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)


def load_existing_translations(lang_code: str) -> Dict[tuple, str]:
    """Load existing translations for a language from development profile."""
    translations = {}
    filepath = TRANSLATION_SOURCES.get(lang_code)
    
    if not filepath or not filepath.exists():
        return translations
    
    rows = read_csv_file(filepath)
    for row in rows:
        element_id = int(row['TRA_ELEID'])
        column = row['TRA_COLUMN']
        translation = row['TRA_NAME']
        translations[(element_id, column)] = translation
    
    return translations


def extract_entity_data(
    entity_name: str, config: Dict[str, str], seed_data_paths: Dict[str, Path]
) -> List[Dict[str, Any]]:
    """Extract translatable data for an entity from its seed CSV."""
    filepath = seed_data_paths.get(entity_name)
    if not filepath or not filepath.exists():
        print(f"Warning: Seed data not found for {entity_name}")
        return []
    
    rows = read_csv_file(filepath)
    translations = []
    
    # Load existing translations for all languages
    lang_translations = {}
    for lang in ["es", "ca", "fr", "oc-aranes"]:
        lang_translations[lang] = load_existing_translations(lang)
    
    for row in rows:
        entity_id = int(row[config['id_column']])
        en_value = row[config['value_column']]
        
        translation_entry = {
            "id": entity_id,
            "en": en_value
        }
        
        # Add existing translations from development profile
        for lang in ["es", "ca", "fr", "oc-aranes"]:
            key = (entity_id, config['column_name'])
            translation_entry[lang] = lang_translations[lang].get(key, "")
        
        translations.append(translation_entry)
    
    return translations


def extract_all_translations(seed_data_paths: Dict[str, Path]) -> Dict[str, Any]:
    """Extract all translatable content and merge with existing translations."""
    master = load_master_translations()
    
    for entity_name, config in ENTITY_CONFIG.items():
        print(f"Extracting {entity_name}...")
        translations = extract_entity_data(entity_name, config, seed_data_paths)
        
        master["entities"][entity_name] = {
            "field": config['field'],
            "column": config['column_name'],
            "translations": translations
        }
        
        print(f"  Found {len(translations)} entries")
    
    # Update metadata
    from datetime import datetime
    master["metadata"]["lastUpdated"] = datetime.now().strftime("%Y-%m-%d")
    
    return master


def save_master_translations(data: Dict[str, Any]):
    """Save master translations to JSON file."""
    with open(MASTER_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nMaster translations saved to: {MASTER_FILE}")


def main():
    """Main extraction process."""
    parser = argparse.ArgumentParser(description="Extract translatable content into master-translations.json")
    parser.add_argument(
        "--scenario",
        choices=SCENARIOS,
        default=get_scenario_from_env(),
        help="Profile for seed data (default: SITMUN_PROFILE or postgres)",
    )
    args = parser.parse_args()
    seed_data_paths = get_seed_data_paths(WORKSPACE_ROOT, args.scenario)

    print("=" * 60)
    print("SITMUN Translation Extractor")
    print("=" * 60)
    print(f"Scenario (seed data): {args.scenario}")
    print()
    
    master = extract_all_translations(seed_data_paths)
    save_master_translations(master)
    
    # Print summary
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    for entity_name, entity_data in master["entities"].items():
        count = len(entity_data["translations"])
        print(f"{entity_name}: {count} entries")
    
    print("\nNext steps:")
    print("1. Review master-translations.json")
    print("2. Complete missing translations")
    print("3. Run generate_translation_files.py to create Liquibase CSVs")


if __name__ == "__main__":
    main()
