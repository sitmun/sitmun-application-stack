# Frontend i18n tools

Reusable scripts for Angular/ngx-translate JSON translation files across front applications.

## sort_and_complete_translations.py

Sorts translation keys alphabetically and fills missing keys from a reference locale (default: `en`).

**Usage**

```bash
# From repo root
python3 tools/front-i18n/sort_and_complete_translations.py --i18n-dir <path-to-assets/i18n>
```

**Examples**

```bash
# Admin app: sort and complete from en
python3 tools/front-i18n/sort_and_complete_translations.py \
  --i18n-dir front/admin/sitmun-admin-app/src/assets/i18n

# Viewer app
python3 tools/front-i18n/sort_and_complete_translations.py \
  --i18n-dir front/viewer/sitmun-viewer-app/src/assets/i18n

# Only sort keys (no completion)
python3 tools/front-i18n/sort_and_complete_translations.py \
  --i18n-dir front/admin/sitmun-admin-app/src/assets/i18n --no-complete

# Different reference locale
python3 tools/front-i18n/sort_and_complete_translations.py \
  --i18n-dir front/admin/sitmun-admin-app/src/assets/i18n --reference es

# Preview without writing
python3 tools/front-i18n/sort_and_complete_translations.py \
  --i18n-dir front/admin/sitmun-admin-app/src/assets/i18n --dry-run
```

**Options**

| Option | Description |
|--------|-------------|
| `--i18n-dir` | Path to `assets/i18n` (required) |
| `--reference` | Reference locale filename without extension (default: `en`) |
| `--no-complete` | Only sort keys; do not add missing keys |
| `--dry-run` | Report only, do not write files |

**Behaviour**

- Keys in each JSON file are written in alphabetical order.
- With completion (default): every locale gets the same set of keys as the reference file; missing keys are copied from the reference (placeholder until translated).
- Output is UTF-8 JSON with 2-space indent.

**Requirements**

- Python 3.7+
- No extra dependencies
