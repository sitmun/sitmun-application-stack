# Ejemplo de migración SITMUN 2 → 3 (Oracle)

SQL Oracle **ilustrativo** que copia un catálogo **núcleo** de SITMUN 2 a un esquema SITMUN 3 Oracle ya evolucionado con Liquibase. No es un ETL de producción (p. ej. DiBa).

## Requisitos previos

1. Oracle 19c+ recomendado (`JSON_OBJECT` / `JSON_ARRAYAGG` con `RETURNING CLOB`).
2. El esquema destino ya creado con el **master Liquibase Oracle completo**:
   [`profiles/oracle/liquibase/master.xml`](../../../profiles/oracle/liquibase/master.xml)
   (`01_schema.oracle.sql` más los incrementos hasta `18_*.sql`).
3. Filas de plataforma ya presentes: codelists, idiomas, `STM_CONF`. **No** las recreéis desde v2.
4. Las tablas de catálogo a migrar (incl. `STM_TSK_TYP`, `STM_GTER_TYP`) están vacías o truncadas. No mezcléis con seed demo de esos tipos.
5. Las tablas origen SITMUN 2 son legibles como `SITMUN2.<tabla>` (véase `00_setup_dblink.sql`).

## Esquema evolucionado (no confiar solo en el `01`)

`01_schema.oracle.sql` solo es el arranque. Cambios posteriores añaden columnas (p. ej. `APP_RESPONSIBLE_INSTITUTION` en `08_application_responsible_institution.sql`).

Antes de migrar:

```text
@05_target_schema_probe.sql
```

Ajustad las listas de columnas de `10_migrate_core.sql` si tras un upgrade de Liquibase aparecen nuevas columnas `NOT NULL`.

Orden de autoridad para las listas de columnas:

1. BD Oracle viva tras el master Liquibase oracle completo
2. Anotaciones JPA `@Column` en `org.sitmun.domain.*`
3. `01_schema.oracle.sql` solo como base histórica

## Orden de ejecución

```text
-- Conectados como usuario destino SITMUN 3
@00_setup_dblink.sql          -- una vez: sinónimos / DB link hacia SITMUN2
@05_target_schema_probe.sql   -- inspeccionar columnas vivas
@06_fk_graph.sql              -- opcional: FK vivas child→parent
@10_migrate_core.sql          -- cargar catálogo núcleo (orden Kahn)
@90_post_checks.sql           -- recuentos y FK huérfanas
```

El orden de los `INSERT` de `10_migrate_core.sql` lo fija un orden topológico sobre el grafo de FK usadas por este ejemplo (`06_topo_order.py`): nivel = 0 sin deps, si no `1 + max(nivel deps)`; dentro del nivel, id lexicográfico.

```bash
python3 tools/examples/sitmun2-to-sitmun3/06_topo_order.py          # listar
python3 tools/examples/sitmun2-to-sitmun3/06_topo_order.py --check   # verificar SQL
python3 tools/examples/sitmun2-to-sitmun3/06_topo_order.py --apply   # reordenar SQL
```

`@06_fk_graph.sql` lista las FK Oracle vivas para contrastar el grafo del script. Seed de plataforma restante (`STM_TER_TYP`, idiomas, codelist, `STM_CONF`) no entra como paso.

Envolved la migración en una transacción y haced `ROLLBACK` en pruebas; `COMMIT` solo cuando las comprobaciones pasen.

## Correspondencia de tablas del núcleo

| SITMUN 2 | SITMUN 3 | Por qué / notas |
|----------|----------|-----------------|
| `STM_CONEXION` | `STM_CONNECT` | Conexiones JDBC para tareas SQL |
| `STM_USUARIO` | `STM_USER` | Contraseñas copiadas tal cual; recalculad hash si el algoritmo cambia |
| `STM_TIPOGRP` | `STM_GTER_TYP` | Antes que territorios; `GTT_NAME` único |
| `STM_ETERRIT` | `STM_TERRITORY` | `TER_CODMUN` → `TER_CODTER`; `TER_CODTGR` → `TER_GTYPID` |
| `STM_GRPTER` | `STM_GRP_TER` | Jerarquía territorio ↔ miembro |
| `STM_ROLES` | `STM_ROLE` + `STM_APP_ROL` | En v3 el rol es independiente de la app; el vínculo pasa a `STM_APP_ROL` |
| `STM_USUCONF` | `STM_USR_CONF` | Clave compuesta v2 → `UCO_ID` surrogate |
| `STM_CARGO` | `STM_POST` | Cargos usuario×territorio; `POS_ID` surrogate |
| `STM_SERVICIO` | `STM_SERVICE` | `SER_TIPO` → `SER_PROTOCOL` |
| `STM_PARAMSER` | `STM_PAR_SER` | Clave compuesta v2 → `PSE_ID` surrogate |
| `STM_CARTO` | `STM_GEOINFO` | Capas / geoinfo |
| `STM_PARAMCAR` | `STM_PAR_GI` | Parámetros de capa |
| `STM_DISPCARTO` | `STM_AVAIL_GI` | Disponibilidad por territorio; `AGI_ID` surrogate |
| `STM_GRPCARTO` | `STM_GRP_GI` | Permisos / fondo / mapa de situación; `GGI_TYPE` = `F`/`C`/`M`/`I` |
| `STM_GCACAR` | `STM_GGI_GI` | Capas del grupo; una capa puede estar en varios grupos |
| `STM_ROLGCA` | `STM_ROL_GGI` | Roles con acceso al grupo |
| `STM_FONDO` | `STM_BACKGRD` | `FON_CODGCA` → `BAC_GGIID` (grupo tipo `F`); `BAC_IMAGE` nuevo en v3 |
| `STM_APPFON` | `STM_APP_BCKG` | Fondos de la app; `ABC_ID` surrogate |
| `STM_GRPTAR` | `STM_GRP_TSK` | Grupos de tareas |
| `STM_TAREA_UI` | `STM_TSK_UI` | Ids de componentes del visor (`TAS_TUIID`); ver [catálogos de referencia](#catálogos-de-referencia-visorplataforma) |
| `STM_TIPOTAREA` | `STM_TSK_TYP` | Ids de tipo de tarea (`TAS_TTASKID`); ver [catálogos de referencia](#catálogos-de-referencia-visorplataforma) |
| `STM_TAREA` | `STM_TASK` | `TAR_CODTTA` → `TAS_TTASKID`; params en `TAS_PARAMS` |
| `STM_PARAMTTA` / `STM_CONSULTA` | dentro de `TAS_PARAMS` | Véase formas JSON más abajo |
| `STM_DISPTAREA` | `STM_AVAIL_TSK` | `ATS_ID` surrogate |
| `STM_ROLTAR` | `STM_ROL_TSK` | Permisos rol–tarea |
| `STM_ARBOL` / `STM_ARBOLNOD` | `STM_TREE` / `STM_TREE_NOD` | Orden topo: `TREE` L0; `TREE_NOD` tras `TREE`+`GEOINFO`+`TASK` |
| `STM_APPS` | `STM_APP` + `STM_APP_TREE` | `APP_CODGCA` → `APP_GGIID` (mapa de situación, tipo `M`) |
| `STM_PARAMAPP` | `STM_PAR_APP` | Parámetros de aplicación (`PAP_CODIGO` → `PAP_ID`) |

Booleanos Oracle: `NUMBER(1,0)` (`0`/`1`). Opcionales sin dato v2 → `0` (false), no `NULL`. Excepción: flags “activo” con `DEFAULT 1` en DDL (p. ej. `TNO_ACTIVE`). Marcas de tiempo: `SYSTIMESTAMP` cuando la columna es obligatoria y el origen es null.

### IDs surrogate con `ROW_NUMBER()`

Donde v2 solo tenía clave compuesta (o ningún id de enlace), v3 exige PK numérica. El ejemplo la genera como `ROW_NUMBER() OVER (ORDER BY …)` → `1..N` determinista; no hay código origen que copiar:

| Destino | Columna generada | Clave v2 / origen |
|---------|------------------|-------------------|
| `STM_PAR_SER` | `PSE_ID` | servicio + tipo + nombre |
| `STM_USR_CONF` | `UCO_ID` | usuario + territorio + rol |
| `STM_APP_BCKG` | `ABC_ID` | app + fondo |
| `STM_APP_TREE` | `ATR_ID` | `APP_CODARB` (sin tabla de enlace) |
| `STM_AVAIL_GI` | `AGI_ID` | territorio + capa |
| `STM_AVAIL_TSK` | `ATS_ID` | territorio + tarea |
| `STM_POST` | `POS_ID` | usuario + territorio |

Tras migrar, `STM_SEQUENCE.SEQ_COUNT` se actualiza a `MAX(id)+1` para esos generadores.

### Catálogos de referencia (visor/plataforma)

No son catálogo de negocio puro: son ids/claves que el **visor o el admin** interpretan. Se migran sobre todo para conservar referencias y revisar/realinear después.

| Origen → destino | Qué identifica | Notas |
|------------------|----------------|-------|
| `STM_TAREA_UI` → `STM_TSK_UI` | Controles/componentes del visor (`TAS_TUIID`, `TUI_TYPE`) | El set v3 puede diferir; ids conservados = utilidad operativa |
| `STM_TIPOTAREA` → `STM_TSK_TYP` | Tipos de tarea del producto (`TAS_TTASKID`) | Sin `TTY_SPEC`/jerarquía v3; hay que alinear con el catálogo oficial |
| `STM_APPS.APP_TEMA` → `APP_THEME` | Tema CSS del visor | Defecto `default` si falta |
| `STM_APPS.APP_TEMPLATE` → `APP_TEMPLATE` | Plantilla de aplicación del visor | Debe existir en el visor v3 |

### Tipos de `STM_GRP_GI` (`GGI_TYPE`)

1. `GCA_TIPO` ya en `F|C|M|I` (mismo código v2/v3) → se conserva
2. Si no: referenciado por `STM_FONDO.FON_CODGCA` → `F`
3. Si no: referenciado por `STM_APPS.APP_CODGCA` → `M`
4. Resto → `C`

## Formas JSON de `TAS_PARAMS` (según el código SITMUN 3)

Almacenamiento: `Task.properties` → `TAS_PARAMS` (CLOB) vía Jackson (`HashMapConverter`).

Identidad en lectura: `variable` > `name` > `label` (`TaskParameterProcessor`).

### Básico legado (tipo id 1, sin `scope`)

`TaskBasicValidator` exige **exactamente** `{name, type, value}` por parámetro (`string|number|boolean|array|object|null`). Claves extra fallan.

### Consulta (`sql-query` / web API)

Hace falta `scope` + habitualmente `command`, y metadatos más ricos (`variable`/`name`, `label`, `type` ∈ `query|template|body`, `required`).

Los placeholders SQL del proxy JDBC solo expanden `${param}` (`SqlUserParametrizationDecorator`). Las plantillas URI HTTP mantienen `{param}`.

Este ejemplo:

- Solo `PARAMTTA` → JSON básico legado
- `STM_CONSULTA` + `TAR_CODCON` → `scope=sql-query`, `command` desde `CNS_SELECT` con `{x}` → `${x}`
- Consulta con aspecto de URL sin conexión → `scope=web-api-query` (ajustable)

La doc de plataforma `docs/parameters-services-layers-tasks.md` puede estar desfasada; preferid los validators/processors Java.

## Fuera de alcance

`STM_DESCARGA`, `STM_TEMATICO` / `STM_TEMRANGO`, `STM_INFORME`, `STM_INFGCA`, favoritos, comentarios, historial de log, tablas i18n / literal-translation, enlaces `STM_TASKREL` de más-info/localizador, dialecto PostgreSQL.

## Comprobaciones post-migración

1. Ejecutad `@90_post_checks.sql` — recuentos origen ≈ destino y cero filas con FK huérfanas.
2. Confirmad `STM_SEQUENCE.SEQ_COUNT` ≥ `MAX(id)+1` para las entidades migradas.
3. Prueba manual: arrancad el backend contra Oracle; abrid Aplicaciones, Territorios y Tareas en el admin.

## No-objetivos

- ETL de producción DiBa
- Recálculo automático de hashes de contraseña
- Fusión dentro de un catálogo seed no vacío
- Regeneración automática del SQL en cada bump de Liquibase
