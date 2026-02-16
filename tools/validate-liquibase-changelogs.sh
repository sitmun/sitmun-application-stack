#!/usr/bin/env bash
# Lists each changelog's last modification date (newest first). Uses working tree only (uncommitted moves/changes are reflected).
# Note: these changelogs were moved from back/backend/sitmun-backend-core/config/db/changelog (back/backend/config).
# Usage: ./tools/validate-liquibase-changelogs.sh [liquibase_dir]
#   liquibase_dir: path from repo root (default: profiles/development/backend/liquibase), or absolute path.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_DIR="profiles/development/backend/liquibase"
if [[ -n "${1:-}" ]]; then
  if [[ "$1" == /* ]]; then
    LIQUIBASE_DIR="$1"
  else
    LIQUIBASE_DIR="$REPO_ROOT/$1"
  fi
else
  LIQUIBASE_DIR="$REPO_ROOT/$DEFAULT_DIR"
fi
MASTER="$LIQUIBASE_DIR/master.xml"
REL_LIQUIBASE="${LIQUIBASE_DIR#$REPO_ROOT/}"

if [[ ! -f "$MASTER" ]]; then
  echo "Not found: $MASTER" >&2
  exit 1
fi

cd "$LIQUIBASE_DIR"

# Collect include paths from master.xml (file="changelog/...")
includes=()
while IFS= read -r line; do
  if [[ "$line" =~ file=\"(changelog/[^\"]+)\" ]]; then
    includes+=("${BASH_REMATCH[1]}")
  fi
done < <(grep -E 'include file="changelog/' "$MASTER")

# For each include: max mtime of the file and, if present, all files in same-named directory
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

for path in "${includes[@]}"; do
  mtime=0
  if [[ -f "$path" ]]; then
    mtime=$(stat -f "%m" "$path")
  fi
  # Same-named directory (e.g. 04_initial_data_dev for 04_initial_data_dev.yaml)
  base="${path%.*}"
  if [[ -d "$base" ]]; then
    while IFS= read -r t; do
      if [[ -n "$t" && "$t" -gt "$mtime" ]]; then mtime="$t"; fi
    done < <(find "$base" -type f -exec stat -f "%m" {} \; 2>/dev/null)
  fi
  printf "%s|%s\n" "$mtime" "$path"
done | sort -t'|' -k1 -rn > "$tmp"

# Print descending by date; mark if different from HEAD (git)
cd "$REPO_ROOT"
echo "Last modification (descending) — $(basename "$LIQUIBASE_DIR") (working tree)"
echo "-------------------------------------------------------------------"
while IFS= read -r line; do
  mtime="${line%%|*}"
  path="${line#*|}"
  if [[ -n "$mtime" && "$mtime" -gt 0 ]]; then
    date_str=$(date -r "$mtime" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "?")
  else
    date_str="(no file)"
  fi
  status=""
  rel_file="$REL_LIQUIBASE/$path"
  base="${path%.*}"
  rel_base="$REL_LIQUIBASE/$base"
  if ! git ls-files --error-unmatch "$rel_file" &>/dev/null; then
    status=" [new]"
  elif ! git diff --quiet HEAD -- "$rel_file" 2>/dev/null; then
    status=" [modified]"
  else
    if [[ -d "$LIQUIBASE_DIR/$base" ]] && ! git diff --quiet HEAD -- "$rel_base" 2>/dev/null; then
      status=" [modified]"
    else
      status=" [not modified]"
    fi
  fi
  printf "%s  %s%s\n" "$date_str" "$path" "$status"
done < "$tmp"
rel_master="$REL_LIQUIBASE/master.xml"
if git ls-files --error-unmatch "$rel_master" &>/dev/null && ! git diff --quiet HEAD -- "$rel_master" 2>/dev/null; then
  echo ""
  echo "Also modified vs HEAD: master.xml"
fi
