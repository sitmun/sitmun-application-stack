#!/usr/bin/env bash
# test_liquibase_1.2.7_to_head_upgrade.sh
# Upgrade path:
#   Phase 1 — apply sitmun-application-stack/1.2.7 (baseline)
#   Phase 2 — apply sitmun-application-stack/1.2.8 (expect checksum fail, no DB change)
#   Phase 3 — apply working-tree HEAD fix (expect success + 19/20 columns)
#
# Usage:
#   bash tools/tests/test_liquibase_1.2.7_to_head_upgrade.sh postgres
#   bash tools/tests/test_liquibase_1.2.7_to_head_upgrade.sh oracle
#   bash tools/tests/test_liquibase_1.2.7_to_head_upgrade.sh both

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TAG_127=sitmun-application-stack/1.2.7
TAG_128=sitmun-application-stack/1.2.8
TARGET="${1:-both}"

PASS=0
FAIL=0

ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    ok "$label: '$actual'"
  else
    fail "$label: expected '$expected', got '$actual'"
  fi
}

assert_ne() {
  local label="$1" unexpected="$2" actual="$3"
  if [[ "$actual" != "$unexpected" ]]; then
    ok "$label: '$actual' (not '$unexpected')"
  else
    fail "$label: got unexpected '$actual'"
  fi
}

extract_tag_liquibase() {
  local tag="$1" profile="$2" dest="$3"
  rm -rf "$dest"
  mkdir -p "$dest"
  git -C "$REPO_ROOT" archive "$tag" "profiles/$profile/liquibase" | tar -x -C "$dest"
  # archive lays out profiles/<profile>/liquibase/...
  echo "$dest/profiles/$profile/liquibase"
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────

run_postgres() {
  local CONTAINER=sitmun_upgrade_pg
  local NETWORK=sitmun_upgrade_pg_net
  local DB=sitmun_upgrade
  local DB_USER=sitmun3
  local DB_PASS=sitmun3
  local TMP
  TMP=$(mktemp -d)
  local LB_127 LB_128 LB_HEAD
  LB_127=$(extract_tag_liquibase "$TAG_127" postgres "$TMP/127")
  LB_128=$(extract_tag_liquibase "$TAG_128" postgres "$TMP/128")
  LB_HEAD="$REPO_ROOT/profiles/postgres/liquibase"

  liquibase_pg() {
    local label="$1" changelog_dir="$2"
    echo ""
    echo "── Liquibase: $label ──"
    set +e
    LB_OUTPUT=$(docker run --rm \
      --network "$NETWORK" \
      -v "$changelog_dir:/liquibase/changelog:ro" \
      liquibase/liquibase:4.29 \
      --url="jdbc:postgresql://$CONTAINER:5432/$DB" \
      --username="$DB_USER" \
      --password="$DB_PASS" \
      --changeLogFile="changelog/master.xml" \
      update 2>&1)
    LB_RC=$?
    set -e
    echo "$LB_OUTPUT" | grep -E "^(Running Changeset|UPDATE SUMMARY|Run:|Previously|Liquibase command|ERROR|Validation)" | head -40
  }

  psql_q() {
    docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -t -c "$1" 2>/dev/null | tr -d ' \n'
  }

  echo ""
  echo "════════════════════════════════════════════════════"
  echo " PostgreSQL: 1.2.7 → 1.2.8 (fail) → HEAD fix"
  echo "════════════════════════════════════════════════════"

  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
  docker network create "$NETWORK"
  docker run -d --name "$CONTAINER" --network "$NETWORK" \
    -e POSTGRES_DB="$DB" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    postgres:16-alpine

  echo -n "  Waiting for Postgres"
  for _ in $(seq 1 40); do
    if docker exec "$CONTAINER" pg_isready -U "$DB_USER" -d "$DB" -q 2>/dev/null; then
      echo " ready."
      break
    fi
    sleep 1
    echo -n "."
  done

  echo ""
  echo "════ PHASE 1: apply $TAG_127 ════"
  liquibase_pg "1.2.7" "$LB_127"
  if [[ $LB_RC -eq 0 ]]; then
    ok "Phase1 Liquibase 1.2.7 succeeded"
  else
    fail "Phase1 Liquibase 1.2.7 failed (exit $LB_RC)"
    echo "$LB_OUTPUT" | grep -i "error\|exception\|failed\|checksum" | head -20
  fi

  P1_MD5=$(psql_q "SELECT MD5SUM FROM DATABASECHANGELOG WHERE ID='1' AND AUTHOR='sitmun';")
  P1_ROWS=$(psql_q "SELECT COUNT(*) FROM DATABASECHANGELOG;")
  P1_TNO=$(psql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='stm_tree_nod' AND column_name='tno_default';")
  P1_ATR=$(psql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='stm_app_tree' AND column_name='atr_id';")
  assert_ne "Phase1 sitmun:1 MD5SUM set" "" "$P1_MD5"
  assert_eq "Phase1 TNO_DEFAULT absent" "0" "$P1_TNO"
  assert_eq "Phase1 ATR_ID absent" "0" "$P1_ATR"
  ok "Phase1 DATABASECHANGELOG rows=$P1_ROWS md5=$P1_MD5"

  echo ""
  echo "════ PHASE 2: apply $TAG_128 (expect FAIL, no DB change) ════"
  liquibase_pg "1.2.8" "$LB_128"
  if [[ $LB_RC -ne 0 ]]; then
    ok "Phase2 Liquibase 1.2.8 failed as expected (exit $LB_RC)"
  else
    fail "Phase2 Liquibase 1.2.8 unexpectedly succeeded"
  fi
  if echo "$LB_OUTPUT" | grep -qi "checksum\|Validation Failed\|validCheckSum"; then
    ok "Phase2 failure mentions checksum/validation"
  else
    fail "Phase2 failure did not mention checksum/validation"
    echo "$LB_OUTPUT" | tail -30
  fi

  P2_MD5=$(psql_q "SELECT MD5SUM FROM DATABASECHANGELOG WHERE ID='1' AND AUTHOR='sitmun';")
  P2_ROWS=$(psql_q "SELECT COUNT(*) FROM DATABASECHANGELOG;")
  P2_TNO=$(psql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='stm_tree_nod' AND column_name='tno_default';")
  P2_ATR=$(psql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='stm_app_tree' AND column_name='atr_id';")
  assert_eq "Phase2 sitmun:1 MD5SUM unchanged" "$P1_MD5" "$P2_MD5"
  assert_eq "Phase2 DATABASECHANGELOG rows unchanged" "$P1_ROWS" "$P2_ROWS"
  assert_eq "Phase2 TNO_DEFAULT still absent" "0" "$P2_TNO"
  assert_eq "Phase2 ATR_ID still absent" "0" "$P2_ATR"

  echo ""
  echo "════ PHASE 3: apply HEAD working-tree fix ════"
  liquibase_pg "HEAD fix" "$LB_HEAD"
  if [[ $LB_RC -eq 0 ]]; then
    ok "Phase3 Liquibase HEAD fix succeeded"
  else
    fail "Phase3 Liquibase HEAD fix failed (exit $LB_RC)"
    echo "$LB_OUTPUT" | grep -i "error\|exception\|failed\|checksum" | head -30
  fi
  if echo "$LB_OUTPUT" | grep -q "Running Changeset:.*01_schema.postgresql.sql::1::sitmun"; then
    fail "Phase3 re-ran sitmun:1 (should only validate)"
  else
    ok "Phase3 did not re-run sitmun:1"
  fi
  if echo "$LB_OUTPUT" | grep -q "19-add-tno-default-postgresql"; then
    ok "Phase3 ran 19-add-tno-default-postgresql"
  else
    fail "Phase3 did not run 19-add-tno-default-postgresql"
  fi
  if echo "$LB_OUTPUT" | grep -q "20_application_tree_order_postgresql"; then
    ok "Phase3 ran 20_application_tree_order_postgresql"
  else
    fail "Phase3 did not run 20_application_tree_order_postgresql"
  fi

  P3_TNO=$(psql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='stm_tree_nod' AND column_name='tno_default';")
  P3_ATR=$(psql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='stm_app_tree' AND column_name='atr_id';")
  P3_ATR_ORD=$(psql_q "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='stm_app_tree' AND column_name='atr_order';")
  P3_ATR_SEQ=$(psql_q "SELECT COUNT(*) FROM STM_SEQUENCE WHERE SEQ_NAME='ATR_ID';")
  P3_ROWS=$(psql_q "SELECT COUNT(*) FROM DATABASECHANGELOG;")
  assert_eq "Phase3 TNO_DEFAULT present" "1" "$P3_TNO"
  assert_eq "Phase3 ATR_ID present" "1" "$P3_ATR"
  assert_eq "Phase3 ATR_ORDER present" "1" "$P3_ATR_ORD"
  assert_eq "Phase3 ATR_ID sequence present" "1" "$P3_ATR_SEQ"
  assert_ne "Phase3 DATABASECHANGELOG grew" "$P1_ROWS" "$P3_ROWS"

  echo ""
  echo "── Postgres teardown ──"
  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
  rm -rf "$TMP"
}

# ── Oracle ────────────────────────────────────────────────────────────────────

run_oracle() {
  local CONTAINER=sitmun_upgrade_ora
  local NETWORK=sitmun_upgrade_ora_net
  local DB=sitmun_upgrade
  local DB_USER=sitmun3
  local DB_PASS=sitmun3
  local ORACLE_PWD=password
  local TMP
  TMP=$(mktemp -d)
  local LB_127 LB_128 LB_HEAD
  LB_127=$(extract_tag_liquibase "$TAG_127" oracle "$TMP/127")
  LB_128=$(extract_tag_liquibase "$TAG_128" oracle "$TMP/128")
  LB_HEAD="$REPO_ROOT/profiles/oracle/liquibase"

  liquibase_ora() {
    local label="$1" changelog_dir="$2"
    echo ""
    echo "── Liquibase: $label ──"
    set +e
    LB_OUTPUT=$(docker run --rm \
      --network "$NETWORK" \
      -v "$changelog_dir:/liquibase/changelog:ro" \
      liquibase/liquibase:4.29 \
      --url="jdbc:oracle:thin:@//$CONTAINER:1521/$DB" \
      --username="$DB_USER" \
      --password="$DB_PASS" \
      --changeLogFile="changelog/master.xml" \
      update 2>&1)
    LB_RC=$?
    set -e
    echo "$LB_OUTPUT" | grep -E "^(Running Changeset|UPDATE SUMMARY|Run:|Previously|Liquibase command|ERROR|Validation)" | head -40
  }

  sqlplus_q() {
    local sql="$1"
    docker exec -i "$CONTAINER" bash 2>/dev/null << DOCKEREOF | tr -d ' \n\r\t'
printf '%s\n' "SET HEADING OFF FEEDBACK OFF PAGESIZE 0 TRIMOUT ON" "${sql}" "EXIT" \
  | sqlplus -s ${DB_USER}/${DB_PASS}@//localhost:1521/${DB} 2>/dev/null
DOCKEREOF
  }

  echo ""
  echo "════════════════════════════════════════════════════"
  echo " Oracle: 1.2.7 → 1.2.8 (fail) → HEAD fix"
  echo "════════════════════════════════════════════════════"

  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
  docker network create "$NETWORK"
  docker run -d --name "$CONTAINER" --network "$NETWORK" \
    -e ORACLE_PASSWORD="$ORACLE_PWD" \
    -e APP_USER="$DB_USER" \
    -e APP_USER_PASSWORD="$DB_PASS" \
    -e ORACLE_DATABASE="$DB" \
    gvenzl/oracle-free:23-slim

  echo -n "  Waiting for Oracle"
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
      echo " TIMEOUT"
      fail "Oracle container failed to become ready"
      return 1
    fi
  done

  echo ""
  echo "════ PHASE 1: apply $TAG_127 ════"
  liquibase_ora "1.2.7" "$LB_127"
  if [[ $LB_RC -eq 0 ]]; then
    ok "Phase1 Liquibase 1.2.7 succeeded"
  else
    fail "Phase1 Liquibase 1.2.7 failed (exit $LB_RC)"
    echo "$LB_OUTPUT" | grep -i "error\|exception\|failed\|checksum" | head -20
  fi

  P1_MD5=$(sqlplus_q "SELECT MD5SUM FROM DATABASECHANGELOG WHERE ID='1' AND AUTHOR='sitmun';")
  P1_ROWS=$(sqlplus_q "SELECT COUNT(*) FROM DATABASECHANGELOG;")
  P1_TNO=$(sqlplus_q "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='STM_TREE_NOD' AND COLUMN_NAME='TNO_DEFAULT';")
  P1_ATR=$(sqlplus_q "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='STM_APP_TREE' AND COLUMN_NAME='ATR_ID';")
  assert_ne "Phase1 sitmun:1 MD5SUM set" "" "$P1_MD5"
  assert_eq "Phase1 TNO_DEFAULT absent" "0" "$P1_TNO"
  assert_eq "Phase1 ATR_ID absent" "0" "$P1_ATR"
  ok "Phase1 DATABASECHANGELOG rows=$P1_ROWS md5=$P1_MD5"

  echo ""
  echo "════ PHASE 2: apply $TAG_128 (expect FAIL, no DB change) ════"
  liquibase_ora "1.2.8" "$LB_128"
  if [[ $LB_RC -ne 0 ]]; then
    ok "Phase2 Liquibase 1.2.8 failed as expected (exit $LB_RC)"
  else
    fail "Phase2 Liquibase 1.2.8 unexpectedly succeeded"
  fi
  if echo "$LB_OUTPUT" | grep -qi "checksum\|Validation Failed\|validCheckSum"; then
    ok "Phase2 failure mentions checksum/validation"
  else
    fail "Phase2 failure did not mention checksum/validation"
    echo "$LB_OUTPUT" | tail -30
  fi

  P2_MD5=$(sqlplus_q "SELECT MD5SUM FROM DATABASECHANGELOG WHERE ID='1' AND AUTHOR='sitmun';")
  P2_ROWS=$(sqlplus_q "SELECT COUNT(*) FROM DATABASECHANGELOG;")
  P2_TNO=$(sqlplus_q "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='STM_TREE_NOD' AND COLUMN_NAME='TNO_DEFAULT';")
  P2_ATR=$(sqlplus_q "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='STM_APP_TREE' AND COLUMN_NAME='ATR_ID';")
  assert_eq "Phase2 sitmun:1 MD5SUM unchanged" "$P1_MD5" "$P2_MD5"
  assert_eq "Phase2 DATABASECHANGELOG rows unchanged" "$P1_ROWS" "$P2_ROWS"
  assert_eq "Phase2 TNO_DEFAULT still absent" "0" "$P2_TNO"
  assert_eq "Phase2 ATR_ID still absent" "0" "$P2_ATR"

  echo ""
  echo "════ PHASE 3: apply HEAD working-tree fix ════"
  liquibase_ora "HEAD fix" "$LB_HEAD"
  if [[ $LB_RC -eq 0 ]]; then
    ok "Phase3 Liquibase HEAD fix succeeded"
  else
    fail "Phase3 Liquibase HEAD fix failed (exit $LB_RC)"
    echo "$LB_OUTPUT" | grep -i "error\|exception\|failed\|checksum" | head -30
  fi
  if echo "$LB_OUTPUT" | grep -q "Running Changeset:.*01_schema.oracle.sql::1::sitmun"; then
    fail "Phase3 re-ran sitmun:1 (should only validate)"
  else
    ok "Phase3 did not re-run sitmun:1"
  fi
  if echo "$LB_OUTPUT" | grep -q "19-add-tno-default-oracle"; then
    ok "Phase3 ran 19-add-tno-default-oracle"
  else
    fail "Phase3 did not run 19-add-tno-default-oracle"
  fi
  if echo "$LB_OUTPUT" | grep -q "20_application_tree_order_oracle"; then
    ok "Phase3 ran 20_application_tree_order_oracle"
  else
    fail "Phase3 did not run 20_application_tree_order_oracle"
  fi

  P3_TNO=$(sqlplus_q "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='STM_TREE_NOD' AND COLUMN_NAME='TNO_DEFAULT';")
  P3_ATR=$(sqlplus_q "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='STM_APP_TREE' AND COLUMN_NAME='ATR_ID';")
  P3_ATR_ORD=$(sqlplus_q "SELECT COUNT(*) FROM USER_TAB_COLUMNS WHERE TABLE_NAME='STM_APP_TREE' AND COLUMN_NAME='ATR_ORDER';")
  P3_ATR_SEQ=$(sqlplus_q "SELECT COUNT(*) FROM STM_SEQUENCE WHERE SEQ_NAME='ATR_ID';")
  P3_ROWS=$(sqlplus_q "SELECT COUNT(*) FROM DATABASECHANGELOG;")
  assert_eq "Phase3 TNO_DEFAULT present" "1" "$P3_TNO"
  assert_eq "Phase3 ATR_ID present" "1" "$P3_ATR"
  assert_eq "Phase3 ATR_ORDER present" "1" "$P3_ATR_ORD"
  assert_eq "Phase3 ATR_ID sequence present" "1" "$P3_ATR_SEQ"
  assert_ne "Phase3 DATABASECHANGELOG grew" "$P1_ROWS" "$P3_ROWS"

  echo ""
  echo "── Oracle teardown ──"
  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
  rm -rf "$TMP"
}

# ── main ──────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════"
echo " SITMUN Liquibase upgrade: 1.2.7 → 1.2.8 → HEAD fix"
echo "════════════════════════════════════════════════════"

case "$TARGET" in
  postgres) run_postgres ;;
  oracle)   run_oracle ;;
  both)
    run_postgres
    run_oracle
    ;;
  *)
    echo "Usage: $0 [postgres|oracle|both]"
    exit 2
    ;;
esac

echo ""
echo "════════════════════════════════════════════════════"
printf " Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
