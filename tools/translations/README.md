# SITMUN Translation Management Tools

This directory contains Python tools for managing translations in the SITMUN application stack. The tools provide a centralized workflow for extracting, managing, and generating translation files for Liquibase database seeding.

## Scenario (profile) selection

Tools that read or write profile Liquibase paths accept a **scenario**: `development`, `postgres`, or `oracle`. Use `--scenario <name>` or set `SITMUN_PROFILE` (same as the main stack). Default is `postgres`. See [../README.md](../README.md) for the full list.

## Overview

The translation management system uses a master JSON file (`master-translations.json`) as the single source of truth for all translations. This approach provides:

- **Centralized Management**: All translations in one place
- **Easy Review**: JSON format is readable and diffable
- **Completeness Tracking**: Easy to identify missing translations
- **Automated Generation**: Generate Liquibase CSV files automatically
- **Version Control Friendly**: Track translation changes in git

## Files

- `_profile_paths.py` - Shared scenario/path resolution (used by profile-aware scripts)
- `master-translations.json` - Master translation file (single source of truth)
- `extract_translatable.py` - Extract translatable content from seed data
- `import_from_csv.py` - Import translations from existing Liquibase CSV files (one-time migration)
- `import_from_generated_csvs.py` - Import translations from generated STM_TRANSLATION_*.csv files
- `generate_translation_files.py` - Generate Liquibase CSV files from master
- `check_translations.py` - Check translation completeness and report missing entries
- `import_missing_translations.py` - Import completed translations from CSV
- `switch_default_language.py` - Switch default language for deployments
- `missing-translations.csv` - Generated file with missing translations (for completion)

## Workflow

### 1. Initial Setup (Extract Existing Data)

Extract translatable content from seed data and existing translations:

```bash
python3 extract_translatable.py
```

This will:
- Read seed data CSV files (Language, CodeListValue, TerritoryType)
- Load existing translations from development profile
- Create/update `master-translations.json` with all data

**Optional: Import from existing Liquibase CSVs**

If you have existing translation CSV files in `05_translations/`, you can import them:

```bash
python3 import_from_csv.py
```

This is useful for one-time migration of manually created translation files into the master file.

### 2. Check Translation Completeness

Check which translations are missing:

```bash
python3 check_translations.py
```

This will:
- Analyze `master-translations.json`
- Show statistics per language and entity
- Generate `missing-translations.csv` with entries that need translation

### 3. Complete Missing Translations

Option A: Edit `master-translations.json` directly
- Open the file in your editor
- Add missing translations to the appropriate language fields
- Save the file

Option B: Use the CSV workflow
- Open `missing-translations.csv` in Excel or similar
- Fill in the missing translation columns (es, ca, fr, oc-aranes)
- Save the CSV file
- Run the import tool:

```bash
python3 import_missing_translations.py
```

### 4. Generate Liquibase Files

Generate the final CSV files for Liquibase:

```bash
python3 generate_translation_files.py
```

This will:

- Read `master-translations.json`
- Generate `STM_TRANSLATION_ES.csv`, `STM_TRANSLATION_CA.csv`, etc.
- Update `05_translations.yaml` changelog
- Calculate correct sequence IDs

### 5. Deploy

The generated files are ready for Liquibase:

- `profiles/postgres/liquibase/changelog/05_translations/STM_TRANSLATION_*.csv`
- `profiles/postgres/liquibase/changelog/05_translations.yaml`

Run your database migration to apply the translations.

### 6. Switch Default Language (Optional)

To create a deployment with a different default language (e.g., Spanish or Catalan):

```bash
# Preview changes without modifying files
python3 switch_default_language.py es --dry-run

# Switch to Spanish as default
python3 switch_default_language.py es

# Switch to Catalan as default
python3 switch_default_language.py ca

# Rollback to previous state
python3 switch_default_language.py --rollback
```

This will:
- Swap the default language and target language in all translations
- Update all seed data CSV files with the new default language
- Update configuration (language.default)
- Regenerate all translation CSV files
- Create a backup before making changes

### Workflow summary

```text
┌─────────────────────────────────────────────────────────┐
│                    Seed Data CSVs                       │
│  (Language, CodeListValue, TerritoryType, etc.)         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ extract_translatable  │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ master-translations   │◄──────┐
         │       .json           │       │
         └───────────┬───────────┘       │
                     │                   │
                     ▼                   │
         ┌───────────────────────┐       │
         │  check_translations   │       │
         └───────────┬───────────┘       │
                     │                   │
                     ▼                   │
         ┌───────────────────────┐       │
         │ missing-translations  │       │
         │       .csv            │       │
         └───────────┬───────────┘       │
                     │                   │
                     ▼                   │
         ┌───────────────────────┐       │
         │   Complete missing    │       │
         │    translations       │       │
         └───────────┬───────────┘       │
                     │                   │
                     ▼                   │
         ┌───────────────────────┐       │
         │ import_missing_       │───────┘
         │   translations        │
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ generate_translation_ │
         │       files           │
         └───────────┬───────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│              Liquibase CSV Files                       │
│  STM_TRANSLATION_ES.csv, STM_TRANSLATION_CA.csv, etc.  │
│              05_translations.yaml                      │
└────────────────────────────────────────────────────────┘
```

## Master Translation File Format

```json
{
  "metadata": {
    "version": "1.0",
    "lastUpdated": "2026-02-12",
    "languages": ["en", "es", "ca", "oc-aranes", "fr"],
    "languageIds": {
      "en": 1,
      "es": 2,
      "ca": 3,
      "oc-aranes": 4,
      "fr": 5
    },
    "defaultLanguage": "en"
  },
  "entities": {
    "EntityName": {
      "field": "fieldName",
      "column": "EntityName.fieldName",
      "translations": [
        {
          "id": 1,
          "en": "English text",
          "es": "Texto en español",
          "ca": "Text en català",
          "fr": "Texte en français",
          "oc-aranes": "Tèxte en aranés"
        }
      ]
    }
  }
}
```

## Translation ID Scheme

The tools automatically generate unique translation IDs following this scheme:

- Spanish (es): 200000 + entity_offset + element_id
- Catalan (ca): 300000 + entity_offset + element_id
- Aranese (oc-aranes): 400000 + entity_offset + element_id
- French (fr): 500000 + entity_offset + element_id

Entity offsets:

- Language: 1000
- CodeListValue: 2000
- TerritoryType: 3000

Example: Spanish translation for TerritoryType ID 5 = 200000 + 3000 + 5 = 203005

## Switching Default Language

The `switch_default_language.py` tool allows you to change the default language for SITMUN deployments. This is useful for creating region-specific deployments where Spanish, Catalan, or another language should be the default instead of English.

### When to use

Spanish-first deployment for Spain; Catalan-first for Catalonia; testing the application in different languages; multi-regional deployments with different defaults.

### How It Works

When you switch from English to Spanish (for example):
1. All English values in seed data CSVs become Spanish
2. All Spanish translations become English translations
3. The system configuration is updated to use Spanish as default
4. Translation files are regenerated with the new mappings

### Usage

```bash
# Preview changes (dry-run)
python3 switch_default_language.py es --dry-run

# Switch to Spanish
python3 switch_default_language.py es

# Switch to Catalan  
python3 switch_default_language.py ca

# Switch to French
python3 switch_default_language.py fr

# Rollback to previous state
python3 switch_default_language.py --rollback
```

**Supported languages:** `es` (Español), `ca` (Català), `fr` (Français), `oc-aranes` (Aranés).

### What Gets Modified

The tool modifies these files:
- `master-translations.json` - Swaps en/target for all 119 entries
- `STM_LANGUAGE.csv` - Updates language names (5 entries)
- `STM_CODELIST.csv` - Updates descriptions (102 entries)
- `STM_TER_TYP.csv` - Updates territory type names (12 entries)
- `STM_CONF.csv` - Updates language.default configuration
- Regenerates all `STM_TRANSLATION_*.csv` files
- Regenerates `05_translations.yaml`

### Example: switching to Spanish

Before: default English, seed data in English, Spanish as translation, `language.default = en`. After: default Spanish, seed data in Spanish, English as translation, `language.default = es`.

**master-translations.json:** `{"id": 1, "en": "Country", "es": "País"}` becomes `{"id": 1, "en": "País", "es": "Country"}`.

**STM_TER_TYP.csv:** `1,Country,...` becomes `1,País,...`. **STM_CONF.csv:** `language.default,en` becomes `language.default,es`.

### Important Notes

- **Backup**: The tool automatically creates a timestamped backup before making changes
- **Validation**: Requires target language to have 100% translation coverage
- **Rollback**: Use `--rollback` to restore from the most recent backup
- **Dry-run**: Always test with `--dry-run` first to preview changes
- **One-way swap**: Switches between current default and target language only
- **New deployments**: This affects seed data for NEW deployments. Existing databases need separate migration scripts.
- **Multiple switches**: Always swaps current default and target; original values are preserved (e.g. en→es then es→ca gives ca default with es and en as translations).

### Limitations

- TaskType titles (`STM_TSK_TYP.csv`) are not currently handled (only 3 entries, can be done manually)
- Only switches between current default and one target language at a time
- Does not affect existing database data (only seed data for new deployments)

### Deployment Scenarios

This tool enables:
- **Spanish deployment**: Default Spanish, English as translation
- **Catalan deployment**: Default Catalan, English as translation
- **Multi-region**: Different defaults per deployment profile
- **Testing**: Easy switching for QA validation

### Deployment workflow (Spanish example)

1. **Prepare:** `python3 check_translations.py` (verify 100% complete).
2. **Preview:** `python3 switch_default_language.py es --dry-run`
3. **Execute:** `python3 switch_default_language.py es`
4. **Verify:** e.g. `head profiles/postgres/liquibase/changelog/04_seed_data/STM_TER_TYP.csv` and `grep language.default profiles/postgres/liquibase/changelog/06_params/STM_CONF.csv`
5. **Deploy:** run Liquibase migration in your environment.

To test without permanent changes: switch (e.g. `python3 switch_default_language.py ca`), test the app, then `python3 switch_default_language.py --rollback`.

### Advanced usage

Restore a specific backup: `python3 switch_default_language.py --rollback --backup-name backup_en_to_es_20260212_143022`

List backups: `ls -la tools/translations/backups/`. Each backup contains the modified CSV files, `master-translations.json`, and `backup_info.json`.

## Adding New Entities

To add a new translatable entity:

1. Add seed data CSV to appropriate location
2. Update `SEED_DATA_PATHS` in `extract_translatable.py`
3. Add entity configuration to `ENTITY_CONFIG`
4. Add entity offset to `ID_SCHEMES` in `generate_translation_files.py`
5. Run extraction and generation tools

## Requirements

- Python 3.7+
- No external dependencies (uses only standard library)

## Tips

- Always run `check_translations.py` before generating files
- Keep `master-translations.json` in version control
- Review diffs before committing translation changes
- Use the CSV workflow for bulk translation work
- The tools are idempotent - safe to run multiple times
- To update existing translations: edit `master-translations.json`, then run `python3 generate_translation_files.py`

## Troubleshooting

**"File not found" errors**: Check that seed data files exist at expected locations

**"Unknown entity" warnings**: Verify entity names match exactly (case-sensitive)

**Missing translations not detected**: Ensure `master-translations.json` is up to date (run extract first)

**ID conflicts**: Check that entity offsets don't overlap in `ID_SCHEMES`

**switch_default_language.py:**

- **"Target language has incomplete translations"**: Run `check_translations.py`, complete translations in `master-translations.json`, then `generate_translation_files.py`
- **"Target language is already the default"**: Choose a different target language
- **"Required files not found"**: Ensure you are in the correct directory and seed data files exist
- **Undo a switch**: `python3 switch_default_language.py --rollback`
