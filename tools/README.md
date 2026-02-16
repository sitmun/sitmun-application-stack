# SITMUN tools

Helpers for codelists, Liquibase changelogs, and translations. Where a tool operates on profile-specific paths, the **scenario** (profile) can be selected so the same command works for `development`, `postgres`, or `oracle`.

## Scenario selection

- **Environment**: `SITMUN_PROFILE` (values: `development`, `postgres`, `oracle`). Same variable as the main stack (see project root README).
- **CLI**: Many tools accept `--scenario <name>`. CLI overrides the environment.
- **Default**: `postgres` when neither is set.

Paths by scenario:

- `postgres` → `profiles/postgres/liquibase`
- `oracle` → `profiles/oracle/liquibase`
- `development` → `profiles/development/backend/liquibase`

---

## Scripts

### Liquibase

| Script | Purpose | Scenario |
|--------|---------|----------|
| **validate-liquibase-changelogs.sh** | List changelogs by last modification (newest first), mark git status. | Select via first argument: `[liquibase_dir]` (default `profiles/development/backend/liquibase`). Use `profiles/postgres/liquibase` or `profiles/oracle/liquibase` for DB profiles. |

```bash
./tools/validate-liquibase-changelogs.sh
./tools/validate-liquibase-changelogs.sh profiles/postgres/liquibase
./tools/validate-liquibase-changelogs.sh profiles/oracle/liquibase
```

### Codelists

| Script | Purpose | Scenario |
|--------|---------|----------|
| **sort_codelist.py** | Sort CSV by `COD_LIST` and `COD_DESCRIPTION`, renumber `COD_ID`. | N/A — pass input (and optional output) file path. |
| **sort_codelist_quoted.py** | Same as above with quoted CSV (development profile format). | N/A — pass input (and optional output) file path. |

```bash
python3 tools/sort_codelist.py profiles/postgres/liquibase/changelog/02_codelists/STM_CODELIST.csv
python3 tools/sort_codelist_quoted.py path/to/stm_codelist.csv
```

### Frontend i18n

| Script | Purpose | Scenario |
|--------|---------|----------|
| **front-i18n/sort_and_complete_translations.py** | Sort Angular/ngx-translate JSON keys; fill missing keys from reference locale. | N/A — pass `--i18n-dir <path>`. |

See [front-i18n/README.md](front-i18n/README.md) for options and examples.

### Translations

All translation tools live under **tools/translations/** and use `tools/translations/README.md` for the full workflow. Those that read or write profile Liquibase paths support scenario selection.

| Script | Purpose | Scenario |
|--------|---------|----------|
| **extract_translatable.py** | Extract from seed CSVs + dev translations → `master-translations.json`. | `--scenario` for seed data profile; translation sources use development. |
| **generate_translation_files.py** | Generate Liquibase translation CSVs + changelog from master. | `--scenario` (default from `SITMUN_PROFILE` or `postgres`). |
| **switch_default_language.py** | Swap default language in seed data and master; regenerates translation CSVs. | `--scenario` for target profile. |
| **import_from_csv.py** | One-time import from existing Liquibase translation CSVs into master. | `--scenario` for CSV location. |
| **import_from_generated_csvs.py** | Import from generated `STM_TRANSLATION_*.csv` into master. | `--scenario` for CSV location. |
| **check_translations.py** | Report missing translations from master. | N/A. |
| **import_missing_translations.py** | Merge completed rows from `missing-translations.csv` into master. | N/A. |

```bash
# Generate translation files for postgres (default)
python3 tools/translations/generate_translation_files.py

# Generate for oracle profile
python3 tools/translations/generate_translation_files.py --scenario oracle
SITMUN_PROFILE=oracle python3 tools/translations/generate_translation_files.py

# Switch default language in postgres profile
python3 tools/translations/switch_default_language.py es --dry-run
python3 tools/translations/switch_default_language.py ca --scenario oracle
```

---

## Requirements

- **Bash**: for `validate-liquibase-changelogs.sh` (macOS/Linux).
- **Python 3.7+**: for all Python tools (no extra deps).
