#!/usr/bin/env python3
"""Prepare a copied Liquibase tree so Liquibase 4.29 can apply a tagged release.

Origin tags before 1.2.7 ship CSVs that 4.29 rejects (unquoted commas, short
rows). Development yaml also names `stm_user.csv` while git stores
`STM_USER.csv`, which Linux cannot open.
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import shutil
import sys
from pathlib import Path

FILE_REF = re.compile(r"^\s+file:\s+(\S+)", re.M)


def rewrite_csv_width(root: Path) -> int:
    changed_files = 0
    for path in root.rglob("*.csv"):
        text = path.read_text(encoding="utf-8")
        rows = list(csv.reader(io.StringIO(text)))
        if len(rows) < 2:
            continue
        width = len(rows[0])
        out = [rows[0]]
        changed = False
        for row in rows[1:]:
            if len(row) > width:
                row = row[: width - 1] + [",".join(row[width - 1 :])]
                changed = True
            elif len(row) < width:
                row = row + [""] * (width - len(row))
                changed = True
            out.append(row)
        if not changed:
            continue
        buf = io.StringIO()
        writer = csv.writer(buf, lineterminator="\n")
        writer.writerows(out)
        path.write_text(buf.getvalue(), encoding="utf-8")
        changed_files += 1
    return changed_files


def exists_exact(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        names = {entry.name for entry in path.parent.iterdir()}
    except FileNotFoundError:
        return False
    return path.name in names


def alias_csv_case(root: Path) -> int:
    created = 0
    for yaml_path in root.rglob("*.yaml"):
        text = yaml_path.read_text(encoding="utf-8")
        for match in FILE_REF.finditer(text):
            rel = match.group(1).strip().strip("'\"")
            wanted = yaml_path.parent / rel
            if exists_exact(wanted):
                continue
            parent = wanted.parent
            if not parent.is_dir():
                continue
            for actual in parent.iterdir():
                if (
                    actual.is_file()
                    and actual.name.lower() == wanted.name.lower()
                    and actual.name != wanted.name
                ):
                    try:
                        shutil.copy2(actual, wanted)
                    except shutil.SameFileError:
                        continue
                    created += 1
                    break
    return created


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv-width", metavar="DIR")
    parser.add_argument("--alias-case", metavar="DIR")
    args = parser.parse_args(argv)
    if not args.csv_width and not args.alias_case:
        parser.error("pass --csv-width DIR and/or --alias-case DIR")
    if args.csv_width:
        rewrite_csv_width(Path(args.csv_width))
    if args.alias_case:
        alias_csv_case(Path(args.alias_case))
    return 0


if __name__ == "__main__":
    sys.exit(main())
