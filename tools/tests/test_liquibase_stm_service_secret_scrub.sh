#!/usr/bin/env bash
# test_liquibase_stm_service_secret_scrub.sh
# Verifies scrubbing ser_user/ser_pwd in stm_service.csv does not break future
# Liquibase runs on a DB seeded before the scrub, when changeSet 4 has
# validCheckSum: ANY (no clearCheckSums).
#
# Phases share one Postgres container (no wipe between phases):
#   Phase 1 — pre-scrub CSV (synthetic cells), YAML without validCheckSum: ANY
#   Phase 2 — scrubbed CSV, still no ANY → expect checksum ValidationFailedException
#   Phase 3 — scrubbed CSV + validCheckSum: ANY → update succeeds without clearCheckSums
#   Phase 4 — assert row counts / idempotent update
#
# Uses a minimal changelog (PostgreSQL schema + 04_initial_data_dev only) so the
# full development master (69+ changesets) is not required for this checksum check.
#
# Requirements: docker, python3
# Usage: bash tools/tests/test_liquibase_stm_service_secret_scrub.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEV_LB="$REPO_ROOT/profiles/development/backend/liquibase"
YAML_REL="profiles/development/backend/liquibase/changelog/04_initial_data_dev.yaml"
CSV_REL="profiles/development/backend/liquibase/changelog/04_initial_data_dev/stm_service.csv"
YAML="$REPO_ROOT/$YAML_REL"
CSV="$REPO_ROOT/$CSV_REL"
MINIMAL_MASTER="$DEV_LB/master-scrub-test.xml"

CONTAINER=sitmun_stm_service_scrub_postgres
NETWORK=sitmun_stm_service_scrub_net
DB=sitmun_stm_service_scrub
DB_USER=sitmun3
DB_PASS=sitmun3
LB_IMAGE=liquibase/liquibase:4.29

PASS=0
FAIL=0
YAML_BACKUP=""
CSV_BACKUP=""

ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

psql_q() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -t -c "$1" 2>/dev/null | tr -d ' \n'
}

write_minimal_master() {
  # Seed changeSet 4 needs codelists + task types (FK stm_tas_fk_tty → STM_TSK_TYP).
  cat > "$MINIMAL_MASTER" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   logicalFilePath="master-scrub-test.xml"
                   xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
                   xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.4.xsd">
  <include file="changelog/01_schema.postgresql.sql" relativeToChangelogFile="true"/>
  <include file="changelog/02_codelists.yaml" relativeToChangelogFile="true"/>
  <include file="changelog/03_task_types.yaml" relativeToChangelogFile="true"/>
  <include file="changelog/04_initial_data_dev.yaml" relativeToChangelogFile="true"/>
</databaseChangeLog>
EOF
}

liquibase_cmd() {
  local label="$1"
  shift
  echo ""
  echo "── Liquibase: $label ──"
  # Same layout as tools/tests/test_liquibase_codelist_auth_mode_swap.sh:
  # mount liquibase/ -> /liquibase/changelog, changeLogFile=changelog/<file>
  # (image WORKDIR is /liquibase).
  if [[ ! -f "$MINIMAL_MASTER" ]]; then
    echo "  ERROR: missing $MINIMAL_MASTER" >&2
    return 1
  fi
  LB_OUTPUT=$(docker run --rm \
    --network "$NETWORK" \
    -v "$DEV_LB:/liquibase/changelog" \
    "$LB_IMAGE" \
    --url="jdbc:postgresql://$CONTAINER:5432/$DB" \
    --username="$DB_USER" \
    --password="$DB_PASS" \
    --changeLogFile=changelog/master-scrub-test.xml \
    --contexts=dev \
    "$@" 2>&1)
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    # One-shot mount debug when changelog cannot be resolved.
    echo "$LB_OUTPUT" | grep -qi "was not found" && docker run --rm \
      -v "$DEV_LB:/liquibase/changelog" \
      "$LB_IMAGE" \
      ls -la /liquibase/changelog/master-scrub-test.xml /liquibase/changelog/master.xml 2>&1 | head -10
  fi
  echo "$LB_OUTPUT" | grep -E "^(Running Changeset|UPDATE SUMMARY|Run:|Previously|Liquibase command|ERROR|Validation|Unexpected)" | head -40
  return $rc
}

liquibase_update_expect_ok() {
  local label="$1"
  if liquibase_cmd "$label" update; then
    ok "Liquibase update '$label' succeeded"
    return 0
  fi
  echo "$LB_OUTPUT" | grep -iE "error|exception|failed|validation" | head -25
  fail "Liquibase update '$label' failed (expected success)"
  return 1
}

liquibase_update_expect_fail() {
  local label="$1"
  if liquibase_cmd "$label" update; then
    fail "Liquibase update '$label' succeeded (expected checksum failure)"
    return 1
  fi
  if echo "$LB_OUTPUT" | grep -qiE "ValidationFailedException|checksum|CheckSum"; then
    ok "Liquibase update '$label' failed on checksum as expected"
    return 0
  fi
  echo "$LB_OUTPUT" | grep -iE "error|exception|failed" | head -25
  fail "Liquibase update '$label' failed, but not with checksum validation"
  return 1
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    ok "$label: '$actual'"
  else
    fail "$label: expected '$expected', got '$actual'"
  fi
}

strip_valid_checksum_any() {
  python3 - "$YAML" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
path.write_text("".join(ln for ln in lines if "validCheckSum:" not in ln), encoding="utf-8")
PY
}

ensure_valid_checksum_any() {
  python3 - "$YAML" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
if "validCheckSum:" in text:
    sys.exit(0)
lines = text.splitlines(keepends=True)
out = []
inserted = False
for ln in lines:
    out.append(ln)
    if (not inserted) and ln.strip() == "context: dev":
        indent = ln[: len(ln) - len(ln.lstrip(" "))]
        out.append(f"{indent}validCheckSum: ANY\n")
        inserted = True
path.write_text("".join(out), encoding="utf-8")
if not inserted:
    raise SystemExit("failed to insert validCheckSum: ANY")
PY
}

apply_pre_scrub_synthetic_csv() {
  python3 - "$CSV" <<'PY'
import csv
from pathlib import Path
import sys
path = Path(sys.argv[1])
with path.open(newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
rows[0]["ser_user"] = "scrubtest_user"
rows[0]["ser_pwd"] = "scrubtest_pwd"
with path.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
    w.writeheader()
    w.writerows(rows)
PY
}

apply_scrubbed_csv() {
  python3 - "$CSV" <<'PY'
import csv
from pathlib import Path
import sys
path = Path(sys.argv[1])
with path.open(newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys())
for row in rows:
    row["ser_user"] = "NULL"
    row["ser_pwd"] = "NULL"
with path.open("w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
    w.writeheader()
    w.writerows(rows)
PY
}

restore_workspace() {
  rm -f "$MINIMAL_MASTER"
  if [[ -n "$YAML_BACKUP" && -f "$YAML_BACKUP" ]]; then
    cp "$YAML_BACKUP" "$YAML"
  fi
  if [[ -n "$CSV_BACKUP" && -f "$CSV_BACKUP" ]]; then
    cp "$CSV_BACKUP" "$CSV"
  fi
}

teardown() {
  echo ""
  echo "── Teardown ──"
  docker rm -f "$CONTAINER" 2>/dev/null && echo "  Container removed." || true
  docker network rm "$NETWORK" 2>/dev/null && echo "  Network removed." || true
  restore_workspace
  [[ -n "$YAML_BACKUP" ]] && rm -f "$YAML_BACKUP"
  [[ -n "$CSV_BACKUP" ]] && rm -f "$CSV_BACKUP"
  echo "  Restored liquibase overlays."
}
trap teardown EXIT

YAML_BACKUP=$(mktemp)
CSV_BACKUP=$(mktemp)
cp "$YAML" "$YAML_BACKUP"
cp "$CSV" "$CSV_BACKUP"
write_minimal_master

echo "════════════════════════════════════════════════════"
echo " SITMUN Liquibase stm_service.csv secret scrub (Docker)"
echo "════════════════════════════════════════════════════"

echo ""
echo "── Setup: starting Postgres container ──"
docker rm -f "$CONTAINER" 2>/dev/null || true
docker network rm "$NETWORK" 2>/dev/null || true
docker network create "$NETWORK"
docker run -d --name "$CONTAINER" --network "$NETWORK" \
  -e POSTGRES_DB="$DB" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  postgres:16-alpine

echo -n "  Waiting for Postgres"
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -c 'SELECT 1' >/dev/null 2>&1; then
    echo " ready."
    break
  fi
  sleep 1
  echo -n "."
  if [[ $i -eq 30 ]]; then
    echo " TIMEOUT"
    exit 1
  fi
done

echo ""
echo "════ PHASE 1: pre-scrub CSV, no validCheckSum: ANY ════"
strip_valid_checksum_any
apply_pre_scrub_synthetic_csv
liquibase_update_expect_ok "Phase 1 — pre-scrub seed"
PHASE1_COUNT=$(psql_q "SELECT COUNT(*) FROM STM_SERVICE;")
if [[ -z "$PHASE1_COUNT" || "$PHASE1_COUNT" == "0" ]]; then
  fail "Phase1 STM_SERVICE count is empty/zero (got '$PHASE1_COUNT')"
else
  ok "Phase1 STM_SERVICE count=$PHASE1_COUNT"
fi
# loadData maps CSV headers that match STM_SERVICE columns, including ser_user/ser_pwd
# even when not listed under columns: — synthetic cells must land in DB.
PHASE1_CREDS=$(psql_q "SELECT COUNT(*) FROM STM_SERVICE WHERE SER_USER='scrubtest_user' AND SER_PWD='scrubtest_pwd';")
assert_eq "Phase1 synthetic CSV credentials loaded" "1" "$PHASE1_CREDS"

echo ""
echo "════ PHASE 2: scrubbed CSV, no validCheckSum (expect fail) ════"
apply_scrubbed_csv
liquibase_update_expect_fail "Phase 2 — scrub without ANY"

echo ""
echo "════ PHASE 3: scrubbed CSV + validCheckSum: ANY (no clearCheckSums) ════"
ensure_valid_checksum_any
liquibase_update_expect_ok "Phase 3 — scrub with ANY"
assert_eq "Phase3 STM_SERVICE count unchanged" "$PHASE1_COUNT" \
  "$(psql_q "SELECT COUNT(*) FROM STM_SERVICE;")"
assert_eq "Phase3 changeSet 4 still once" "1" \
  "$(psql_q "SELECT COUNT(*) FROM DATABASECHANGELOG WHERE ID='4' AND AUTHOR='sitmun';")"
# Scrub does not re-run loadData — DB keeps Phase 1 credential cells.
assert_eq "Phase3 DB credentials unchanged (no re-seed)" "1" \
  "$(psql_q "SELECT COUNT(*) FROM STM_SERVICE WHERE SER_USER='scrubtest_user' AND SER_PWD='scrubtest_pwd';")"

echo ""
echo "════ PHASE 4: idempotent re-apply ════"
liquibase_update_expect_ok "Phase 4 — idempotent update"
assert_eq "Phase4 STM_SERVICE count unchanged" "$PHASE1_COUNT" \
  "$(psql_q "SELECT COUNT(*) FROM STM_SERVICE;")"
assert_eq "Phase4 DB credentials still unchanged" "1" \
  "$(psql_q "SELECT COUNT(*) FROM STM_SERVICE WHERE SER_USER='scrubtest_user' AND SER_PWD='scrubtest_pwd';")"

echo ""
echo "════════════════════════════════════════════════════"
printf " Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
