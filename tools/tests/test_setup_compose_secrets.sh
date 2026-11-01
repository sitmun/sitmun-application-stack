#!/usr/bin/env bash
# A copied profile .env has the three secret names only as comments.
# setup must append values without replacing one that is already set.
#
#   bash tools/tests/test_setup_compose_secrets.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

assert_generated() {
  local file="$1" key="$2"
  if ! grep -qE "^${key}=[0-9a-f]{64}$" "$file"; then
    echo "missing generated ${key} in ${file}" >&2
    exit 1
  fi
}

run_copy() {
  local dir="$1"
  (
    cd "$dir"
    # shellcheck disable=SC1091
    source "$ROOT/setup.sh"
    copy_env_file_if_missing
  )
}

copied="$work/copied"
mkdir -p "$copied"
cp "$ROOT/profiles/postgres.env" "$copied/.env"
run_copy "$copied"
for key in SITMUN_USER_SECRET MIDDLEWARE_SECRET SITMUN_MBTILES_JOB_HANDLE_SECRET; do
  assert_generated "$copied/.env" "$key"
done

kept="$work/kept"
mkdir -p "$kept"
cp "$ROOT/profiles/postgres.env" "$kept/.env"
printf '\nSITMUN_USER_SECRET=kept-value-0123456789abcdef0123456789abcd\n' >> "$kept/.env"
run_copy "$kept"
if ! grep -qx 'SITMUN_USER_SECRET=kept-value-0123456789abcdef0123456789abcd' "$kept/.env"; then
  echo "existing SITMUN_USER_SECRET was replaced" >&2
  exit 1
fi
if [[ "$(grep -c '^SITMUN_USER_SECRET=' "$kept/.env")" -ne 1 ]]; then
  echo "SITMUN_USER_SECRET was duplicated" >&2
  exit 1
fi
assert_generated "$kept/.env" MIDDLEWARE_SECRET
assert_generated "$kept/.env" SITMUN_MBTILES_JOB_HANDLE_SECRET

created="$work/created"
mkdir -p "$created/profiles"
cp "$ROOT/profiles/development-postgres.env" "$created/profiles/development-postgres.env"
run_copy "$created"
if ! grep -qx 'COMPOSE_PROFILES=postgres' "$created/.env"; then
  echo "missing .env was not created from profiles/development-postgres.env" >&2
  exit 1
fi
for key in SITMUN_USER_SECRET MIDDLEWARE_SECRET SITMUN_MBTILES_JOB_HANDLE_SECRET; do
  assert_generated "$created/.env" "$key"
done

if grep -q 'openssl rand' "$ROOT/README.md"; then
  echo "README still tells operators to run openssl" >&2
  exit 1
fi

if grep -q 'openssl rand' "$ROOT"/profiles/*.env; then
  echo "a profile env template still tells operators to run openssl" >&2
  exit 1
fi

echo "setup appends the three compose secrets when .env already exists"
