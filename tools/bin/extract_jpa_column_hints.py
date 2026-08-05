#!/usr/bin/env python3
"""Extract lightweight JPA column hints from sitmun-backend-core domain entities.

Scans Java sources for @Column(name=...), field initializers, Bean Validation,
and auditing annotations. Output is a JSON map:

  {"STM_APP.APP_PRIVATE": {"java_default": "false", "validated_not_null": false, "audited": null}}

Used to annotate schema-drift INFO rows; does not invent SQL DEFAULT clauses.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

COLUMN_RE = re.compile(
    r'@Column\s*\((.*?)\)\s*(?:\n\s*@\w+[^\n]*)*\s*(?:private|protected|public)\s+'
    r'([\w.<>,\s]+?)\s+(\w+)\s*(?:=\s*([^;]+))?\s*;',
    re.S,
)
COLUMN_NAME_RE = re.compile(r'name\s*=\s*"([^"]+)"')
TABLE_RE = re.compile(r'@Table\s*\(\s*name\s*=\s*"([^"]+)"')
ENTITY_RE = re.compile(r'@Entity\b')
NOT_NULL_RE = re.compile(r'@(?:NotNull|NotBlank|NotEmpty)\b')
CREATED_RE = re.compile(r'@CreatedDate\b')
MODIFIED_RE = re.compile(r'@LastModifiedDate\b')


def extract_file(path: Path) -> dict[str, dict]:
    text = path.read_text(encoding="utf-8")
    if not ENTITY_RE.search(text):
        return {}
    table_m = TABLE_RE.search(text)
    if not table_m:
        return {}
    table = table_m.group(1).upper()
    out: dict[str, dict] = {}
    for m in COLUMN_RE.finditer(text):
        ann, _type, _field, default = m.group(1), m.group(2), m.group(3), m.group(4)
        name_m = COLUMN_NAME_RE.search(ann)
        if not name_m:
            continue
        col = name_m.group(1).upper()
        # Look at annotations immediately preceding the field match
        start = max(0, m.start() - 400)
        window = text[start : m.start()]
        hint: dict = {
            "java_default": None,
            "validated_not_null": bool(NOT_NULL_RE.search(window + "@Column(" + ann)),
            "audited": None,
        }
        if default is not None:
            hint["java_default"] = default.strip()
        if CREATED_RE.search(window):
            hint["audited"] = "created"
        elif MODIFIED_RE.search(window):
            hint["audited"] = "modified"
        out[f"{table}.{col}"] = hint
    return out


def extract_tree(domain_root: Path) -> dict[str, dict]:
    merged: dict[str, dict] = {}
    for path in sorted(domain_root.rglob("*.java")):
        merged.update(extract_file(path))
    return merged


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--domain-root",
        type=Path,
        default=None,
        help="Path to org/sitmun/domain (default: backend submodule)",
    )
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args(argv)

    repo = Path(__file__).resolve().parents[2]
    domain = args.domain_root or (
        repo
        / "back/backend/sitmun-backend-core/src/main/java/org/sitmun/domain"
    )
    if not domain.is_dir():
        print(f"Domain root not found: {domain}", file=sys.stderr)
        return 2
    hints = extract_tree(domain)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(hints, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {len(hints)} column hints → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
