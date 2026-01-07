--liquibase formatted sql
--changeset sitmun:25-1 context:dev,prod

-- Replace SILME extension controls with standard SITNA controls
-- This changelog creates new standard controls (tasks 35, 36) and replaces references
-- to SILME extension controls (tasks 11, 31) in all related tables.
-- Note: Tasks 11 and 31 remain in the database but are replaced in all references.

-- Add standard sitna.layerCatalog control (uses virtual WMS capabilities)
-- This is separate from the SILME extension version (TUI_ID = 11, TAS_ID = 11)
INSERT INTO STM_TSK_UI (TUI_ID, TUI_NAME, TUI_TOOLTIP, TUI_ORDER, TUI_TYPE) 
VALUES (35, 'sitna.layerCatalog', 'layerCatalog (standard with virtual WMS)', 35, NULL);

-- Add corresponding task
INSERT INTO STM_TASK (TAS_ID, TAS_NAME, TAS_SERID, TAS_GTASKID, TAS_TTASKID, TAS_TUIID, TAS_CREATED, TAS_CONNID, TAS_GIID, TAS_PARAMS) 
VALUES (35, 'Layer Catalog (API SITNA with virtual WMS)', NULL, 1, 1, 35, NULL, NULL, NULL, NULL);

-- Add standard sitna.workLayerManager control (native SITNA control)
-- This is separate from the SILME extension version (TUI_ID = 31, TAS_ID = 31)
INSERT INTO STM_TSK_UI (TUI_ID, TUI_NAME, TUI_TOOLTIP, TUI_ORDER, TUI_TYPE) 
VALUES (36, 'sitna.workLayerManager', 'workLayerManager (standard native control)', 36, NULL);

-- Add corresponding task
INSERT INTO STM_TASK (TAS_ID, TAS_NAME, TAS_SERID, TAS_GTASKID, TAS_TTASKID, TAS_TUIID, TAS_CREATED, TAS_CONNID, TAS_GIID, TAS_PARAMS) 
VALUES (36, 'Work Layer Manager (API SITNA)', NULL, 1, 1, 36, NULL, NULL, NULL, NULL);

-- Replace SILME layerCatalog (task ID 11) with native layerCatalog (task ID 35) in available tasks
UPDATE STM_AVAIL_TSK SET ATS_TASKID = 35 WHERE ATS_TASKID = 11;

-- Replace SILME workLayerManager (task ID 31) with native workLayerManager (task ID 36) in available tasks
UPDATE STM_AVAIL_TSK SET ATS_TASKID = 36 WHERE ATS_TASKID = 31;

-- Replace SILME layerCatalog (task ID 11) with native layerCatalog (task ID 35) in role tasks
UPDATE STM_ROL_TSK SET RTS_TASKID = 35 WHERE RTS_TASKID = 11;

-- Replace SILME workLayerManager (task ID 31) with native workLayerManager (task ID 36) in role tasks
UPDATE STM_ROL_TSK SET RTS_TASKID = 36 WHERE RTS_TASKID = 31;

-- Replace SILME layerCatalog (task ID 11) with native layerCatalog (task ID 35) in tree nodes
-- Note: Initial data has NULL values, but this ensures production databases are migrated
UPDATE STM_TREE_NOD SET TNO_TASKID = 35 WHERE TNO_TASKID = 11;

-- Replace SILME workLayerManager (task ID 31) with native workLayerManager (task ID 36) in tree nodes
-- Note: Initial data has NULL values, but this ensures production databases are migrated
UPDATE STM_TREE_NOD SET TNO_TASKID = 36 WHERE TNO_TASKID = 31;

-- Replace SILME layerCatalog (task ID 11) with native layerCatalog (task ID 35) in task relationships
-- Note: No initial data exists, but this ensures production databases are migrated
UPDATE STM_TASKREL SET TAR_TASKID = 35 WHERE TAR_TASKID = 11;
UPDATE STM_TASKREL SET TAR_TASKRELID = 35 WHERE TAR_TASKRELID = 11;

-- Replace SILME workLayerManager (task ID 31) with native workLayerManager (task ID 36) in task relationships
-- Note: No initial data exists, but this ensures production databases are migrated
UPDATE STM_TASKREL SET TAR_TASKID = 36 WHERE TAR_TASKID = 31;
UPDATE STM_TASKREL SET TAR_TASKRELID = 36 WHERE TAR_TASKRELID = 31;

-- Update sequences
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TUI_ID), 0) + 1 FROM STM_TSK_UI) WHERE SEQ_NAME = 'TUI_ID';

--changeset sitmun:25-2 context:dev,prod
-- Restrict tasks for application 12 and territory 4
-- Ensure only the specified tasks are available for this application-territory combination

-- Remove unauthorized task-role associations for application 12
-- Delete task-role associations for tasks NOT in the allowed list
DELETE FROM STM_ROL_TSK 
WHERE RTS_ROLEID IN (
  SELECT ARO_ROLEID FROM STM_APP_ROL WHERE ARO_APPID = 12
)
AND RTS_TASKID NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 19, 20, 22, 24, 25, 26, 27, 35, 36, 32281, 32282, 32283, 32285, 32286, 32287);

-- Ensure allowed tasks are associated with application 12 roles
-- Insert task-role associations for allowed tasks with application 12 roles (only if they don't exist)
--changeset sitmun:25-3 dbms:postgresql
INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT DISTINCT aro.ARO_ROLEID, allowed_tasks.task_id
FROM STM_APP_ROL aro
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (12), (13), (14), (16), (18), (19), (20), (22), (24), (25), (26), (27), (35), (36), (32281), (32282), (32283), (32285), (32286), (32287)) AS allowed_tasks(task_id)
WHERE aro.ARO_APPID = 12
AND NOT EXISTS (
  SELECT 1 FROM STM_ROL_TSK rts 
  WHERE rts.RTS_ROLEID = aro.ARO_ROLEID 
  AND rts.RTS_TASKID = allowed_tasks.task_id
);

--changeset sitmun:25-3 dbms:oracle
INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT DISTINCT aro.ARO_ROLEID, allowed_tasks.task_id
FROM STM_APP_ROL aro
CROSS JOIN (
  SELECT 1 AS task_id FROM DUAL UNION ALL SELECT 2 FROM DUAL UNION ALL SELECT 3 FROM DUAL UNION ALL SELECT 4 FROM DUAL UNION ALL SELECT 5 FROM DUAL UNION ALL 
  SELECT 6 FROM DUAL UNION ALL SELECT 7 FROM DUAL UNION ALL SELECT 8 FROM DUAL UNION ALL SELECT 9 FROM DUAL UNION ALL SELECT 10 FROM DUAL UNION ALL 
  SELECT 12 FROM DUAL UNION ALL SELECT 13 FROM DUAL UNION ALL SELECT 14 FROM DUAL UNION ALL SELECT 16 FROM DUAL UNION ALL SELECT 18 FROM DUAL UNION ALL 
  SELECT 19 FROM DUAL UNION ALL SELECT 20 FROM DUAL UNION ALL SELECT 22 FROM DUAL UNION ALL SELECT 24 FROM DUAL UNION ALL SELECT 25 FROM DUAL UNION ALL 
  SELECT 26 FROM DUAL UNION ALL SELECT 27 FROM DUAL UNION ALL SELECT 35 FROM DUAL UNION ALL SELECT 36 FROM DUAL UNION ALL 
  SELECT 32281 FROM DUAL UNION ALL SELECT 32282 FROM DUAL UNION ALL SELECT 32283 FROM DUAL UNION ALL SELECT 32285 FROM DUAL UNION ALL 
  SELECT 32286 FROM DUAL UNION ALL SELECT 32287 FROM DUAL
) allowed_tasks
WHERE aro.ARO_APPID = 12
AND NOT EXISTS (
  SELECT 1 FROM STM_ROL_TSK rts 
  WHERE rts.RTS_ROLEID = aro.ARO_ROLEID 
  AND rts.RTS_TASKID = allowed_tasks.task_id
);

--changeset sitmun:25-3 dbms:h2
INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT DISTINCT aro.ARO_ROLEID, allowed_tasks.task_id
FROM STM_APP_ROL aro
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (12), (13), (14), (16), (18), (19), (20), (22), (24), (25), (26), (27), (35), (36), (32281), (32282), (32283), (32285), (32286), (32287)) AS allowed_tasks(task_id)
WHERE aro.ARO_APPID = 12
AND NOT EXISTS (
  SELECT 1 FROM STM_ROL_TSK rts 
  WHERE rts.RTS_ROLEID = aro.ARO_ROLEID 
  AND rts.RTS_TASKID = allowed_tasks.task_id
);

-- Remove unauthorized task-territory availabilities for territory 4
-- Delete task availabilities for tasks NOT in the allowed list
--changeset sitmun:25-4 context:dev,prod
DELETE FROM STM_AVAIL_TSK 
WHERE ATS_TERID = 4
AND ATS_TASKID NOT IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 19, 20, 22, 24, 25, 26, 27, 35, 36, 32281, 32282, 32283, 32285, 32286, 32287);

-- Ensure allowed tasks are available to territory 4
-- Insert task availabilities for allowed tasks that don't already exist
--changeset sitmun:25-5 dbms:postgresql
WITH base_id AS (SELECT COALESCE(MAX(ATS_ID), 0) AS base FROM STM_AVAIL_TSK),
allowed_tasks AS (
  SELECT task_id, ROW_NUMBER() OVER (ORDER BY task_id) AS rn
  FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (12), (13), (14), (16), (18), (19), (20), (22), (24), (25), (26), (27), (35), (36), (32281), (32282), (32283), (32285), (32286), (32287)) AS t(task_id)
  WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TERID = 4 AND ATS_TASKID = t.task_id)
)
INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT base_id.base + allowed_tasks.rn, 4, allowed_tasks.task_id, CURRENT_TIMESTAMP
FROM allowed_tasks, base_id;

--changeset sitmun:25-5 dbms:oracle
INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
WITH base_id AS (SELECT COALESCE(MAX(ATS_ID), 0) AS base FROM STM_AVAIL_TSK),
allowed_tasks AS (
  SELECT task_id, ROW_NUMBER() OVER (ORDER BY task_id) AS rn
  FROM (
    SELECT 1 AS task_id FROM DUAL UNION ALL SELECT 2 FROM DUAL UNION ALL SELECT 3 FROM DUAL UNION ALL SELECT 4 FROM DUAL UNION ALL SELECT 5 FROM DUAL UNION ALL 
    SELECT 6 FROM DUAL UNION ALL SELECT 7 FROM DUAL UNION ALL SELECT 8 FROM DUAL UNION ALL SELECT 9 FROM DUAL UNION ALL SELECT 10 FROM DUAL UNION ALL 
    SELECT 12 FROM DUAL UNION ALL SELECT 13 FROM DUAL UNION ALL SELECT 14 FROM DUAL UNION ALL SELECT 16 FROM DUAL UNION ALL SELECT 18 FROM DUAL UNION ALL 
    SELECT 19 FROM DUAL UNION ALL SELECT 20 FROM DUAL UNION ALL SELECT 22 FROM DUAL UNION ALL SELECT 24 FROM DUAL UNION ALL SELECT 25 FROM DUAL UNION ALL 
    SELECT 26 FROM DUAL UNION ALL SELECT 27 FROM DUAL UNION ALL SELECT 35 FROM DUAL UNION ALL SELECT 36 FROM DUAL UNION ALL 
    SELECT 32281 FROM DUAL UNION ALL SELECT 32282 FROM DUAL UNION ALL SELECT 32283 FROM DUAL UNION ALL SELECT 32285 FROM DUAL UNION ALL 
    SELECT 32286 FROM DUAL UNION ALL SELECT 32287 FROM DUAL
  )
  WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TERID = 4 AND ATS_TASKID = task_id)
)
SELECT base_id.base + allowed_tasks.rn, 4, allowed_tasks.task_id, CURRENT_TIMESTAMP
FROM allowed_tasks, base_id;

--changeset sitmun:25-5 dbms:h2
WITH base_id AS (SELECT COALESCE(MAX(ATS_ID), 0) AS base FROM STM_AVAIL_TSK),
allowed_tasks AS (
  SELECT task_id, ROW_NUMBER() OVER (ORDER BY task_id) AS rn
  FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (12), (13), (14), (16), (18), (19), (20), (22), (24), (25), (26), (27), (35), (36), (32281), (32282), (32283), (32285), (32286), (32287)) AS t(task_id)
  WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TERID = 4 AND ATS_TASKID = t.task_id)
)
INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT base_id.base + allowed_tasks.rn, 4, allowed_tasks.task_id, CURRENT_TIMESTAMP
FROM allowed_tasks, base_id;

-- Update sequence after inserts
--changeset sitmun:25-6 context:dev,prod
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';


--changeset sitmun:25-7 dbms:oracle
ALTER TABLE STM_TOKEN_USER MODIFY ACTIVE NUMBER(5,0);