#!/usr/bin/env bash
# test_liquibase_codelist_auth_mode_swap.sh
# GitHub issue #45: pre-1.2.7 COD_ID 53/54 assignment must swap before
# changeset 2 loadUpdateData reapplies the post-1.2.7 CSV.
#
# Applying origin tag 1.2.6 with Liquibase 4.29 fails on an unquoted CSV
# comma. This test seeds the pre-1.2.7 assignment on a HEAD schema instead.
#
#   Phase 1 — apply HEAD (greenfield, post-swap CSV, 25 MARK_RAN)
#   Phase 2 — restore pre-1.2.7 rows, drop 25 from DATABASECHANGELOG, apply HEAD
#   Phase 3 — re-apply HEAD (idempotent)
#
# Usage: bash tools/tests/test_liquibase_codelist_auth_mode_swap.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LB_HEAD="$REPO_ROOT/profiles/postgres/liquibase"

CONTAINER=sitmun_authmode_swap_postgres
NETWORK=sitmun_authmode_swap_net
DB=sitmun_authmode_swap
DB_USER=sitmun3
DB_PASS=sitmun3

PASS=0
FAIL=0

ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

psql_q() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -t -A -c "$1" 2>/dev/null | tr -d ' '
}

auth_mode_value() {
  psql_q "SELECT COD_VALUE FROM STM_CODELIST WHERE COD_ID=$1 AND COD_LIST='service.authenticationMode';"
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    ok "$label: '$actual'"
  else
    fail "$label: expected '$expected', got '$actual'"
  fi
}

liquibase_update() {
  local label="$1"
  echo ""
  echo "── Liquibase update: $label ──"
  set +e
  LB_OUTPUT=$(docker run --rm \
    --network "$NETWORK" \
    -v "$LB_HEAD:/liquibase/changelog:ro" \
    liquibase/liquibase:4.29 \
    --url="jdbc:postgresql://$CONTAINER:5432/$DB" \
    --username="$DB_USER" \
    --password="$DB_PASS" \
    --changeLogFile="changelog/master.xml" \
    update 2>&1)
  local rc=$?
  set -e
  echo "$LB_OUTPUT" | grep -E "^(Running Changeset|UPDATE SUMMARY|Run:|Previously|Liquibase command|ERROR)" | head -30 || true
  if [[ $rc -ne 0 ]]; then
    echo "$LB_OUTPUT" | grep -i "error\|exception\|failed\|unique\|constraint\|STM_COD" | head -20 || true
    fail "Liquibase update '$label' failed (exit $rc)"
    return 1
  fi
  ok "Liquibase update '$label' succeeded"
}

restore_pre_swap_assignment() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -v ON_ERROR_STOP=1 -c "
    UPDATE STM_CODELIST
      SET COD_VALUE = '__sitmun_tmp_auth_mode__',
          COD_DESCRIPTION = '__sitmun_tmp_auth_mode__'
      WHERE COD_ID = 53 AND COD_LIST = 'service.authenticationMode';
    UPDATE STM_CODELIST
      SET COD_VALUE = 'HTTP Basic authentication',
          COD_DESCRIPTION = 'HTTP Basic authentication'
      WHERE COD_ID = 54 AND COD_LIST = 'service.authenticationMode';
    UPDATE STM_CODELIST
      SET COD_VALUE = 'None',
          COD_DESCRIPTION = 'None'
      WHERE COD_ID = 53 AND COD_LIST = 'service.authenticationMode'
        AND COD_VALUE = '__sitmun_tmp_auth_mode__';
    DELETE FROM DATABASECHANGELOG WHERE ID = '25-fix-auth-mode-swap';
  "
}

teardown() {
  echo ""
  echo "── Teardown ──"
  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
}
trap teardown EXIT

echo "════════════════════════════════════════════════════"
echo " SITMUN Liquibase auth-mode COD_ID swap (#45)"
echo "════════════════════════════════════════════════════"

docker rm -f "$CONTAINER" 2>/dev/null || true
docker network rm "$NETWORK" 2>/dev/null || true
docker network create "$NETWORK"
docker run -d --name "$CONTAINER" --network "$NETWORK" \
  -e POSTGRES_DB="$DB" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  postgres:16-alpine >/dev/null

echo -n "  Waiting for Postgres"
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB" -q 2>/dev/null; then
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
echo "════ PHASE 1: HEAD greenfield ════"
liquibase_update "HEAD greenfield"
assert_eq "Phase1 COD_ID 53" "HTTPBasicauthentication" "$(auth_mode_value 53)"
assert_eq "Phase1 COD_ID 54" "None" "$(auth_mode_value 54)"
assert_eq "Phase1 25 EXECTYPE" "MARK_RAN" "$(psql_q "SELECT EXECTYPE FROM DATABASECHANGELOG WHERE ID='25-fix-auth-mode-swap';")"

echo ""
echo "════ PHASE 2: pre-1.2.7 rows then HEAD ════"
restore_pre_swap_assignment
assert_eq "Phase2 setup COD_ID 53" "None" "$(auth_mode_value 53)"
assert_eq "Phase2 setup COD_ID 54" "HTTPBasicauthentication" "$(auth_mode_value 54)"
if liquibase_update "HEAD after pre-swap restore"; then
  assert_eq "Phase2 COD_ID 53" "HTTPBasicauthentication" "$(auth_mode_value 53)"
  assert_eq "Phase2 COD_ID 54" "None" "$(auth_mode_value 54)"
  assert_eq "Phase2 25 EXECTYPE" "EXECUTED" "$(psql_q "SELECT EXECTYPE FROM DATABASECHANGELOG WHERE ID='25-fix-auth-mode-swap';")"
else
  fail "Phase 2 unique constraint on auth-mode swap"
fi

echo ""
echo "════ PHASE 3: Re-apply HEAD ════"
if [[ $FAIL -eq 0 ]]; then
  liquibase_update "HEAD re-apply"
  assert_eq "Phase3 COD_ID 53" "HTTPBasicauthentication" "$(auth_mode_value 53)"
  assert_eq "Phase3 COD_ID 54" "None" "$(auth_mode_value 54)"
else
  echo "  Skipping Phase 3 because a prior phase failed."
fi

echo ""
echo "════════════════════════════════════════════════════"
printf " Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
