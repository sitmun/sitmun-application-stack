#!/usr/bin/env python3
"""Check translation completeness and report missing translations."""

import argparse
import csv
from pathlib import Path
from collections import defaultdict
from typing import Any

from _profile_paths import load_all_baselines, discover_baselines

SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed-data"


def check_completeness(master: dict[str, Any]) -> dict[str, Any]:
    languages = list(master["metadata"]["allLanguageIds"].keys())

    stats: dict[str, Any] = {
        "by_entity": {},
        "by_language": defaultdict(lambda: {"complete": 0, "missing": 0}),
        "missing_details": defaultdict(list),
    }

    for entity_name, entity_data in master["entities"].items():
        entity_stats: dict[str, Any] = {
            "total": len(entity_data["translations"]),
            "by_language": {},
        }

        for lang in languages:
            complete = 0
            missing = 0
            for entry in entity_data["translations"]:
                translation = entry.get(lang, "").strip()
                if translation:
                    complete += 1
                    stats["by_language"][lang]["complete"] += 1
                else:
                    missing += 1
                    stats["by_language"][lang]["missing"] += 1
                    stats["missing_details"][lang].append(
                        {"entity": entity_name, "id": entry["id"], "en": entry.get("en", "")}
                    )

            entity_stats["by_language"][lang] = {
                "complete": complete,
                "missing": missing,
                "percentage": (complete / entity_stats["total"] * 100)
                if entity_stats["total"] > 0
                else 0,
            }

        stats["by_entity"][entity_name] = entity_stats

    return stats


def print_statistics(stats: dict[str, Any], master: dict[str, Any]) -> None:
    languages = list(master["metadata"]["allLanguageIds"].keys())

    print("=" * 60)
    print("Translation Completeness Report")
    print("=" * 60)
    print()

    print("Overall Statistics:")
    print("-" * 60)
    for lang in languages:
        complete = stats["by_language"][lang]["complete"]
        missing = stats["by_language"][lang]["missing"]
        total = complete + missing
        percentage = (complete / total * 100) if total > 0 else 0
        print(f"{lang:12s}: {complete:4d}/{total:4d} ({percentage:5.1f}%) complete")
    print()

    print("By Entity:")
    print("-" * 60)
    for entity_name, entity_stats in stats["by_entity"].items():
        print(f"\n{entity_name} ({entity_stats['total']} entries):")
        for lang in languages:
            ls = entity_stats["by_language"][lang]
            print(
                f"  {lang:12s}: {ls['complete']:4d}/{entity_stats['total']:4d} "
                f"({ls['percentage']:5.1f}%) complete"
            )

    print("\n" + "=" * 60)
    print("Missing Translations:")
    print("=" * 60)
    for lang in languages:
        missing = stats["missing_details"][lang]
        if missing:
            print(f"\n{lang.upper()} - {len(missing)} missing:")
            for item in missing[:10]:
                print(f"  {item['entity']:20s} ID {item['id']:3d}: {item['en']}")
            if len(missing) > 10:
                print(f"  ... and {len(missing) - 10} more")
        else:
            print(f"\n{lang.upper()}: All translations complete!")


def export_missing_to_csv(stats: dict[str, Any], master: dict[str, Any]) -> None:
    output_file = SEED_DATA_DIR / "missing-translations.csv"
    languages = list(master["metadata"]["allLanguageIds"].keys())
    fieldnames = ["Entity", "ID", "Field", "en"] + languages + ["Notes"]

    rows = []
    for entity_name, entity_data in master["entities"].items():
        for entry in entity_data["translations"]:
            if any(not entry.get(lang, "").strip() for lang in languages):
                row: dict[str, Any] = {
                    "Entity": entity_name,
                    "ID": entry["id"],
                    "Field": entity_data["field"],
                    "en": entry.get("en", ""),
                    "Notes": "",
                }
                for lang in languages:
                    row[lang] = entry.get(lang, "")
                rows.append(row)

    if rows:
        with open(output_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)
        print(f"\nMissing translations exported to: {output_file}")
        print("Complete the translations and run import_missing_translations.py")
    else:
        print("\nNo missing translations found!")


def main() -> None:
    parser = argparse.ArgumentParser(description="Check translation completeness.")
    parser.add_argument("--baseline", metavar="LANG", help="(ignored, kept for compatibility)")
    args = parser.parse_args()

    master = load_all_baselines(SEED_DATA_DIR)

    print("=" * 60)
    print("SITMUN Translation Checker")
    print("=" * 60)
    print()

    stats = check_completeness(master)
    print_statistics(stats, master)

    print("\n" + "=" * 60)
    export_missing_to_csv(stats, master)


if __name__ == "__main__":
    main()
