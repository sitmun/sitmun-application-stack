#!/usr/bin/env python3
"""Sort and renumber quoted CSV (development profile format) by cod_list and cod_description."""

import csv
import sys
from pathlib import Path


def sort_and_renumber_codelist(input_file: Path, output_file: Path = None) -> None:
    """
    Sort quoted CSV by cod_list and cod_description, renumber cod_id from 1 without gaps.
    
    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file (defaults to input_file)
    """
    if output_file is None:
        output_file = input_file
    
    # Read all rows
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        rows = list(reader)
    
    # Sort by cod_list, then cod_description
    rows.sort(key=lambda r: (r['cod_list'], r['cod_description']))
    
    # Renumber cod_id starting from 1
    for idx, row in enumerate(rows, start=1):
        row['cod_id'] = str(idx)
    
    # Write sorted and renumbered data with quoting
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=header, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"Sorted and renumbered {len(rows)} rows")
    print(f"Output written to: {output_file}")


def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python sort_codelist_quoted.py <input_csv> [output_csv]")
        print("\nExample:")
        print("  python sort_codelist_quoted.py stm_codelist.csv")
        print("  python sort_codelist_quoted.py input.csv output.csv")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    
    if not input_file.exists():
        print(f"Error: File not found: {input_file}")
        sys.exit(1)
    
    sort_and_renumber_codelist(input_file, output_file)


if __name__ == '__main__':
    main()
