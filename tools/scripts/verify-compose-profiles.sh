#!/usr/bin/env bash
# Verify every committed Docker Compose profile can build and reach healthy.
#
# Does NOT overwrite the operator .env. Uses --env-file with temp copies.
# Requires docker, curl, and bash >= 4. Run from the repo root.
#
# Usage:
#   bash tools/scripts/verify-compose-profiles.sh
#   bash tools/scripts/verify-compose-profiles.sh --skip-oracle   # skip oracle targets
#   bash tools/scripts/verify-compose-profiles.sh --only-build    # build only, no up/down
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

SKIP_ORACLE=false
SKIP_STANDALONE=false
SKIP_BUILD=false
ONLY_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-oracle)      SKIP_ORACLE=true      ;;
    --skip-standalone)  SKIP_STANDALONE=true  ;;
    --skip-build)       SKIP_BUILD=true       ;;
    --only-build)       ONLY_BUILD=true       ;;
  esac
done

# ---------------------------------------------------------------------------
# Counters and helpers
# ---------------------------------------------------------------------------

PASS=0
FAIL=0
ERRORS=()

pass() { echo "[PASS] $*"; PASS=$((PASS + 1)); }
fail() { echo "[FAIL] $*"; FAIL=$((FAIL + 1)); ERRORS+=("$*"); }

# Ephemeral secrets injected for production and standalone profiles (required by :?).
EPHEMERAL_USER_SECRET="verify-compose-profiles-user-secret-32ch"
EPHEMERAL_MIDDLEWARE_SECRET="verify-compose-profiles-middleware-secret-32"

# Project counter using a temp file so it persists across function calls
# (command substitution creates subshells that can't mutate the parent counter).
COUNTER_FILE="$(mktemp)"
echo 0 > "$COUNTER_FILE"

next_project() {
  local n
  n=$(cat "$COUNTER_FILE")
  n=$((n + 1))
  echo "$n" > "$COUNTER_FILE"
  echo "sitmun-verify-$$-${n}"
}

make_env_file() {
  local base="$1" extra="$2" out="$3"
  {
    cat "$base"
    echo "SITMUN_USER_SECRET=${EPHEMERAL_USER_SECRET}"
    echo "MIDDLEWARE_SECRET=${EPHEMERAL_MIDDLEWARE_SECRET}"
    if [[ -n "$extra" ]]; then
      echo "$extra"
    fi
  } > "$out"
}

# Wait for a service to return HTTP 2xx, up to $2 seconds.
wait_healthy() {
  local url="$1" timeout="${2:-120}" elapsed=0
  while ! curl -sf --max-time 5 "$url" > /dev/null 2>&1; do
    sleep 5
    elapsed=$((elapsed + 5))
    if [[ $elapsed -ge $timeout ]]; then
      return 1
    fi
  done
  return 0
}

run_target() {
  local label="$1" env_file="$2" compose_file="${3:-}"
  local project
  project="$(next_project)"
  ACTIVE_PROJECTS+=("$project")

  local compose_args=(-p "$project" --env-file "$env_file")
  if [[ -n "$compose_file" ]]; then
    compose_args+=(-f "$compose_file")
  fi

  echo ""
  echo "=== $label (project: $project) ==="

  if [[ "$ONLY_BUILD" == "true" ]]; then
    pass "$label: build-only mode, skipping up"
    return
  fi

  local up_ok=true
  if ! docker compose "${compose_args[@]}" up -d --wait --timeout 300 2>&1 | tail -5; then
    up_ok=false
  fi

  if [[ "$up_ok" == "false" ]]; then
    fail "$label: up failed"
    docker compose "${compose_args[@]}" down -v --remove-orphans 2>/dev/null || true
    # Remove from active list since we already tore down.
    local new_active=()
    for p in "${ACTIVE_PROJECTS[@]}"; do
      [[ "$p" != "$project" ]] && new_active+=("$p")
    done
    ACTIVE_PROJECTS=("${new_active[@]:-}")
    return
  fi

  # Determine ports from env file (grep exits 1 when no match — use || true to avoid set -e).
  local front_port
  front_port="$(grep -E '^LOCAL_PORT=' "$env_file" | cut -d= -f2 | tr -d '"' | head -1 || true)"
  front_port="${front_port:-9000}"

  local backend_port proxy_port
  if [[ -n "$compose_file" ]]; then
    backend_port=8080
    proxy_port=8081
  else
    backend_port=9001
    proxy_port=9002
  fi

  local ok=true
  if ! wait_healthy "http://localhost:${front_port}/" 60; then
    fail "$label: front not healthy at :${front_port}"
    ok=false
  fi
  if ! wait_healthy "http://localhost:${backend_port}/api/dashboard/health" 120; then
    fail "$label: backend not healthy at :${backend_port}"
    ok=false
  fi
  if ! wait_healthy "http://localhost:${proxy_port}/actuator/health" 60; then
    fail "$label: proxy not healthy at :${proxy_port}"
    ok=false
  fi

  if [[ "$ok" == "true" ]]; then
    pass "$label"
  fi

  docker compose "${compose_args[@]}" down -v --remove-orphans 2>/dev/null || true
  # Remove from active list since teardown is done.
  local new_active=()
  for p in "${ACTIVE_PROJECTS[@]}"; do
    [[ "$p" != "$project" ]] && new_active+=("$p")
  done
  ACTIVE_PROJECTS=("${new_active[@]:-}")
  # Give the Docker daemon a moment to release ports and volumes before the next target.
  sleep 5
}

# ---------------------------------------------------------------------------
# Temp dir for env file copies + project registry for EXIT cleanup
# ---------------------------------------------------------------------------

TMPDIR_ENV="$(mktemp -d)"
ACTIVE_PROJECTS=()

cleanup_all() {
  for proj in "${ACTIVE_PROJECTS[@]:-}"; do
    docker compose -p "$proj" down -v --remove-orphans 2>/dev/null || true
  done
  rm -rf "$TMPDIR_ENV" "$COUNTER_FILE"
}
trap 'cleanup_all' EXIT

# ---------------------------------------------------------------------------
# Build all images (no-cache)
# ---------------------------------------------------------------------------

if [[ "$SKIP_BUILD" == "false" ]]; then
  echo ""
  echo "=== Building images (no-cache) ==="

  if ENVIRONMENT=development docker compose build --no-cache front 2>&1 | tail -3; then
    pass "build: ENVIRONMENT=development front"
  else
    fail "build: ENVIRONMENT=development front"
  fi

  if ENVIRONMENT=production docker compose build --no-cache front 2>&1 | tail -3; then
    pass "build: ENVIRONMENT=production front"
  else
    fail "build: ENVIRONMENT=production front"
  fi

  if docker compose build --no-cache backend proxy 2>&1 | tail -3; then
    pass "build: backend proxy"
  else
    fail "build: backend proxy"
  fi

  if docker compose build --no-cache mbtiles 2>&1 | tail -3; then
    pass "build: mbtiles"
  else
    fail "build: mbtiles"
  fi
else
  echo ""
  echo "=== Building images: skipped (--skip-build) ==="
fi

# ---------------------------------------------------------------------------
# Development targets (root docker-compose.yml, ENVIRONMENT=development)
# ---------------------------------------------------------------------------

echo ""
echo "=== Development targets ==="

make_env_file "profiles/development-postgres.env" "COMPOSE_PROFILES=postgres" \
  "$TMPDIR_ENV/dev-postgres.env"
run_target "dev/postgres" "$TMPDIR_ENV/dev-postgres.env"

make_env_file "profiles/development-postgres.env" "COMPOSE_PROFILES=postgres,demo" \
  "$TMPDIR_ENV/dev-postgres-demo.env"
run_target "dev/postgres+demo" "$TMPDIR_ENV/dev-postgres-demo.env"

make_env_file "profiles/development-postgres.env" "COMPOSE_PROFILES=postgres,mbtiles" \
  "$TMPDIR_ENV/dev-postgres-mbtiles.env"
run_target "dev/postgres+mbtiles" "$TMPDIR_ENV/dev-postgres-mbtiles.env"

make_env_file "profiles/development-postgres.env" "COMPOSE_PROFILES=postgres,demo,mbtiles" \
  "$TMPDIR_ENV/dev-postgres-demo-mbtiles.env"
run_target "dev/postgres+demo+mbtiles" "$TMPDIR_ENV/dev-postgres-demo-mbtiles.env"

make_env_file "profiles/development-postgres.env" "COMPOSE_PROFILES=postgres,dev" \
  "$TMPDIR_ENV/dev-postgres-devalias.env"
run_target "dev/postgres+dev-alias" "$TMPDIR_ENV/dev-postgres-devalias.env"

if [[ "$SKIP_ORACLE" == "false" ]]; then
  make_env_file "profiles/development-oracle.env" "COMPOSE_PROFILES=oracle" \
    "$TMPDIR_ENV/dev-oracle.env"
  run_target "dev/oracle" "$TMPDIR_ENV/dev-oracle.env"

  make_env_file "profiles/development-oracle.env" "COMPOSE_PROFILES=oracle,demo" \
    "$TMPDIR_ENV/dev-oracle-demo.env"
  run_target "dev/oracle+demo" "$TMPDIR_ENV/dev-oracle-demo.env"

  make_env_file "profiles/development-oracle.env" "COMPOSE_PROFILES=oracle,mbtiles" \
    "$TMPDIR_ENV/dev-oracle-mbtiles.env"
  run_target "dev/oracle+mbtiles" "$TMPDIR_ENV/dev-oracle-mbtiles.env"

  make_env_file "profiles/development-oracle.env" "COMPOSE_PROFILES=oracle,demo,mbtiles" \
    "$TMPDIR_ENV/dev-oracle-demo-mbtiles.env"
  run_target "dev/oracle+demo+mbtiles" "$TMPDIR_ENV/dev-oracle-demo-mbtiles.env"
fi

# ---------------------------------------------------------------------------
# Production targets (root docker-compose.yml, ENVIRONMENT=production)
# ---------------------------------------------------------------------------

echo ""
echo "=== Production targets ==="

make_env_file "profiles/postgres.env" "COMPOSE_PROFILES=postgres" \
  "$TMPDIR_ENV/prod-postgres.env"
run_target "prod/postgres" "$TMPDIR_ENV/prod-postgres.env"

make_env_file "profiles/postgres.env" "COMPOSE_PROFILES=postgres,demo" \
  "$TMPDIR_ENV/prod-postgres-demo.env"
run_target "prod/postgres+demo" "$TMPDIR_ENV/prod-postgres-demo.env"

make_env_file "profiles/postgres.env" "COMPOSE_PROFILES=postgres,mbtiles" \
  "$TMPDIR_ENV/prod-postgres-mbtiles.env"
run_target "prod/postgres+mbtiles" "$TMPDIR_ENV/prod-postgres-mbtiles.env"

make_env_file "profiles/postgres.env" "COMPOSE_PROFILES=postgres,demo,mbtiles" \
  "$TMPDIR_ENV/prod-postgres-demo-mbtiles.env"
run_target "prod/postgres+demo+mbtiles" "$TMPDIR_ENV/prod-postgres-demo-mbtiles.env"

make_env_file "profiles/postgres.env" "COMPOSE_PROFILES=postgres,dev" \
  "$TMPDIR_ENV/prod-postgres-devalias.env"
run_target "prod/postgres+dev-alias" "$TMPDIR_ENV/prod-postgres-devalias.env"

if [[ "$SKIP_ORACLE" == "false" ]]; then
  make_env_file "profiles/oracle.env" "COMPOSE_PROFILES=oracle" \
    "$TMPDIR_ENV/prod-oracle.env"
  run_target "prod/oracle" "$TMPDIR_ENV/prod-oracle.env"

  make_env_file "profiles/oracle.env" "COMPOSE_PROFILES=oracle,demo" \
    "$TMPDIR_ENV/prod-oracle-demo.env"
  run_target "prod/oracle+demo" "$TMPDIR_ENV/prod-oracle-demo.env"

  make_env_file "profiles/oracle.env" "COMPOSE_PROFILES=oracle,mbtiles" \
    "$TMPDIR_ENV/prod-oracle-mbtiles.env"
  run_target "prod/oracle+mbtiles" "$TMPDIR_ENV/prod-oracle-mbtiles.env"

  make_env_file "profiles/oracle.env" "COMPOSE_PROFILES=oracle,demo,mbtiles" \
    "$TMPDIR_ENV/prod-oracle-demo-mbtiles.env"
  run_target "prod/oracle+demo+mbtiles" "$TMPDIR_ENV/prod-oracle-demo-mbtiles.env"
fi

# ---------------------------------------------------------------------------
# Standalone profiles (their own docker-compose.yml, no root .env)
# Standalone profiles bind standard ports (8080, 8081, 5432/1521).
# Skip with --skip-standalone if those ports are already in use on the host.
# ---------------------------------------------------------------------------

if [[ "$SKIP_STANDALONE" == "false" ]]; then
  echo ""
  echo "=== Standalone profiles ==="

  make_env_file /dev/null "" "$TMPDIR_ENV/standalone-postgres.env"
  run_target "standalone/profiles/postgres" "$TMPDIR_ENV/standalone-postgres.env" \
    "profiles/postgres/docker-compose.yml"

  if [[ "$SKIP_ORACLE" == "false" ]]; then
    make_env_file /dev/null "" "$TMPDIR_ENV/standalone-oracle.env"
    run_target "standalone/profiles/oracle" "$TMPDIR_ENV/standalone-oracle.env" \
      "profiles/oracle/docker-compose.yml"
  fi
else
  echo ""
  echo "=== Standalone profiles: skipped (--skip-standalone) ==="
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "=== Summary ==="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "  Failures:"
  for e in "${ERRORS[@]}"; do
    echo "    - $e"
  done
  exit 1
fi
echo "  All targets healthy."
