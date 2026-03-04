#!/usr/bin/env bash
# test_liquibase_scenarios.sh
# Tests that Liquibase applies the postgres seed data correctly and that
# switching language baselines updates STM_LANGUAGE and STM_TRANSLATION in place.
#
# Requirements: docker, python3
# Usage: bash tools/tests/test_liquibase_scenarios.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS_DIR="$REPO_ROOT/tools/bin"
POSTGRES_PROFILE="$REPO_ROOT/profiles/postgres"

CONTAINER=sitmun_test_postgres
NETWORK=sitmun_test_net
DB=sitmun_test
DB_USER=sitmun3
DB_PASS=sitmun3

PASS=0
FAIL=0

# ── helpers ────────────────────────────────────────────────────────────────────

ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

psql_q() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -t -c "$1" 2>/dev/null | tr -d ' \n'
}

liquibase_update() {
  local label="$1"
  echo ""
  echo "── Liquibase update: $label ──"
  local output
  output=$(docker run --rm \
    --network "$NETWORK" \
    -v "$POSTGRES_PROFILE/liquibase:/liquibase/changelog:ro" \
    liquibase/liquibase:4.29 \
    --url="jdbc:postgresql://$CONTAINER:5432/$DB" \
    --username="$DB_USER" \
    --password="$DB_PASS" \
    --changeLogFile="changelog/master.xml" \
    update 2>&1)
  local rc=$?
  echo "$output" | grep -E "^(Running Changeset|UPDATE SUMMARY|Run:|Previously|Liquibase command|ERROR)" | head -20
  if [[ $rc -ne 0 ]]; then
    echo "  ERROR: Liquibase exited with code $rc"
    echo "$output" | grep -i "error\|exception\|failed" | head -10
    fail "Liquibase update '$label' failed (exit $rc)"
    return 1
  fi
  ok "Liquibase update '$label' succeeded"
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    ok "$label: '$actual'"
  else
    fail "$label: expected '$expected', got '$actual'"
  fi
}

assert_ge() {
  local label="$1" min="$2" actual="$3"
  if [[ -n "$actual" && "$actual" -ge "$min" ]]; then
    ok "$label: $actual >= $min"
  else
    fail "$label: expected >= $min, got '$actual'"
  fi
}

generate() {
  local baseline="$1"
  echo "  Generating for baseline=$baseline..."
  (cd "$TOOLS_DIR" && python3 generate_all_seed_outputs.py --scenarios postgres --baseline "$baseline") 2>&1 \
    | grep -E "^(ERROR|Written|Done for)" | head -20
  local rc=${PIPESTATUS[0]}
  if [[ $rc -eq 0 ]]; then
    ok "generate_all_seed_outputs --baseline $baseline"
  else
    fail "generate_all_seed_outputs --baseline $baseline (exit $rc)"
  fi
}

# ── setup ──────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════"
echo " SITMUN Liquibase Integration Test"
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
  if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB" -q 2>/dev/null; then
    echo " ready."
    break
  fi
  sleep 1
  echo -n "."
done

# ── TEST 1: initial apply (en baseline) ──────────────────────────────────────

echo ""
echo "════ TEST 1: Initial apply — baseline=en ════"

generate en
liquibase_update "en baseline, first apply"

CODELIST_COUNT=$(psql_q "SELECT COUNT(*) FROM STM_CODELIST;")
assert_ge "STM_CODELIST rows" 90 "$CODELIST_COUNT"

TSK_TYP_COUNT=$(psql_q "SELECT COUNT(*) FROM STM_TSK_TYP;")
assert_ge "STM_TSK_TYP rows" 4 "$TSK_TYP_COUNT"

LANG_COUNT=$(psql_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
assert_eq "STM_LANGUAGE rows" 5 "$LANG_COUNT"

TRA_COUNT=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
assert_ge "STM_TRANSLATION rows" 400 "$TRA_COUNT"

EN_NAME=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
assert_eq "LAN_NAME[en] with baseline=en" "English" "$EN_NAME"

ES_NAME=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='es';")
assert_eq "LAN_NAME[es] with baseline=en" "Spanish" "$ES_NAME"

ES_TRA=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION t JOIN STM_LANGUAGE l ON t.TRA_LANID=l.LAN_ID WHERE l.LAN_SHORTNAME='es';")
assert_ge "STM_TRANSLATION rows for es" 100 "$ES_TRA"

LAN_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='LAN_ID';")
assert_ge "STM_SEQUENCE[LAN_ID]" 5 "$LAN_SEQ"

TRA_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='TRA_ID';")
assert_ge "STM_SEQUENCE[TRA_ID]" 400 "$TRA_SEQ"

TREENODE_COUNT=$(psql_q "SELECT COUNT(*) FROM STM_CODELIST WHERE COD_LIST='treenode.node.type';")
assert_ge "treenode.node.type codelist entries" 5 "$TREENODE_COUNT"

# ── TEST 2: idempotent re-apply ──────────────────────────────────────────────

echo ""
echo "════ TEST 2: Idempotent re-apply — baseline=en again ════"

liquibase_update "en baseline, second apply"

LANG_COUNT2=$(psql_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
assert_eq "STM_LANGUAGE count unchanged" "$LANG_COUNT" "$LANG_COUNT2"

TRA_COUNT2=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
assert_eq "STM_TRANSLATION count unchanged" "$TRA_COUNT" "$TRA_COUNT2"

EN_NAME2=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
assert_eq "LAN_NAME[en] unchanged after re-apply" "English" "$EN_NAME2"

# ── TEST 3: switch to Spanish baseline ──────────────────────────────────────

echo ""
echo "════ TEST 3: Switch baseline to es ════"

generate es
liquibase_update "es baseline"

EN_NAME_ES=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
assert_eq "LAN_NAME[en] with baseline=es" "Inglés" "$EN_NAME_ES"

ES_NAME_ES=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='es';")
assert_eq "LAN_NAME[es] with baseline=es" "Español" "$ES_NAME_ES"

CA_NAME_ES=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='ca';")
assert_eq "LAN_NAME[ca] with baseline=es" "Catalán" "$CA_NAME_ES"

LANG_COUNT3=$(psql_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
assert_eq "STM_LANGUAGE count unchanged after baseline switch" "$LANG_COUNT" "$LANG_COUNT3"

EN_TRA=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION t JOIN STM_LANGUAGE l ON t.TRA_LANID=l.LAN_ID WHERE l.LAN_SHORTNAME='en';")
assert_ge "STM_TRANSLATION rows for en (now a non-baseline language)" 100 "$EN_TRA"

# ── TEST 4: switch to Catalan baseline ──────────────────────────────────────

echo ""
echo "════ TEST 4: Switch baseline to ca ════"

generate ca
liquibase_update "ca baseline"

EN_NAME_CA=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
assert_eq "LAN_NAME[en] with baseline=ca" "Anglès" "$EN_NAME_CA"

CA_NAME_CA=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='ca';")
assert_eq "LAN_NAME[ca] with baseline=ca" "Català" "$CA_NAME_CA"

TRA_COUNT4=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
assert_ge "STM_TRANSLATION rows after ca switch" 400 "$TRA_COUNT4"

# ── TEST 5: switch back to English ──────────────────────────────────────────

echo ""
echo "════ TEST 5: Restore baseline to en ════"

generate en
liquibase_update "en baseline, restore"

EN_NAME_BACK=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
assert_eq "LAN_NAME[en] restored to English" "English" "$EN_NAME_BACK"

TRA_COUNT5=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
assert_ge "STM_TRANSLATION rows after restore" 400 "$TRA_COUNT5"

# ── teardown ──────────────────────────────────────────────────────────────────

echo ""
echo "── Teardown ──"
docker rm -f "$CONTAINER" 2>/dev/null && echo "  Container removed." || true
docker network rm "$NETWORK" 2>/dev/null && echo "  Network removed." || true
(cd "$TOOLS_DIR" && python3 generate_all_seed_outputs.py --scenarios postgres,oracle --baseline en > /dev/null 2>&1)
echo "  Generated files restored to baseline=en for both profiles."

# ── summary ───────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════"
printf " Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
