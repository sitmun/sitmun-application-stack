#!/usr/bin/env bash
# test_liquibase_scenarios_oracle.sh
# Tests that Liquibase applies the oracle seed data correctly and that
# switching language baselines updates STM_LANGUAGE and STM_TRANSLATION in place.
#
# Requirements: docker, python3
# Usage: bash tools/tests/test_liquibase_scenarios_oracle.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS_DIR="$REPO_ROOT/tools/bin"
ORACLE_PROFILE="$REPO_ROOT/profiles/oracle"

CONTAINER=sitmun_test_oracle
NETWORK=sitmun_test_oracle_net
DB=sitmun_test
DB_USER=sitmun3
DB_PASS=sitmun3
ORACLE_PWD=password

PASS=0
FAIL=0
LIQUIBASE_OK=0

# ── helpers ────────────────────────────────────────────────────────────────────

ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

sqlplus_q() {
  # Run a SQL query via sqlplus inside the container; strip all whitespace.
  # Uses printf %s to write the SQL to avoid any shell interpretation of quotes.
  local sql="$1"
  docker exec -i "$CONTAINER" bash 2>/dev/null << DOCKEREOF | tr -d ' \n\r\t'
printf '%s\n' "SET HEADING OFF FEEDBACK OFF PAGESIZE 0 TRIMOUT ON" "${sql}" "EXIT" \
  | sqlplus -s ${DB_USER}/${DB_PASS}@//localhost:1521/${DB} 2>/dev/null
DOCKEREOF
}

liquibase_update() {
  local label="$1"
  echo ""
  echo "── Liquibase update: $label ──"
  local output
  output=$(docker run --rm \
    --network "$NETWORK" \
    -v "$ORACLE_PROFILE/liquibase:/liquibase/changelog:ro" \
    liquibase/liquibase:4.29 \
    --url="jdbc:oracle:thin:@//$CONTAINER:1521/$DB" \
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
    LIQUIBASE_OK=0
    return 1
  fi
  ok "Liquibase update '$label' succeeded"
  LIQUIBASE_OK=1
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
  (cd "$TOOLS_DIR" && python3 generate_all_seed_outputs.py --scenarios oracle --baseline "$baseline") 2>&1 \
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
echo " SITMUN Liquibase Oracle Integration Test"
echo "════════════════════════════════════════════════════"

echo ""
echo "── Setup: starting Oracle container ──"
docker rm -f "$CONTAINER" 2>/dev/null || true
docker network rm "$NETWORK" 2>/dev/null || true
docker network create "$NETWORK"
docker run -d --name "$CONTAINER" --network "$NETWORK" \
  -e ORACLE_PASSWORD="$ORACLE_PWD" \
  -e APP_USER="$DB_USER" \
  -e APP_USER_PASSWORD="$DB_PASS" \
  -e ORACLE_DATABASE="$DB" \
  gvenzl/oracle-free:23-slim

echo -n "  Waiting for Oracle (this takes ~90s)"
for i in $(seq 1 90); do
  result=$(docker exec "$CONTAINER" bash -c "
    printf 'SET HEADING OFF FEEDBACK OFF PAGESIZE 0 TRIMOUT ON;\nSELECT 42 FROM DUAL;\nEXIT;\n' \
    | sqlplus -s ${DB_USER}/${DB_PASS}@//localhost:1521/${DB} 2>/dev/null
  " 2>/dev/null | tr -d ' \n\r\t' || true)
  if [[ "$result" == "42" ]]; then
    echo " ready."
    break
  fi
  sleep 3
  echo -n "."
  if [[ $i -eq 90 ]]; then
    echo " TIMEOUT waiting for Oracle"
    exit 1
  fi
done

# ── TEST 1: initial apply (en baseline) ──────────────────────────────────────

echo ""
echo "════ TEST 1: Initial apply — baseline=en ════"

generate en
liquibase_update "en baseline, first apply"

if [[ $LIQUIBASE_OK -eq 1 ]]; then
  CODELIST_COUNT=$(sqlplus_q "SELECT COUNT(*) FROM STM_CODELIST;")
  assert_ge "STM_CODELIST rows" 90 "$CODELIST_COUNT"

  TSK_TYP_COUNT=$(sqlplus_q "SELECT COUNT(*) FROM STM_TSK_TYP;")
  assert_ge "STM_TSK_TYP rows" 4 "$TSK_TYP_COUNT"

  LANG_COUNT=$(sqlplus_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
  assert_eq "STM_LANGUAGE rows" 5 "$LANG_COUNT"

  TRA_COUNT=$(sqlplus_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
  assert_ge "STM_TRANSLATION rows" 400 "$TRA_COUNT"

  EN_NAME=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
  assert_eq "LAN_NAME[en] with baseline=en" "English" "$EN_NAME"

  ES_NAME=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='es';")
  assert_eq "LAN_NAME[es] with baseline=en" "Spanish" "$ES_NAME"

  ES_TRA=$(sqlplus_q "SELECT COUNT(*) FROM STM_TRANSLATION t JOIN STM_LANGUAGE l ON t.TRA_LANID=l.LAN_ID WHERE l.LAN_SHORTNAME='es';")
  assert_ge "STM_TRANSLATION rows for es" 100 "$ES_TRA"

  LAN_SEQ=$(sqlplus_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='LAN_ID';")
  assert_ge "STM_SEQUENCE[LAN_ID]" 5 "$LAN_SEQ"

  TRA_SEQ=$(sqlplus_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='TRA_ID';")
  assert_ge "STM_SEQUENCE[TRA_ID]" 400 "$TRA_SEQ"

  TREENODE_COUNT=$(sqlplus_q "SELECT COUNT(*) FROM STM_CODELIST WHERE COD_LIST='treenode.node.type';")
  assert_ge "treenode.node.type codelist entries" 5 "$TREENODE_COUNT"
fi

# ── TEST 2: idempotent re-apply ──────────────────────────────────────────────

echo ""
echo "════ TEST 2: Idempotent re-apply — baseline=en again ════"

liquibase_update "en baseline, second apply"

if [[ $LIQUIBASE_OK -eq 1 ]]; then
  LANG_COUNT2=$(sqlplus_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
  assert_eq "STM_LANGUAGE count unchanged" "${LANG_COUNT:-0}" "$LANG_COUNT2"

  TRA_COUNT2=$(sqlplus_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
  assert_eq "STM_TRANSLATION count unchanged" "${TRA_COUNT:-0}" "$TRA_COUNT2"

  EN_NAME2=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
  assert_eq "LAN_NAME[en] unchanged after re-apply" "English" "$EN_NAME2"
fi

# ── TEST 3: switch to Spanish baseline ──────────────────────────────────────

echo ""
echo "════ TEST 3: Switch baseline to es ════"

generate es
liquibase_update "es baseline"

if [[ $LIQUIBASE_OK -eq 1 ]]; then
  EN_NAME_ES=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
  assert_eq "LAN_NAME[en] with baseline=es" "Inglés" "$EN_NAME_ES"

  ES_NAME_ES=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='es';")
  assert_eq "LAN_NAME[es] with baseline=es" "Español" "$ES_NAME_ES"

  CA_NAME_ES=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='ca';")
  assert_eq "LAN_NAME[ca] with baseline=es" "Catalán" "$CA_NAME_ES"

  LANG_COUNT3=$(sqlplus_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
  assert_eq "STM_LANGUAGE count unchanged after baseline switch" "${LANG_COUNT:-0}" "$LANG_COUNT3"

  EN_TRA=$(sqlplus_q "SELECT COUNT(*) FROM STM_TRANSLATION t JOIN STM_LANGUAGE l ON t.TRA_LANID=l.LAN_ID WHERE l.LAN_SHORTNAME='en';")
  assert_ge "STM_TRANSLATION rows for en (now a non-baseline language)" 100 "$EN_TRA"
fi

# ── TEST 4: switch to Catalan baseline ──────────────────────────────────────

echo ""
echo "════ TEST 4: Switch baseline to ca ════"

generate ca
liquibase_update "ca baseline"

if [[ $LIQUIBASE_OK -eq 1 ]]; then
  EN_NAME_CA=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
  assert_eq "LAN_NAME[en] with baseline=ca" "Anglès" "$EN_NAME_CA"

  CA_NAME_CA=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='ca';")
  assert_eq "LAN_NAME[ca] with baseline=ca" "Català" "$CA_NAME_CA"

  TRA_COUNT4=$(sqlplus_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
  assert_ge "STM_TRANSLATION rows after ca switch" 400 "$TRA_COUNT4"
fi

# ── TEST 5: restore English baseline ────────────────────────────────────────

echo ""
echo "════ TEST 5: Restore baseline to en ════"

generate en
liquibase_update "en baseline, restore"

if [[ $LIQUIBASE_OK -eq 1 ]]; then
  EN_NAME_BACK=$(sqlplus_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
  assert_eq "LAN_NAME[en] restored to English" "English" "$EN_NAME_BACK"

  TRA_COUNT5=$(sqlplus_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
  assert_ge "STM_TRANSLATION rows after restore" 400 "$TRA_COUNT5"
fi

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
