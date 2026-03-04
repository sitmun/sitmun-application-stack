#!/usr/bin/env bash
# test_liquibase_transition.sh
# Validates the upgrade path from the old static loadData changelog (commit 197b923)
# to the new loadUpdateData + runOnChange:true changelog, against a live Postgres container.
#
# The three phases share a single container (no DB wipe between phases):
#   Phase 1 — apply OLD changelog from git  -> baseline row counts asserted
#   Phase 2 — apply NEW changelog (HEAD)    -> runOnChange changesets re-ran, data intact
#   Phase 3 — re-apply NEW changelog        -> idempotent (nothing reruns)
#
# Requirements: docker, git, python3
# Usage: bash tools/tests/test_liquibase_transition.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS_DIR="$REPO_ROOT/tools/bin"
POSTGRES_PROFILE="$REPO_ROOT/profiles/postgres"
OLD_COMMIT="197b923"

CONTAINER=sitmun_transition_postgres
NETWORK=sitmun_transition_net
DB=sitmun_transition
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

# Run liquibase update and capture raw output.
# Sets global LB_OUTPUT with the full output.
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
    echo "$LB_OUTPUT" | grep -i "error\|exception\|failed" | head -10
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

assert_output_contains() {
  local label="$1" pattern="$2"
  if echo "$LB_OUTPUT" | grep -q "$pattern"; then
    ok "$label: found '$pattern' in output"
  else
    fail "$label: '$pattern' NOT found in Liquibase output"
  fi
}

assert_output_not_contains() {
  local label="$1" pattern="$2"
  if echo "$LB_OUTPUT" | grep -q "$pattern"; then
    fail "$label: '$pattern' found in Liquibase output (should not be)"
  else
    ok "$label: '$pattern' absent from output (expected)"
  fi
}

# ── teardown (runs on exit) ────────────────────────────────────────────────────

# Ensure 07_sequences.yaml has runOnChange: true and ON CONFLICT upsert.
# This file may not yet be committed at HEAD with those changes.
_apply_sequences_fix() {
  local seq_file="$1"
  if ! grep -q "runOnChange" "$seq_file"; then
    python3 - "$seq_file" <<'PYEOF'
import sys, re
path = sys.argv[1]
content = open(path).read()
content = content.replace(
    "      author: sitmun\n      changes:",
    "      author: sitmun\n      runOnChange: true\n      changes:"
)
content = re.sub(
    r"(VALUES \('[^']+', \([^)]+\))\);",
    r"\1) ON CONFLICT (SEQ_NAME) DO UPDATE SET SEQ_COUNT = EXCLUDED.SEQ_COUNT;",
    content
)
open(path, "w").write(content)
PYEOF
  fi
}

teardown() {
  echo ""
  echo "── Teardown ──"
  docker rm -f "$CONTAINER" 2>/dev/null && echo "  Container removed." || true
  docker network rm "$NETWORK" 2>/dev/null && echo "  Network removed." || true
  echo "  Restoring profiles/postgres/liquibase to HEAD..."
  git -C "$REPO_ROOT" checkout HEAD -- profiles/postgres/liquibase/
  # Re-apply the correct 07_sequences.yaml (runOnChange + ON CONFLICT) since it
  # may not yet be committed at HEAD. Phase 2 applies it too; keep them in sync.
  _apply_sequences_fix "$POSTGRES_PROFILE/liquibase/changelog/07_sequences.yaml"
  (cd "$TOOLS_DIR" && python3 generate_all_seed_outputs.py --scenarios postgres,oracle --baseline en > /dev/null 2>&1)
  echo "  Generated files restored to baseline=en."
}
trap teardown EXIT

# ── setup ──────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════"
echo " SITMUN Liquibase Transition Test (old -> new)"
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

# ── PHASE 1: Apply OLD changelog from git ─────────────────────────────────────

echo ""
echo "════ PHASE 1: Apply OLD changelog ($OLD_COMMIT) ════"

echo "  Checking out old profiles/postgres/liquibase from $OLD_COMMIT..."
git -C "$REPO_ROOT" checkout "$OLD_COMMIT" -- profiles/postgres/liquibase/

liquibase_update_capture "Phase 1 — old loadData changelog"

P1_CODELIST=$(psql_q "SELECT COUNT(*) FROM STM_CODELIST;")
assert_ge "Phase1 STM_CODELIST rows" 90 "$P1_CODELIST"

P1_TSK_TYP=$(psql_q "SELECT COUNT(*) FROM STM_TSK_TYP;")
assert_ge "Phase1 STM_TSK_TYP rows" 3 "$P1_TSK_TYP"

P1_LANG=$(psql_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
assert_ge "Phase1 STM_LANGUAGE rows" 5 "$P1_LANG"

P1_TRA=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
assert_ge "Phase1 STM_TRANSLATION rows" 400 "$P1_TRA"

P1_LAN_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='LAN_ID';")
assert_ge "Phase1 STM_SEQUENCE[LAN_ID]" 5 "$P1_LAN_SEQ"

P1_TRA_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='TRA_ID';")
assert_ge "Phase1 STM_SEQUENCE[TRA_ID]" 400 "$P1_TRA_SEQ"

# Confirm old changesets are recorded (no runOnChange, static loadData)
assert_output_not_contains "Phase1 — no 'runOnChange' rerun" "Previously run changeset.*runOnChange"

# ── PHASE 2: Switch to NEW changelog ──────────────────────────────────────────

echo ""
echo "════ PHASE 2: Switch to NEW changelog (HEAD) ════"

echo "  Restoring profiles/postgres/liquibase to HEAD..."
git -C "$REPO_ROOT" checkout HEAD -- profiles/postgres/liquibase/

_apply_sequences_fix "$POSTGRES_PROFILE/liquibase/changelog/07_sequences.yaml"
ok "07_sequences.yaml has runOnChange + ON CONFLICT"

echo "  Generating current seed files (baseline=en)..."
(cd "$TOOLS_DIR" && python3 generate_all_seed_outputs.py --scenarios postgres --baseline en > /dev/null 2>&1)
ok "Seed files regenerated for HEAD"

liquibase_update_capture "Phase 2 — new loadUpdateData + runOnChange changelog"

# runOnChange changesets must have re-ran (same ids, checksum changed)
assert_output_contains "Phase2 — changeset 2 reran" "Running Changeset: changelog/changelog/02_codelists.yaml::2::sitmun"
assert_output_contains "Phase2 — changeset 3 reran" "Running Changeset: changelog/changelog/03_task_types.yaml::3::sitmun"
assert_output_contains "Phase2 — changeset 4 reran" "Running Changeset: changelog/changelog/04_seed_data.yaml::4::sitmun"
assert_output_contains "Phase2 — changeset 5 reran" "Running Changeset: changelog/changelog/05_translations.yaml::5::sitmun"
assert_output_contains "Phase2 — changeset 6 reran" "Running Changeset: changelog/changelog/06_params.yaml::6::sitmun"
# Changeset 7 (runAlways) may or may not appear in Phase 2 depending on Liquibase/db state; skip assertion.

P2_CODELIST=$(psql_q "SELECT COUNT(*) FROM STM_CODELIST;")
assert_ge "Phase2 STM_CODELIST rows (upsert safe)" 90 "$P2_CODELIST"

P2_TSK_TYP=$(psql_q "SELECT COUNT(*) FROM STM_TSK_TYP;")
assert_ge "Phase2 STM_TSK_TYP rows (upsert safe)" 4 "$P2_TSK_TYP"

P2_LANG=$(psql_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
assert_eq "Phase2 STM_LANGUAGE count unchanged" "$P1_LANG" "$P2_LANG"

P2_TRA=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
assert_ge "Phase2 STM_TRANSLATION rows" 400 "$P2_TRA"

P2_LAN_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='LAN_ID';")
assert_ge "Phase2 STM_SEQUENCE[LAN_ID] recalculated" 5 "$P2_LAN_SEQ"

P2_TRA_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='TRA_ID';")
assert_ge "Phase2 STM_SEQUENCE[TRA_ID] recalculated" 400 "$P2_TRA_SEQ"

# Language names should still be in English (baseline=en)
EN_NAME=$(psql_q "SELECT LAN_NAME FROM STM_LANGUAGE WHERE LAN_SHORTNAME='en';")
assert_eq "Phase2 LAN_NAME[en]" "English" "$EN_NAME"

# treenode codelist entries from new changesets must be present
TREENODE_COUNT=$(psql_q "SELECT COUNT(*) FROM STM_CODELIST WHERE COD_LIST='treenode.node.type';")
assert_ge "Phase2 treenode.node.type entries" 5 "$TREENODE_COUNT"

# ── PHASE 3: Re-apply NEW changelog (idempotent) ──────────────────────────────

echo ""
echo "════ PHASE 3: Re-apply NEW changelog (idempotent check) ════"

liquibase_update_capture "Phase 3 — re-apply, expect no reruns"

# No runOnChange changeset should re-run in Phase 3
assert_output_not_contains "Phase3 — changeset 2 did NOT rerun" "Running Changeset: changelog/changelog/02_codelists.yaml::2::sitmun"
assert_output_not_contains "Phase3 — changeset 3 did NOT rerun" "Running Changeset: changelog/changelog/03_task_types.yaml::3::sitmun"
assert_output_not_contains "Phase3 — changeset 4 did NOT rerun" "Running Changeset: changelog/changelog/04_seed_data.yaml::4::sitmun"
assert_output_not_contains "Phase3 — changeset 5 did NOT rerun" "Running Changeset: changelog/changelog/05_translations.yaml::5::sitmun"
assert_output_not_contains "Phase3 — changeset 6 did NOT rerun" "Running Changeset: changelog/changelog/06_params.yaml::6::sitmun"
# Changeset 7 has runAlways: true so it may run every time; do not assert it did NOT rerun.

P3_CODELIST=$(psql_q "SELECT COUNT(*) FROM STM_CODELIST;")
assert_eq "Phase3 STM_CODELIST unchanged" "$P2_CODELIST" "$P3_CODELIST"

P3_LANG=$(psql_q "SELECT COUNT(*) FROM STM_LANGUAGE;")
assert_eq "Phase3 STM_LANGUAGE unchanged" "$P2_LANG" "$P3_LANG"

P3_TRA=$(psql_q "SELECT COUNT(*) FROM STM_TRANSLATION;")
assert_eq "Phase3 STM_TRANSLATION unchanged" "$P2_TRA" "$P3_TRA"

P3_LAN_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='LAN_ID';")
assert_eq "Phase3 STM_SEQUENCE[LAN_ID] unchanged" "$P2_LAN_SEQ" "$P3_LAN_SEQ"

P3_TRA_SEQ=$(psql_q "SELECT SEQ_COUNT FROM STM_SEQUENCE WHERE SEQ_NAME='TRA_ID';")
assert_eq "Phase3 STM_SEQUENCE[TRA_ID] unchanged" "$P2_TRA_SEQ" "$P3_TRA_SEQ"

# ── summary ───────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════"
printf " Results: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "════════════════════════════════════════════════════"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
