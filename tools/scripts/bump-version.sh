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
  "back/backend/sitmun-backend-core/src/main/resources/application.yml|  version: \"{{VERSION}}\"|  version: \"{{NEW}}\""
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

# ── Helpers ──────────────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage:
  ./tools/scripts/bump-version.sh [VERSION] [--dry-run|-n] [--status|-s] [-h|--help]

  --status, -s    Report version in VERSION and each consumer file; flag mismatches. No writes.
  --dry-run, -n   Show changes that would be made; do not write files or run npm.
  VERSION         Set VERSION file and propagate (e.g. 1.2.5). Creates VERSION if missing.
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
  while IFS= read -r line; do
    if [[ "$line" == *"$match_line"* ]]; then
      echo "${line//"$match_line"/"$replace_line"}"
    else
      echo "$line"
    fi
  done < "$path" > "$temp"
  mv "$temp" "$path"
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
    echo "Error: VERSION file not found. Create it (e.g. echo 1.2.4 > VERSION) or run with an explicit version to create and sync: ./tools/scripts/bump-version.sh 1.2.5" >&2
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
