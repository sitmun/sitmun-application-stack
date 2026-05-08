#!/usr/bin/env bash
# bump-version.sh — Propagate stack version from VERSION (or argument) to all consumer files.
# Usage: ./tools/scripts/bump-version.sh [VERSION] [--dry-run|-n] [--status|-s] [-h|--help]
# Run from repo root. See tools/README.md "Version and release" for details.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VERSION_FILE="$REPO_ROOT/VERSION"

# ── Config: paths and patterns (add new versioned files here) ─────────────────
# Format: "path|match_template|replace_template" — match/replace use {{VERSION}} and {{NEW}}.
# Path is relative to REPO_ROOT. One targeted pattern per file; no global replace.
BUMP_ENTRIES=(
  "back/backend/sitmun-backend-core/build.gradle|project.version = '{{VERSION}}'|project.version = '{{NEW}}'"
  "back/proxy/sitmun-proxy-middleware/build.gradle|project.version = '{{VERSION}}'|project.version = '{{NEW}}'"
  "front/admin/sitmun-admin-app/package.json|\"version\": \"{{VERSION}}\"|\"version\": \"{{NEW}}\""
  "front/viewer/sitmun-viewer-app/package.json|\"version\": \"{{VERSION}}\"|\"version\": \"{{NEW}}\""
  "back/backend/sitmun-backend-core/src/main/resources/application.yml|  version: {{VERSION}}|  version: {{NEW}}"
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-admin.yaml|  version: {{VERSION}}|  version: {{NEW}}"
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-auth.yaml|  version: {{VERSION}}|  version: {{NEW}}"
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-conf.yaml|  version: {{VERSION}}|  version: {{NEW}}"
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-proxy.yaml|  version: {{VERSION}}|  version: {{NEW}}"
  "front/admin/sitmun-admin-app/src/environments/environment.ts|  version: '{{VERSION}}',|  version: '{{NEW}}',"
  "front/admin/sitmun-admin-app/src/environments/environment.prod.ts|  version: '{{VERSION}}',|  version: '{{NEW}}',"
  "front/viewer/sitmun-viewer-app/src/environments/environment.ts|  version: '{{VERSION}}',|  version: '{{NEW}}',"
  "front/viewer/sitmun-viewer-app/src/environments/environment.prod.ts|  version: '{{VERSION}}',|  version: '{{NEW}}',"
  "profiles/postgres.env|APP_VERSION={{VERSION}}|APP_VERSION={{NEW}}"
  "profiles/oracle.env|APP_VERSION={{VERSION}}|APP_VERSION={{NEW}}"
  "profiles/development.env|APP_VERSION={{VERSION}}|APP_VERSION={{NEW}}"
  "profiles/development-postgres.env|APP_VERSION={{VERSION}}|APP_VERSION={{NEW}}"
  "profiles/development-oracle.env|APP_VERSION={{VERSION}}|APP_VERSION={{NEW}}"
  "README.md|version-{{VERSION}}-blue|version-{{NEW}}-blue"
  "front/admin/sitmun-admin-app/README.md|version-{{VERSION}}-blue|version-{{NEW}}-blue"
  "front/viewer/sitmun-viewer-app/README.md|version-{{VERSION}}-blue|version-{{NEW}}-blue"
  "back/backend/sitmun-backend-core/README.md|version-{{VERSION}}-blue|version-{{NEW}}-blue"
  "back/proxy/sitmun-proxy-middleware/README.md|version-{{VERSION}}-blue|version-{{NEW}}-blue"
)
NPM_DIRS=( "front/admin/sitmun-admin-app" "front/viewer/sitmun-viewer-app" )
PACKAGE_JSON_FILES=(
  "front/admin/sitmun-admin-app/package.json"
  "front/viewer/sitmun-viewer-app/package.json"
)
APP_VERSION_ENV_FILES=(
  "profiles/postgres.env"
  "profiles/oracle.env"
  "profiles/development.env"
  "profiles/development-postgres.env"
  "profiles/development-oracle.env"
)
README_BADGE_FILES=(
  "README.md"
  "front/admin/sitmun-admin-app/README.md"
  "front/viewer/sitmun-viewer-app/README.md"
  "back/backend/sitmun-backend-core/README.md"
  "back/proxy/sitmun-proxy-middleware/README.md"
)
GRADLE_VERSION_FILES=(
  "back/backend/sitmun-backend-core/build.gradle"
  "back/proxy/sitmun-proxy-middleware/build.gradle"
)
TS_ENV_VERSION_FILES=(
  "front/admin/sitmun-admin-app/src/environments/environment.ts"
  "front/admin/sitmun-admin-app/src/environments/environment.prod.ts"
  "front/viewer/sitmun-viewer-app/src/environments/environment.ts"
  "front/viewer/sitmun-viewer-app/src/environments/environment.prod.ts"
)
BACKEND_APP_YML_FILE="back/backend/sitmun-backend-core/src/main/resources/application.yml"
OPENAPI_YAML_VERSION_FILES=(
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-admin.yaml"
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-auth.yaml"
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-conf.yaml"
  "back/backend/sitmun-backend-core/src/main/resources/static/v3/api-docs-proxy.yaml"
)

# ── Helpers ──────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage:
  ./tools/scripts/bump-version.sh [VERSION] [--dry-run|-n] [--status|-s] [-h|--help]

  --status, -s    Report version in VERSION and each consumer file; flag mismatches. No writes.
  --dry-run, -n   Show changes that would be made; do not write files or run npm.
  VERSION         Set VERSION file and propagate (e.g. 1.2.6). Creates VERSION if missing.
  (no args)       Propagate from current VERSION file to all consumers.

Run from repo root. After updating files, runs npm install --package-lock-only in frontend apps.
EOF
  exit 0
}

# Validate version format (semver-like: x.y.z or x.y.z-SNAPSHOT)
validate_version() {
  local v="$1"
  if [[ ! "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    echo "Error: invalid version format '$v'. Use x.y.z or x.y.z-SNAPSHOT." >&2
    exit 1
  fi
}

# Extract current version from a file using match template ({{VERSION}} = capture).
# Outputs the version string or empty if not found. Uses sed -E (ERE).
extract_version() {
  local file="$1" match_tpl="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 1
  local re="$match_tpl"
  re="${re//\\/\\\\}"
  re="${re//\*/\\*}"
  re="${re//\./\\.}"
  re="${re//\[/\\[}"
  re="${re//\]/\\]}"
  re="${re//\(/\\\(}"
  re="${re//\)/\\\)}"
  re="${re//\&/\\&}"
  re="${re//\"/\\\"}"
  re="${re//\'/\'}"
  re="${re//\{\{VERSION\}\}/([0-9][0-9.a-zA-Z-]*)}"
  sed -E -n "s/^.*${re}.*$/\\1/p" "$path" | head -1
}

# Replace version in file. Full-line or segment: if match_line appears as substring, replace that segment; else replace whole line.
replace_in_file() {
  local file="$1" match_tpl="$2" replace_tpl="$3" new_ver="$4" current_ver="$5"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 1
  local match_line="${match_tpl//\{\{VERSION\}\}/$current_ver}"
  local replace_line="${replace_tpl//\{\{NEW\}\}/$new_ver}"
  local temp
  temp="$(mktemp)"
  awk -v old="$match_line" -v new="$replace_line" '
    {
      pos = index($0, old)
      if (pos > 0) {
        pre = substr($0, 1, pos - 1)
        post = substr($0, pos + length(old))
        print pre new post
      } else {
        print $0
      }
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Normalize package.json version lines (also repairs malformed quote cases).
normalize_package_json_version_line() {
  local file="$1" new_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  local temp
  temp="$(mktemp)"
  awk -v new_ver="$new_ver" '
    BEGIN { done = 0 }
    {
      # Accept malformed quoted variants and force canonical JSON key/value form.
      if (done == 0 && $0 ~ /^[[:space:]]*"+[[:space:]]*version[[:space:]]*"+[[:space:]]*:/) {
        print "  \"version\": \"" new_ver "\","
        done = 1
        next
      }
      print $0
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Normalize APP_VERSION env assignments to canonical unquoted form.
normalize_env_app_version_line() {
  local file="$1" new_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  local temp
  temp="$(mktemp)"
  awk -v new_ver="$new_ver" '
    BEGIN { done = 0 }
    {
      if (done == 0 && $0 ~ /^"?APP_VERSION=/) {
        print "APP_VERSION=" new_ver
        done = 1
        next
      }
      print $0
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Normalize README badge token to avoid quoted version corruption.
normalize_readme_badge_line() {
  local file="$1" new_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  local temp
  temp="$(mktemp)"
  awk -v new_ver="$new_ver" '
    {
      gsub(/"version-[0-9]+\.[0-9]+\.[0-9]+-blue"/, "version-" new_ver "-blue")
      gsub(/version-[0-9]+\.[0-9]+\.[0-9]+-blue/, "version-" new_ver "-blue")
      print $0
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Normalize Gradle project.version line to canonical format.
normalize_gradle_version_line() {
  local file="$1" new_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  local temp
  temp="$(mktemp)"
  awk -v new_ver="$new_ver" '
    BEGIN { done = 0 }
    {
      if (done == 0 && $0 ~ /^"?project\.version = '\''[0-9][0-9.a-zA-Z-]*'\''"?$/) {
        print "project.version = '\''" new_ver "'\''"
        done = 1
        next
      }
      print $0
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Normalize TypeScript environment version line to canonical format.
normalize_ts_env_version_line() {
  local file="$1" new_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  local temp
  temp="$(mktemp)"
  awk -v new_ver="$new_ver" '
    BEGIN { done = 0 }
    {
      # Repair malformed variants like:
      #   "  version: '\''1.2.6'\'',"
      # and enforce canonical TS object property form.
      if (done == 0 && $0 ~ /^[[:space:]]*"?[[:space:]]*version[[:space:]]*:[[:space:]]*["\047]?[0-9][0-9A-Za-z.-]*["\047]?,?[[:space:]]*"?[[:space:]]*$/) {
        print "  version: '\''" new_ver "'\'',"
        done = 1
        next
      }
      print $0
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Normalize backend application.yml version line to canonical unquoted format.
normalize_backend_app_yml_version_line() {
  local file="$1" new_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  local temp
  temp="$(mktemp)"
  awk -v new_ver="$new_ver" '
    BEGIN { done = 0 }
    {
      if (done == 0 && $0 ~ /^[[:space:]]*"?[[:space:]]*version:[[:space:]]*"*[0-9][0-9.a-zA-Z-]*"*[[:space:]]*"?$/) {
        print "  version: " new_ver
        done = 1
        next
      }
      print $0
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Normalize OpenAPI YAML version lines to canonical format.
normalize_openapi_yaml_version_line() {
  local file="$1" new_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  local temp
  temp="$(mktemp)"
  awk -v new_ver="$new_ver" '
    BEGIN { done = 0 }
    {
      if (done == 0 && $0 ~ /^[[:space:]]*"?[[:space:]]*version:[[:space:]]*[0-9][0-9.a-zA-Z-]*[[:space:]]*"?$/) {
        print "  version: " new_ver
        done = 1
        next
      }
      print $0
    }
  ' "$path" > "$temp"
  mv "$temp" "$path"
}

# Run post-propagation normalization for known structured files.
normalize_known_version_lines() {
  local new_ver="$1"
  local rel
  for rel in "${PACKAGE_JSON_FILES[@]}"; do
    normalize_package_json_version_line "$rel" "$new_ver"
  done
  for rel in "${APP_VERSION_ENV_FILES[@]}"; do
    normalize_env_app_version_line "$rel" "$new_ver"
  done
  for rel in "${README_BADGE_FILES[@]}"; do
    normalize_readme_badge_line "$rel" "$new_ver"
  done
  for rel in "${GRADLE_VERSION_FILES[@]}"; do
    normalize_gradle_version_line "$rel" "$new_ver"
  done
  for rel in "${TS_ENV_VERSION_FILES[@]}"; do
    normalize_ts_env_version_line "$rel" "$new_ver"
  done
  normalize_backend_app_yml_version_line "$BACKEND_APP_YML_FILE" "$new_ver"
  for rel in "${OPENAPI_YAML_VERSION_FILES[@]}"; do
    normalize_openapi_yaml_version_line "$rel" "$new_ver"
  done
}

# Basic structural checks to catch accidental corruption early.
validate_ts_env_file() {
  local file="$1" expected_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  if ! awk -v expected_ver="$expected_ver" '
    BEGIN { ok = 0; bad = 0 }
    /^[[:space:]]*"/ && /version[[:space:]]*:/ { bad = 1 }
    {
      if ($0 ~ "^[[:space:]]*version:[[:space:]]*\\047" expected_ver "\\047,[[:space:]]*$") {
        ok = 1
      }
    }
    END {
      if (bad == 1 || ok == 0) exit 1
    }
  ' "$path"; then
    echo "Error: $file failed TS environment validation after version propagation." >&2
    return 1
  fi
}

validate_package_json_file() {
  local file="$1" expected_ver="$2"
  local path="$REPO_ROOT/$file"
  [[ ! -f "$path" ]] && return 0
  if ! python3 - "$path" "$expected_ver" <<'PY'
import json
import sys
path = sys.argv[1]
expected = sys.argv[2]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)
if data.get("version") != expected:
    raise SystemExit(1)
PY
  then
    echo "Error: $file failed JSON/version validation after version propagation." >&2
    return 1
  fi
}

validate_post_propagation() {
  local expected_ver="$1"
  local rel
  for rel in "${PACKAGE_JSON_FILES[@]}"; do
    validate_package_json_file "$rel" "$expected_ver"
  done
  for rel in "${TS_ENV_VERSION_FILES[@]}"; do
    validate_ts_env_file "$rel" "$expected_ver"
  done
}

# ── Main: parse args ─────────────────────────────────────────────────────────
DO_STATUS=0
DO_DRY_RUN=0
VERSION_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)  usage ;;
    -s|--status)   DO_STATUS=1; shift ;;
    -n|--dry-run)  DO_DRY_RUN=1; shift ;;
    [0-9]*.*)      [[ -z "$VERSION_ARG" ]] && VERSION_ARG="$1"; shift ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

# ── Resolve effective version ─────────────────────────────────────────────────
EFFECTIVE_VERSION=""
if [[ $DO_STATUS -eq 1 ]]; then
  # Status: report only
  if [[ -f "$VERSION_FILE" ]]; then
    EFFECTIVE_VERSION="$(cat "$VERSION_FILE" | tr -d ' \r\n')"
    echo "VERSION $EFFECTIVE_VERSION"
  else
    echo "VERSION (missing)"
  fi
  MISMATCH_COUNT=0
  for entry in "${BUMP_ENTRIES[@]}"; do
    IFS='|' read -r relpath match_tpl replace_tpl <<< "$entry"
    current="$(extract_version "$relpath" "$match_tpl" 2>/dev/null || true)"
    if [[ -z "$current" ]]; then
      if [[ -f "$REPO_ROOT/$relpath" ]]; then
        echo "$relpath (no match)"
      else
        echo "$relpath (missing)"
      fi
      [[ -n "$EFFECTIVE_VERSION" ]] && (( MISMATCH_COUNT++ )) || true
    else
      echo "$relpath $current"
      if [[ -n "$EFFECTIVE_VERSION" && "$current" != "$EFFECTIVE_VERSION" ]]; then
        (( MISMATCH_COUNT++ )) || true
      fi
    fi
  done
  if [[ -n "$EFFECTIVE_VERSION" && $MISMATCH_COUNT -gt 0 ]]; then
    echo "Mismatch: $MISMATCH_COUNT file(s) differ from VERSION"
  fi
  exit 0
fi

# Propagate or dry-run: need effective version
if [[ -n "$VERSION_ARG" ]]; then
  validate_version "$VERSION_ARG"
  EFFECTIVE_VERSION="$VERSION_ARG"
  if [[ $DO_DRY_RUN -eq 0 ]]; then
    echo "$EFFECTIVE_VERSION" > "$VERSION_FILE"
    echo "Wrote VERSION with $EFFECTIVE_VERSION"
  else
    echo "Would write VERSION with $EFFECTIVE_VERSION"
  fi
else
  if [[ ! -f "$VERSION_FILE" ]]; then
    echo "Error: VERSION file not found. Create it (e.g. echo 1.2.4 > VERSION) or run with an explicit version to create and sync: ./tools/scripts/bump-version.sh 1.2.6" >&2
    exit 1
  fi
  EFFECTIVE_VERSION="$(cat "$VERSION_FILE" | tr -d ' \r\n')"
  validate_version "$EFFECTIVE_VERSION"
fi

# ── Propagate (or dry-run) to each configured file ────────────────────────────
for entry in "${BUMP_ENTRIES[@]}"; do
  IFS='|' read -r relpath match_tpl replace_tpl <<< "$entry"
  path="$REPO_ROOT/$relpath"
  current="$(extract_version "$relpath" "$match_tpl" 2>/dev/null || true)"
  if [[ -z "$current" ]]; then
    if [[ -f "$path" ]]; then
      echo "Warning: $relpath — no match (skip)" >&2
    else
      echo "Warning: $relpath — missing (skip)" >&2
    fi
    continue
  fi
  if [[ "$current" == "$EFFECTIVE_VERSION" ]]; then
    [[ $DO_DRY_RUN -eq 1 ]] && echo "$relpath: already $EFFECTIVE_VERSION (no change)"
    continue
  fi
  if [[ $DO_DRY_RUN -eq 1 ]]; then
    echo "$relpath: would replace '$current' with '$EFFECTIVE_VERSION'"
  else
    replace_in_file "$relpath" "$match_tpl" "$replace_tpl" "$EFFECTIVE_VERSION" "$current"
    echo "Updated $relpath: $current -> $EFFECTIVE_VERSION"
  fi
done

# Normalize known files to canonical format and auto-repair quote corruption.
if [[ $DO_DRY_RUN -eq 0 ]]; then
  normalize_known_version_lines "$EFFECTIVE_VERSION"
  validate_post_propagation "$EFFECTIVE_VERSION"
fi

# ── npm install --package-lock-only ─────────────────────────────────────────
if [[ $DO_DRY_RUN -eq 1 ]]; then
  echo "Would run: npm install --package-lock-only in ${NPM_DIRS[*]}"
  exit 0
fi

for dir in "${NPM_DIRS[@]}"; do
  fullpath="$REPO_ROOT/$dir"
  if [[ ! -d "$fullpath" ]]; then
    echo "Warning: $dir not found (skip npm)" >&2
    continue
  fi
  if ( cd "$fullpath" && npm install --package-lock-only ); then
    echo "Updated lockfile in $dir"
  else
    echo "Error: npm install --package-lock-only failed in $dir" >&2
    echo "The version was propagated to all files but lockfiles could not be updated. Run 'npm install --package-lock-only' manually in $dir, or fix the environment and re-run this script with the same version." >&2
    exit 1
  fi
done

echo "Done. Version $EFFECTIVE_VERSION propagated to all files and lockfiles updated."
