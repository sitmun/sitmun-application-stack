#!/usr/bin/env python3
"""
Import completed translations from missing-translations.csv back into master-translations.json.
Use this after completing translations in the CSV file.
"""

import json
import csv
from pathlib import Path
from typing import Dict, Any

MASTER_FILE = Path(__file__).parent / "master-translations.json"
MISSING_FILE = Path(__file__).parent / "missing-translations.csv"


def load_master_translations() -> Dict[str, Any]:
    """Load master translations file."""
    with open(MASTER_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_missing_translations() -> list:
    """Load completed translations from CSV."""
    if not MISSING_FILE.exists():
        raise FileNotFoundError(f"Missing translations file not found: {MISSING_FILE}")
    
    with open(MISSING_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)


def merge_translations(master: Dict[str, Any], missing_rows: list) -> int:
    """Merge completed translations into master data."""
    updated_count = 0
    languages = [lang for lang in master["metadata"]["languages"] if lang != "en"]
    
    for row in missing_rows:
        entity_name = row["Entity"]
        entity_id = int(row["ID"])
        
        if entity_name not in master["entities"]:
            print(f"Warning: Unknown entity {entity_name}, skipping")
            continue
        
        # Find the entry in master data
        entity_data = master["entities"][entity_name]
        entry = next((e for e in entity_data["translations"] if e["id"] == entity_id), None)
        
        if not entry:
            print(f"Warning: Entry ID {entity_id} not found in {entity_name}, skipping")
            continue
        
        # Update translations
        for lang in languages:
            new_value = row.get(lang, "").strip()
            if new_value:
                old_value = entry.get(lang, "")
                if new_value != old_value:
                    entry[lang] = new_value
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
    print("=" * 60)
    print("SITMUN Translation Importer")
    print("=" * 60)
    print()
    
    if not MISSING_FILE.exists():
        print(f"Error: Missing translations file not found: {MISSING_FILE}")
        print("Run check_translations.py first to generate it.")
        return
    
    print("Loading master translations...")
    master = load_master_translations()
    
    print("Loading completed translations from CSV...")
    missing_rows = load_missing_translations()
    print(f"Found {len(missing_rows)} rows in CSV")
    
    print("\nMerging translations...")
    updated_count = merge_translations(master, missing_rows)
    
    if updated_count > 0:
        print(f"Updated {updated_count} translations")
        save_master_translations(master)
        print(f"Master translations saved to: {MASTER_FILE}")
        print("\nNext steps:")
        print("1. Run check_translations.py to verify completeness")
        print("2. Run generate_translation_files.py to create Liquibase CSVs")
    else:
        print("No new translations found in CSV file")


if __name__ == "__main__":
    main()
