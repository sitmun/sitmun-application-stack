#!/usr/bin/env python3
"""
Generate non-translation seed CSVs and loadUpdateData YAML changesets for a production profile.
Reads master-seed-data.json and writes postgres/oracle outputs.
Refuses to run against the development profile.
STM_LANGUAGE and STM_TRANSLATION are NOT handled here (owned by generate_translation_files.py).
"""

import argparse
import csv
import json
from pathlib import Path
from typing import Any

from _profile_paths import get_liquibase_root, get_scenario_from_env, discover_scenarios, resolve_baseline

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed-data"
MASTER_FILE = SEED_DATA_DIR / "master-seed-data.json"

LANGUAGE_DEFAULT_CONF_KEY = "language.default"


# --- Entity schema definitions -----------------------------------------------
# Each entry: (uppercase CSV fieldnames, column type map, changeset_id)
ENTITY_SCHEMAS: dict[str, dict[str, Any]] = {
    "STM_CODELIST": {
        "changeset_id": "2",
        "yaml_file": "02_codelists.yaml",
        "csv_dir": "02_codelists",
        "csv_file": "STM_CODELIST.csv",
        "pk": "COD_ID",
        "fields": ["COD_ID", "COD_LIST", "COD_VALUE", "COD_SYSTEM", "COD_DEFAULT", "COD_DESCRIPTION"],
        "types": {
            "COD_ID": "NUMERIC", "COD_LIST": "STRING", "COD_VALUE": "STRING",
            "COD_SYSTEM": "BOOLEAN", "COD_DEFAULT": "BOOLEAN", "COD_DESCRIPTION": "STRING",
        },
        "extras": {},  # no extra loadData options
    },
    "STM_TSK_TYP": {
        "changeset_id": "3",
        "yaml_file": "03_task_types.yaml",
        "csv_dir": "03_task_types",
        "csv_file": "STM_TSK_TYP.csv",
        "pk": "TTY_ID",
        "fields": ["TTY_ID", "TTY_NAME", "TTY_TITLE", "TTY_ENABLED", "TTY_PARENTID", "TTY_ORDER"],
        "types": {
            "TTY_ID": "NUMERIC", "TTY_NAME": "STRING", "TTY_TITLE": "STRING",
            "TTY_ENABLED": "BOOLEAN", "TTY_PARENTID": "NUMERIC", "TTY_ORDER": "NUMERIC",
        },
        "extras": {'quotchar': '"'},
    },
    "STM_TER_TYP": {
        "changeset_id": "4",
        "yaml_file": None,  # grouped into 04_seed_data.yaml
        "csv_dir": "04_seed_data",
        "csv_file": "STM_TER_TYP.csv",
        "pk": "TET_ID",
        "fields": ["TET_ID", "TET_NAME", "TET_OFFICIAL", "TET_TOP", "TET_BOTTOM"],
        "types": {
            "TET_ID": "NUMERIC", "TET_NAME": "STRING", "TET_OFFICIAL": "BOOLEAN",
            "TET_TOP": "BOOLEAN", "TET_BOTTOM": "BOOLEAN",
        },
        "extras": {"usePreparedStatements": True},
    },
    "STM_USER": {
        "changeset_id": "4",
        "yaml_file": None,  # grouped into 04_seed_data.yaml
        "csv_dir": "04_seed_data",
        "csv_file": "STM_USER.csv",
        "pk": "USE_ID",
        "fields": ["USE_ID", "USE_USER", "USE_PWD", "USE_NAME", "USE_SURNAME", "USE_ADM", "USE_BLOCKED", "USE_CREATED"],
        "types": {
            "USE_ID": "NUMERIC", "USE_USER": "STRING", "USE_PWD": "STRING",
            "USE_NAME": "STRING", "USE_SURNAME": "STRING", "USE_ADM": "BOOLEAN",
            "USE_BLOCKED": "BOOLEAN", "USE_CREATED": "DATETIME",
        },
        "extras": {"usePreparedStatements": True},
    },
    "STM_GRP_TSK": {
        "changeset_id": "4",
        "yaml_file": None,  # grouped into 04_seed_data.yaml
        "csv_dir": "04_seed_data",
        "csv_file": "STM_GRP_TSK.csv",
        "pk": "GTS_ID",
        "fields": ["GTS_ID", "GTS_NAME"],
        "types": {"GTS_ID": "NUMERIC", "GTS_NAME": "STRING"},
        "extras": {"usePreparedStatements": True},
    },
    "STM_TSK_UI": {
        "changeset_id": "4",
        "yaml_file": None,  # grouped into 04_seed_data.yaml
        "csv_dir": "04_seed_data",
        "csv_file": "STM_TSK_UI.csv",
        "pk": "TUI_ID",
        "fields": ["TUI_ID", "TUI_NAME", "TUI_TOOLTIP", "TUI_ORDER", "TUI_TYPE"],
        "types": {
            "TUI_ID": "NUMERIC", "TUI_NAME": "STRING", "TUI_TOOLTIP": "STRING",
            "TUI_ORDER": "NUMERIC", "TUI_TYPE": "STRING",
        },
        "extras": {"usePreparedStatements": True},
    },
    "STM_TASK": {
        "changeset_id": "4",
        "yaml_file": None,  # grouped into 04_seed_data.yaml
        "csv_dir": "04_seed_data",
        "csv_file": "STM_TASK.csv",
        "pk": "TAS_ID",
        "fields": [
            "TAS_ID", "TAS_NAME", "TAS_CREATED", "TAS_ORDER", "TAS_GIID", "TAS_SERID",
            "TAS_GTASKID", "TAS_TTASKID", "TAS_TUIID", "TAS_CONNID", "TAS_PARAMS",
        ],
        "types": {
            "TAS_ID": "NUMERIC", "TAS_NAME": "STRING", "TAS_CREATED": "DATETIME",
            "TAS_ORDER": "NUMERIC", "TAS_GIID": "NUMERIC", "TAS_SERID": "NUMERIC",
            "TAS_GTASKID": "NUMERIC", "TAS_TTASKID": "NUMERIC", "TAS_TUIID": "NUMERIC",
            "TAS_CONNID": "NUMERIC", "TAS_PARAMS": "STRING",
        },
        "extras": {"usePreparedStatements": True},
    },
    "STM_CONF": {
        "changeset_id": "6",
        "yaml_file": "06_params.yaml",
        "csv_dir": "06_params",
        "csv_file": "STM_CONF.csv",
        "pk": "CNF_ID",
        "fields": ["CNF_ID", "CNF_NAME", "CNF_VALUE"],
        "types": {"CNF_ID": "NUMERIC", "CNF_NAME": "STRING", "CNF_VALUE": "STRING"},
        "extras": {},
    },
}

# Sequence table update template
SEQ_UPDATE = (
    "UPDATE STM_SEQUENCE SET SEQ_COUNT = "
    "(SELECT COALESCE(MAX({pk}), 0) + 1 FROM {table}) "
    "WHERE SEQ_NAME = '{pk}'"
)


# --- Utility functions -------------------------------------------------------

def load_master() -> dict[str, Any]:
    if not MASTER_FILE.exists():
        raise FileNotFoundError(
            f"master-seed-data.json not found at {MASTER_FILE}. "
            "Run extract_seed_data.py first."
        )
    with open(MASTER_FILE, encoding="utf-8") as f:
        return json.load(f)


def format_value(value: Any, type_hint: str) -> str:
    """Convert a Python value to its CSV string representation."""
    if value is None:
        return ""
    if type_hint == "BOOLEAN":
        return "true" if value else "false"
    return str(value)


def write_csv(filepath: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, fieldnames=fields, quoting=csv.QUOTE_MINIMAL, extrasaction="ignore", lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written {len(rows)} rows -> {filepath.name}")



def _yaml_sql_block(stmt: str) -> list[str]:
    lines = ["        - sql:"]
    if stmt.upper().startswith("BEGIN"):
        lines.append("            splitStatements: false")
    lines.append(f"            sql: \"{stmt}\"")
    return lines


def _yaml_load_update_data(entity_name: str, schema: dict[str, Any]) -> list[str]:
    lines = [
        "        - loadUpdateData:",
        "            encoding: UTF-8",
        f"            file: {schema['csv_dir']}/{schema['csv_file']}",
        "            relativeToChangelogFile: true",
        f"            tableName: {entity_name}",
        f"            primaryKey: {schema['pk']}",
    ]
    extras = schema.get("extras", {})
    if extras.get("quotchar"):
        lines.append(f"            quotchar: \"\\\"\"")
    if extras.get("usePreparedStatements"):
        lines.append("            usePreparedStatements: true")
    lines.append("            columns:")
    for field in schema["fields"]:
        t = schema["types"][field]
        lines += [
            f"              - column:",
            f"                  name: {field}",
            f"                  type: {t}",
        ]
    return lines


# --- Validation  -------------------------------------------------------------

def validate_master(master: dict[str, Any]) -> None:
    entities = master.get("entities", {})
    for entity_name, entity_data in entities.items():
        classification = entity_data.get("classification")
        if classification not in ("reference", "extensible"):
            raise ValueError(
                f"{entity_name}: missing or invalid classification {classification!r}. "
                "Must be 'reference' or 'extensible'."
            )
        pk_col = entity_data.get("pk_column", "").lower()
        rows = entity_data.get("rows", [])
        seen: set = set()
        for row in rows:
            pk = row.get(pk_col)
            if pk is None:
                raise ValueError(f"{entity_name}: row missing pk_column '{pk_col}': {row}")
            if pk in seen:
                raise ValueError(f"{entity_name}: duplicate PK {pk_col}={pk!r}")
            seen.add(pk)
    print("  Integrity checks passed.")


# --- Row builders ------------------------------------------------------------

def build_codelist_rows(raw_rows: list[dict]) -> list[dict[str, Any]]:
    fields = ENTITY_SCHEMAS["STM_CODELIST"]["fields"]
    types = ENTITY_SCHEMAS["STM_CODELIST"]["types"]
    result = []
    for row in raw_rows:
        out: dict[str, Any] = {}
        for f in fields:
            raw_val = row.get(f.lower(), "")
            out[f] = format_value(raw_val, types[f])
        result.append(out)
    return result


def build_generic_rows(entity_name: str, raw_rows: list[dict]) -> list[dict[str, Any]]:
    schema = ENTITY_SCHEMAS[entity_name]
    fields = schema["fields"]
    types = schema["types"]
    result = []
    for row in raw_rows:
        out: dict[str, Any] = {}
        for f in fields:
            raw_val = row.get(f.lower(), "")
            out[f] = format_value(raw_val, types[f])
        result.append(out)
    return result


# --- YAML builders -----------------------------------------------------------

def build_codelist_yaml() -> str:
    schema = ENTITY_SCHEMAS["STM_CODELIST"]
    seq_stmt = SEQ_UPDATE.format(pk="COD_ID", table="STM_CODELIST")

    lines = ["databaseChangeLog:", "  - changeSet:"]
    lines += [
        f"      id: {schema['changeset_id']}",
        "      author: sitmun",
        "      runOnChange: true",
        "      changes:",
    ]
    lines += _yaml_load_update_data("STM_CODELIST", schema)
    lines += _yaml_sql_block(seq_stmt)
    return "\n".join(lines) + "\n"


def build_task_types_yaml() -> str:
    schema = ENTITY_SCHEMAS["STM_TSK_TYP"]
    seq_stmt = SEQ_UPDATE.format(pk="TTY_ID", table="STM_TSK_TYP")

    lines = ["databaseChangeLog:", "  - changeSet:"]
    lines += [
        f"      id: {schema['changeset_id']}",
        "      author: sitmun",
        "      runOnChange: true",
        "      changes:",
    ]
    lines += _yaml_load_update_data("STM_TSK_TYP", schema)
    lines += _yaml_sql_block(seq_stmt)
    return "\n".join(lines) + "\n"


def build_seed_data_yaml() -> str:
    """04_seed_data.yaml with loadUpdateData for all extensible entities (no cleanup)."""
    lines = ["databaseChangeLog:", "  - changeSet:"]
    lines += [
        "      id: 4",
        "      author: sitmun",
        "      runOnChange: true",
        "      changes:",
    ]
    for entity in ["STM_TER_TYP", "STM_USER", "STM_GRP_TSK", "STM_TSK_UI", "STM_TASK"]:
        lines += _yaml_load_update_data(entity, ENTITY_SCHEMAS[entity])
    for entity, pk in [
        ("STM_TER_TYP", "TET_ID"), ("STM_USER", "USE_ID"), ("STM_GRP_TSK", "GTS_ID"),
        ("STM_TSK_UI", "TUI_ID"), ("STM_TASK", "TAS_ID"),
    ]:
        lines += _yaml_sql_block(SEQ_UPDATE.format(pk=pk, table=entity))
    return "\n".join(lines) + "\n"


def build_config_yaml() -> str:
    schema = ENTITY_SCHEMAS["STM_CONF"]
    seq_stmt = SEQ_UPDATE.format(pk="CNF_ID", table="STM_CONF")

    lines = ["databaseChangeLog:", "  - changeSet:"]
    lines += [
        f"      id: {schema['changeset_id']}",
        "      author: sitmun",
        "      runOnChange: true",
        "      changes:",
    ]
    lines += _yaml_load_update_data("STM_CONF", schema)
    lines += _yaml_sql_block(seq_stmt)
    return "\n".join(lines) + "\n"


# --- Main --------------------------------------------------------------------

def generate(scenario: str) -> None:
    if scenario == "development":
        raise SystemExit("ERROR: generate_seed_files.py refuses to write to the development profile.")

    print(f"\nScenario: {scenario}")
    liquibase_root = get_liquibase_root(WORKSPACE_ROOT, scenario)
    changelog_dir = liquibase_root / "changelog"

    print("\nLoading master-seed-data.json...")
    master = load_master()

    print("\nValidating integrity...")
    validate_master(master)

    entities = master["entities"]

    # --- STM_CODELIST ---
    print("\nGenerating STM_CODELIST...")
    codelist_rows = build_codelist_rows(entities["STM_CODELIST"]["rows"])
    csv_path = changelog_dir / "02_codelists" / "STM_CODELIST.csv"
    write_csv(csv_path, codelist_rows, ENTITY_SCHEMAS["STM_CODELIST"]["fields"])
    yaml_content = build_codelist_yaml()
    (changelog_dir / "02_codelists.yaml").write_text(yaml_content, encoding="utf-8", newline="\n")
    print(f"  Written 02_codelists.yaml")

    # --- STM_TSK_TYP ---
    print("\nGenerating STM_TSK_TYP...")
    tsk_typ_rows = build_generic_rows("STM_TSK_TYP", entities["STM_TSK_TYP"]["rows"])
    csv_path = changelog_dir / "03_task_types" / "STM_TSK_TYP.csv"
    write_csv(csv_path, tsk_typ_rows, ENTITY_SCHEMAS["STM_TSK_TYP"]["fields"])
    yaml_content = build_task_types_yaml()
    (changelog_dir / "03_task_types.yaml").write_text(yaml_content, encoding="utf-8", newline="\n")
    print(f"  Written 03_task_types.yaml")

    # --- 04_seed_data group ---
    print("\nGenerating 04_seed_data entities...")
    ter_typ_rows = build_generic_rows("STM_TER_TYP", entities["STM_TER_TYP"]["rows"])
    user_rows = build_generic_rows("STM_USER", entities["STM_USER"]["rows"])
    grp_tsk_rows = build_generic_rows("STM_GRP_TSK", entities["STM_GRP_TSK"]["rows"])
    tsk_ui_rows = build_generic_rows("STM_TSK_UI", entities["STM_TSK_UI"]["rows"])
    task_rows = build_generic_rows("STM_TASK", entities["STM_TASK"]["rows"])

    seed_data_dir = changelog_dir / "04_seed_data"
    for entity_name, rows in [
        ("STM_TER_TYP", ter_typ_rows), ("STM_USER", user_rows),
        ("STM_GRP_TSK", grp_tsk_rows), ("STM_TSK_UI", tsk_ui_rows), ("STM_TASK", task_rows),
    ]:
        schema = ENTITY_SCHEMAS[entity_name]
        write_csv(seed_data_dir / schema["csv_file"], rows, schema["fields"])

    yaml_content = build_seed_data_yaml()
    (changelog_dir / "04_seed_data.yaml").write_text(yaml_content, encoding="utf-8", newline="\n")
    print(f"  Written 04_seed_data.yaml")

    # --- STM_CONF ---
    print("\nGenerating STM_CONF...")
    active_lang = resolve_baseline(None, SEED_DATA_DIR)
    raw_conf_rows = [
        {**row, "cnf_value": active_lang}
        if row.get("cnf_name") == LANGUAGE_DEFAULT_CONF_KEY
        else row
        for row in entities["STM_CONF"]["rows"]
    ]
    conf_rows = build_generic_rows("STM_CONF", raw_conf_rows)
    csv_path = changelog_dir / "06_params" / "STM_CONF.csv"
    write_csv(csv_path, conf_rows, ENTITY_SCHEMAS["STM_CONF"]["fields"])
    yaml_content = build_config_yaml()
    (changelog_dir / "06_params.yaml").write_text(yaml_content, encoding="utf-8", newline="\n")
    print(f"  Written 06_params.yaml")

    print(f"\nDone for scenario: {scenario}")


def main() -> None:
    scenarios = discover_scenarios(WORKSPACE_ROOT)
    parser = argparse.ArgumentParser(
        description="Generate non-translation seed CSVs and YAML changesets for a production profile."
    )
    parser.add_argument(
        "--scenario",
        choices=scenarios,
        default=get_scenario_from_env(),
        help="Target scenario (default: SITMUN_PROFILE or postgres). development is rejected.",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("SITMUN Seed File Generator")
    print("=" * 60)

    generate(args.scenario)


if __name__ == "__main__":
    main()
