#!/usr/bin/env python3
"""
Generate Liquibase translation CSV files from master-translations.json.
Creates separate CSV files per language and updates the Liquibase changelog.
Scenario (profile) selectable via --scenario or SITMUN_PROFILE; default: postgres.
"""

import argparse
import json
import csv
from pathlib import Path
from typing import Dict, List, Any

from _profile_paths import get_liquibase_root, get_scenario_from_env, SCENARIOS

# Configuration
WORKSPACE_ROOT = Path(__file__).parent.parent.parent
MASTER_FILE = Path(__file__).parent / "master-translations.json"

def load_master_translations() -> Dict[str, Any]:
    """Load master translations file."""
    with open(MASTER_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_csv_for_language(master: Dict[str, Any], lang_code: str, start_id: int) -> tuple[List[Dict[str, Any]], int]:
    """Generate translation rows for a specific language with consecutive IDs."""
    rows = []
    lang_id = master["metadata"]["languageIds"][lang_code]
    current_id = start_id
    
    for entity_name, entity_data in master["entities"].items():
        # Skip entities marked as seedDataOnly (e.g., TaskUITooltip)
        if entity_data.get("seedDataOnly"):
            continue
        
        column_name = entity_data["column"]
        
        for entry in entity_data["translations"]:
            translation_text = entry.get(lang_code, "").strip()
            
            # Skip empty translations
            if not translation_text:
                continue
            
            rows.append({
                "TRA_ID": current_id,
                "TRA_ELEID": entry["id"],
                "TRA_COLUMN": column_name,
                "TRA_LANID": lang_id,
                "TRA_NAME": translation_text
            })
            current_id += 1
    
    return rows, current_id


def write_csv_file(filepath: Path, rows: List[Dict[str, Any]]):
    """Write translation rows to CSV file with proper quoting for 'null' values."""
    if not rows:
        print(f"  No translations to write for {filepath.name}")
        return
    
    fieldnames = ["TRA_ID", "TRA_ELEID", "TRA_COLUMN", "TRA_LANID", "TRA_NAME"]
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_NONNUMERIC)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"  Written {len(rows)} translations to {filepath.name}")


def count_total_translations(master: Dict[str, Any]) -> int:
    """Count total number of translations across all languages."""
    total = 0
    
    for lang_code in master["metadata"]["languages"]:
        if lang_code == "en":  # Skip default language
            continue
        
        for entity_name, entity_data in master["entities"].items():
            # Skip entities marked as seedDataOnly (e.g., TaskUITooltip)
            if entity_data.get("seedDataOnly"):
                continue
            
            for entry in entity_data["translations"]:
                if entry.get(lang_code, "").strip():
                    total += 1
    
    return total


def generate_liquibase_yaml(master: Dict[str, Any]):
    """Generate Liquibase changelog YAML content."""
    yaml_content = """databaseChangeLog:
  - changeSet:
      id: 5
      author: sitmun
      changes:
        - loadData:
            encoding: UTF-8
            file: 05_translations/STM_LANGUAGE.csv
            relativeToChangelogFile: true
            tableName: STM_LANGUAGE
            columns:
              - column:
                  name: LAN_ID
                  type: NUMERIC
              - column:
                  name: LAN_SHORTNAME
                  type: STRING
              - column:
                  name: LAN_NAME
                  type: STRING
"""
    
    # Add loadData for each language's translation file
    for lang_code in master["metadata"]["languages"]:
        if lang_code == "en":  # Skip default language
            continue
        
        lang_upper = lang_code.upper().replace("-", "_")
        yaml_content += f"""        - loadData:
            encoding: UTF-8
            file: 05_translations/STM_TRANSLATION_{lang_upper}.csv
            relativeToChangelogFile: true
            tableName: STM_TRANSLATION
            quotchar: "\\"" 
            columns:
              - column:
                  name: TRA_ID
                  type: NUMERIC
              - column:
                  name: TRA_ELEID
                  type: NUMERIC
              - column:
                  name: TRA_COLUMN
                  type: STRING
              - column:
                  name: TRA_LANID
                  type: NUMERIC
              - column:
                  name: TRA_NAME
                  type: STRING
"""
    
    return yaml_content


def main():
    parser = argparse.ArgumentParser(description="Generate Liquibase translation CSVs from master.")
    parser.add_argument(
        "--scenario",
        choices=SCENARIOS,
        default=get_scenario_from_env(),
        help="Profile/scenario (default: SITMUN_PROFILE or postgres)",
    )
    args = parser.parse_args()
    liquibase_root = get_liquibase_root(WORKSPACE_ROOT, args.scenario)
    output_dir = liquibase_root / "changelog" / "05_translations"
    changelog_file = liquibase_root / "changelog" / "05_translations.yaml"

    print("=" * 60)
    print("SITMUN Translation File Generator")
    print("=" * 60)
    print(f"Scenario: {args.scenario} -> {liquibase_root}")
    print()
    
    # Load master translations
    print("Loading master translations...")
    master = load_master_translations()
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate CSV files for each language with consecutive IDs
    print("\nGenerating translation CSV files with consecutive IDs...")
    current_id = 1
    max_id = 0
    
    for lang_code in master["metadata"]["languages"]:
        if lang_code == "en":  # Skip default language (stored in seed data)
            continue
        
        print(f"\nProcessing {lang_code}...")
        rows, next_id = generate_csv_for_language(master, lang_code, current_id)
        
        lang_upper = lang_code.upper().replace("-", "_")
        output_file = output_dir / f"STM_TRANSLATION_{lang_upper}.csv"
        write_csv_file(output_file, rows)
        
        current_id = next_id
        max_id = next_id - 1
    
    # Generate Liquibase YAML
    print("\nGenerating Liquibase changelog...")
    yaml_content = generate_liquibase_yaml(master)
    with open(changelog_file, 'w', encoding='utf-8') as f:
        f.write(yaml_content)
    print(f"  Updated {changelog_file}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    for entity_name, entity_data in master["entities"].items():
        count = len(entity_data["translations"])
        print(f"{entity_name}: {count} entries")
    print(f"\nTotal translations: {max_id}")
    print(f"Next available ID: {max_id + 1}")
    print("\nNote: TRA_ID sequence is managed by 07_sequences.yaml")


if __name__ == "__main__":
    main()
