#!/usr/bin/env bash
# test_liquibase_codelist_auth_mode_swap.sh
# Reproduces / verifies GitHub issue #45: upgrading STM_CODELIST auth-mode rows
# from the pre-1.2.7 COD_ID assignment to the post-1.2.7 assignment must not
# violate STM_COD_UK when changeset 2 re-runs via loadUpdateData.
#
# Keeps HEAD schema/master throughout; only STM_CODELIST.csv auth-mode IDs change
# between phases (avoids Liquibase ValidationFailedException from unrelated schema drift).
#
# Phases share one Postgres container (no wipe between phases):
#   Phase 1 — HEAD liquibase + pre-swap CSV rows (53=None, 54=HTTP Basic)
#   Phase 2 — HEAD liquibase + post-swap CSV (+ optional local 02_codelists.yaml fix)
#   Phase 3 — re-apply (idempotent)
#
# Requirements: docker, git
# Usage: bash tools/tests/test_liquibase_codelist_auth_mode_swap.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
POSTGRES_PROFILE="$REPO_ROOT/profiles/postgres"
PRE_SWAP_COMMIT="4e521b2^"
CODELISTS_YAML_REL="profiles/postgres/liquibase/changelog/02_codelists.yaml"
CODELISTS_CSV_REL="profiles/postgres/liquibase/changelog/02_codelists/STM_CODELIST.csv"
CODELISTS_YAML="$REPO_ROOT/$CODELISTS_YAML_REL"
CODELISTS_CSV="$REPO_ROOT/$CODELISTS_CSV_REL"

CONTAINER=sitmun_authmode_swap_postgres
NETWORK=sitmun_authmode_swap_net
DB=sitmun_authmode_swap
DB_USER=sitmun3
DB_PASS=sitmun3

PASS=0
FAIL=0
LOCAL_CODELISTS_YAML_BACKUP=""
LOCAL_CODELISTS_CSV_BACKUP=""

# ── helpers ────────────────────────────────────────────────────────────────────

ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

psql_q() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB" -t -c "$1" 2>/dev/null | tr -d ' \n'
}

liquibase_update_capture() {
  local label="$1"
  echo ""
  echo "── Liquibase update: $label ──"
  LB_OUTPUT=$(docker run --rm \
    --network "$NETWORK" \
    -v "$POSTGRES_PROFILE/liquibase:/liquibase/changelog:ro" \
    liquibase/liquibase:4.29 \
    --url="jdbc:postgresql://$CONTAINER:5432/$DB" \
    --username="$DB_USER" \
    --password="$DB_PASS" \
    --changeLogFile="changelog/master.xml" \
    update 2>&1)
  local rc=$?
  echo "$LB_OUTPUT" | grep -E "^(Running Changeset|UPDATE SUMMARY|Run:|Previously|Liquibase command|ERROR)" | head -30
  if [[ $rc -ne 0 ]]; then
    echo "  ERROR: Liquibase exited with code $rc"
    echo "$LB_OUTPUT" | grep -i "error\|exception\|failed\|unique\|constraint\|STM_COD" | head -20
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

auth_mode_value() {
  # Strip spaces so "HTTP Basic authentication" compares stably.
  psql_q "SELECT COD_VALUE FROM STM_CODELIST WHERE COD_ID=$1 AND COD_LIST='service.authenticationMode';"
}

restore_workspace_overlays() {
  git -C "$REPO_ROOT" checkout HEAD -- profiles/postgres/liquibase/
  if [[ -n "$LOCAL_CODELISTS_YAML_BACKUP" && -f "$LOCAL_CODELISTS_YAML_BACKUP" ]]; then
    cp "$LOCAL_CODELISTS_YAML_BACKUP" "$CODELISTS_YAML"
  fi
  if [[ -n "$LOCAL_CODELISTS_CSV_BACKUP" && -f "$LOCAL_CODELISTS_CSV_BACKUP" ]]; then
    cp "$LOCAL_CODELISTS_CSV_BACKUP" "$CODELISTS_CSV"
  fi
}

apply_pre_swap_csv() {
  # Only replace the two auth-mode rows; keep the rest of HEAD's CSV.
  python3 - "$CODELISTS_CSV" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
for line in lines:
    if line.startswith("53,service.authenticationMode,"):
        out.append("53,service.authenticationMode,None,true,true,None\n")
    elif line.startswith("54,service.authenticationMode,"):
        out.append("54,service.authenticationMode,HTTP Basic authentication,true,false,HTTP Basic authentication\n")
    else:
        out.append(line)
path.write_text("".join(out), encoding="utf-8")
PY
}

# ── teardown ───────────────────────────────────────────────────────────────────

teardown() {
  echo ""
  echo "── Teardown ──"
  docker rm -f "$CONTAINER" 2>/dev/null && echo "  Container removed." || true
  docker network rm "$NETWORK" 2>/dev/null && echo "  Network removed." || true
  restore_workspace_overlays
  [[ -n "$LOCAL_CODELISTS_YAML_BACKUP" ]] && rm -f "$LOCAL_CODELISTS_YAML_BACKUP"
  [[ -n "$LOCAL_CODELISTS_CSV_BACKUP" ]] && rm -f "$LOCAL_CODELISTS_CSV_BACKUP"
  echo "  Restored profiles/postgres/liquibase workspace state."
}
trap teardown EXIT

# Snapshot local overlays that differ from HEAD (green fix / intentional CSV).
if [[ -f "$CODELISTS_YAML" ]] && ! git -C "$REPO_ROOT" diff --quiet HEAD -- "$CODELISTS_YAML_REL" 2>/dev/null; then
  LOCAL_CODELISTS_YAML_BACKUP=$(mktemp)
  cp "$CODELISTS_YAML" "$LOCAL_CODELISTS_YAML_BACKUP"
  echo "  Captured local overlay for $CODELISTS_YAML_REL"
fi
if [[ -f "$CODELISTS_CSV" ]] && ! git -C "$REPO_ROOT" diff --quiet HEAD -- "$CODELISTS_CSV_REL" 2>/dev/null; then
  LOCAL_CODELISTS_CSV_BACKUP=$(mktemp)
  cp "$CODELISTS_CSV" "$LOCAL_CODELISTS_CSV_BACKUP"
  echo "  Captured local overlay for $CODELISTS_CSV_REL"
fi

# ── setup ──────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════"
echo " SITMUN Liquibase auth-mode COD_ID swap (#45)"
echo "════════════════════════════════════════════════════"
echo "  Pre-swap reference commit: $PRE_SWAP_COMMIT"

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

# Ensure HEAD liquibase tree, then overlay local YAML fix if present.
restore_workspace_overlays

# ── PHASE 1: pre-swap CSV on HEAD schema ───────────────────────────────────────

echo ""
echo "════ PHASE 1: HEAD schema + pre-1.2.7 auth-mode CSV rows ════"

apply_pre_swap_csv
# Phase 1 must exercise loadUpdateData without the green fix so the DB stores
# the pre-swap assignment the same way 1.2.6 did.
git -C "$REPO_ROOT" checkout HEAD -- "$CODELISTS_YAML_REL"

liquibase_update_capture "Phase 1 — pre-1.2.7 auth-mode IDs"

assert_eq "Phase1 COD_ID 53" "None" "$(auth_mode_value 53)"
assert_eq "Phase1 COD_ID 54" "HTTPBasicauthentication" "$(auth_mode_value 54)"

# ── PHASE 2: restore post-swap CSV (+ optional YAML fix) ───────────────────────

echo ""
echo "════ PHASE 2: HEAD auth-mode CSV (post-1.2.7 IDs) ════"

git -C "$REPO_ROOT" checkout HEAD -- "$CODELISTS_CSV_REL"
if [[ -n "$LOCAL_CODELISTS_CSV_BACKUP" && -f "$LOCAL_CODELISTS_CSV_BACKUP" ]]; then
  cp "$LOCAL_CODELISTS_CSV_BACKUP" "$CODELISTS_CSV"
fi
if [[ -n "$LOCAL_CODELISTS_YAML_BACKUP" && -f "$LOCAL_CODELISTS_YAML_BACKUP" ]]; then
  cp "$LOCAL_CODELISTS_YAML_BACKUP" "$CODELISTS_YAML"
  echo "  Using local $CODELISTS_YAML_REL fix overlay."
else
  git -C "$REPO_ROOT" checkout HEAD -- "$CODELISTS_YAML_REL"
  echo "  Using HEAD $CODELISTS_YAML_REL (no fix overlay)."
fi

if liquibase_update_capture "Phase 2 — post-1.2.7 auth-mode IDs"; then
  assert_eq "Phase2 COD_ID 53" "HTTPBasicauthentication" "$(auth_mode_value 53)"
  assert_eq "Phase2 COD_ID 54" "None" "$(auth_mode_value 54)"
else
  fail "Phase 2 reproduce issue #45 (unique constraint on auth-mode swap)"
fi

# ── PHASE 3: idempotent re-apply ───────────────────────────────────────────────

echo ""
echo "════ PHASE 3: Re-apply (idempotent) ════"

if [[ $FAIL -eq 0 ]]; then
  liquibase_update_capture "Phase 3 — idempotent re-apply"
  assert_eq "Phase3 COD_ID 53" "HTTPBasicauthentication" "$(auth_mode_value 53)"
  assert_eq "Phase3 COD_ID 54" "None" "$(auth_mode_value 54)"
else
  echo "  Skipping Phase 3 because Phase 2 failed."
fi

# ── summary ───────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════"
printf " Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
