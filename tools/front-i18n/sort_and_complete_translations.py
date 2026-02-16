#!/usr/bin/env python3
"""
Sort i18n JSON keys alphabetically and complete missing keys from reference locale.
Reusable across front applications (admin, viewer, etc.).

Usage:
  python3 sort_and_complete_translations.py --i18n-dir <path>
  python3 sort_and_complete_translations.py --i18n-dir front/admin/sitmun-admin-app/src/assets/i18n --reference en
  python3 sort_and_complete_translations.py --i18n-dir front/viewer/sitmun-viewer-app/src/assets/i18n --no-complete
"""

import argparse
import json
import sys
from pathlib import Path


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def sort_and_complete(
    i18n_dir: Path,
    reference: str = "en",
    complete: bool = True,
    dry_run: bool = False,
) -> tuple[int, int]:
    """
    Sort all JSON keys and add missing keys from reference locale.
    Returns (files_processed, keys_added).
    """
    i18n_dir = i18n_dir.resolve()
    if not i18n_dir.is_dir():
        print(f"Error: not a directory: {i18n_dir}", file=sys.stderr)
        sys.exit(1)

    ref_file = i18n_dir / f"{reference}.json"
    if not ref_file.exists():
        print(f"Error: reference file not found: {ref_file}", file=sys.stderr)
        sys.exit(1)

    ref_data = load_json(ref_file)
    all_keys = sorted(ref_data.keys())
    json_files = sorted(i18n_dir.glob("*.json"))
    files_processed = 0
    keys_added = 0

    for path in json_files:
        data = load_json(path)
        before_keys = set(data.keys())
        if complete:
            for k in all_keys:
                if k not in data:
                    data[k] = ref_data[k]
                    keys_added += 1
        # Keep only keys that exist in this file (and ref if completing)
        if complete:
            data = {k: data[k] for k in all_keys if k in data}
        else:
            data = {k: data[k] for k in sorted(data.keys())}

        if not dry_run:
            save_json(path, data)
        files_processed += 1
        missing = len(all_keys) - len(data) if complete else 0
        print(f"  {path.name}: {len(data)} keys" + (f", {missing} still missing" if missing else ""))

    return files_processed, keys_added


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sort i18n JSON keys and complete missing keys from reference locale."
    )
    parser.add_argument(
        "--i18n-dir",
        type=Path,
        required=True,
        help="Path to assets/i18n directory (e.g. front/admin/sitmun-admin-app/src/assets/i18n)",
    )
    parser.add_argument(
        "--reference",
        default="en",
        help="Reference locale filename without extension (default: en)",
    )
    parser.add_argument(
        "--no-complete",
        action="store_true",
        help="Only sort keys; do not add missing keys from reference",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would be done without writing files",
    )
    args = parser.parse_args()

    # Resolve relative to cwd
    i18n_dir = args.i18n_dir.resolve()
    print(f"I18n dir: {i18n_dir}")
    print(f"Reference: {args.reference}.json, complete: {not args.no_complete}")
    if args.dry_run:
        print("Dry run – no files will be written")
    print()

    files_processed, keys_added = sort_and_complete(
        i18n_dir,
        reference=args.reference,
        complete=not args.no_complete,
        dry_run=args.dry_run,
    )
    print()
    print(f"Processed {files_processed} file(s), added {keys_added} missing key(s).")


if __name__ == "__main__":
    main()
