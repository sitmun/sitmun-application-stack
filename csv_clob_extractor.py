#!/usr/bin/env python3
"""
CSV CLOB Extractor

Extracts content from a specified column in a CSV file to individual files,
replacing the original content with file:/ references.

Usage:
    python csv_clob_extractor.py input.csv column_name [--output-dir=DIR] [--output-csv=FILE]

Arguments:
    input.csv      Input CSV file to process
    column_name    Name of the column containing CLOB data to extract

Options:
    --output-dir=DIR     Directory to store extracted files [default: clob_files]
    --output-csv=FILE    Output CSV file name [default: input_processed.csv]
"""

import csv
import os
import sys
import argparse
import re
from pathlib import Path

def slugify(text):
    """Convert text to a file-safe string"""
    return re.sub(r'[^\w\s-]', '', text.lower()).strip().replace(' ', '_')

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Extract CLOB data from CSV columns to files')
    parser.add_argument('changelog', help='Changelog CSV file')
    parser.add_argument('input_csv', help='Input CSV file')
    parser.add_argument('column_name', help='Name of column containing CLOB data')
    parser.add_argument('--output-dir', default='clob_files', help='Directory to store extracted files')
    parser.add_argument('--output-csv', help='Output CSV file (default: input_processed.csv)')
    parser.add_argument('--input-delimiter', default=",", help='Input delimiter (default: ,)')
    parser.add_argument('--output-delimiter', default=",", help='Output delimiter (default: ,)')
    parser.add_argument('--input-quotechar', default="'", help='Input quote char (default: '')')
    parser.add_argument('--output-quotechar', default="'", help='Output quote char (default: '')')
    parser.add_argument('--uppercase-header', default="false", help='Uppercase header (default: false)')

    args = parser.parse_args()
    
    # Set up paths
    input_csv = args.input_csv
    column_name = args.column_name
    output_dir = args.output_dir
    changelog = args.changelog
    input_delimiter = args.input_delimiter
    output_delimiter = args.output_delimiter
    input_quotechar = args.input_quotechar
    output_quotechar = args.output_quotechar
    uppercase_header = args.uppercase_header.lower() == 'true'

    # Default output CSV name based on input name if not specified
    input_path = Path(input_csv)
    if not args.output_csv:
        output_csv = Path(str(input_path.with_name(f"{input_path.stem}_processed{input_path.suffix}")))
    else:
        output_csv = Path(args.output_csv)

    output_path = Path(output_dir)
    if not output_path.is_absolute():
        output_path = Path(input_path.parent, output_path)

    # Create output directory if it doesn't exist
    if not output_path.exists():
        print(f"Creating output directory: {output_path}")
        os.makedirs(output_path, exist_ok=True)
    
    print(f"Processing CSV file: {input_csv}")
    print(f"Extracting column: {column_name}")
    print(f"Output directory: {output_path}")
    print(f"Output CSV: {output_csv}")
    
    try:
        # Find the index of the target column
        with open(input_csv, 'r', newline='', encoding='utf-8') as f:
            reader = csv.reader(f, quotechar=input_quotechar, delimiter=input_delimiter)
            header = next(reader)
            
            try:
                column_index = header.index(column_name)
            except ValueError:
                print(f"Error: Column '{column_name}' not found in CSV header.")
                print(f"Available columns: {', '.join(header)}")
                sys.exit(1)
        
        # Process the CSV file
        row_count = 0
        extracted_count = 0
        
        with open(input_csv, 'r', newline='', encoding='utf-8') as infile, \
             open(output_csv, 'w', newline='', encoding='utf-8') as outfile:
            
            reader = csv.reader(infile, quotechar=input_quotechar, delimiter=input_delimiter)
            writer = csv.writer(outfile, quotechar=output_quotechar, delimiter=output_delimiter)
            
            # Write header row
            header = next(reader)
            if uppercase_header:
                header = [col.upper() for col in header]
            writer.writerow(header)
            
            # Process data rows
            for row_num, row in enumerate(reader, 2):  # Start from line 2 (after header)
                row_count += 1
                
                # Handle the CLOB field if it exists and has content
                if column_index < len(row) and row[column_index] and row[column_index].lower() != 'null':
                    # Extract content, handling quoted values
                    content = row[column_index]
                    
                    # Create a filename for the extracted content
                    base_name = os.path.basename(input_csv).replace('.csv', '')
                    file_name = f"{base_name}_{slugify(column_name)}_row{row_num}.txt"
                    file_path = os.path.join(output_path, file_name)
                    print(f"- Updated CSV saved to {file_path}")

                    # Write content to file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    
                    # Replace cell content with file reference
                    rel_path = os.path.join(changelog, output_dir, file_name)
                    row[column_index] = f"file:{rel_path}"
                    extracted_count += 1
                
                # Write the modified row
                writer.writerow(row)
        
        print(f"\nProcessing complete:")
        print(f"- Processed {row_count} data rows")
        print(f"- Extracted {extracted_count} entries to {output_dir}")
        print(f"- Updated CSV saved to {output_csv}")
        print("\nImportant: When using this CSV with Liquibase, ensure the column type is 'STRING', not 'CLOB'")
    
    except Exception as e:
        print(f"Error processing CSV: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 