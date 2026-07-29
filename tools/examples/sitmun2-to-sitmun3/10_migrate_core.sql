-- Migración del catálogo núcleo SITMUN 2 → 3 (ejemplo Oracle).
-- Haced COMMIT solo después de 90_post_checks.sql.
--
-- Convenciones usadas en todo el fichero:
--   SUBSTR(..., 1, N)  → defensivo frente a ORA-12899: N = tope v3; longitudes v2
--                        se infieren del .hbm.xml y pueden no coincidir con el DDL real
--   NVL(bool, 0) / 0   → booleanos opcionales: null origen o sin dato v2 → 0 (false);
--                        NOT NULL con semántica “activo” pueden usar defecto 1 (p. ej. TNO_ACTIVE)
--   EXISTS (...)       → no insertar filas que romperían FK hacia filas ya filtradas
--   ROW_NUMBER()       → genera el ID surrogate nuevo en v3 (1..N) donde v2 solo
--                        tenía clave compuesta o ningún id propio; el ORDER BY fija
--                        un orden determinista, no copia un código origen
--   [nuevo en v3]      → columna (o semántica) sin equivalente en el .hbm.xml de v2;
--                        valor NULL/defecto explícito, no hay dato origen que mapear
--   -- → COL_DESTINO   → columna v3 del INSERT (alineado en columna 81); anotad siempre
--                        para localizar ORA-01400/12899/etc.

-- Orden de INSERT (topo por nivel de FK; ver 06_topo_order.py).
-- Regenerar: python3 06_topo_order.py --apply
--
--   01. [L0] STM_CONNECT  ← ∅
--   02. [L0] STM_GRP_GI  ← ∅
--   03. [L0] STM_GRP_TSK  ← ∅
--   04. [L0] STM_GTER_TYP  ← ∅
--   05. [L0] STM_ROLE  ← ∅
--   06. [L0] STM_SERVICE  ← ∅
--   07. [L0] STM_TREE  ← ∅
--   08. [L0] STM_TSK_TYP  ← ∅
--   09. [L0] STM_TSK_UI  ← ∅
--   10. [L0] STM_USER  ← ∅
--   11. [L1] STM_APP  ← STM_GRP_GI
--   12. [L1] STM_BACKGRD  ← STM_GRP_GI
--   13. [L1] STM_GEOINFO  ← STM_CONNECT, STM_SERVICE
--   14. [L1] STM_PAR_SER  ← STM_SERVICE
--   15. [L1] STM_ROL_GGI  ← STM_GRP_GI, STM_ROLE
--   16. [L1] STM_TERRITORY  ← STM_GTER_TYP
--   17. [L2] STM_APP_BCKG  ← STM_APP, STM_BACKGRD
--   18. [L2] STM_APP_ROL  ← STM_APP, STM_ROLE
--   19. [L2] STM_APP_TREE  ← STM_APP, STM_TREE
--   20. [L2] STM_AVAIL_GI  ← STM_GEOINFO, STM_TERRITORY
--   21. [L2] STM_GGI_GI  ← STM_GEOINFO, STM_GRP_GI
--   22. [L2] STM_GRP_TER  ← STM_TERRITORY
--   23. [L2] STM_PAR_APP  ← STM_APP
--   24. [L2] STM_PAR_GI  ← STM_GEOINFO
--   25. [L2] STM_POST  ← STM_TERRITORY, STM_USER
--   26. [L2] STM_TASK  ← STM_CONNECT, STM_GEOINFO, STM_GRP_TSK, STM_SERVICE, STM_TSK_TYP, STM_TSK_UI
--   27. [L2] STM_USR_CONF  ← STM_ROLE, STM_TERRITORY, STM_USER
--   28. [L3] STM_AVAIL_TSK  ← STM_TASK, STM_TERRITORY
--   29. [L3] STM_ROL_TSK  ← STM_ROLE, STM_TASK
--   30. [L3] STM_TREE_NOD  ← STM_GEOINFO, STM_TASK, STM_TREE
--   31. [L4] STM_SEQUENCE  ← (todos los pasos previos)
SET DEFINE OFF
-- Por qué: evita que SQL*Plus interprete & dentro de literales/JSON.
WHENEVER SQLERROR EXIT SQL.SQLCODE
-- Por qué: detiene la migración en el primer error en lugar de continuar a medias.

PROMPT === STM_CONNECT (desde STM_CONEXION) ===
INSERT INTO STM_CONNECT (CON_ID, CON_NAME, CON_DRIVER, CON_USER, CON_PWD, CON_CONNECTION)
SELECT c.CON_CODIGO,                                                            -- → CON_ID
       -- SUBSTR defensivo: el tope N es el de v3 (VARCHAR2(N CHAR)). En el .hbm.xml de v2
       -- estas columnas ya tenían 80/50/50/50/250, pero no sabemos si en producción el DDL
       -- real se mantuvo igual; si v2 es más largo, sin truncar Oracle lanza ORA-12899.
       SUBSTR(c.CON_NOMBRE, 1, 80),                                             -- → CON_NAME
       SUBSTR(c.CON_DRIVER, 1, 50),                                             -- → CON_DRIVER
       SUBSTR(c.CON_USUARIO, 1, 50),                                            -- → CON_USER
       SUBSTR(c.CON_PASSWORD, 1, 50),                                           -- → CON_PWD
       SUBSTR(c.CON_CONSTRING, 1, 250)                                          -- → CON_CONNECTION
  FROM SITMUN2.STM_CONEXION c;

PROMPT === STM_GRP_GI (desde STM_GRPCARTO) ===
-- GGI_TYPE codelist: F=fondo, C=grupo cartografía, M=mapa de situación, I=informe.
INSERT INTO STM_GRP_GI (GGI_ID, GGI_NAME, GGI_TYPE)
SELECT g.GCA_CODIGO,                                                            -- → GGI_ID
       SUBSTR(g.GCA_NOMBRE, 1, 80),                                             -- → GGI_NAME
       CASE                                                                     -- → GGI_TYPE
         -- Si GCA_TIPO ya es código v3 (F/C/M/I), conservarlo.
         WHEN UPPER(TRIM(g.GCA_TIPO)) IN ('F', 'C', 'M', 'I')
           THEN UPPER(TRIM(g.GCA_TIPO))
         -- Si no, inferir por uso en v2. Estas heurísticas no son perfectas pero ayudan.
         WHEN EXISTS (
                SELECT 1 FROM SITMUN2.STM_FONDO f WHERE f.FON_CODGCA = g.GCA_CODIGO
              )
           THEN 'F'
         WHEN EXISTS (
                SELECT 1 FROM SITMUN2.STM_APPS a WHERE a.APP_CODGCA = g.GCA_CODIGO
              )
           THEN 'M'
         ELSE 'C'
       END
  FROM SITMUN2.STM_GRPCARTO g;

PROMPT === STM_GRP_TSK (desde STM_GRPTAR) ===
INSERT INTO STM_GRP_TSK (GTS_ID, GTS_NAME)
SELECT g.GTA_CODIGO,                                                            -- → GTS_ID
       SUBSTR(g.GTA_NOMBRE, 1, 80)                                              -- → GTS_NAME
  FROM SITMUN2.STM_GRPTAR g;

PROMPT === STM_GTER_TYP (desde STM_TIPOGRP) ===
-- Por qué antes de territorios: TER_GTYPID referencia GTT_ID.
INSERT INTO STM_GTER_TYP (GTT_ID, GTT_NAME)
SELECT t.TGR_CODIGO,                                                            -- → GTT_ID
       SUBSTR(                                                                  -- → GTT_NAME (único; desambiguar con id si hace falta)
         CASE
           WHEN COUNT(*) OVER (
                  PARTITION BY NVL(t.TGR_NOMBRE, 'gter-' || t.TGR_CODIGO)
                ) > 1
             THEN NVL(t.TGR_NOMBRE, 'gter-' || t.TGR_CODIGO)
                  || ' (' || t.TGR_CODIGO || ')'
           ELSE NVL(t.TGR_NOMBRE, 'gter-' || t.TGR_CODIGO)
         END,
         1, 250)
  FROM SITMUN2.STM_TIPOGRP t;

PROMPT === STM_ROLE (desde STM_ROLES) ===
-- Por qué sin ROL_CODAPP aquí: en v3 el rol es independiente; el vínculo app va a STM_APP_ROL.
INSERT INTO STM_ROLE (ROL_ID, ROL_NAME, ROL_NOTE)
SELECT r.ROL_CODIGO,                                                            -- → ROL_ID
       SUBSTR(                                                                  -- → ROL_NAME
         CASE
           -- Por qué desambiguar: STM_ROL_NAME_UK exige ROL_NAME único; en v2 el mismo
           -- nombre podía repetirse en apps distintas.
           WHEN COUNT(*) OVER (PARTITION BY NVL(r.ROL_NOMBRE, 'rol')) > 1
             THEN NVL(r.ROL_NOMBRE, 'rol') || ' (' || r.ROL_CODIGO || ')'
           -- Defecto 'rol-'||id: ROL_NAME NOT NULL; ROL_NOMBRE puede ser null en v2.
           ELSE NVL(r.ROL_NOMBRE, 'rol-' || r.ROL_CODIGO)
         END,
         1, 250),
       SUBSTR(r.ROL_OBSERV, 1, 500)                                             -- → ROL_NOTE
  FROM SITMUN2.STM_ROLES r;

PROMPT === STM_SERVICE (desde STM_SERVICIO) ===
INSERT INTO STM_SERVICE (
  SER_ID, SER_NAME, SER_ABSTRACT, SER_URL, SER_PROJECTS, SER_LEGEND, SER_INFOURL,
  SER_CREATED, SER_PROTOCOL, SER_NAT_PROT, SER_BLOCKED, SER_PROXIED,
  SER_AUTH_MOD, SER_USER, SER_PWD
)
SELECT s.SER_CODIGO,                                                            -- → SER_ID
       SUBSTR(s.SER_NOMBRE, 1, 60),                                             -- → SER_NAME
       NULL,                                                                    -- → SER_ABSTRACT [nuevo en v3]
       SUBSTR(s.SER_URL, 1, 4000),                                              -- → SER_URL (v3 amplía a 4000; v2 hbm decía 250)
       SUBSTR(s.SER_PROJECTS, 1, 1000),                                         -- → SER_PROJECTS
       SUBSTR(s.SER_LEYENDA, 1, 4000),                                          -- → SER_LEGEND
       SUBSTR(s.SER_INFOURL, 1, 4000),                                          -- → SER_INFOURL
       s.SER_F_ALTA,                                                            -- → SER_CREATED
       -- Defecto 'WMS': SER_PROTOCOL es NOT NULL; valor de codelist habitual si falta SER_TIPO
       SUBSTR(NVL(s.SER_TIPO, 'WMS'), 1, 30),                                   -- → SER_PROTOCOL
       NULL,                                                                    -- → SER_NAT_PROT [nuevo en v3]
       0,                                                                       -- → SER_BLOCKED [nuevo en v3] defecto 0: servicio activo (NOT NULL)
       0,                                                                       -- → SER_PROXIED [nuevo en v3] defecto 0: sin proxy hasta configurar
       NULL,                                                                    -- → SER_AUTH_MOD [nuevo en v3]
       NULL,                                                                    -- → SER_USER [nuevo en v3] (credencial del servicio; distinta de STM_CONNECT)
       NULL                                                                     -- → SER_PWD [nuevo en v3]
  FROM SITMUN2.STM_SERVICIO s;

PROMPT === STM_TREE (desde STM_ARBOL) ===
INSERT INTO STM_TREE (TRE_ID, TRE_NAME, TRE_ABSTRACT, TRE_TYPE, TRE_IMAGE, TRE_IMAGE_NAME, TRE_USERID)
SELECT a.ARB_CODIGO,                                                            -- → TRE_ID
       SUBSTR(a.ARB_NOMBRE, 1, 100),                                            -- → TRE_NAME
       NULL,                                                                    -- → TRE_ABSTRACT [nuevo en v3]
       NULL,                                                                    -- → TRE_TYPE [nuevo en v3]
       NULL,                                                                    -- → TRE_IMAGE [nuevo en v3]
       NULL,                                                                    -- → TRE_IMAGE_NAME [nuevo en v3]
       NULL                                                                     -- → TRE_USERID [nuevo en v3]
  FROM SITMUN2.STM_ARBOL a;

PROMPT === STM_TSK_TYP (desde STM_TIPOTAREA) ===
-- Migración sobre todo informativa / de utilidad operativa: estos ids son los
-- identificadores de tipos de tarea del producto (visor/admin) a los que apuntan
-- las tareas (TAS_TTASKID). Conservar TTY_ID = TTA_CODIGO evita remapear;
-- TTY_SPEC / jerarquía v3 quedan vacíos — hay que alinear o rellenar después
-- con el catálogo oficial de tipos v3.
INSERT INTO STM_TSK_TYP (
  TTY_ID, TTY_NAME, TTY_TITLE, TTY_ENABLED, TTY_PARENTID, TTY_ORDER, TTY_SPEC
)
SELECT t.TTA_CODIGO,                                                            -- → TTY_ID
       SUBSTR(t.TTA_NOMBRE, 1, 50),                                             -- → TTY_NAME
       SUBSTR(t.TTA_NOMBRE, 1, 50),                                             -- → TTY_TITLE [nuevo en v3]: sin título en v2 → nombre
       1,                                                                       -- → TTY_ENABLED [nuevo en v3] defecto 1: tipo activo (NOT NULL)
       NULL,                                                                    -- → TTY_PARENTID [nuevo en v3]
       NULL,                                                                    -- → TTY_ORDER [nuevo en v3]
       NULL                                                                     -- → TTY_SPEC [nuevo en v3]
  FROM SITMUN2.STM_TIPOTAREA t;

PROMPT === STM_TSK_UI (desde STM_TAREA_UI) ===
-- Migración sobre todo informativa / de utilidad operativa: estos ids son los
-- identificadores de los componentes (controles) del visor a los que apuntan
-- las tareas (TAS_TUIID). Conservar TUI_ID = TUI_CODIGO facilita revisar y
-- reasignar referencias; el catálogo de UI del visor v3 puede diferir del v2.
INSERT INTO STM_TSK_UI (TUI_ID, TUI_NAME, TUI_TOOLTIP, TUI_ORDER, TUI_TYPE)
SELECT u.TUI_CODIGO,                                                            -- → TUI_ID
       SUBSTR(u.TUI_NOMBRE, 1, 50),                                             -- → TUI_NAME
       SUBSTR(u.TUI_TOOLTIP, 1, 100),                                           -- → TUI_TOOLTIP
       u.TUI_ORDEN,                                                             -- → TUI_ORDER
       SUBSTR(u.TUI_TIPO, 1, 30)                                                -- → TUI_TYPE (clave de componente; revisar vs visor v3)
  FROM SITMUN2.STM_TAREA_UI u;

PROMPT === STM_USER (desde STM_USUARIO) ===
INSERT INTO STM_USER (
  USE_ID, USE_USER, USE_PWD, USE_NAME, USE_SURNAME,
  USE_IDENT, USE_IDENTTYPE, USE_EMAIL,
  USE_ADM, USE_BLOCKED, USE_CREATED, USE_UPDATED, USE_LAST_PASSWORD_CHANGE
)
SELECT u.USU_CODIGO,                                                            -- → USE_ID
       SUBSTR(u.USU_USUARIO, 1, 50),                                            -- → USE_USER
       SUBSTR(u.USU_PASSWORD, 1, 128),                                          -- → USE_PWD
       -- Por qué copiar el hash tal cual: este ejemplo no asume el algoritmo v2;
       -- hay que recalcular/reset si SITMUN 3 no lo reconoce.
       SUBSTR(u.USU_NOMBRE, 1, 50),                                             -- → USE_NAME
       SUBSTR(u.USU_APELLIDOS, 1, 50),                                          -- → USE_SURNAME
       NULL,                                                                    -- → USE_IDENT [nuevo en v3]
       NULL,                                                                    -- → USE_IDENTTYPE [nuevo en v3]
       NULL,                                                                    -- → USE_EMAIL [nuevo en v3]
       NVL(u.USU_ADM, 0),                                                       -- → USE_ADM (null → false)
       NVL(u.USU_BLOQ, 0),                                                      -- → USE_BLOCKED (null → false)
       NULL,                                                                    -- → USE_CREATED [nuevo en v3]
       NULL,                                                                    -- → USE_UPDATED [nuevo en v3]
       NULL                                                                     -- → USE_LAST_PASSWORD_CHANGE [nuevo en v3]
  FROM SITMUN2.STM_USUARIO u;

PROMPT === STM_APP (desde STM_APPS) ===
INSERT INTO STM_APP (
  APP_ID, APP_NAME, APP_TYPE, APP_TITLE, APP_THEME, APP_LOGO, APP_DESCRIPTION,
  APP_SCALES, APP_PROJECT, APP_TEMPLATE, APP_REFRESH, APP_ENTRYS, APP_ENTRYM,
  APP_GGIID, APP_CREATED, APP_MAINTENANCE_INFORMATION, APP_UNAVAILABLE,
  APP_LAST_UPDATE, APP_CREATORID, APP_PRIVATE, APP_HEADERPARAMS,
  APP_RESPONSIBLE_INSTITUTION
)
SELECT a.APP_CODIGO,                                                            -- → APP_ID
       SUBSTR(a.APP_NOMBRE, 1, 80),                                             -- → APP_NAME
       -- Defecto 'I': codelist application.type (interna); APP_TIPO puede faltar
       SUBSTR(NVL(a.APP_TIPO, 'I'), 1, 250),                                    -- → APP_TYPE
       SUBSTR(a.APP_TITULO, 1, 250),                                            -- → APP_TITLE
       SUBSTR(NVL(a.APP_TEMA, 'default'), 1, 30),                               -- → APP_THEME: clave de tema del visor; defecto 'default' si falta APP_TEMA
       NULL,                                                                    -- → APP_LOGO [nuevo en v3]
       NULL,                                                                    -- → APP_DESCRIPTION [nuevo en v3]
       SUBSTR(a.APP_ESCALAS, 1, 250),                                           -- → APP_SCALES
       SUBSTR(a.APP_PROJECT, 1, 250),                                           -- → APP_PROJECT
       SUBSTR(a.APP_TEMPLATE, 1, 250),                                          -- → APP_TEMPLATE: id de plantilla del visor (informativo; debe existir en v3)
       NVL(a.APP_AUTOREFR, 0),                                                  -- → APP_REFRESH (bool opcional: null → false)
       NVL(a.APP_SUPRAMUN, 0),                                                  -- → APP_ENTRYS (mapeo aproximado desde APP_SUPRAMUN; null → false)
       0,                                                                       -- → APP_ENTRYM [nuevo en v3] bool opcional: false
       CASE                                                                     -- → APP_GGIID (mapa de situación, grupo tipo M); solo si el GRP_GI ya migró
         WHEN a.APP_CODGCA IS NOT NULL
              AND EXISTS (SELECT 1 FROM STM_GRP_GI g WHERE g.GGI_ID = a.APP_CODGCA)
           THEN a.APP_CODGCA
         ELSE NULL
       END,
       NVL(a.APP_F_ALTA, SYSTIMESTAMP),                                         -- → APP_CREATED (NOT NULL)
       NULL,                                                                    -- → APP_MAINTENANCE_INFORMATION [nuevo en v3]
       0,                                                                       -- → APP_UNAVAILABLE [nuevo en v3] defecto 0: app disponible (NOT NULL)
       SYSTIMESTAMP,                                                            -- → APP_LAST_UPDATE [nuevo en v3] NOT NULL: sin dato v2 → ahora
       NULL,                                                                    -- → APP_CREATORID [nuevo en v3]
       0,                                                                       -- → APP_PRIVATE [nuevo en v3] defecto 0: app pública hasta revisión manual
       NULL,                                                                    -- → APP_HEADERPARAMS [nuevo en v3]
       NULL                                                                     -- → APP_RESPONSIBLE_INSTITUTION [nuevo en v3] (changeset Liquibase 08)
  FROM SITMUN2.STM_APPS a;

PROMPT === STM_BACKGRD (desde STM_FONDO) ===
INSERT INTO STM_BACKGRD (
  BAC_ID, BAC_NAME, BAC_IMAGE, BAC_DESC, BAC_ACTIVE, BAC_GGIID, BAC_CREATED
)
SELECT f.FON_CODIGO,                                                            -- → BAC_ID
       SUBSTR(f.FON_NOMBRE, 1, 30),                                             -- → BAC_NAME
       NULL,                                                                    -- → BAC_IMAGE [nuevo en v3]
       SUBSTR(f.FON_DESC, 1, 250),                                              -- → BAC_DESC
       NVL(f.FON_ACTIVO, 0),                                                    -- → BAC_ACTIVE (bool opcional: null → false)
       f.FON_CODGCA,                                                            -- → BAC_GGIID
       f.FON_F_ALTA                                                             -- → BAC_CREATED
  FROM SITMUN2.STM_FONDO f
 WHERE f.FON_CODGCA IS NULL
    OR EXISTS (SELECT 1 FROM STM_GRP_GI g WHERE g.GGI_ID = f.FON_CODGCA);
 -- Por qué exigir grupo: BeforeCreateBackgroundValidator exige BAC_GGIID tipo F.

PROMPT === STM_GEOINFO (desde STM_CARTO) ===
INSERT INTO STM_GEOINFO (
  GEO_ID, GEO_NAME, GEO_ABSTRACT, GEO_LAYERS, GEO_MINSCALE, GEO_MAXSCALE, GEO_ORDER,
  GEO_TRANSP, GEO_FILTER_GM, GEO_QUERYABL, GEO_QUERYACT, GEO_QUERYLAY, GEO_FILTER_GFI,
  GEO_TYPE, GEO_SERID, GEO_SELECTABL, GEO_SELECTLAY, GEO_FILTER_SS, GEO_SERSELID,
  GEO_LEGENDTIP, GEO_LEGENDURL, GEO_CREATED, GEO_CONNID, GEO_METAURL, GEO_DATAURL,
  GEO_THEMATIC, GEO_GEOMTYPE, GEO_SOURCE, GEO_STYID, GEO_STYUSEALL, GEO_BLOCKED
)
SELECT c.CAR_CODIGO,                                                            -- → GEO_ID
       SUBSTR(c.CAR_NOMBRE, 1, 100),                                            -- → GEO_NAME
       NULL,                                                                    -- → GEO_ABSTRACT [nuevo en v3]
       SUBSTR(c.CAR_CAPAS, 1, 800),                                             -- → GEO_LAYERS
       c.CAR_ESC_MIN,                                                           -- → GEO_MINSCALE
       c.CAR_ESC_MAX,                                                           -- → GEO_MAXSCALE
       c.CAR_ORDEN,                                                             -- → GEO_ORDER
       c.CAR_TRANSP,                                                            -- → GEO_TRANSP
       0,                                                                       -- → GEO_FILTER_GM [nuevo en v3] bool opcional: false
       NVL(c.CAR_QUERYABL, 0),                                                  -- → GEO_QUERYABL (null → false; NOT NULL en v3)
       NVL(c.CAR_QUERYACT, 0),                                                  -- → GEO_QUERYACT (null → false; NOT NULL en v3)
       SUBSTR(c.CAR_QUERYLAY, 1, 500),                                          -- → GEO_QUERYLAY
       0,                                                                       -- → GEO_FILTER_GFI [nuevo en v3] bool opcional: false
       SUBSTR(c.CAR_TIPO, 1, 30),                                               -- → GEO_TYPE
       c.CAR_CODSER,                                                            -- → GEO_SERID
       NVL(c.CAR_SELECTABL, 0),                                                 -- → GEO_SELECTABL (null → false)
       SUBSTR(c.CAR_SELECTLAY, 1, 500),                                         -- → GEO_SELECTLAY
       0,                                                                       -- → GEO_FILTER_SS [nuevo en v3] bool opcional: false
       c.CAR_CODSERSEL,                                                         -- → GEO_SERSELID
       SUBSTR(c.CAR_LEYENDTIP, 1, 50),                                          -- → GEO_LEGENDTIP
       SUBSTR(c.CAR_LEYENDURL, 1, 4000),                                        -- → GEO_LEGENDURL
       c.CAR_F_ALTA,                                                            -- → GEO_CREATED
       c.CAR_CODCON,                                                            -- → GEO_CONNID
       SUBSTR(c.CAR_METAURL, 1, 4000),                                          -- → GEO_METAURL
       NULL,                                                                    -- → GEO_DATAURL [nuevo en v3]
       NVL(c.CAR_TEMATIZABLE, 0),                                               -- → GEO_THEMATIC (null → false)
       SUBSTR(c.CAR_TIPOGEOM, 1, 50),                                           -- → GEO_GEOMTYPE
       NULL,                                                                    -- → GEO_SOURCE [nuevo en v3]
       NULL,                                                                    -- → GEO_STYID [nuevo en v3]
       0,                                                                       -- → GEO_STYUSEALL [nuevo en v3] bool opcional: false
       0                                                                        -- → GEO_BLOCKED [nuevo en v3] bool: false = capa activa (NOT NULL)
  FROM SITMUN2.STM_CARTO c
 WHERE EXISTS (SELECT 1 FROM STM_SERVICE s WHERE s.SER_ID = c.CAR_CODSER);
 -- Por qué filtrar por servicio: GEO_SERID es FK; capas sin servicio migrado se omiten.

PROMPT === STM_PAR_SER (desde STM_PARAMSER) ===
INSERT INTO STM_PAR_SER (PSE_ID, PSE_SERID, PSE_TYPE, PSE_NAME, PSE_VALUE)
SELECT ROW_NUMBER() OVER (ORDER BY p.PSE_CODSER, p.PSE_TIPO, p.PSE_NOMBRE),     -- → PSE_ID
       -- Genera PSE_ID (nuevo en v3): v2 clave (servicio, tipo, nombre); sin id origen.
       p.PSE_CODSER,                                                            -- → PSE_SERID
       SUBSTR(NVL(p.PSE_TIPO, 'WMS'), 1, 250),                                  -- → PSE_TYPE (defecto WMS; NOT NULL)
       SUBSTR(p.PSE_NOMBRE, 1, 30),                                             -- → PSE_NAME
       SUBSTR(p.PSE_VALOR, 1, 250)                                              -- → PSE_VALUE
  FROM SITMUN2.STM_PARAMSER p
 WHERE EXISTS (SELECT 1 FROM STM_SERVICE s WHERE s.SER_ID = p.PSE_CODSER);
 -- Por qué EXISTS: evita parámetros huérfanos si el servicio no se ha migrado.

PROMPT === STM_ROL_GGI (desde STM_ROLGCA) ===
INSERT INTO STM_ROL_GGI (RGG_ROLEID, RGG_GGIID)
SELECT rg.RGC_CODROL,                                                           -- → RGG_ROLEID
       rg.RGC_CODGCA                                                            -- → RGG_GGIID
  FROM SITMUN2.STM_ROLGCA rg
 WHERE EXISTS (SELECT 1 FROM STM_ROLE r WHERE r.ROL_ID = rg.RGC_CODROL)
   AND EXISTS (SELECT 1 FROM STM_GRP_GI g WHERE g.GGI_ID = rg.RGC_CODGCA);

PROMPT === STM_TERRITORY (desde STM_ETERRIT) ===
INSERT INTO STM_TERRITORY (
  TER_ID, TER_CODTER, TER_NAME, TER_ADMNAME, TER_ADDRESS, TER_EMAIL, TER_SCOPE,
  TER_LOGO, TER_EXTENT, TER_CENTER, TER_LEGAL, TER_ZOOM, TER_BLOCKED,
  TER_TYPID, TER_NOTE, TER_CREATED, TER_GTYPID, TER_PROJECT, TER_DESCRIPTION
)
SELECT t.TER_CODIGO,                                                            -- → TER_ID
       SUBSTR(t.TER_CODMUN, 1, 50),                                             -- → TER_CODTER
       SUBSTR(                                                                  -- → TER_NAME (NOT NULL UNIQUE): null → 'territorio-'||id; duplicados → sufijo (id)
         CASE
           WHEN COUNT(*) OVER (
                  PARTITION BY NVL(t.TER_NOMBRE, 'territorio-' || t.TER_CODIGO)
                ) > 1
             THEN NVL(t.TER_NOMBRE, 'territorio-' || t.TER_CODIGO)
                  || ' (' || t.TER_CODIGO || ')'
           ELSE NVL(t.TER_NOMBRE, 'territorio-' || t.TER_CODIGO)
         END,
         1, 250),
       SUBSTR(t.TER_NADMIN, 1, 250),                                            -- → TER_ADMNAME
       SUBSTR(t.TER_DIRECC, 1, 250),                                            -- → TER_ADDRESS
       SUBSTR(t.TER_CORREO, 1, 250),                                            -- → TER_EMAIL
       SUBSTR(t.TER_AMBITO, 1, 250),                                            -- → TER_SCOPE
       SUBSTR(t.TER_LOGO, 1, 4000),                                             -- → TER_LOGO
       SUBSTR(t.TER_EXT, 1, 250),                                               -- → TER_EXTENT
       NULL,                                                                    -- → TER_CENTER [nuevo en v3]
       NULL,                                                                    -- → TER_LEGAL [nuevo en v3]
       NULL,                                                                    -- → TER_ZOOM [nuevo en v3]
       NVL(t.TER_BLOQ, 0),                                                      -- → TER_BLOCKED (null → false; NOT NULL en v3)
       NULL,                                                                    -- → TER_TYPID [nuevo en v3]: STM_TER_TYP es seed; no hay tipoterr en v2
       SUBSTR(t.TER_OBSERV, 1, 250),                                            -- → TER_NOTE
       t.TER_F_ALTA,                                                            -- → TER_CREATED
       CASE                                                                     -- → TER_GTYPID: tras migrar STM_TIPOGRP → STM_GTER_TYP; si falta el tipo, NULL
         WHEN EXISTS (
                SELECT 1 FROM STM_GTER_TYP g WHERE g.GTT_ID = t.TER_CODTGR
              ) THEN t.TER_CODTGR
         ELSE NULL
       END,
       NULL,                                                                    -- → TER_PROJECT [nuevo en v3]
       NULL                                                                     -- → TER_DESCRIPTION [nuevo en v3]
  FROM SITMUN2.STM_ETERRIT t;

PROMPT === STM_APP_BCKG (desde STM_APPFON) ===
INSERT INTO STM_APP_BCKG (ABC_ID, ABC_APPID, ABC_BACKID, ABC_ORDER)
SELECT ROW_NUMBER() OVER (ORDER BY af.APF_CODAPP, af.APF_CODFON),               -- → ABC_ID
       -- Genera ABC_ID (nuevo en v3): v2 clave (app, fondo); sin id origen.
       af.APF_CODAPP,                                                           -- → ABC_APPID
       af.APF_CODFON,                                                           -- → ABC_BACKID
       NVL(af.APF_ORDEN, 0)                                                     -- → ABC_ORDER (null → 0)
  FROM SITMUN2.STM_APPFON af
 WHERE EXISTS (SELECT 1 FROM STM_APP a WHERE a.APP_ID = af.APF_CODAPP)
   AND EXISTS (SELECT 1 FROM STM_BACKGRD b WHERE b.BAC_ID = af.APF_CODFON);

PROMPT === STM_APP_ROL (desde ROL_CODAPP de v2) ===
-- Por qué: en v2 el rol pertenecía a una app; en v3 eso es una tabla de join.
INSERT INTO STM_APP_ROL (ARO_APPID, ARO_ROLEID)
SELECT r.ROL_CODAPP,                                                            -- → ARO_APPID
       r.ROL_CODIGO                                                             -- → ARO_ROLEID
  FROM SITMUN2.STM_ROLES r
 WHERE EXISTS (SELECT 1 FROM STM_APP a WHERE a.APP_ID = r.ROL_CODAPP)
   AND EXISTS (SELECT 1 FROM STM_ROLE rol WHERE rol.ROL_ID = r.ROL_CODIGO);

PROMPT === STM_APP_TREE (desde APP_CODARB de v2) ===
INSERT INTO STM_APP_TREE (ATR_ID, ATR_APPID, ATR_TREEID, ATR_ORDER)
SELECT ROW_NUMBER() OVER (ORDER BY a.APP_CODIGO),                               -- → ATR_ID
       -- Genera ATR_ID (nuevo en v3): v2 solo APP_CODARB en la app; sin id de enlace.
       a.APP_CODIGO,                                                            -- → ATR_APPID
       a.APP_CODARB,                                                            -- → ATR_TREEID
       1                                                                        -- → ATR_ORDER (primer y único árbol migrado desde APP_CODARB)
  FROM SITMUN2.STM_APPS a
 WHERE a.APP_CODARB IS NOT NULL
   AND EXISTS (SELECT 1 FROM STM_APP app WHERE app.APP_ID = a.APP_CODIGO)
   AND EXISTS (SELECT 1 FROM STM_TREE t WHERE t.TRE_ID = a.APP_CODARB);

PROMPT === STM_AVAIL_GI (desde STM_DISPCARTO) ===
INSERT INTO STM_AVAIL_GI (AGI_ID, AGI_CREATED, AGI_OWNER, AGI_GIID, AGI_TERID)
SELECT ROW_NUMBER() OVER (ORDER BY d.DCA_CODTER, d.DCA_CODCAR),                 -- → AGI_ID
       -- Genera AGI_ID (nuevo en v3): v2 clave (territorio, capa); sin id origen.
       d.DCA_F_ALTA,                                                            -- → AGI_CREATED
       NULL,                                                                    -- → AGI_OWNER [nuevo en v3]
       d.DCA_CODCAR,                                                            -- → AGI_GIID
       d.DCA_CODTER                                                             -- → AGI_TERID
  FROM SITMUN2.STM_DISPCARTO d
 WHERE EXISTS (SELECT 1 FROM STM_GEOINFO g WHERE g.GEO_ID = d.DCA_CODCAR)
   AND EXISTS (SELECT 1 FROM STM_TERRITORY t WHERE t.TER_ID = d.DCA_CODTER);

PROMPT === STM_GGI_GI (desde STM_GCACAR) ===
-- Por qué: miembros del grupo de permisos / fondo / mapa de situación.
-- Una misma capa puede pertenecer a varios grupos (p. ej. fondo y permisos).
INSERT INTO STM_GGI_GI (GGG_GGIID, GGG_GIID)
SELECT gc.GCC_CODGCA,                                                           -- → GGG_GGIID
       gc.GCC_CODCAR                                                            -- → GGG_GIID
  FROM SITMUN2.STM_GCACAR gc
 WHERE EXISTS (SELECT 1 FROM STM_GRP_GI g WHERE g.GGI_ID = gc.GCC_CODGCA)
   AND EXISTS (SELECT 1 FROM STM_GEOINFO gi WHERE gi.GEO_ID = gc.GCC_CODCAR);

PROMPT === STM_GRP_TER (desde STM_GRPTER) ===
INSERT INTO STM_GRP_TER (GTE_TERID, GTE_TERMID)
SELECT g.GRT_CODTER,                                                            -- → GTE_TERID
       g.GRT_CODTERM                                                            -- → GTE_TERMID
  FROM SITMUN2.STM_GRPTER g
 WHERE EXISTS (SELECT 1 FROM STM_TERRITORY t WHERE t.TER_ID = g.GRT_CODTER)
   AND EXISTS (SELECT 1 FROM STM_TERRITORY t WHERE t.TER_ID = g.GRT_CODTERM);

PROMPT === STM_PAR_APP (desde STM_PARAMAPP) ===
INSERT INTO STM_PAR_APP (PAP_ID, PAP_NAME, PAP_VALUE, PAP_TYPE, PAP_APPID)
SELECT p.PAP_CODIGO,                                                            -- → PAP_ID
       SUBSTR(p.PAP_NOMBRE, 1, 30),                                             -- → PAP_NAME
       SUBSTR(p.PAP_VALOR, 1, 250),                                             -- → PAP_VALUE
       SUBSTR(p.PAP_TIPO, 1, 250),                                              -- → PAP_TYPE
       p.PAP_CODAPP                                                             -- → PAP_APPID
  FROM SITMUN2.STM_PARAMAPP p
 WHERE EXISTS (SELECT 1 FROM STM_APP a WHERE a.APP_ID = p.PAP_CODAPP);

PROMPT === STM_PAR_GI (desde STM_PARAMCAR) ===
INSERT INTO STM_PAR_GI (PGI_ID, PGI_NAME, PGI_VALUE, PGI_FORMAT, PGI_TYPE, PGI_GIID, PGI_ORDER)
SELECT p.PCA_CODIGO,                                                            -- → PGI_ID
       SUBSTR(p.PCA_NOMBRE, 1, 250),                                            -- → PGI_NAME
       SUBSTR(p.PCA_VALOR, 1, 250),                                             -- → PGI_VALUE
       SUBSTR(p.PCA_FORMATO, 1, 250),                                           -- → PGI_FORMAT
       SUBSTR(NVL(p.PCA_TIPO, 'INFO'), 1, 50),                                  -- → PGI_TYPE (defecto INFO; NOT NULL)
       p.PCA_CODCAR,                                                            -- → PGI_GIID
       p.PCA_ORDEN                                                              -- → PGI_ORDER
  FROM SITMUN2.STM_PARAMCAR p
 WHERE EXISTS (SELECT 1 FROM STM_GEOINFO g WHERE g.GEO_ID = p.PCA_CODCAR);

PROMPT === STM_POST (desde STM_CARGO) ===
INSERT INTO STM_POST (
  POS_ID, POS_CREATED, POS_UPDATED, POS_EMAIL, POS_EXPIRATION,
  POS_POST, POS_ORG, POS_TYPE, POS_TERID, POS_USERID
)
SELECT ROW_NUMBER() OVER (ORDER BY c.CGO_CODUSU, c.CGO_CODTER),                 -- → POS_ID
       -- Genera POS_ID (nuevo en v3): v2 clave (usuario, territorio); sin id origen.
       c.CGO_F_ALTA,                                                            -- → POS_CREATED
       NULL,                                                                    -- → POS_UPDATED [nuevo en v3]
       SUBSTR(c.CGO_CORREO, 1, 250),                                            -- → POS_EMAIL
       c.CGO_F_CADUC,                                                           -- → POS_EXPIRATION
       SUBSTR(c.CGO_CARGO, 1, 250),                                             -- → POS_POST
       SUBSTR(c.CGO_ORG, 1, 250),                                               -- → POS_ORG
       NULL,                                                                    -- → POS_TYPE [nuevo en v3]
       c.CGO_CODTER,                                                            -- → POS_TERID
       c.CGO_CODUSU                                                             -- → POS_USERID
  FROM SITMUN2.STM_CARGO c
 WHERE EXISTS (SELECT 1 FROM STM_USER u WHERE u.USE_ID = c.CGO_CODUSU)
   AND EXISTS (SELECT 1 FROM STM_TERRITORY t WHERE t.TER_ID = c.CGO_CODTER);

PROMPT === STM_TASK + TAS_PARAMS (desde STM_TAREA / PARAMTTA / CONSULTA) ===
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_CREATED, TAS_ORDER,
  TAS_GIID, TAS_SERID, TAS_GTASKID, TAS_TTASKID, TAS_TUIID, TAS_CONNID, TAS_PARAMS
)
SELECT tar.TAR_CODIGO,                                                          -- → TAS_ID
       SUBSTR(tar.TAR_NOMBRE, 1, 512),                                          -- → TAS_NAME
       tar.TAR_F_ALTA,                                                          -- → TAS_CREATED
       NULL,                                                                    -- → TAS_ORDER [nuevo en v3]
       tar.TAR_CODCAR,                                                          -- → TAS_GIID
       tar.TAR_CODSER,                                                          -- → TAS_SERID
       tar.TAR_CODGTA,                                                          -- → TAS_GTASKID
       tar.TAR_CODTTA,                                                          -- → TAS_TTASKID
       tar.TAR_CODTUI,                                                          -- → TAS_TUIID
       tar.TAR_CODCON,                                                          -- → TAS_CONNID
       CASE                                                                     -- → TAS_PARAMS
         -- Forma B (consulta SQL): hace falta scope+command; el proxy JDBC solo expande ${var}.
         WHEN cns.CNS_CODIGO IS NOT NULL AND tar.TAR_CODCON IS NOT NULL THEN
           JSON_OBJECT(
             KEY 'scope' VALUE 'sql-query',
             -- Por qué REGEXP_REPLACE: v2 suele usar {param}; v3 SQL espera ${param}.
             KEY 'command' VALUE
               REGEXP_REPLACE(
                 cns.CNS_SELECT,
                 '\{([A-Za-z_][A-Za-z0-9_]*)\}',
                 '${\1}'
               ),
             KEY 'parameters' VALUE (
               SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                          KEY 'variable' VALUE p.PTT_NOMBRE,
                          KEY 'label' VALUE p.PTT_NOMBRE,
                          KEY 'type' VALUE 'query',
                          -- required TRUE: en la migración tratamos los params de consulta como obligatorios
                          KEY 'required' VALUE TRUE
                          ABSENT ON NULL
                          RETURNING CLOB
                        )
                        ORDER BY p.PTT_ORDEN NULLS LAST, p.PTT_CODIGO
                        RETURNING CLOB
                      )
                 FROM SITMUN2.STM_PARAMTTA p
                WHERE p.PTT_CODTAR = tar.TAR_CODIGO
             )
             ABSENT ON NULL
             RETURNING CLOB
           )
         -- Forma B (web API): URL sin conexión JDBC → scope web-api-query; se mantiene {var} URI.
         WHEN cns.CNS_CODIGO IS NOT NULL
              AND tar.TAR_CODCON IS NULL
              AND (LOWER(NVL(cns.CNS_SELECT, cns.CNS_URLTRANF)) LIKE 'http%'
                   OR LOWER(NVL(cns.CNS_URLTRANF, cns.CNS_SELECT)) LIKE 'http%') THEN
           JSON_OBJECT(
             KEY 'scope' VALUE 'web-api-query',
             KEY 'command' VALUE NVL(cns.CNS_URLTRANF, cns.CNS_SELECT),
             KEY 'parameters' VALUE (
               SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                          KEY 'variable' VALUE p.PTT_NOMBRE,
                          KEY 'label' VALUE p.PTT_NOMBRE,
                          KEY 'type' VALUE 'query',
                          KEY 'required' VALUE TRUE
                          ABSENT ON NULL
                          RETURNING CLOB
                        )
                        ORDER BY p.PTT_ORDEN NULLS LAST, p.PTT_CODIGO
                        RETURNING CLOB
                      )
                 FROM SITMUN2.STM_PARAMTTA p
                WHERE p.PTT_CODTAR = tar.TAR_CODIGO
             )
             ABSENT ON NULL
             RETURNING CLOB
           )
         -- Forma A (básico legado): TaskBasicValidator exige exactamente name/type/value, sin scope.
         WHEN EXISTS (
                SELECT 1 FROM SITMUN2.STM_PARAMTTA p WHERE p.PTT_CODTAR = tar.TAR_CODIGO
              ) THEN
           JSON_OBJECT(
             KEY 'parameters' VALUE (
               SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                          KEY 'name' VALUE p.PTT_NOMBRE,
                          KEY 'type' VALUE
                            -- Defecto 'string': tipo básico válido si PTT_TIPO no es reconocido.
                            CASE LOWER(TRIM(NVL(p.PTT_TIPO, 'string')))
                              WHEN 'string' THEN 'string'
                              WHEN 'number' THEN 'number'
                              WHEN 'boolean' THEN 'boolean'
                              WHEN 'array' THEN 'array'
                              WHEN 'object' THEN 'object'
                              WHEN 'null' THEN 'null'
                              ELSE 'string'
                            END,
                          KEY 'value' VALUE p.PTT_VALOR
                          ABSENT ON NULL
                          RETURNING CLOB
                        )
                        ORDER BY p.PTT_ORDEN NULLS LAST, p.PTT_CODIGO
                        RETURNING CLOB
                      )
                 FROM SITMUN2.STM_PARAMTTA p
                WHERE p.PTT_CODTAR = tar.TAR_CODIGO
             )
             RETURNING CLOB
           )
         ELSE NULL  -- sin params ni consulta: TAS_PARAMS puede ser null
       END
  FROM SITMUN2.STM_TAREA tar
  LEFT JOIN SITMUN2.STM_CONSULTA cns ON cns.CNS_CODIGO = tar.TAR_CODIGO
 WHERE tar.TAR_CODTTA IS NULL
    OR EXISTS (SELECT 1 FROM STM_TSK_TYP tty WHERE tty.TTY_ID = tar.TAR_CODTTA);

PROMPT === STM_USR_CONF (desde STM_USUCONF) ===
INSERT INTO STM_USR_CONF (UCO_ID, UCO_USERID, UCO_TERID, UCO_ROLEID, UCO_ROLEM, UCO_CREATED)
SELECT ROW_NUMBER() OVER (ORDER BY u.UCF_CODUSU, u.UCF_CODTER, u.UCF_CODROL),   -- → UCO_ID
       -- Genera UCO_ID (nuevo en v3): v2 clave (usuario, territorio, rol); sin id origen.
       u.UCF_CODUSU,                                                            -- → UCO_USERID
       u.UCF_CODTER,                                                            -- → UCO_TERID
       u.UCF_CODROL,                                                            -- → UCO_ROLEID
       0,                                                                       -- → UCO_ROLEM [nuevo en v3] defecto 0: no es rol maestro (NOT NULL)
       NULL                                                                     -- → UCO_CREATED [nuevo en v3]
  FROM SITMUN2.STM_USUCONF u
 WHERE EXISTS (SELECT 1 FROM STM_USER usr WHERE usr.USE_ID = u.UCF_CODUSU)
   AND EXISTS (SELECT 1 FROM STM_TERRITORY t WHERE t.TER_ID = u.UCF_CODTER)
   AND EXISTS (SELECT 1 FROM STM_ROLE r WHERE r.ROL_ID = u.UCF_CODROL);

PROMPT === STM_AVAIL_TSK (desde STM_DISPTAREA) ===
INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_CREATED, ATS_TASKID, ATS_TERID)
SELECT ROW_NUMBER() OVER (ORDER BY d.DTA_CODTER, d.DTA_CODTAR),                 -- → ATS_ID
       -- Genera ATS_ID (nuevo en v3): v2 clave (territorio, tarea); sin id origen.
       NULL,                                                                    -- → ATS_CREATED [nuevo en v3]
       d.DTA_CODTAR,                                                            -- → ATS_TASKID
       d.DTA_CODTER                                                             -- → ATS_TERID
  FROM SITMUN2.STM_DISPTAREA d
 WHERE EXISTS (SELECT 1 FROM STM_TASK t WHERE t.TAS_ID = d.DTA_CODTAR)
   AND EXISTS (SELECT 1 FROM STM_TERRITORY ter WHERE ter.TER_ID = d.DTA_CODTER);

PROMPT === STM_ROL_TSK (desde STM_ROLTAR) ===
INSERT INTO STM_ROL_TSK (RTS_TASKID, RTS_ROLEID)
SELECT r.RTA_CODTAR,                                                            -- → RTS_TASKID
       r.RTA_CODROL                                                             -- → RTS_ROLEID
  FROM SITMUN2.STM_ROLTAR r
 WHERE EXISTS (SELECT 1 FROM STM_TASK t WHERE t.TAS_ID = r.RTA_CODTAR)
   AND EXISTS (SELECT 1 FROM STM_ROLE rol WHERE rol.ROL_ID = r.RTA_CODROL);

PROMPT === STM_TREE_NOD (desde STM_ARBOLNOD) ===
INSERT INTO STM_TREE_NOD (
  TNO_ID, TNO_PARENTID, TNO_NAME, TNO_ABSTRACT, TNO_TOOLTIP,
  TNO_ACTIVE, TNO_RADIO, TNO_LOAD_DATA, TNO_DEFAULT, TNO_ORDER,
  TNO_METAURL, TNO_DATAURL, TNO_FILTER_GM, TNO_FILTER_GFI, TNO_QUERYACT, TNO_FILTER_SE,
  TNO_STYLE, TNO_TREEID, TNO_GIID, TNO_TYPE, TNO_IMAGE, TNO_IMAGE_NAME,
  TNO_VIEW_MODE, TNO_TASKID, TNO_FILTERABLE, TNO_MAPPING
)
SELECT n.ARN_CODIGO,                                                            -- → TNO_ID
       n.ARN_CODPADRE,                                                          -- → TNO_PARENTID
       SUBSTR(n.ARN_NOMBRE, 1, 80),                                             -- → TNO_NAME
       NULL,                                                                    -- → TNO_ABSTRACT [nuevo en v3]
       SUBSTR(n.ARN_TOOLTIP, 1, 100),                                           -- → TNO_TOOLTIP
       NVL(n.ARN_ACTIVO, 1),                                                    -- → TNO_ACTIVE (NOT NULL DEFAULT 1: activo si v2 es null)
       0,                                                                       -- → TNO_RADIO [nuevo en v3] bool opcional: false
       0,                                                                       -- → TNO_LOAD_DATA [nuevo en v3] bool opcional: false
       0,                                                                       -- → TNO_DEFAULT [nuevo en v3] bool: false (NOT NULL DEFAULT 0)
       n.ARN_ORDEN,                                                             -- → TNO_ORDER
       NULL,                                                                    -- → TNO_METAURL [nuevo en v3]
       NULL,                                                                    -- → TNO_DATAURL [nuevo en v3]
       0,                                                                       -- → TNO_FILTER_GM [nuevo en v3] bool opcional: false
       0,                                                                       -- → TNO_FILTER_GFI [nuevo en v3] bool opcional: false
       0,                                                                       -- → TNO_QUERYACT [nuevo en v3] bool opcional: false
       0,                                                                       -- → TNO_FILTER_SE [nuevo en v3] bool opcional: false
       NULL,                                                                    -- → TNO_STYLE [nuevo en v3]
       n.ARN_CODARB,                                                            -- → TNO_TREEID
       n.ARN_CODCAR,                                                            -- → TNO_GIID
       NULL,                                                                    -- → TNO_TYPE [nuevo en v3]
       NULL,                                                                    -- → TNO_IMAGE [nuevo en v3]
       NULL,                                                                    -- → TNO_IMAGE_NAME [nuevo en v3]
       NULL,                                                                    -- → TNO_VIEW_MODE [nuevo en v3]
       NULL,                                                                    -- → TNO_TASKID [nuevo en v3]: v2 no enlazaba tarea al nodo
       0,                                                                       -- → TNO_FILTERABLE [nuevo en v3] bool opcional: false
       NULL                                                                     -- → TNO_MAPPING [nuevo en v3]
  FROM SITMUN2.STM_ARBOLNOD n
 WHERE EXISTS (SELECT 1 FROM STM_TREE t WHERE t.TRE_ID = n.ARN_CODARB)
   AND (n.ARN_CODCAR IS NULL
        OR EXISTS (SELECT 1 FROM STM_GEOINFO g WHERE g.GEO_ID = n.ARN_CODCAR));

PROMPT === STM_SEQUENCE (actualizar contadores) ===
-- Por qué: Hibernate TableGenerator lee SEQ_COUNT; si queda bajo, los nuevos IDs chocan.
MERGE INTO STM_SEQUENCE t
USING (
  SELECT seq_name, seq_count FROM (
    SELECT 'APP_ID' seq_name, NVL(MAX(APP_ID), 0) + 1 seq_count FROM STM_APP
    UNION ALL SELECT 'USE_ID', NVL(MAX(USE_ID), 0) + 1 FROM STM_USER
    UNION ALL SELECT 'TER_ID', NVL(MAX(TER_ID), 0) + 1 FROM STM_TERRITORY
    UNION ALL SELECT 'ROL_ID', NVL(MAX(ROL_ID), 0) + 1 FROM STM_ROLE
    UNION ALL SELECT 'UCO_ID', NVL(MAX(UCO_ID), 0) + 1 FROM STM_USR_CONF
    UNION ALL SELECT 'CON_ID', NVL(MAX(CON_ID), 0) + 1 FROM STM_CONNECT
    UNION ALL SELECT 'SER_ID', NVL(MAX(SER_ID), 0) + 1 FROM STM_SERVICE
    UNION ALL SELECT 'PSE_ID', NVL(MAX(PSE_ID), 0) + 1 FROM STM_PAR_SER
    UNION ALL SELECT 'GEO_ID', NVL(MAX(GEO_ID), 0) + 1 FROM STM_GEOINFO
    UNION ALL SELECT 'PGI_ID', NVL(MAX(PGI_ID), 0) + 1 FROM STM_PAR_GI
    UNION ALL SELECT 'PAP_ID', NVL(MAX(PAP_ID), 0) + 1 FROM STM_PAR_APP
    UNION ALL SELECT 'AGI_ID', NVL(MAX(AGI_ID), 0) + 1 FROM STM_AVAIL_GI
    UNION ALL SELECT 'ATS_ID', NVL(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK
    UNION ALL SELECT 'GTS_ID', NVL(MAX(GTS_ID), 0) + 1 FROM STM_GRP_TSK
    UNION ALL SELECT 'GTT_ID', NVL(MAX(GTT_ID), 0) + 1 FROM STM_GTER_TYP
    UNION ALL SELECT 'TTY_ID', NVL(MAX(TTY_ID), 0) + 1 FROM STM_TSK_TYP
    UNION ALL SELECT 'TUI_ID', NVL(MAX(TUI_ID), 0) + 1 FROM STM_TSK_UI
    UNION ALL SELECT 'TAS_ID', NVL(MAX(TAS_ID), 0) + 1 FROM STM_TASK
    UNION ALL SELECT 'TRE_ID', NVL(MAX(TRE_ID), 0) + 1 FROM STM_TREE
    UNION ALL SELECT 'TNO_ID', NVL(MAX(TNO_ID), 0) + 1 FROM STM_TREE_NOD
    UNION ALL SELECT 'ATR_ID', NVL(MAX(ATR_ID), 0) + 1 FROM STM_APP_TREE
    UNION ALL SELECT 'GGI_ID', NVL(MAX(GGI_ID), 0) + 1 FROM STM_GRP_GI
    UNION ALL SELECT 'BAC_ID', NVL(MAX(BAC_ID), 0) + 1 FROM STM_BACKGRD
    UNION ALL SELECT 'ABC_ID', NVL(MAX(ABC_ID), 0) + 1 FROM STM_APP_BCKG
    UNION ALL SELECT 'POS_ID', NVL(MAX(POS_ID), 0) + 1 FROM STM_POST
  )
) s
ON (t.SEQ_NAME = s.seq_name)
WHEN MATCHED THEN UPDATE SET t.SEQ_COUNT = GREATEST(NVL(t.SEQ_COUNT, 0), s.seq_count)
-- GREATEST: no bajamos un seq ya más alto (p. ej. de seed de plataforma).
WHEN NOT MATCHED THEN INSERT (SEQ_NAME, SEQ_COUNT) VALUES (s.seq_name, s.seq_count);

PROMPT === migrate_core terminado ===
