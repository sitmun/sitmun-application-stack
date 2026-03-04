"""Resolve Liquibase profile paths by scenario and i18n baselines."""

import os
from pathlib import Path

DEFAULT_SCENARIO = "postgres"

# tools/bin/ -> tools/ -> repo root; data lives at tools/seed-data/
_TOOLS_ROOT = Path(__file__).resolve().parent.parent
_TOOLS_DIR = _TOOLS_ROOT / "seed-data"


# ---------------------------------------------------------------------------
# Scenario discovery
# ---------------------------------------------------------------------------

def discover_scenarios(workspace_root: Path) -> tuple[str, ...]:
    """Return all valid scenario names from filesystem convention.

    Convention: profiles/<scenario>/liquibase/ exists.
    The development profile lives at profiles/development/backend/liquibase,
    so its marker is profiles/development/backend/liquibase.
    """
    base = workspace_root / "profiles"
    found = []
    if not base.exists():
        return ()
    for child in sorted(base.iterdir()):
        if not child.is_dir():
            continue
        name = child.name
        if name == "development":
            # Special path: profiles/development/backend/liquibase
            if (child / "backend" / "liquibase").exists():
                found.append(name)
        else:
            if (child / "liquibase").exists():
                found.append(name)
    return tuple(found)


def get_scenario_from_env() -> str:
    """Scenario from SITMUN_PROFILE, or default."""
    return os.environ.get("SITMUN_PROFILE", DEFAULT_SCENARIO).strip().lower()


def get_liquibase_root(workspace_root: Path, scenario: str) -> Path:
    """Liquibase root for the given scenario.

    development -> profiles/development/backend/liquibase
    other       -> profiles/<scenario>/liquibase
    """
    scenario = (scenario or DEFAULT_SCENARIO).strip().lower()
    valid = discover_scenarios(workspace_root)
    if scenario not in valid:
        raise ValueError(f"Unknown scenario {scenario!r}. Known: {valid}")
    if scenario == "development":
        return workspace_root / "profiles" / "development" / "backend" / "liquibase"
    return workspace_root / "profiles" / scenario / "liquibase"


# ---------------------------------------------------------------------------
# Baseline resolution
# ---------------------------------------------------------------------------

def discover_baselines(tools_dir: Path | None = None) -> list[str]:
    """Return all available i18n baseline codes from master-i18n.*.json files."""
    d = tools_dir or _TOOLS_DIR
    return sorted(p.stem.split(".", 1)[1] for p in d.glob("master-i18n.*.json"))


def resolve_baseline(baseline_arg: str | None, tools_dir: Path | None = None) -> str:
    """Resolve the active baseline code with precedence:

    1. Explicit --baseline <lang> argument
    2. i18n-active-baseline.json selector file
    3. Hard error (no implicit fallback)
    """
    import json

    d = tools_dir or _TOOLS_DIR
    available = discover_baselines(d)
    if not available:
        raise RuntimeError(
            f"No master-i18n.*.json files found in {d}. "
            "Run phase 1b migration first."
        )

    if baseline_arg:
        code = baseline_arg.strip()
        if code not in available:
            raise ValueError(
                f"Baseline {code!r} not found. "
                f"Available: {available}. "
                f"Expected file: {d / f'master-i18n.{code}.json'}"
            )
        return code

    selector = d / "i18n-active-baseline.json"
    if selector.exists():
        with open(selector, encoding="utf-8") as f:
            data = json.load(f)
        code = data.get("activeBaseline", "").strip()
        if not code:
            raise RuntimeError(
                f"i18n-active-baseline.json exists but 'activeBaseline' is empty in {selector}."
            )
        if code not in available:
            raise ValueError(
                f"Selector specifies baseline {code!r} but file "
                f"master-i18n.{code}.json not found in {d}. "
                f"Available: {available}"
            )
        return code

    raise RuntimeError(
        "No baseline specified and no i18n-active-baseline.json found. "
        f"Pass --baseline <lang> (available: {available}) or create {selector}."
    )


def load_baseline(baseline_code: str, tools_dir: Path | None = None) -> dict:
    """Load baseline JSON for one language. Each file contains only its own language column."""
    import json

    d = tools_dir or _TOOLS_DIR
    path = d / f"master-i18n.{baseline_code}.json"
    if not path.exists():
        available = discover_baselines(d)
        raise FileNotFoundError(
            f"Baseline file not found: {path}. Available: {available}"
        )
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_all_baselines(tools_dir: Path | None = None) -> dict:
    """Merge all per-language baselines into a single dict with all language columns per row.

    Returns a combined structure:
      metadata.allLanguageIds: {lang: id, ...}  (inferred from file discovery + Language entity)
      entities.<Name>.translations: [{id: N, en: ..., es: ..., ca: ..., ...}, ...]
    """
    import json

    d = tools_dir or _TOOLS_DIR
    codes = discover_baselines(d)
    if not codes:
        raise RuntimeError(f"No master-i18n.*.json files found in {d}.")

    # Load all per-lang files
    per_lang: dict[str, dict] = {code: load_baseline(code, d) for code in codes}

    # Use the en baseline (or first available) as the structural template
    primary_code = "en" if "en" in per_lang else codes[0]
    primary = per_lang[primary_code]

    # Collect all entity names (union across all files)
    all_entity_names: list[str] = list(primary["entities"].keys())
    for code, data in per_lang.items():
        for name in data["entities"]:
            if name not in all_entity_names:
                all_entity_names.append(name)

    # Build merged entities
    merged_entities: dict = {}
    for entity_name in all_entity_names:
        # Gather all ids from primary baseline
        primary_entity = primary["entities"].get(entity_name, {"field": "", "column": "", "translations": []})
        id_set = {e["id"] for e in primary_entity["translations"]}

        # Index per-language rows by id
        lang_rows: dict[str, dict[int, str]] = {}
        for code, data in per_lang.items():
            entity = data["entities"].get(entity_name, {})
            lang_rows[code] = {e["id"]: e.get(code, "") for e in entity.get("translations", [])}
            # Also collect any ids not in primary
            for e in entity.get("translations", []):
                id_set.add(e["id"])

        merged_translations = []
        for eid in sorted(id_set):
            row: dict = {"id": eid}
            for code in codes:
                row[code] = lang_rows.get(code, {}).get(eid, "")
            merged_translations.append(row)

        merged_entities[entity_name] = {
            "field": primary_entity.get("field", ""),
            "column": primary_entity.get("column", ""),
            "translations": merged_translations,
        }
        if primary_entity.get("seedDataOnly"):
            merged_entities[entity_name]["seedDataOnly"] = True

    # Read allLanguageIds from i18n-active-baseline.json (authoritative project config)
    selector = d / "i18n-active-baseline.json"
    all_lang_ids: dict[str, int] = {}
    if selector.exists():
        with open(selector, encoding="utf-8") as f:
            sel = json.load(f)
        all_lang_ids = sel.get("allLanguageIds", {})
    # Fall back to sequential ordering if not configured
    for i, code in enumerate(codes, start=1):
        if code not in all_lang_ids:
            all_lang_ids[code] = i

    return {
        "metadata": {
            "version": "1.0",
            "defaultLanguage": primary_code,
            "allLanguageIds": all_lang_ids,
        },
        "entities": merged_entities,
    }


def save_baseline(baseline_code: str, data: dict, tools_dir: Path | None = None) -> None:
    """Write a single-language baseline back to disk.

    Accepts either:
    - A single-lang dict (metadata.language = baseline_code, rows have only id + lang key), or
    - A multi-lang dict (rows have multiple language keys) — in that case only the baseline_code
      column is extracted and saved.
    """
    import json
    from datetime import datetime

    d = tools_dir or _TOOLS_DIR
    path = d / f"master-i18n.{baseline_code}.json"

    # Detect format: if rows contain keys other than id and baseline_code, extract only ours
    entities_out: dict = {}
    for entity_name, entity_data in data["entities"].items():
        translations_out = []
        for entry in entity_data.get("translations", []):
            translations_out.append({
                "id": entry["id"],
                baseline_code: entry.get(baseline_code, ""),
            })
        entities_out[entity_name] = {
            "field": entity_data.get("field", ""),
            "column": entity_data.get("column", ""),
            "translations": translations_out,
        }
        if entity_data.get("seedDataOnly"):
            entities_out[entity_name]["seedDataOnly"] = True

    out = {
        "metadata": {
            "version": "1.0",
            "lastUpdated": datetime.now().strftime("%Y-%m-%d"),
            "language": baseline_code,
        },
        "entities": entities_out,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")
