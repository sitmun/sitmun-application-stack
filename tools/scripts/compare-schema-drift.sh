#!/usr/bin/env bash
# compare-schema-drift.sh
# Apply development (reference) and postgres/oracle (fixable) Liquibase changelogs
# to fresh Docker DBs, dump schema contracts, report PROBLEM/INFO drift, and write
# draft incremental Liquibase YAML to close PROBLEM drifts on the fixable profile.
#
# Usage:
#   bash tools/scripts/compare-schema-drift.sh postgres
#   bash tools/scripts/compare-schema-drift.sh oracle
#   bash tools/scripts/compare-schema-drift.sh both
#   bash tools/scripts/compare-schema-drift.sh dev-dialects
#   bash tools/scripts/compare-schema-drift.sh postgres --against jpa
#   bash tools/scripts/compare-schema-drift.sh postgres --out /tmp/drift-pg
#   bash tools/scripts/compare-schema-drift.sh postgres --fail-on none

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="${1:-postgres}"
shift || true

AGAINST="profiles"
OUT_ROOT=""
FAIL_ON="problem"
CHANGESET_PREFIX="21_schema_drift_fix"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --against) AGAINST="${2:-}"; shift 2 ;;
    --out) OUT_ROOT="${2:-}"; shift 2 ;;
    --fail-on) FAIL_ON="${2:-}"; shift 2 ;;
    --changeset-prefix) CHANGESET_PREFIX="${2:-}"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ "$AGAINST" != "profiles" && "$AGAINST" != "jpa" ]]; then
  echo "--against must be profiles or jpa" >&2
  exit 2
fi

OUT_ROOT="${OUT_ROOT:-$REPO_ROOT/tools/out/schema-drift}"
REPORT_PY="$REPO_ROOT/tools/bin/report_schema_drift.py"
HINTS_PY="$REPO_ROOT/tools/bin/extract_jpa_column_hints.py"
DEV_LB="$REPO_ROOT/profiles/development/backend/liquibase"

PASS=0
FAIL=0
ok()   { echo "  ✓ $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $*"; FAIL=$((FAIL+1)); }

dump_pg_schema() {
  local container="$1" db="$2" user="$3" out_prefix="$4"
  docker exec "$container" psql -U "$user" -d "$db" -v ON_ERROR_STOP=1 -At -F '|' -c "
    SELECT upper(c.table_name), upper(c.column_name), c.data_type,
           COALESCE(c.character_maximum_length::text, ''),
           c.is_nullable,
           COALESCE(replace(c.column_default, E'\n', ' '), '')
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name LIKE 'stm_%'
    ORDER BY 1, 2;
  " > "${out_prefix}.columns"

  docker exec "$container" psql -U "$user" -d "$db" -v ON_ERROR_STOP=1 -At -F '|' -c "
    SELECT upper(tc.table_name),
           CASE tc.constraint_type
             WHEN 'PRIMARY KEY' THEN 'PK'
             WHEN 'UNIQUE' THEN 'UK'
             ELSE tc.constraint_type
           END,
           string_agg(upper(kcu.column_name), ',' ORDER BY kcu.ordinal_position),
           '',
           '',
           tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
     AND tc.constraint_name = kcu.constraint_name
     AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name LIKE 'stm_%'
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    GROUP BY tc.table_name, tc.constraint_type, tc.constraint_name
    ORDER BY 1, 2, 6;
  " > "${out_prefix}.constraints"

  docker exec "$container" psql -U "$user" -d "$db" -v ON_ERROR_STOP=1 -At -F '|' -c "
    SELECT
      upper(kcu.table_name),
      'FK',
      string_agg(upper(kcu.column_name), ',' ORDER BY kcu.ordinal_position),
      upper(ccu.table_name),
      string_agg(upper(ccu.column_name), ',' ORDER BY kcu.ordinal_position),
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_schema = kcu.constraint_schema
     AND tc.constraint_name = kcu.constraint_name
     AND tc.table_name = kcu.table_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_schema = tc.constraint_schema
     AND ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name LIKE 'stm_%'
      AND tc.constraint_type = 'FOREIGN KEY'
    GROUP BY kcu.table_name, ccu.table_name, tc.constraint_name
    ORDER BY 1, 6;
  " >> "${out_prefix}.constraints"

  if [[ ! -s "${out_prefix}.columns" ]]; then
    echo "ERROR: empty column dump for ${out_prefix}" >&2
    return 1
  fi
}

liquibase_pg() {
  local network="$1" host="$2" db="$3" user="$4" pass="$5" changelog_dir="$6"
  local contexts="${7:-}"
  if [[ -n "$contexts" ]]; then
    docker run --rm \
      --network "$network" \
      -v "$changelog_dir:/liquibase/changelog:ro" \
      liquibase/liquibase:4.29 \
      --url="jdbc:postgresql://${host}:5432/${db}" \
      --username="$user" \
      --password="$pass" \
      --changeLogFile="changelog/master.xml" \
      --contexts="$contexts" \
      update
  else
    docker run --rm \
      --network "$network" \
      -v "$changelog_dir:/liquibase/changelog:ro" \
      liquibase/liquibase:4.29 \
      --url="jdbc:postgresql://${host}:5432/${db}" \
      --username="$user" \
      --password="$pass" \
      --changeLogFile="changelog/master.xml" \
      update
  fi
}

run_jpa_pg() {
  local network="$1" host="$2" db="$3" user="$4" pass="$5"
  local backend="$REPO_ROOT/back/backend/sitmun-backend-core"
  if [[ ! -d "$backend" ]]; then
    echo "sitmun-backend-core missing; cannot --against jpa" >&2
    return 2
  fi
  (
    cd "$backend"
    ./gradlew --quiet bootRun \
      -Dspring-boot.run.arguments="--spring.main.web-application-type=none" \
      -Dspring.liquibase.enabled=false \
      -Dspring.jpa.hibernate.ddl-auto=create \
      -Dspring.datasource.url="jdbc:postgresql://${host}:5432/${db}" \
      -Dspring.datasource.username="$user" \
      -Dspring.datasource.password="$pass" \
      -Dspring.datasource.driver-class-name=org.postgresql.Driver \
      -Dspring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect \
      >/tmp/sitmun-jpa-schema-export.log 2>&1 &
    local pid=$!
    # Wait until STM_APP exists or timeout
    for _ in $(seq 1 90); do
      if docker exec "$host" psql -U "$user" -d "$db" -At -c \
        "SELECT 1 FROM information_schema.tables WHERE table_name='stm_app'" 2>/dev/null | grep -q 1; then
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
        return 0
      fi
      if ! kill -0 "$pid" 2>/dev/null; then
        wait "$pid" || true
        echo "JPA export process exited early; see /tmp/sitmun-jpa-schema-export.log" >&2
        return 1
      fi
      sleep 2
    done
    kill "$pid" 2>/dev/null || true
    echo "Timed out waiting for Hibernate schema" >&2
    return 1
  )
}

run_postgres() {
  local CONTAINER=sitmun_drift_pg
  local NETWORK=sitmun_drift_pg_net
  local DB_USER=sitmun3
  local DB_PASS=sitmun3
  local OUT="$OUT_ROOT/postgres"
  local PROD_LB="$REPO_ROOT/profiles/postgres/liquibase"
  mkdir -p "$OUT"

  echo ""
  echo "════════════════════════════════════════════════════"
  echo " PostgreSQL schema drift (against=$AGAINST)"
  echo "════════════════════════════════════════════════════"

  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
  docker network create "$NETWORK"
  docker run -d --name "$CONTAINER" --network "$NETWORK" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -e POSTGRES_DB=postgres \
    postgres:16-alpine >/dev/null

  # wait ready
  for _ in $(seq 1 60); do
    if docker exec "$CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE sitmun_ref;"
  docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE sitmun_fix;"

  if [[ "$AGAINST" == "jpa" ]]; then
    # Reference via Hibernate; fixable = postgres Liquibase
    # bootRun needs host network name resolvable from host — use published port instead
    local PORT
    PORT=$(docker inspect -f '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$CONTAINER" 2>/dev/null || true)
    if [[ -z "$PORT" ]]; then
      docker rm -f "$CONTAINER"
      docker run -d --name "$CONTAINER" --network "$NETWORK" \
        -p 55432:5432 \
        -e POSTGRES_USER="$DB_USER" \
        -e POSTGRES_PASSWORD="$DB_PASS" \
        -e POSTGRES_DB=postgres \
        postgres:16-alpine >/dev/null
      for _ in $(seq 1 60); do
        docker exec "$CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1 && break
        sleep 1
      done
      docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE sitmun_ref;"
      docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE sitmun_fix;"
      PORT=55432
    fi
    echo "── Hibernate ddl-auto=create → sitmun_ref ──"
    (
      cd "$REPO_ROOT/back/backend/sitmun-backend-core"
      ./gradlew --quiet bootRun \
        --args="--spring.main.web-application-type=none --spring.main.lazy-initialization=true" \
        -Dspring.liquibase.enabled=false \
        -Dspring.jpa.hibernate.ddl-auto=create \
        -Dspring.datasource.url="jdbc:postgresql://127.0.0.1:${PORT}/sitmun_ref" \
        -Dspring.datasource.username="$DB_USER" \
        -Dspring.datasource.password="$DB_PASS" \
        >/tmp/sitmun-jpa-schema-export.log 2>&1 &
      local pid=$!
      for _ in $(seq 1 120); do
        if docker exec "$CONTAINER" psql -U "$DB_USER" -d sitmun_ref -At -c \
          "SELECT 1 FROM information_schema.tables WHERE table_name='stm_app'" 2>/dev/null | grep -q 1; then
          kill "$pid" 2>/dev/null || true
          wait "$pid" 2>/dev/null || true
          break
        fi
        if ! kill -0 "$pid" 2>/dev/null; then
          echo "JPA export failed; log:" >&2
          tail -50 /tmp/sitmun-jpa-schema-export.log >&2 || true
          return 1
        fi
        sleep 2
      done
    )
    echo "── Liquibase postgres profile → sitmun_fix ──"
    liquibase_pg "$NETWORK" "$CONTAINER" sitmun_fix "$DB_USER" "$DB_PASS" "$PROD_LB"
  else
    echo "── Liquibase development (contexts=dev) → sitmun_ref ──"
    liquibase_pg "$NETWORK" "$CONTAINER" sitmun_ref "$DB_USER" "$DB_PASS" "$DEV_LB" "dev"
    echo "── Liquibase postgres profile → sitmun_fix ──"
    liquibase_pg "$NETWORK" "$CONTAINER" sitmun_fix "$DB_USER" "$DB_PASS" "$PROD_LB"
  fi

  dump_pg_schema "$CONTAINER" sitmun_ref "$DB_USER" "$OUT/left"
  dump_pg_schema "$CONTAINER" sitmun_fix "$DB_USER" "$OUT/right"

  local hints="$OUT/jpa_hints.json"
  python3 "$HINTS_PY" --out "$hints" || true

  local mode_arg="profiles"
  local left_label="development"
  if [[ "$AGAINST" == "jpa" ]]; then
    mode_arg="jpa"
    left_label="jpa"
  fi

  set +e
  python3 "$REPORT_PY" \
    --left-columns "$OUT/left.columns" \
    --right-columns "$OUT/right.columns" \
    --left-constraints "$OUT/left.constraints" \
    --right-constraints "$OUT/right.constraints" \
    --left-label "$left_label" \
    --right-label "postgres" \
    --mode "$mode_arg" \
    --dbms postgresql \
    --out-dir "$OUT" \
    --changeset-prefix "$CHANGESET_PREFIX" \
    --hints "$hints" \
    --fail-on "$FAIL_ON"
  local rc=$?
  set -e

  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true

  if [[ $rc -eq 0 ]]; then
    ok "postgres drift report exit 0"
  else
    fail "postgres drift report exit $rc (drafts still under $OUT)"
  fi
  return "$rc"
}

dump_oracle_schema() {
  local container="$1" user="$2" pass="$3" service="$4" out_prefix="$5"
  local connect="${user}/${pass}@//localhost:1521/${service}"
  docker exec "$container" bash -c "echo \"
SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF LINESIZE 32767 LONG 100000 WRAP OFF
SELECT table_name||'|'||column_name||'|'||data_type||'|'||
       NVL(TO_CHAR(CASE WHEN data_type IN ('VARCHAR2','NVARCHAR2','CHAR','NCHAR')
                        THEN char_length ELSE data_length END),'')||'|'||
       CASE nullable WHEN 'N' THEN 'NO' WHEN 'Y' THEN 'YES' ELSE nullable END||'|'
FROM user_tab_columns
WHERE table_name LIKE 'STM_%'
ORDER BY table_name, column_name;
\" | sqlplus -s ${connect}" > "${out_prefix}.columns"

  docker exec "$container" bash -c "echo \"
SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF LINESIZE 32767 LONG 100000 WRAP OFF
SELECT acc.table_name||'|'||
       CASE ac.constraint_type WHEN 'P' THEN 'PK' WHEN 'U' THEN 'UK' END||'|'||
       LISTAGG(acc.column_name, ',') WITHIN GROUP (ORDER BY acc.position)||'|||'||ac.constraint_name
FROM user_constraints ac
JOIN user_cons_columns acc ON ac.constraint_name = acc.constraint_name
WHERE ac.constraint_type IN ('P','U')
  AND ac.table_name LIKE 'STM_%'
GROUP BY acc.table_name, ac.constraint_type, ac.constraint_name
ORDER BY 1;
\" | sqlplus -s ${connect}" > "${out_prefix}.constraints"

  docker exec "$container" bash -c "echo \"
SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF LINESIZE 32767 LONG 100000 WRAP OFF
SELECT acc.table_name||'|FK|'||
       LISTAGG(acc.column_name, ',') WITHIN GROUP (ORDER BY acc.position)||'|'||
       r.table_name||'|'||
       LISTAGG(rcc.column_name, ',') WITHIN GROUP (ORDER BY acc.position)||'|'||
       ac.constraint_name
FROM user_constraints ac
JOIN user_cons_columns acc ON ac.constraint_name = acc.constraint_name
JOIN user_constraints r ON ac.r_constraint_name = r.constraint_name
JOIN user_cons_columns rcc ON r.constraint_name = rcc.constraint_name AND rcc.position = acc.position
WHERE ac.constraint_type = 'R'
  AND ac.table_name LIKE 'STM_%'
GROUP BY acc.table_name, r.table_name, ac.constraint_name
ORDER BY 1;
\" | sqlplus -s ${connect}" >> "${out_prefix}.constraints"

  if ! grep -q '^STM_' "${out_prefix}.columns" 2>/dev/null; then
    echo "ERROR: oracle column dump failed for ${out_prefix}:" >&2
    head -20 "${out_prefix}.columns" >&2 || true
    return 1
  fi
}

liquibase_oracle() {
  local network="$1" host="$2" user="$3" pass="$4" service="$5" changelog_dir="$6"
  local contexts="${7:-}"
  if [[ -n "$contexts" ]]; then
    docker run --rm \
      --network "$network" \
      -v "$changelog_dir:/liquibase/changelog:ro" \
      liquibase/liquibase:4.29 \
      --url="jdbc:oracle:thin:@//${host}:1521/${service}" \
      --username="$user" \
      --password="$pass" \
      --changeLogFile="changelog/master.xml" \
      --contexts="$contexts" \
      update
  else
    docker run --rm \
      --network "$network" \
      -v "$changelog_dir:/liquibase/changelog:ro" \
      liquibase/liquibase:4.29 \
      --url="jdbc:oracle:thin:@//${host}:1521/${service}" \
      --username="$user" \
      --password="$pass" \
      --changeLogFile="changelog/master.xml" \
      update
  fi
}

run_oracle() {
  local CONTAINER=sitmun_drift_ora
  local NETWORK=sitmun_drift_ora_net
  local SYS_PASS=OraclePassword123
  local OUT="$OUT_ROOT/oracle"
  local PROD_LB="$REPO_ROOT/profiles/oracle/liquibase"
  local SERVICE=FREEPDB1
  mkdir -p "$OUT"

  if [[ "$AGAINST" == "jpa" ]]; then
    echo "Oracle --against jpa not implemented in v1 (use profiles mode)." >&2
    return 2
  fi

  echo ""
  echo "════════════════════════════════════════════════════"
  echo " Oracle schema drift (against=$AGAINST)"
  echo "════════════════════════════════════════════════════"

  docker rm -f "$CONTAINER" 2>/dev/null || true
  docker network rm "$NETWORK" 2>/dev/null || true
  docker network create "$NETWORK"
  docker run -d --name "$CONTAINER" --network "$NETWORK" \
    -e ORACLE_PASSWORD="$SYS_PASS" \
    gvenzl/oracle-free:23-slim >/dev/null

  echo "Waiting for Oracle..."
  for _ in $(seq 1 120); do
    if docker exec "$CONTAINER" healthcheck.sh >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done

  # Create two schemas
  docker exec "$CONTAINER" bash -c "echo \"
ALTER SESSION SET CONTAINER=FREEPDB1;
CREATE USER sitmun_ref IDENTIFIED BY sitmun3 QUOTA UNLIMITED ON USERS;
GRANT CONNECT, RESOURCE TO sitmun_ref;
CREATE USER sitmun_fix IDENTIFIED BY sitmun3 QUOTA UNLIMITED ON USERS;
GRANT CONNECT, RESOURCE TO sitmun_fix;
\" | sqlplus -s sys/${SYS_PASS} as sysdba"

  echo "── Liquibase development (contexts=dev) → sitmun_ref ──"
  liquibase_oracle "$NETWORK" "$CONTAINER" sitmun_ref sitmun3 "$SERVICE" "$DEV_LB" "dev"
  echo "── Liquibase oracle profile → sitmun_fix ──"
  liquibase_oracle "$NETWORK" "$CONTAINER" sitmun_fix sitmun3 "$SERVICE" "$PROD_LB"

  dump_oracle_schema "$CONTAINER" sitmun_ref sitmun3 "$SERVICE" "$OUT/left"
  dump_oracle_schema "$CONTAINER" sitmun_fix sitmun3 "$SERVICE" "$OUT/right"

  local hints="$OUT/jpa_hints.json"
  python3 "$HINTS_PY" --out "$hints" || true

  set +e
  python3 "$REPORT_PY" \
    --left-columns "$OUT/left.columns" \
    --right-columns "$OUT/right.columns" \
    --left-constraints "$OUT/left.constraints" \
    --right-constraints "$OUT/right.constraints" \
    --left-label "development" \
    --right-label "oracle" \
    --mode profiles \
    --dbms oracle \
    --out-dir "$OUT" \
    --changeset-prefix "$CHANGESET_PREFIX" \
    --hints "$hints" \
    --fail-on "$FAIL_ON"
  local rc=$?
  set -e

  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true

  if [[ $rc -eq 0 ]]; then
    ok "oracle drift report exit 0"
  else
    fail "oracle drift report exit $rc (drafts still under $OUT)"
  fi
  return "$rc"
}

run_dev_dialects() {
  # Compare development Liquibase final schema: postgresql (left) vs oracle (right).
  # h2 is ephemeral in apps/tests; gaps for h2 are covered by 68 inventory + Gradle.
  local PG_CONTAINER=sitmun_drift_dev_pg
  local ORA_CONTAINER=sitmun_drift_dev_ora
  local PG_NETWORK=sitmun_drift_dev_pg_net
  local ORA_NETWORK=sitmun_drift_dev_ora_net
  local DB_USER=sitmun3
  local DB_PASS=sitmun3
  local SYS_PASS=OraclePassword123
  local SERVICE=FREEPDB1
  local OUT="$OUT_ROOT/dev-dialects"
  mkdir -p "$OUT"

  echo ""
  echo "════════════════════════════════════════════════════"
  echo " Development dialect drift (postgresql vs oracle)"
  echo "════════════════════════════════════════════════════"

  docker rm -f "$PG_CONTAINER" "$ORA_CONTAINER" 2>/dev/null || true
  docker network rm "$PG_NETWORK" "$ORA_NETWORK" 2>/dev/null || true

  docker network create "$PG_NETWORK"
  docker run -d --name "$PG_CONTAINER" --network "$PG_NETWORK" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -e POSTGRES_DB=postgres \
    postgres:16-alpine >/dev/null

  for _ in $(seq 1 60); do
    docker exec "$PG_CONTAINER" pg_isready -U "$DB_USER" >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec "$PG_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE sitmun_dev;"

  echo "── Liquibase development (postgresql, contexts=dev) ──"
  liquibase_pg "$PG_NETWORK" "$PG_CONTAINER" sitmun_dev "$DB_USER" "$DB_PASS" "$DEV_LB" "dev"
  dump_pg_schema "$PG_CONTAINER" sitmun_dev "$DB_USER" "$OUT/left"

  docker network create "$ORA_NETWORK"
  docker run -d --name "$ORA_CONTAINER" --network "$ORA_NETWORK" \
    -e ORACLE_PASSWORD="$SYS_PASS" \
    gvenzl/oracle-free:23-slim >/dev/null

  echo "Waiting for Oracle..."
  for _ in $(seq 1 120); do
    docker exec "$ORA_CONTAINER" healthcheck.sh >/dev/null 2>&1 && break
    sleep 5
  done

  docker exec "$ORA_CONTAINER" bash -c "echo \"
ALTER SESSION SET CONTAINER=FREEPDB1;
CREATE USER sitmun_dev IDENTIFIED BY sitmun3 QUOTA UNLIMITED ON USERS;
GRANT CONNECT, RESOURCE TO sitmun_dev;
\" | sqlplus -s sys/${SYS_PASS} as sysdba"

  echo "── Liquibase development (oracle, contexts=dev) ──"
  liquibase_oracle "$ORA_NETWORK" "$ORA_CONTAINER" sitmun_dev sitmun3 "$SERVICE" "$DEV_LB" "dev"
  dump_oracle_schema "$ORA_CONTAINER" sitmun_dev sitmun3 "$SERVICE" "$OUT/right"

  local hints="$OUT/jpa_hints.json"
  python3 "$HINTS_PY" --out "$hints" || true

  set +e
  python3 "$REPORT_PY" \
    --left-columns "$OUT/left.columns" \
    --right-columns "$OUT/right.columns" \
    --left-constraints "$OUT/left.constraints" \
    --right-constraints "$OUT/right.constraints" \
    --left-label "development-postgresql" \
    --right-label "development-oracle" \
    --mode profiles \
    --dbms oracle \
    --out-dir "$OUT" \
    --changeset-prefix "67_dev_dialect_drift_fix" \
    --hints "$hints" \
    --fail-on "$FAIL_ON"
  local rc=$?
  set -e

  docker rm -f "$PG_CONTAINER" "$ORA_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$PG_NETWORK" "$ORA_NETWORK" >/dev/null 2>&1 || true

  if [[ $rc -eq 0 ]]; then
    ok "dev-dialects drift report exit 0"
  else
    fail "dev-dialects drift report exit $rc (drafts still under $OUT)"
  fi
  return "$rc"
}

OVERALL=0
case "$TARGET" in
  postgres)
    run_postgres || OVERALL=$?
    ;;
  oracle)
    run_oracle || OVERALL=$?
    ;;
  both)
    run_postgres || OVERALL=$?
    run_oracle || OVERALL=$?
    ;;
  dev-dialects)
    run_dev_dialects || OVERALL=$?
    ;;
  *)
    echo "Usage: $0 postgres|oracle|both|dev-dialects [--against profiles|jpa] [--out DIR] [--fail-on problem|any|none]" >&2
    exit 2
    ;;
esac

echo ""
echo "Done. Drafts under $OUT_ROOT (review YAML, then add MASTER_INCLUDE.txt line to master.xml)."
exit "$OVERALL"
