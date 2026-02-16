#!/usr/bin/env python3
"""
Check translation completeness and report missing translations.
Helps identify which entries need translation work.
"""

import json
import csv
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

MASTER_FILE = Path(__file__).parent / "master-translations.json"


def load_master_translations() -> Dict[str, Any]:
    """Load master translations file."""
    with open(MASTER_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def check_completeness(master: Dict[str, Any]) -> Dict[str, Any]:
    """Check translation completeness and return statistics."""
    languages = [lang for lang in master["metadata"]["languages"] if lang != "en"]
    
    stats = {
        "total_entries": 0,
        "by_entity": {},
        "by_language": defaultdict(lambda: {"complete": 0, "missing": 0}),
        "missing_details": defaultdict(list)
    }
    
    for entity_name, entity_data in master["entities"].items():
        entity_stats = {
            "total": len(entity_data["translations"]),
            "by_language": {}
        }
        
        for lang in languages:
            complete = 0
            missing = 0
            
            for entry in entity_data["translations"]:
                stats["total_entries"] += 1
                translation = entry.get(lang, "").strip()
                
                if translation:
                    complete += 1
                    stats["by_language"][lang]["complete"] += 1
                else:
                    missing += 1
                    stats["by_language"][lang]["missing"] += 1
                    stats["missing_details"][lang].append({
                        "entity": entity_name,
                        "id": entry["id"],
                        "en": entry["en"]
                    })
            
            entity_stats["by_language"][lang] = {
                "complete": complete,
                "missing": missing,
                "percentage": (complete / entity_stats["total"] * 100) if entity_stats["total"] > 0 else 0
            }
        
        stats["by_entity"][entity_name] = entity_stats
    
    return stats


def print_statistics(stats: Dict[str, Any], master: Dict[str, Any]):
    """Print translation statistics in a readable format."""
    languages = [lang for lang in master["metadata"]["languages"] if lang != "en"]
    
    print("=" * 60)
    print("Translation Completeness Report")
    print("=" * 60)
    print()
    
    # Overall statistics
    print("Overall Statistics:")
    print("-" * 60)
    for lang in languages:
        complete = stats["by_language"][lang]["complete"]
        missing = stats["by_language"][lang]["missing"]
        total = complete + missing
        percentage = (complete / total * 100) if total > 0 else 0
        print(f"{lang:12s}: {complete:4d}/{total:4d} ({percentage:5.1f}%) complete")
    print()
    
    # Per-entity statistics
    print("By Entity:")
    print("-" * 60)
    for entity_name, entity_stats in stats["by_entity"].items():
        print(f"\n{entity_name} ({entity_stats['total']} entries):")
        for lang in languages:
            lang_stats = entity_stats["by_language"][lang]
            print(f"  {lang:12s}: {lang_stats['complete']:4d}/{entity_stats['total']:4d} "
                  f"({lang_stats['percentage']:5.1f}%) complete")
    
    # Missing translations details
    print("\n" + "=" * 60)
    print("Missing Translations:")
    print("=" * 60)
    for lang in languages:
        missing = stats["missing_details"][lang]
        if missing:
            print(f"\n{lang.upper()} - {len(missing)} missing:")
            for item in missing[:10]:  # Show first 10
                print(f"  {item['entity']:20s} ID {item['id']:3d}: {item['en']}")
            if len(missing) > 10:
                print(f"  ... and {len(missing) - 10} more")
        else:
            print(f"\n{lang.upper()}: All translations complete! ✓")


def export_missing_to_csv(stats: Dict[str, Any], master: Dict[str, Any]):
    """Export missing translations to CSV for easy completion."""
    output_file = Path(__file__).parent / "missing-translations.csv"
    
    languages = [lang for lang in master["metadata"]["languages"] if lang != "en"]
    fieldnames = ["Entity", "ID", "Field", "en"] + languages + ["Notes"]
    
    rows = []
    for entity_name, entity_data in master["entities"].items():
        for entry in entity_data["translations"]:
            # Check if any language is missing
            has_missing = any(not entry.get(lang, "").strip() for lang in languages)
            
            if has_missing:
                row = {
                    "Entity": entity_name,
                    "ID": entry["id"],
                    "Field": entity_data["field"],
                    "en": entry["en"],
                    "Notes": ""
                }
                for lang in languages:
                    row[lang] = entry.get(lang, "")
                rows.append(row)
    
    if rows:
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"\nMissing translations exported to: {output_file}")
        print(f"Complete the translations and run import_missing_translations.py")
    else:
        print("\nNo missing translations found!")


def main():
    """Main check process."""
    print("=" * 60)
    print("SITMUN Translation Checker")
    print("=" * 60)
    print()
    
    if not MASTER_FILE.exists():
        print(f"Error: Master translations file not found: {MASTER_FILE}")
        print("Run extract_translatable.py first.")
        return
    
    master = load_master_translations()
    stats = check_completeness(master)
    print_statistics(stats, master)
    
    print("\n" + "=" * 60)
    export_missing_to_csv(stats, master)


if __name__ == "__main__":
    main()
