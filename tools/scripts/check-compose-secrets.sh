#!/usr/bin/env bash
# Root Compose must refuse to render when the three secrets are unset.
# PostgreSQL and Oracle must start from that root file only.
#
# Uses profiles/postgres.env, which does not assign the secrets. Shell values
# for those names are cleared so a developer .env cannot hide a default.
#
#   bash tools/scripts/check-compose-secrets.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

tmp="$(mktemp)"
cleanup() { rm -f "$tmp"; }
trap cleanup EXIT

grep -v -E '^(SITMUN_USER_SECRET|MIDDLEWARE_SECRET|SITMUN_MBTILES_JOB_HANDLE_SECRET)=' \
  profiles/postgres.env > "$tmp"

set +e
output="$(
  env -u SITMUN_USER_SECRET -u MIDDLEWARE_SECRET -u SITMUN_MBTILES_JOB_HANDLE_SECRET \
    docker compose --env-file "$tmp" config 2>&1
)"
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
  echo "docker compose config succeeded without SITMUN_USER_SECRET, MIDDLEWARE_SECRET, and SITMUN_MBTILES_JOB_HANDLE_SECRET" >&2
  exit 1
fi

if ! grep -q 'is required' <<<"$output"; then
  echo "expected Compose to report that a variable is required" >&2
  printf '%s\n' "$output" >&2
  exit 1
fi

echo "root compose refuses to render without the three secrets"

standalone_fail=0
for path in profiles/postgres/docker-compose.yml profiles/oracle/docker-compose.yml; do
  if [[ -f "$path" ]]; then
    echo "standalone compose file still present: $path" >&2
    standalone_fail=1
  fi
done

if grep -q 'cd profiles/postgres' README.md; then
  echo "README still tells operators to cd profiles/postgres" >&2
  standalone_fail=1
fi

if grep -q 'profiles/postgres/docker-compose.yml' tools/scripts/verify-compose-profiles.sh \
  || grep -q 'profiles/oracle/docker-compose.yml' tools/scripts/verify-compose-profiles.sh; then
  echo "verify-compose-profiles.sh still targets a standalone compose file" >&2
  standalone_fail=1
fi

if [[ "$standalone_fail" -ne 0 ]]; then
  exit 1
fi

echo "root compose is the only postgres and oracle entry point"
