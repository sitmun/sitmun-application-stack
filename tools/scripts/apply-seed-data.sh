#!/usr/bin/env bash
# apply-seed-data.sh
# Generates seed files for the target database type, then applies the Liquibase
# changelog to a remote (or local) database.
#
# Requirements: docker, python3
#
# Usage:
#   bash tools/scripts/apply-seed-data.sh --db-type postgres --url jdbc:postgresql://host:5432/dbname \
#       --username user --password pass [--baseline en] [--skip-generate]
#
#   bash tools/scripts/apply-seed-data.sh --db-type oracle --url jdbc:oracle:thin:@//host:1521/service \
#       --username user --password pass [--baseline es]
#
# Options:
#   --db-type          postgres | oracle  (required)
#   --url              JDBC URL of the target database  (required)
#   --username         Database username  (required)
#   --password         Database password  (required)
#   --baseline         i18n baseline language code, e.g. en, es, ca  (default: en)
#   --skip-generate    Skip seed-file generation; use already-generated files as-is
#   --dry-run          Run Liquibase in updateSQL mode (prints SQL, no changes)
#   -h, --help         Show this help

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS_DIR="$REPO_ROOT/tools/bin"

# ── defaults ────────────────────────────────────────────────────────────────
DB_TYPE=""
JDBC_URL=""
DB_USER=""
DB_PASS=""
BASELINE="en"
GENERATE=0
DRY_RUN=0

# ── argument parsing ─────────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage:
  bash tools/scripts/apply-seed-data.sh --db-type postgres --url jdbc:postgresql://host:5432/dbname \
      --username user --password pass [--baseline en] [--generate] [--dry-run]

  bash tools/scripts/apply-seed-data.sh --db-type oracle --url jdbc:oracle:thin:@//host:1521/service \
      --username user --password pass [--baseline es]

Options:
  --db-type          postgres | oracle  (required)
  --url              JDBC URL of the target database  (required)
  --username         Database username  (required)
  --password         Database password  (required)
  --baseline         i18n baseline language code, e.g. en, es, ca  (default: en)
  --generate         Regenerate seed files before applying (modifies tracked files in profiles/)
  --dry-run          Run Liquibase in updateSQL mode (prints SQL, no changes applied)
  -h, --help         Show this help
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-type)       DB_TYPE="$2";    shift 2 ;;
    --url)           JDBC_URL="$2";   shift 2 ;;
    --username)      DB_USER="$2";    shift 2 ;;
    --password)      DB_PASS="$2";    shift 2 ;;
    --baseline)      BASELINE="$2";   shift 2 ;;
    --generate)      GENERATE=1;      shift   ;;
    --dry-run)       DRY_RUN=1;       shift   ;;
    -h|--help)       usage ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── validation ───────────────────────────────────────────────────────────────
error() { echo "ERROR: $*" >&2; exit 1; }

[[ -z "$DB_TYPE"  ]] && error "--db-type is required (postgres or oracle)"
[[ -z "$JDBC_URL" ]] && error "--url is required"
[[ -z "$DB_USER"  ]] && error "--username is required"
[[ -z "$DB_PASS"  ]] && error "--password is required"

case "$DB_TYPE" in
  postgres|oracle) ;;
  *) error "--db-type must be 'postgres' or 'oracle', got '$DB_TYPE'" ;;
esac

PROFILE_DIR="$REPO_ROOT/profiles/$DB_TYPE"
[[ -d "$PROFILE_DIR/liquibase" ]] || error "Profile directory not found: $PROFILE_DIR/liquibase"

# ── generate seed files ──────────────────────────────────────────────────────
if [[ $GENERATE -eq 1 ]]; then
  echo "── Generating seed files (scenario=$DB_TYPE, baseline=$BASELINE) ──"
  (cd "$TOOLS_DIR" && python3 generate_all_seed_outputs.py \
      --scenarios "$DB_TYPE" \
      --baseline  "$BASELINE") \
    || error "Seed generation failed"
  echo "  ✓ Seed files generated"
else
  echo "── Using existing seed files (pass --generate to regenerate) ──"
fi

# ── Liquibase image ───────────────────────────────────────────────────────────
# Both postgres and oracle drivers are bundled in the official Liquibase image.
LIQUIBASE_IMAGE="liquibase/liquibase:4.29"

# ── run Liquibase ─────────────────────────────────────────────────────────────
COMMAND="update"
[[ $DRY_RUN -eq 1 ]] && COMMAND="updateSQL"

echo ""
echo "── Applying changelog to $JDBC_URL (command: $COMMAND) ──"

docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$PROFILE_DIR/liquibase:/liquibase/changelog:ro" \
  "$LIQUIBASE_IMAGE" \
  --url="$JDBC_URL" \
  --username="$DB_USER" \
  --password="$DB_PASS" \
  --changeLogFile="changelog/master.xml" \
  "$COMMAND"

RC=$?

if [[ $RC -ne 0 ]]; then
  error "Liquibase exited with code $RC"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo ""
  echo "  ✓ Dry run complete — no changes applied"
else
  echo ""
  echo "  ✓ Changelog applied successfully"
fi
