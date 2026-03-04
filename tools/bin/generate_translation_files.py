#!/usr/bin/env python3
"""
Generate Liquibase translation CSV files from a baseline JSON.
Creates STM_LANGUAGE.csv and per-language STM_TRANSLATION_*.csv files.
Generates 05_translations.yaml with loadUpdateData + runOnChange + cleanup + sequence sync.
Scenario (profile) selectable via --scenario or SITMUN_PROFILE; default: postgres.
"""

import argparse
import csv
from pathlib import Path
from typing import Any

from _profile_paths import (
    get_liquibase_root,
    get_scenario_from_env,
    discover_scenarios,
    resolve_baseline,
    load_all_baselines,
)

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed-data"

# Chunk size for staged-key cleanup (avoids huge NOT IN lists)
CLEANUP_CHUNK_SIZE = 500


def generate_language_csv_rows(master: dict[str, Any], baseline_code: str = "en") -> list[dict[str, Any]]:
    """Generate STM_LANGUAGE rows from Language entity translations."""
    lang_ids: dict[str, int] = master["metadata"]["allLanguageIds"]
    lang_entity = master["entities"].get("Language", {})
    translations = lang_entity.get("translations", [])

    rows = []
    for entry in sorted(translations, key=lambda e: e["id"]):
        rows.append({
            "LAN_ID": entry["id"],
            "LAN_SHORTNAME": _lang_shortname(entry["id"], lang_ids),
            "LAN_NAME": entry.get(baseline_code, entry.get("en", "")),
        })
    return rows


def _lang_shortname(lan_id: int, lang_ids: dict[str, int]) -> str:
    for code, lid in lang_ids.items():
        if lid == lan_id:
            return code
    return str(lan_id)


def generate_translation_rows(
    master: dict[str, Any], lang_code: str
) -> list[dict[str, Any]]:
    """Generate STM_TRANSLATION rows for a specific language.

    TRA_ID is assigned deterministically: each (entity_entry, language) pair
    always gets the same TRA_ID regardless of which language is the baseline.
    Layout: for each entity (sorted by entity order), for each entry (sorted by
    element id), IDs are assigned in blocks per language:
      block_size  = total translatable entries across all entities
      lang_offset = (lang_position_in_sorted_allLangIds) * block_size
      row_id      = lang_offset + entry_position_within_all_entries + 1
    This guarantees TRA_ID is stable across baseline switches.
    """
    all_lang_ids: dict[str, int] = master["metadata"]["allLanguageIds"]
    lang_id = all_lang_ids[lang_code]
    sorted_langs = sorted(all_lang_ids.keys())
    lang_position = sorted_langs.index(lang_code)  # 0-based

    # Collect all translatable (entity, entry_id) pairs in stable order
    all_entries: list[tuple[str, int, str]] = []  # (entity_name, entry_id, column_name)
    for entity_name, entity_data in master["entities"].items():
        if entity_data.get("seedDataOnly"):
            continue
        column_name = entity_data["column"]
        for entry in sorted(entity_data["translations"], key=lambda e: e["id"]):
            all_entries.append((entity_name, entry["id"], column_name))

    block_size = len(all_entries)
    base_id = lang_position * block_size + 1

    rows = []
    for pos, (entity_name, entry_id, column_name) in enumerate(all_entries):
        entity_data = master["entities"][entity_name]
        entry = next(e for e in entity_data["translations"] if e["id"] == entry_id)
        text = entry.get(lang_code, "").strip()
        if not text:
            continue
        rows.append({
            "TRA_ID": base_id + pos,
            "TRA_ELEID": entry_id,
            "TRA_COLUMN": column_name,
            "TRA_LANID": lang_id,
            "TRA_NAME": text,
        })

    return rows


def write_csv_nonnumeric(filepath: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    """Write CSV with QUOTE_NONNUMERIC (matches existing production file format)."""
    if not rows:
        print(f"  No rows to write for {filepath.name}")
        return
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fieldnames, quoting=csv.QUOTE_NONNUMERIC, lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written {len(rows)} rows to {filepath.name}")


def write_csv_minimal(filepath: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    """Write CSV with QUOTE_MINIMAL (for STM_LANGUAGE)."""
    if not rows:
        print(f"  No rows to write for {filepath.name}")
        return
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL, lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written {len(rows)} rows to {filepath.name}")


def _chunked_not_in_sql(
    table: str, pk_col: str, pk_values: list[int], chunk_size: int, dbms: str = "generic"
) -> list[str]:
    """Return DELETE statements for PK-based cleanup.

    For generic/postgres: when values exceed chunk_size, uses a CREATE/INSERT/DELETE/DROP
    temp table approach.
    For oracle: wraps CREATE TABLE in a PL/SQL block with exception handling so it is
    safe to re-run (table may already exist from a prior failed run), and uses a normal
    heap table that is dropped at the end.
    """
    if not pk_values:
        return [f"DELETE FROM {table}"]

    statements = []
    if len(pk_values) <= chunk_size:
        ids = ", ".join(str(v) for v in pk_values)
        statements.append(f"DELETE FROM {table} WHERE {pk_col} NOT IN ({ids})")
    else:
        temp = f"tmp_keep_{table.lower()}"
        if dbms == "oracle":
            # PL/SQL block: drop if exists, then create — safe for re-runs
            statements.append(
                f"BEGIN EXECUTE IMMEDIATE 'DROP TABLE {temp}'; "
                f"EXCEPTION WHEN OTHERS THEN NULL; END;"
            )
            statements.append(f"CREATE TABLE {temp} ({pk_col} NUMBER PRIMARY KEY)")
        else:
            statements.append(f"CREATE TABLE {temp} ({pk_col} NUMERIC PRIMARY KEY)")
        for i in range(0, len(pk_values), chunk_size):
            chunk = pk_values[i : i + chunk_size]
            vals = ", ".join(f"({v})" for v in chunk)
            statements.append(f"INSERT INTO {temp} ({pk_col}) VALUES {vals}")
        statements.append(
            f"DELETE FROM {table} WHERE {pk_col} NOT IN (SELECT {pk_col} FROM {temp})"
        )
        statements.append(f"DROP TABLE {temp}")
    return statements


def generate_yaml(
    master: dict[str, Any],
    language_rows: list[dict[str, Any]],
    translation_rows_by_lang: dict[str, list[dict[str, Any]]],
    all_tra_ids: list[int],
    max_lan_id: int,
    max_tra_id: int,
    baseline_code: str = "en",
    dbms: str = "generic",
) -> str:
    """Generate 05_translations.yaml with loadUpdateData, cleanup, and sequence sync."""
    non_baseline_langs = [
        lang for lang in master["metadata"]["allLanguageIds"] if lang != baseline_code
    ]

    lan_ids = [r["LAN_ID"] for r in language_rows]
    lan_cleanup = _chunked_not_in_sql("STM_LANGUAGE", "LAN_ID", lan_ids, CLEANUP_CHUNK_SIZE, dbms)

    lines = ["databaseChangeLog:"]

    # ---- Single changeset id: 5 — all translation data + cleanup + sequences ----
    lines += [
        "  - changeSet:",
        "      id: 5",
        "      author: sitmun",
        "      runOnChange: true",
        "      changes:",
        "        - loadUpdateData:",
        "            encoding: UTF-8",
        "            file: 05_translations/STM_LANGUAGE.csv",
        "            relativeToChangelogFile: true",
        "            tableName: STM_LANGUAGE",
        "            primaryKey: LAN_ID",
        "            columns:",
        "              - column:",
        "                  name: LAN_ID",
        "                  type: NUMERIC",
        "              - column:",
        "                  name: LAN_SHORTNAME",
        "                  type: STRING",
        "              - column:",
        "                  name: LAN_NAME",
        "                  type: STRING",
    ]

    # ---- STM_TRANSLATION: temp table + loadData + upsert (no full delete) ----
    if dbms == "oracle":
        lines += [
            "        - sql:",
            "            sql: \"CREATE TABLE TMP_TRA_UPLOAD (TRA_ID NUMBER, TRA_ELEID NUMBER, TRA_COLUMN VARCHAR2(4000), TRA_LANID NUMBER, TRA_NAME VARCHAR2(4000))\"",
        ]
    else:
        lines += [
            "        - sql:",
            "            sql: \"CREATE TABLE TMP_TRA_UPLOAD (TRA_ID INT4, TRA_ELEID INT4, TRA_COLUMN VARCHAR(4000), TRA_LANID INT4, TRA_NAME VARCHAR(4000))\"",
        ]

    for lang_code in non_baseline_langs:
        lang_upper = lang_code.upper().replace("-", "_")
        csv_file = f"05_translations/STM_TRANSLATION_{lang_upper}.csv"
        lines += [
            "        - loadData:",
            "            encoding: UTF-8",
            f"            file: {csv_file}",
            "            relativeToChangelogFile: true",
            "            tableName: TMP_TRA_UPLOAD",
            '            quotchar: "\\""',
            "            columns:",
            "              - column:",
            "                  name: TRA_ID",
            "                  type: NUMERIC",
            "              - column:",
            "                  name: TRA_ELEID",
            "                  type: NUMERIC",
            "              - column:",
            "                  name: TRA_COLUMN",
            "                  type: STRING",
            "              - column:",
            "                  name: TRA_LANID",
            "                  type: NUMERIC",
            "              - column:",
            "                  name: TRA_NAME",
            "                  type: STRING",
        ]

    if dbms == "oracle":
        lines += [
            "        - sql:",
            "            splitStatements: false",
            "            sql: \"MERGE INTO STM_TRANSLATION t USING TMP_TRA_UPLOAD s ON (t.TRA_ELEID=s.TRA_ELEID AND t.TRA_COLUMN=s.TRA_COLUMN AND t.TRA_LANID=s.TRA_LANID) WHEN MATCHED THEN UPDATE SET t.TRA_NAME = s.TRA_NAME WHEN NOT MATCHED THEN INSERT (TRA_ID, TRA_ELEID, TRA_COLUMN, TRA_LANID, TRA_NAME) VALUES (s.TRA_ID, s.TRA_ELEID, s.TRA_COLUMN, s.TRA_LANID, s.TRA_NAME)\"",
        ]
        lines += [
            "        - sql:",
            "            splitStatements: false",
            "            sql: \"BEGIN EXECUTE IMMEDIATE 'DROP TABLE TMP_TRA_UPLOAD'; EXCEPTION WHEN OTHERS THEN NULL; END;\"",
        ]
    else:
        # Postgres: two-step upsert so we never insert TRA_ID from temp (avoids PK
        # conflict when migrating from old changelog where existing rows already have those IDs).
        lines += [
            "        - sql:",
            "            splitStatements: false",
            "            sql: |",
            "              INSERT INTO STM_TRANSLATION (TRA_ID, TRA_ELEID, TRA_COLUMN, TRA_LANID, TRA_NAME)",
            "              SELECT (SELECT COALESCE(MAX(TRA_ID),0) FROM STM_TRANSLATION) + row_number() OVER (ORDER BY u.TRA_ELEID, u.TRA_COLUMN, u.TRA_LANID), u.TRA_ELEID, u.TRA_COLUMN, u.TRA_LANID, u.TRA_NAME",
            "              FROM TMP_TRA_UPLOAD u",
            "              WHERE NOT EXISTS (SELECT 1 FROM STM_TRANSLATION t WHERE t.TRA_ELEID=u.TRA_ELEID AND t.TRA_COLUMN=u.TRA_COLUMN AND t.TRA_LANID=u.TRA_LANID);",
            "              UPDATE STM_TRANSLATION t SET TRA_NAME = u.TRA_NAME FROM TMP_TRA_UPLOAD u WHERE t.TRA_ELEID=u.TRA_ELEID AND t.TRA_COLUMN=u.TRA_COLUMN AND t.TRA_LANID=u.TRA_LANID;",
        ]
        lines += [
            "        - sql:",
            "            sql: \"DROP TABLE TMP_TRA_UPLOAD\"",
        ]

    # STM_LANGUAGE cleanup and sequences (after translations, FK order)
    for stmt in lan_cleanup:
        if not stmt.startswith("--"):
            lines.append(f"        - sql:")
            if stmt.upper().startswith("BEGIN"):
                lines.append(f"            splitStatements: false")
            lines.append(f"            sql: \"{stmt}\"")
    lines += [
        "        - sql:",
        "            sql: \"UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(LAN_ID), 0) + 1 FROM STM_LANGUAGE) WHERE SEQ_NAME = 'LAN_ID'\"",
    ]
    lines += [
        "        - sql:",
        "            sql: \"UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TRA_ID), 0) + 1 FROM STM_TRANSLATION) WHERE SEQ_NAME = 'TRA_ID'\"",
    ]

    return "\n".join(lines) + "\n"


def validate_integrity(master: dict[str, Any]) -> None:
    """Basic integrity checks: required columns, unique IDs, FK validity."""
    lang_ids_map: dict[str, int] = master["metadata"].get("allLanguageIds", {})

    # Language entity IDs
    lang_entity = master["entities"].get("Language", {})
    lang_pks = set()
    for entry in lang_entity.get("translations", []):
        if entry["id"] in lang_pks:
            raise ValueError(f"Duplicate LAN_ID {entry['id']} in Language entity")
        lang_pks.add(entry["id"])

    # Translation entity IDs and FK checks
    for entity_name, entity_data in master["entities"].items():
        if entity_data.get("seedDataOnly"):
            continue
        seen_ids: set[int] = set()
        for entry in entity_data.get("translations", []):
            eid = entry.get("id")
            if eid is None:
                raise ValueError(f"Missing id in {entity_name}")
            if eid in seen_ids:
                raise ValueError(f"Duplicate id {eid} in {entity_name}")
            seen_ids.add(eid)
            if "en" not in entry:
                raise ValueError(f"Missing 'en' key in {entity_name} id={eid}")


def main() -> None:
    scenarios = discover_scenarios(WORKSPACE_ROOT)
    parser = argparse.ArgumentParser(description="Generate Liquibase translation CSVs from baseline.")
    parser.add_argument(
        "--scenario",
        choices=scenarios,
        default=get_scenario_from_env(),
        help="Profile/scenario (default: SITMUN_PROFILE or postgres)",
    )
    parser.add_argument("--baseline", metavar="LANG", help="Baseline language code (e.g. en, es)")
    args = parser.parse_args()

    if args.scenario == "development":
        raise SystemExit("ERROR: generate_translation_files.py refuses to write to the development profile.")

    baseline_code = resolve_baseline(args.baseline, SEED_DATA_DIR)
    master = load_all_baselines(SEED_DATA_DIR)

    liquibase_root = get_liquibase_root(WORKSPACE_ROOT, args.scenario)
    output_dir = liquibase_root / "changelog" / "05_translations"
    changelog_file = liquibase_root / "changelog" / "05_translations.yaml"

    print("=" * 60)
    print(f"SITMUN Translation File Generator (baseline: {baseline_code})")
    print("=" * 60)
    print(f"Scenario: {args.scenario} -> {liquibase_root}")
    print()

    validate_integrity(master)

    output_dir.mkdir(parents=True, exist_ok=True)

    # --- STM_LANGUAGE ---
    print("Generating STM_LANGUAGE.csv...")
    language_rows = generate_language_csv_rows(master, baseline_code)
    write_csv_minimal(
        output_dir / "STM_LANGUAGE.csv",
        language_rows,
        ["LAN_ID", "LAN_SHORTNAME", "LAN_NAME"],
    )

    # --- STM_TRANSLATION per language (all except baseline, which is the "default") ---
    non_baseline_langs = [
        lang for lang in master["metadata"]["allLanguageIds"] if lang != baseline_code
    ]
    print("\nGenerating translation CSV files...")
    translation_rows_by_lang: dict[str, list[dict[str, Any]]] = {}
    all_tra_ids: list[int] = []
    max_lan_id = max((r["LAN_ID"] for r in language_rows), default=0)

    for lang_code in non_baseline_langs:
        print(f"\nProcessing {lang_code}...")
        rows = generate_translation_rows(master, lang_code)
        lang_upper = lang_code.upper().replace("-", "_")
        write_csv_nonnumeric(
            output_dir / f"STM_TRANSLATION_{lang_upper}.csv",
            rows,
            ["TRA_ID", "TRA_ELEID", "TRA_COLUMN", "TRA_LANID", "TRA_NAME"],
        )
        translation_rows_by_lang[lang_code] = rows
        all_tra_ids.extend(r["TRA_ID"] for r in rows)

    max_tra_id = max(all_tra_ids, default=0)

    max_tra_id = max(all_tra_ids, default=0)

    dbms = "oracle" if args.scenario == "oracle" else "generic"

    # --- Liquibase YAML ---
    print("\nGenerating Liquibase changelog...")
    yaml_content = generate_yaml(
        master, language_rows, translation_rows_by_lang,
        all_tra_ids, max_lan_id, max_tra_id,
        baseline_code, dbms,
    )
    with open(changelog_file, "w", encoding="utf-8", newline="\n") as f:
        f.write(yaml_content)
    print(f"  Updated {changelog_file}")

    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print(f"STM_LANGUAGE rows: {len(language_rows)}")
    for entity_name, entity_data in master["entities"].items():
        print(f"{entity_name}: {len(entity_data['translations'])} entries")
    print(f"\nMax TRA_ID: {max_tra_id}")
    print(f"Next available TRA_ID: {max_tra_id + 1}")
    print("\nNote: sequences are updated by the generated 05_translations.yaml")


if __name__ == "__main__":
    main()
