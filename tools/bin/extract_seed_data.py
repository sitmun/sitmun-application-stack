#!/usr/bin/env python3
"""
Extract non-translation seed data from development CSVs into master-seed-data.json.
Sources: codelists, task types, territory types, users (dev+prod), tasks, task UI, group tasks, config.
STM_LANGUAGE and STM_TRANSLATION are NOT included (owned by generate_translation_files.py).
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any

DEV_LIQUIBASE = Path(__file__).resolve().parent.parent.parent / "profiles/development/backend/liquibase"
SEED_DATA_DIR = Path(__file__).resolve().parent.parent / "seed-data"
OUTPUT_FILE = SEED_DATA_DIR / "master-seed-data.json"

SOURCES = {
    "STM_CODELIST": DEV_LIQUIBASE / "changelog/02_codelists/stm_codelist.csv",
    "STM_TSK_TYP": DEV_LIQUIBASE / "changelog/03_task_types/stm_tsk_typ.csv",
    "STM_TER_TYP": DEV_LIQUIBASE / "changelog/04_initial_data_dev/stm_ter_typ.csv",
    "STM_USER_DEV": DEV_LIQUIBASE / "changelog/04_initial_data_dev/stm_user.csv",
    "STM_USER_PROD": DEV_LIQUIBASE / "changelog/04_initial_data_prod/STM_USER.csv",
    "STM_TASK": DEV_LIQUIBASE / "changelog/04_initial_data_dev/stm_task.csv",
    "STM_TSK_UI": DEV_LIQUIBASE / "changelog/04_initial_data_dev/stm_tsk_ui.csv",
    "STM_GRP_TSK": DEV_LIQUIBASE / "changelog/04_initial_data_dev/stm_grp_tsk.csv",
    "STM_CONF": DEV_LIQUIBASE / "changelog/06_params/stm_conf.csv",
}

# Entity classification for sync safety
ENTITY_CLASSIFICATION = {
    "STM_CODELIST": "reference",
    "STM_TSK_TYP": "reference",
    "STM_TER_TYP": "extensible",
    "STM_USER": "extensible",
    "STM_TASK": "extensible",
    "STM_TSK_UI": "extensible",
    "STM_GRP_TSK": "extensible",
    "STM_CONF": "reference",
}

# Primary key columns per entity
PK_COLUMNS = {
    "STM_CODELIST": "cod_id",
    "STM_TSK_TYP": "TTY_ID",
    "STM_TER_TYP": "tet_id",
    "STM_USER": "use_id",
    "STM_TASK": "tas_id",
    "STM_TSK_UI": "tui_id",
    "STM_GRP_TSK": "gts_id",
    "STM_CONF": "cnf_id",
}


def read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Source CSV not found: {path}")
    with open(path, encoding="utf-8") as f:
        # Handle both quoted and unquoted headers
        content = f.read()
    from io import StringIO
    reader = csv.DictReader(StringIO(content))
    rows = []
    for row in reader:
        # Normalize keys to lower-case for consistent access
        rows.append({k.strip('"').strip().lower(): v.strip('"').strip() for k, v in row.items()})
    return rows


def normalize_row(row: dict[str, str]) -> dict[str, Any]:
    """Normalize CSV row values (booleans, nulls)."""
    result: dict[str, Any] = {}
    for k, v in row.items():
        if v.upper() in ("TRUE",):
            result[k] = True
        elif v.upper() in ("FALSE",):
            result[k] = False
        elif v.upper() in ("NULL", ""):
            result[k] = None
        else:
            # Try numeric
            try:
                result[k] = int(v)
            except ValueError:
                try:
                    result[k] = float(v)
                except ValueError:
                    result[k] = v
    return result


def validate_entity(entity_name: str, rows: list[dict[str, Any]], pk_col: str) -> None:
    seen: set = set()
    for row in rows:
        pk = row.get(pk_col)
        if pk is None:
            raise ValueError(f"{entity_name}: row missing PK column '{pk_col}': {row}")
        if pk in seen:
            raise ValueError(f"{entity_name}: duplicate PK {pk_col}={pk!r}")
        seen.add(pk)


def extract_codelist() -> list[dict[str, Any]]:
    rows = [normalize_row(r) for r in read_csv(SOURCES["STM_CODELIST"])]
    validate_entity("STM_CODELIST", rows, "cod_id")
    return sorted(rows, key=lambda r: r["cod_id"])


def extract_tsk_typ() -> list[dict[str, Any]]:
    raw = read_csv(SOURCES["STM_TSK_TYP"])
    rows = [normalize_row(r) for r in raw]
    validate_entity("STM_TSK_TYP", rows, "tty_id")
    return sorted(rows, key=lambda r: (r["tty_id"] if r["tty_id"] is not None else -1))


def extract_ter_typ() -> list[dict[str, Any]]:
    rows = [normalize_row(r) for r in read_csv(SOURCES["STM_TER_TYP"])]
    validate_entity("STM_TER_TYP", rows, "tet_id")
    return sorted(rows, key=lambda r: r["tet_id"])


def extract_users() -> list[dict[str, Any]]:
    """Merge dev and prod users. Prod row overrides dev row on USE_ID conflict."""
    dev_rows = {
        r["use_id"]: normalize_row(r)
        for r in read_csv(SOURCES["STM_USER_DEV"])
    }
    prod_rows = {
        r["use_id"]: {**normalize_row(r), "_context": "prod"}
        for r in read_csv(SOURCES["STM_USER_PROD"])
    }
    for k, v in dev_rows.items():
        if k not in prod_rows:
            v["_context"] = "dev"

    merged: dict[str, dict[str, Any]] = {}
    for k, v in dev_rows.items():
        merged[k] = v
    for k, v in prod_rows.items():
        merged[k] = v  # prod overrides dev

    all_rows = list(merged.values())
    validate_entity("STM_USER", all_rows, "use_id")
    return sorted(all_rows, key=lambda r: r["use_id"])


def extract_task() -> list[dict[str, Any]]:
    rows = [normalize_row(r) for r in read_csv(SOURCES["STM_TASK"])]
    validate_entity("STM_TASK", rows, "tas_id")
    return sorted(rows, key=lambda r: r["tas_id"])


def extract_tsk_ui() -> list[dict[str, Any]]:
    rows = [normalize_row(r) for r in read_csv(SOURCES["STM_TSK_UI"])]
    validate_entity("STM_TSK_UI", rows, "tui_id")
    return sorted(rows, key=lambda r: r["tui_id"])


def extract_grp_tsk() -> list[dict[str, Any]]:
    rows = [normalize_row(r) for r in read_csv(SOURCES["STM_GRP_TSK"])]
    validate_entity("STM_GRP_TSK", rows, "gts_id")
    return sorted(rows, key=lambda r: r["gts_id"])


def extract_conf() -> list[dict[str, Any]]:
    rows = [normalize_row(r) for r in read_csv(SOURCES["STM_CONF"])]
    validate_entity("STM_CONF", rows, "cnf_id")
    return sorted(rows, key=lambda r: r["cnf_id"])


def main() -> None:
    print("=" * 60)
    print("SITMUN Seed Data Extractor")
    print("=" * 60)
    print(f"Source: {DEV_LIQUIBASE}")
    print()

    extractors = {
        "STM_CODELIST": extract_codelist,
        "STM_TSK_TYP": extract_tsk_typ,
        "STM_TER_TYP": extract_ter_typ,
        "STM_USER": extract_users,
        "STM_TASK": extract_task,
        "STM_TSK_UI": extract_tsk_ui,
        "STM_GRP_TSK": extract_grp_tsk,
        "STM_CONF": extract_conf,
    }

    entities: dict[str, Any] = {}
    for entity_name, extractor in extractors.items():
        print(f"Extracting {entity_name}...")
        rows = extractor()
        entities[entity_name] = {
            "classification": ENTITY_CLASSIFICATION[entity_name],
            "pk_column": PK_COLUMNS[entity_name],
            "rows": rows,
        }
        print(f"  {len(rows)} rows")

    master = {
        "metadata": {
            "version": "1.0",
            "lastUpdated": datetime.now().strftime("%Y-%m-%d"),
            "description": (
                "Canonical non-translation seed data. English/default. "
                "STM_LANGUAGE and STM_TRANSLATION are owned by generate_translation_files.py."
            ),
        },
        "entities": entities,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(master, f, indent=2, ensure_ascii=False)

    print(f"\nWritten: {OUTPUT_FILE}")
    print("\nNext steps:")
    print("1. Run generate_all_seed_outputs.py to generate postgres/oracle files")


if __name__ == "__main__":
    main()
