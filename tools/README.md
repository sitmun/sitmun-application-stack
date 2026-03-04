# SITMUN tools

Helpers for codelists, Liquibase changelogs, seed data, and translations.

## Layout

```
tools/
├── seed-data/        source-of-truth JSON/CSV data (never edit generated files)
├── bin/              Python tooling — generators, importers, utilities
├── scripts/          operational shell scripts (apply, validate)
├── tests/            integration test scripts (Docker-based Liquibase tests)
└── i18n-utils/       frontend i18n helpers
```

## Scenario selection

- **Environment**: `SITMUN_PROFILE` (values: discovered from `profiles/*/liquibase/`).
- **CLI**: Many tools accept `--scenario <name>`. CLI overrides the environment.
- **Default**: `postgres` when neither is set.

Paths by scenario:

- `postgres` → `profiles/postgres/liquibase`
- `oracle` → `profiles/oracle/liquibase`
- `development` → `profiles/development/backend/liquibase`

---

## Liquibase execution: backend vs tests

- **Backend (Spring)**  
  When the app runs with a profile (e.g. in Docker), Liquibase uses the profile changelog (e.g. `file:/usr/src/config/liquibase/master.xml`), which is the same as `profiles/postgres/liquibase/master.xml` or `profiles/oracle/liquibase/master.xml` when that path is mounted. So production and Docker run the same profile changelogs (01–07, etc.).

- **Shell tests** (`tools/tests/test_liquibase_scenarios.sh`, `test_liquibase_scenarios_oracle.sh`)  
  They mount `profiles/<scenario>/liquibase` and run `liquibase update` with `changelog/master.xml`. So they run the same changelog as production for that profile. Behaviour matches the backend when it uses that profile.

- **JUnit tests**  
  They use classpath changelogs (e.g. `classpath:/db/changelog/db.changelog-postgres.yaml` in `application-postgres.yml`), which include files from `src/test/resources/db/changelog/` and/or the backend `config/db/changelog/`. That set can differ from the profile changelogs (e.g. no 07_sequences, or different includes). So JUnit Liquibase runs do not necessarily behave the same as profile-based runs; they validate the app against a test DB schema, not the production seed flow.

---

## tools/scripts/ — Operational

| Script | Purpose |
|--------|---------|
| **apply-seed-data.sh** | Generate seed files then apply the Liquibase changelog to a remote database. `--db-type postgres\|oracle`; `--baseline` selects i18n language. |
| **validate-liquibase-changelogs.sh** | List changelogs by last modification (newest first). Pass `[liquibase_dir]` as first argument (default: development). |

```bash
# Apply seed data to a remote PostgreSQL database (English baseline)
bash tools/scripts/apply-seed-data.sh \
  --db-type postgres \
  --url jdbc:postgresql://db.example.com:5432/sitmun \
  --username sitmun3 --password secret

# Apply with Spanish as the display language
bash tools/scripts/apply-seed-data.sh \
  --db-type postgres \
  --url jdbc:postgresql://db.example.com:5432/sitmun \
  --username sitmun3 --password secret \
  --baseline es

# Apply to Oracle
bash tools/scripts/apply-seed-data.sh \
  --db-type oracle \
  --url "jdbc:oracle:thin:@//oracle.example.com:1521/sitmun" \
  --username sitmun3 --password secret

# Dry run (print SQL, no changes)
bash tools/scripts/apply-seed-data.sh \
  --db-type postgres \
  --url jdbc:postgresql://db.example.com:5432/sitmun \
  --username sitmun3 --password secret \
  --dry-run

# Validate changelogs
bash tools/scripts/validate-liquibase-changelogs.sh
bash tools/scripts/validate-liquibase-changelogs.sh profiles/postgres/liquibase
bash tools/scripts/validate-liquibase-changelogs.sh profiles/oracle/liquibase
```

---

## tools/tests/ — Integration Tests

| Script | Purpose |
|--------|---------|
| **test_liquibase_scenarios.sh** | Docker-based Liquibase test for PostgreSQL (5 scenarios, language switching). |
| **test_liquibase_scenarios_oracle.sh** | Same for Oracle. |

```bash
bash tools/tests/test_liquibase_scenarios.sh
bash tools/tests/test_liquibase_scenarios_oracle.sh
```

---

## tools/bin/ — Python Tooling

See [seed-data/README.md](seed-data/README.md) for the full workflow.

| Script | Purpose | Key flags |
|--------|---------|-----------|
| **generate_all_seed_outputs.py** | Orchestrator: run translation + seed generation for all production profiles. | `--scenarios` (default: postgres,oracle); `--baseline` |
| **generate_seed_files.py** | Generate non-translation seed CSVs + loadUpdateData YAMLs. | `--scenario` |
| **generate_translation_files.py** | Generate Liquibase translation CSVs + changelog from baseline. | `--scenario`; `--baseline` |
| **switch_default_language.py** | Non-destructive baseline selection + production regeneration. | positional lang; `--dry-run` |
| **check_translations.py** | Report missing translations. | `--baseline` |
| **import_missing_translations.py** | Merge completed rows from `missing-translations.csv` into a baseline. | `--baseline` |
| **extract_seed_data.py** | Extract non-translation seed rows from dev CSVs → `master-seed-data.json`. | — |
| **extract_translatable.py** | Extract from seed CSVs + dev translations → baseline JSON. | `--scenario`; `--baseline` |
| **import_from_csv.py** | One-time import from legacy Liquibase translation CSVs into a baseline. | `--scenario`; `--baseline` |
| **import_from_generated_csvs.py** | Import from generated `STM_TRANSLATION_*.csv` into a baseline. | `--scenario`; `--baseline` |
| **sort_codelist.py** | Sort and renumber `STM_CODELIST.csv`. | pass input file path |

```bash
# Generate translation + seed files for both production profiles (default baseline)
python3 tools/bin/generate_all_seed_outputs.py

# Explicit English baseline, both profiles
python3 tools/bin/generate_all_seed_outputs.py --baseline en --scenarios postgres,oracle

# Only translation files for oracle
python3 tools/bin/generate_translation_files.py --scenario oracle --baseline en

# Switch default language to Spanish (non-destructive, regenerates postgres + oracle)
python3 tools/bin/switch_default_language.py es --dry-run
python3 tools/bin/switch_default_language.py es

# Sort a codelist CSV
python3 tools/bin/sort_codelist.py profiles/postgres/liquibase/changelog/02_codelists/STM_CODELIST.csv
```

---

## tools/i18n-utils/ — Frontend i18n

| Script | Purpose |
|--------|---------|
| **sort_and_complete_translations.py** | Sort Angular/ngx-translate JSON keys; fill missing keys from reference locale. |

---

## Requirements

- **Bash**: for shell scripts (macOS/Linux).
- **Docker**: for `scripts/apply-seed-data.sh` and `tests/` scripts (runs Liquibase in a container).
- **Python 3.10+**: for all Python tools (stdlib only, no extra deps).
