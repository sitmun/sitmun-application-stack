#!/usr/bin/env python3
"""Compare schema dumps and emit draft Liquibase changelogs that close PROBLEM drifts.

Dump formats (pipe-separated, no header):
  columns:     table|column|data_type|length|nullable[|default]
  constraints: table|type|cols|reftable|refcols[|name]
               type is PK, UK, or FK (UNIQUE → UK)

Reference = left dump; fixable = right dump. Generated YAML brings right toward left.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

SEVERITY_PROBLEM = "problem"
SEVERITY_INFO = "info"

# Production-only FKs kept intentionally (do not drop; do not count as PROBLEM).
INTENTIONAL_FIXABLE_FKS: frozenset[tuple[str, frozenset[str]]] = frozenset(
    {
        ("STM_APP_BCKG", frozenset({"ABC_APPID"})),
        ("STM_APP_BCKG", frozenset({"ABC_BACKID"})),
    }
)


@dataclass(frozen=True)
class Column:
    table: str
    column: str
    data_type: str
    length: str
    nullable: str  # YES / NO
    default: str = ""

    @property
    def key(self) -> tuple[str, str]:
        return (self.table.upper(), self.column.upper())


@dataclass(frozen=True)
class Constraint:
    table: str
    ctype: str  # PK, UK, FK
    cols: tuple[str, ...]
    reftable: str = ""
    refcols: tuple[str, ...] = ()
    name: str = ""

    @property
    def identity(self) -> tuple:
        cols = tuple(c.upper() for c in self.cols)
        if self.ctype == "PK":
            # order-insensitive for equality of presence; order drift is INFO elsewhere
            return ("PK", self.table.upper(), frozenset(cols))
        if self.ctype == "UK":
            return ("UK", self.table.upper(), frozenset(cols))
        return (
            "FK",
            self.table.upper(),
            frozenset(cols),
            self.reftable.upper(),
            frozenset(c.upper() for c in self.refcols),
        )


@dataclass
class Drift:
    category: str
    severity: str
    table: str
    detail: str
    left: str = ""
    right: str = ""
    # fields used by changelog emission
    column: str = ""
    data_type: str = ""
    length: str = ""
    nullable: str = ""
    cols: tuple[str, ...] = ()
    reftable: str = ""
    refcols: tuple[str, ...] = ()
    constraint_name: str = ""
    ctype: str = ""
    # for createTable drafts
    column_defs: tuple[dict, ...] = ()


def _col_def(c: Column) -> dict:
    return {
        "name": c.column,
        "data_type": c.data_type,
        "length": c.length,
        "nullable": c.nullable,
    }


@dataclass
class Report:
    drifts: list[Drift] = field(default_factory=list)
    left_label: str = "left"
    right_label: str = "right"

    @property
    def problems(self) -> list[Drift]:
        return [d for d in self.drifts if d.severity == SEVERITY_PROBLEM]

    @property
    def infos(self) -> list[Drift]:
        return [d for d in self.drifts if d.severity == SEVERITY_INFO]


def _parse_cols(s: str) -> tuple[str, ...]:
    s = (s or "").strip()
    if not s:
        return ()
    return tuple(p.strip() for p in s.split(",") if p.strip())


def load_columns(path: Path) -> dict[tuple[str, str], Column]:
    out: dict[tuple[str, str], Column] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        while len(parts) < 6:
            parts.append("")
        col = Column(
            table=parts[0].strip(),
            column=parts[1].strip(),
            data_type=parts[2].strip(),
            length=parts[3].strip(),
            nullable=parts[4].strip().upper() or "YES",
            default=parts[5].strip(),
        )
        out[col.key] = col
    return out


def load_constraints(path: Path) -> list[Constraint]:
    out: list[Constraint] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        while len(parts) < 6:
            parts.append("")
        ctype = parts[1].strip().upper()
        if ctype == "UNIQUE":
            ctype = "UK"
        if ctype == "PRIMARY KEY":
            ctype = "PK"
        if ctype == "FOREIGN KEY":
            ctype = "FK"
        # Skip sqlplus wrap fragments / malformed rows (must be PK|UK|FK on STM_*).
        if ctype not in {"PK", "UK", "FK"}:
            continue
        table = parts[0].strip()
        if not table.upper().startswith("STM_"):
            continue
        out.append(
            Constraint(
                table=table,
                ctype=ctype,
                cols=_parse_cols(parts[2]),
                reftable=parts[3].strip(),
                refcols=_parse_cols(parts[4]),
                name=parts[5].strip(),
            )
        )
    return out


def _normalize_type(data_type: str) -> str:
    t = data_type.lower().strip()
    aliases = {
        "character varying": "varchar",
        "character": "char",
        "timestamp without time zone": "timestamp",
        "timestamp with time zone": "timestamptz",
        "double precision": "float8",
        "boolean": "boolean",
        "bool": "boolean",
        "integer": "int",
        "int4": "int",
        "int8": "bigint",
        "bigint": "bigint",
        "smallint": "smallint",
        "int2": "smallint",
        "text": "text",
        "bytea": "bytea",
        "numeric": "numeric",
        "float4": "real",
        "real": "real",
        "clob": "clob",
        "blob": "blob",
        "number": "number",
        "varchar2": "varchar",
        "nvarchar2": "nvarchar",
    }
    return aliases.get(t, t)


def _length_int(length: str) -> int | None:
    if not length or not str(length).strip():
        return None
    try:
        return int(str(length).strip())
    except ValueError:
        return None


def _liquibase_type(col: Column, dbms: str) -> str:
    nt = _normalize_type(col.data_type)
    length = _length_int(col.length)
    if dbms == "oracle":
        if nt in ("varchar", "nvarchar") and length is not None:
            return f"VARCHAR2({length} CHAR)"
        if nt == "char" and length is not None:
            return f"CHAR({length} CHAR)"
        if nt == "int":
            return "NUMBER(10)"
        if nt == "bigint":
            return "NUMBER(19)"
        if nt == "boolean":
            return "NUMBER(1)"
        if nt == "timestamp":
            return "TIMESTAMP"
        if nt == "text" or nt == "clob":
            return "CLOB"
        return col.data_type.upper()
    # postgresql / generic
    if nt == "varchar" and length is not None:
        return f"VARCHAR({length})"
    if nt == "char" and length is not None:
        return f"CHAR({length})"
    if nt == "int":
        return "INT"
    if nt == "boolean":
        return "BOOLEAN"
    if nt == "timestamp":
        return "TIMESTAMP"
    if nt == "text":
        return "TEXT"
    if length is not None and nt not in ("bytea", "blob"):
        return f"{col.data_type.upper()}({length})"
    return col.data_type.upper() if col.data_type else "INT"


def compare_schemas(
    left_cols: dict[tuple[str, str], Column],
    right_cols: dict[tuple[str, str], Column],
    left_cons: Iterable[Constraint],
    right_cons: Iterable[Constraint],
    *,
    mode: str = "profiles",
) -> Report:
    """mode: profiles | jpa — affects severity of some categories."""
    report = Report()
    left_tables = {k[0] for k in left_cols}
    right_tables = {k[0] for k in right_cols}

    for t in sorted(left_tables - right_tables):
        cols = [left_cols[k] for k in sorted(left_cols) if k[0] == t]
        report.drifts.append(
            Drift(
                category="table_only_reference",
                severity=SEVERITY_PROBLEM,
                table=t,
                detail=f"table only on reference ({len(cols)} columns)",
                left="; ".join(f"{c.column}:{_col_summary(c)}" for c in cols),
                column_defs=tuple(_col_def(c) for c in cols),
            )
        )
    for t in sorted(right_tables - left_tables):
        sev = SEVERITY_INFO if mode == "jpa" else SEVERITY_PROBLEM
        report.drifts.append(
            Drift(
                category="table_only_fixable",
                severity=sev,
                table=t,
                detail="table only on fixable",
            )
        )

    shared_tables = left_tables & right_tables
    for key in sorted(set(left_cols) | set(right_cols)):
        lc = left_cols.get(key)
        rc = right_cols.get(key)
        table, column = key
        # Whole-table presence already reported; skip per-column noise.
        if table not in shared_tables:
            continue
        if lc and not rc:
            report.drifts.append(
                Drift(
                    category="column_only_reference",
                    severity=SEVERITY_PROBLEM,
                    table=table,
                    column=column,
                    detail=f"column {column} only on reference",
                    left=_col_summary(lc),
                    data_type=lc.data_type,
                    length=lc.length,
                    nullable=lc.nullable,
                )
            )
            continue
        if rc and not lc:
            sev = SEVERITY_INFO if mode == "jpa" else SEVERITY_PROBLEM
            report.drifts.append(
                Drift(
                    category="column_only_fixable",
                    severity=sev,
                    table=table,
                    column=column,
                    detail=f"column {column} only on fixable",
                    right=_col_summary(rc),
                )
            )
            continue
        assert lc and rc
        ll = _length_int(lc.length)
        rl = _length_int(rc.length)
        if ll is not None and rl is not None and rl < ll:
            sev = SEVERITY_INFO if mode == "jpa" else SEVERITY_PROBLEM
            report.drifts.append(
                Drift(
                    category="length_narrower_fixable",
                    severity=sev,
                    table=table,
                    column=column,
                    detail=f"{column} length {rl} < reference {ll}",
                    left=_col_summary(lc),
                    right=_col_summary(rc),
                    data_type=lc.data_type,
                    length=lc.length,
                    nullable=lc.nullable,
                )
            )
        elif ll is not None and rl is not None and rl > ll:
            report.drifts.append(
                Drift(
                    category="length_wider_fixable",
                    severity=SEVERITY_INFO,
                    table=table,
                    column=column,
                    detail=f"{column} length {rl} > reference {ll}",
                    left=_col_summary(lc),
                    right=_col_summary(rc),
                )
            )
        if lc.nullable != rc.nullable:
            report.drifts.append(
                Drift(
                    category="nullability_diff",
                    severity=SEVERITY_INFO,
                    table=table,
                    column=column,
                    detail=f"{column} nullable {rc.nullable} vs reference {lc.nullable}",
                    left=_col_summary(lc),
                    right=_col_summary(rc),
                )
            )
        if _normalize_type(lc.data_type) != _normalize_type(rc.data_type):
            report.drifts.append(
                Drift(
                    category="type_diff",
                    severity=SEVERITY_INFO,
                    table=table,
                    column=column,
                    detail=f"{column} type {rc.data_type} vs reference {lc.data_type}",
                    left=_col_summary(lc),
                    right=_col_summary(rc),
                )
            )

    left_by_id = {c.identity: c for c in left_cons}
    right_by_id = {c.identity: c for c in right_cons}
    for ident in sorted(set(left_by_id) | set(right_by_id), key=str):
        lc = left_by_id.get(ident)
        rc = right_by_id.get(ident)
        if lc and not rc:
            sev = SEVERITY_INFO if mode == "jpa" else SEVERITY_PROBLEM
            report.drifts.append(
                Drift(
                    category="constraint_only_reference",
                    severity=sev,
                    table=lc.table,
                    detail=f"{lc.ctype} {_cols_csv(lc.cols)} only on reference"
                    + (f" → {lc.reftable}({_cols_csv(lc.refcols)})" if lc.ctype == "FK" else ""),
                    cols=lc.cols,
                    reftable=lc.reftable,
                    refcols=lc.refcols,
                    constraint_name=lc.name or _suggest_fk_name(lc),
                    ctype=lc.ctype,
                )
            )
        elif rc and not lc:
            intentional = (
                rc.ctype == "FK"
                and (rc.table.upper(), frozenset(c.upper() for c in rc.cols))
                in INTENTIONAL_FIXABLE_FKS
            )
            if intentional:
                sev = SEVERITY_INFO
                category = "intentional_fixable_fk"
                detail = (
                    f"FK {_cols_csv(rc.cols)} only on fixable (intentional) "
                    f"→ {rc.reftable}({_cols_csv(rc.refcols)})"
                )
            else:
                sev = SEVERITY_INFO if mode == "jpa" else SEVERITY_PROBLEM
                category = "constraint_only_fixable"
                detail = f"{rc.ctype} {_cols_csv(rc.cols)} only on fixable" + (
                    f" → {rc.reftable}({_cols_csv(rc.refcols)})" if rc.ctype == "FK" else ""
                )
            report.drifts.append(
                Drift(
                    category=category,
                    severity=sev,
                    table=rc.table,
                    detail=detail,
                    cols=rc.cols,
                    reftable=rc.reftable,
                    refcols=rc.refcols,
                    constraint_name=rc.name,
                    ctype=rc.ctype,
                )
            )

    return report


def _col_summary(c: Column) -> str:
    bits = [c.data_type]
    if c.length:
        bits.append(f"({c.length})")
    bits.append("NULL" if c.nullable == "YES" else "NOT NULL")
    return " ".join(bits)


def _cols_csv(cols: tuple[str, ...]) -> str:
    return ",".join(cols)


def _suggest_fk_name(c: Constraint) -> str:
    """Prefer stable STM_* names over Hibernate-generated hashes."""
    if c.name and c.name.upper().startswith("STM_"):
        return c.name
    table = c.table.upper()
    if not table.startswith("STM_"):
        table = f"STM_{table}"
    col = (c.cols[0] if c.cols else "COL").upper()
    suffix = col.split("_")[-1] if "_" in col else col
    return f"{table}_FK_{suffix}"


def _fk_name_for_drift(d: Drift) -> str:
    return _suggest_fk_name(
        Constraint(d.table, "FK", d.cols, d.reftable, d.refcols, d.constraint_name)
    )


def sensible_backfill_literal(
    data_type: str,
    *,
    dbms: str,
    java_default: str | None = None,
) -> str | None:
    """SQL literal for UPDATE backfill before NOT NULL. None = cannot invent (e.g. FK)."""
    if java_default is not None:
        jd = java_default.strip()
        if jd in ("true", "Boolean.TRUE"):
            return "1" if dbms == "oracle" else "TRUE"
        if jd in ("false", "Boolean.FALSE"):
            return "0" if dbms == "oracle" else "FALSE"
        if (jd.startswith('"') and jd.endswith('"')) or (
            jd.startswith("'") and jd.endswith("'")
        ):
            return f"'{jd[1:-1]}'"
        if jd.replace(".", "", 1).isdigit() or (
            jd.startswith("-") and jd[1:].replace(".", "", 1).isdigit()
        ):
            return jd
    nt = _normalize_type(data_type)
    if nt == "boolean":
        return "0" if dbms == "oracle" else "FALSE"
    if nt in ("int", "bigint", "smallint", "number", "numeric", "real", "float8"):
        return "0"
    if nt in ("varchar", "nvarchar", "char", "text", "clob"):
        return "''"
    if nt in ("timestamp", "timestamptz", "date"):
        return "CURRENT_TIMESTAMP"
    return None


def backfill_update_sql(
    table: str,
    column: str,
    data_type: str,
    *,
    dbms: str,
    java_default: str | None = None,
) -> str | None:
    lit = sensible_backfill_literal(data_type, dbms=dbms, java_default=java_default)
    if lit is None:
        return None
    return f"UPDATE {table} SET {column} = {lit} WHERE {column} IS NULL"


def _yaml_escape(s: str) -> str:
    return s.replace('"', '\\"')


def _append_not_null_with_backfill(
    lines: list[str],
    *,
    table: str,
    column: str,
    data_type: str,
    length: str,
    dbms: str,
    java_default: str | None = None,
) -> None:
    """Emit UPDATE backfill then addNotNullConstraint (or TODO if no literal)."""
    col = Column(table, column, data_type, length, "YES")
    lb_type = _liquibase_type(col, dbms)
    sql = backfill_update_sql(
        table, column, data_type, dbms=dbms, java_default=java_default
    )
    if sql is None:
        lines.append(
            f"      # TODO: cannot invent NOT NULL backfill for {table}.{column} ({data_type})"
        )
        return
    lines.append("        - sql:")
    lines.append("            sql: |")
    lines.append(f"              {sql}")
    lines.append("        - addNotNullConstraint:")
    lines.append(f"            tableName: {table}")
    lines.append(f"            columnName: {column}")
    lines.append(f"            columnDataType: {lb_type}")


def emit_changelog_yaml(
    drifts: list[Drift],
    *,
    dbms: str,
    changeset_prefix: str,
    author: str = "sitmun",
    include_info: bool = False,
) -> str:
    """Emit a single Liquibase YAML file with one changeSet per fixable PROBLEM drift."""
    selected = [
        d
        for d in drifts
        if d.severity == SEVERITY_PROBLEM
        or (include_info and d.severity == SEVERITY_INFO)
    ]
    fixable_cats = {
        "column_only_reference",
        "length_narrower_fixable",
        "constraint_only_reference",
        "table_only_reference",
    }
    lines = [
        "databaseChangeLog:",
        "  # DRAFT — generated by tools/bin/report_schema_drift.py",
        "  # Review before including in master.xml. Do not rewrite sitmun:1.",
        "",
    ]
    n = 0
    for d in selected:
        if d.category not in fixable_cats:
            continue
        if d.severity == SEVERITY_INFO and not include_info:
            continue
        n += 1
        cid = f"{changeset_prefix}-{n:02d}-{_slug(d.table)}-{_slug(d.column or d.ctype or 'obj')}"
        if d.category == "table_only_reference":
            if not d.column_defs:
                lines.extend(
                    [
                        f"  # TODO: table {d.table} only on reference — no column metadata",
                        "",
                    ]
                )
                continue
            lines.append("  - changeSet:")
            lines.append(f"      id: {cid}")
            lines.append(f"      author: {author}")
            lines.append(f"      dbms: {dbms}")
            lines.append("      preConditions:")
            lines.append("        - onFail: MARK_RAN")
            lines.append("        - onError: MARK_RAN")
            lines.append("        - not:")
            lines.append("            tableExists:")
            lines.append(f"              tableName: {d.table}")
            lines.append("      changes:")
            lines.append("        - createTable:")
            lines.append(f"            tableName: {d.table}")
            lines.append("            columns:")
            for cd in d.column_defs:
                col = Column(
                    d.table,
                    cd["name"],
                    cd["data_type"],
                    cd.get("length", ""),
                    cd.get("nullable", "YES"),
                )
                lb_type = _liquibase_type(col, dbms)
                lines.append("              - column:")
                lines.append(f"                  name: {cd['name']}")
                lines.append(f"                  type: {lb_type}")
                if cd.get("nullable") == "NO":
                    lines.append("                  constraints:")
                    lines.append("                    nullable: false")
            lines.append("")
            continue
        if d.severity == SEVERITY_INFO:
            lines.append(f"  # INFO skipped by default: {d.detail}")
            continue

        lines.append("  - changeSet:")
        lines.append(f"      id: {cid}")
        lines.append(f"      author: {author}")
        lines.append(f"      dbms: {dbms}")
        lines.append("      preConditions:")
        lines.append("        - onFail: MARK_RAN")
        lines.append("        - onError: MARK_RAN")

        if d.category == "column_only_reference":
            col = Column(d.table, d.column, d.data_type, d.length, d.nullable or "YES")
            lb_type = _liquibase_type(col, dbms)
            lines.append("        - not:")
            lines.append("            columnExists:")
            lines.append(f"              tableName: {d.table}")
            lines.append(f"              columnName: {d.column}")
            lines.append("      changes:")
            lines.append("        - addColumn:")
            lines.append(f"            tableName: {d.table}")
            lines.append("            columns:")
            lines.append("              - column:")
            lines.append(f"                  name: {d.column}")
            lines.append(f"                  type: {lb_type}")
            if d.nullable == "NO":
                # Add nullable first, backfill, then NOT NULL (never invent FK values).
                _append_not_null_with_backfill(
                    lines,
                    table=d.table,
                    column=d.column,
                    data_type=d.data_type,
                    length=d.length,
                    dbms=dbms,
                )
        elif d.category == "length_narrower_fixable":
            col = Column(d.table, d.column, d.data_type, d.length, d.nullable or "YES")
            lb_type = _liquibase_type(col, dbms)
            lines.append("        - columnExists:")
            lines.append(f"            tableName: {d.table}")
            lines.append(f"            columnName: {d.column}")
            lines.append("      changes:")
            lines.append("        - modifyDataType:")
            lines.append(f"            tableName: {d.table}")
            lines.append(f"            columnName: {d.column}")
            lines.append(f"            newDataType: {lb_type}")
        elif d.category == "constraint_only_reference" and d.ctype == "FK":
            cname = _fk_name_for_drift(d)
            lines.append("        - not:")
            lines.append("            foreignKeyConstraintExists:")
            lines.append(f"              foreignKeyName: {cname}")
            lines.append("      changes:")
            lines.append("        - addForeignKeyConstraint:")
            lines.append(f"            constraintName: {cname}")
            lines.append(f"            baseTableName: {d.table}")
            lines.append(f"            baseColumnNames: {_cols_csv(d.cols)}")
            lines.append(f"            referencedTableName: {d.reftable}")
            lines.append(f"            referencedColumnNames: {_cols_csv(d.refcols)}")
        elif d.category == "constraint_only_reference" and d.ctype in ("PK", "UK"):
            lines.extend(
                [
                    f"      # TODO: {d.ctype} on {d.table}({_cols_csv(d.cols)}) — review before applying",
                    "      changes: []",
                ]
            )
        else:
            lines.extend(
                [
                    f"      # TODO: unhandled {d.category}: {d.detail}",
                    "      changes: []",
                ]
            )
        lines.append("")

    if n == 0:
        lines.append("  # No PROBLEM drifts eligible for auto-generated changes.")
        lines.append("")
    return "\n".join(lines)


def _slug(s: str) -> str:
    s = (s or "x").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:40] or "x"


def format_text_report(report: Report) -> str:
    lines = [
        f"Schema drift: {report.left_label} (reference) → {report.right_label} (fixable)",
        f"PROBLEM: {len(report.problems)}  INFO: {len(report.infos)}",
        "",
    ]
    if report.problems:
        lines.append("=== PROBLEM ===")
        for d in report.problems:
            lines.append(f"[{d.category}] {d.table}: {d.detail}")
            if d.left:
                lines.append(f"  reference: {d.left}")
            if d.right:
                lines.append(f"  fixable:   {d.right}")
        lines.append("")
    if report.infos:
        lines.append("=== INFO ===")
        for d in report.infos:
            lines.append(f"[{d.category}] {d.table}: {d.detail}")
        lines.append("")
    return "\n".join(lines)


def master_include_snippet(filename: str) -> str:
    return (
        f'  <include file="changelog/{filename}" relativeToChangelogFile="true"/>'
    )


def annotate_with_hints(report: Report, hints: dict) -> None:
    """Attach java_default / validated_not_null / audited to matching INFO nullability drifts."""
    if not hints:
        return
    for d in report.drifts:
        if d.category != "nullability_diff" or not d.column:
            continue
        key = f"{d.table.upper()}.{d.column.upper()}"
        h = hints.get(key)
        if not h:
            continue
        bits = []
        if h.get("java_default") is not None:
            bits.append(f"java_default={h['java_default']!r}")
        if h.get("validated_not_null"):
            bits.append("validated_not_null")
        if h.get("audited"):
            bits.append(f"audited={h['audited']}")
        if bits:
            d.detail = f"{d.detail} [{', '.join(bits)}]"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--left-columns", type=Path, required=True)
    p.add_argument("--right-columns", type=Path, required=True)
    p.add_argument("--left-constraints", type=Path, required=True)
    p.add_argument("--right-constraints", type=Path, required=True)
    p.add_argument("--left-label", default="reference")
    p.add_argument("--right-label", default="fixable")
    p.add_argument("--mode", choices=("profiles", "jpa"), default="profiles")
    p.add_argument("--dbms", choices=("postgresql", "oracle"), default="postgresql")
    p.add_argument("--out-dir", type=Path, help="Write report.txt, drift.json, draft YAML")
    p.add_argument("--changeset-prefix", default="21_schema_drift_fix")
    p.add_argument("--include-info-changelogs", action="store_true")
    p.add_argument("--hints", type=Path, help="JSON map TABLE.COLUMN → metadata")
    p.add_argument(
        "--fail-on",
        choices=("problem", "any", "none"),
        default="problem",
    )
    p.add_argument("--json", type=Path, help="Write JSON report path (in addition to out-dir)")
    args = p.parse_args(argv)

    left_cols = load_columns(args.left_columns)
    right_cols = load_columns(args.right_columns)
    left_cons = load_constraints(args.left_constraints)
    right_cons = load_constraints(args.right_constraints)
    report = compare_schemas(
        left_cols, right_cols, left_cons, right_cons, mode=args.mode
    )
    report.left_label = args.left_label
    report.right_label = args.right_label

    hints: dict = {}
    if args.hints and args.hints.exists():
        hints = json.loads(args.hints.read_text(encoding="utf-8"))
        annotate_with_hints(report, hints)

    text = format_text_report(report)
    print(text)

    yaml_name = f"{args.changeset_prefix}.yaml"
    yaml_body = emit_changelog_yaml(
        report.drifts,
        dbms=args.dbms,
        changeset_prefix=args.changeset_prefix,
        include_info=args.include_info_changelogs,
    )

    if args.out_dir:
        args.out_dir.mkdir(parents=True, exist_ok=True)
        (args.out_dir / "report.txt").write_text(text, encoding="utf-8")
        (args.out_dir / yaml_name).write_text(yaml_body, encoding="utf-8")
        payload = {
            "left": args.left_label,
            "right": args.right_label,
            "mode": args.mode,
            "problems": len(report.problems),
            "infos": len(report.infos),
            "drifts": [asdict(d) for d in report.drifts],
            "master_include": master_include_snippet(yaml_name),
        }
        (args.out_dir / "drift.json").write_text(
            json.dumps(payload, indent=2) + "\n", encoding="utf-8"
        )
        (args.out_dir / "MASTER_INCLUDE.txt").write_text(
            master_include_snippet(yaml_name) + "\n", encoding="utf-8"
        )
        print(f"Wrote draft changelog: {args.out_dir / yaml_name}")
        print(f"After review, add to master.xml:\n{master_include_snippet(yaml_name)}")

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(
            json.dumps([asdict(d) for d in report.drifts], indent=2) + "\n",
            encoding="utf-8",
        )

    if args.fail_on == "none":
        return 0
    if args.fail_on == "any" and report.drifts:
        return 1
    if args.fail_on == "problem" and report.problems:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
