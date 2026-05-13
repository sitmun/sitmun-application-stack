--liquibase formatted sql
--changeset sitmun:45-1 context:dev,prod
--
-- After control merge (27), tasks 35/36 are sitna.layerCatalog / sitna.workLayerManager but
-- 29_align_task_names_with_core.sql set TAS_NAME to core seed labels "Events" / "Timetable"
-- (those names apply to different sample query tasks in backend-core seed).
-- Admin-friendly names: https://github.com/sitmun/sitmun-admin-app/issues/370
UPDATE STM_TASK t
SET TAS_NAME = 'Layer Catalog (available layers)'
WHERE t.TAS_ID = 35
  AND EXISTS (
    SELECT 1
    FROM STM_TSK_UI u
    WHERE u.TUI_ID = t.TAS_TUIID
      AND u.TUI_NAME = 'sitna.layerCatalog'
  );

UPDATE STM_TASK t
SET TAS_NAME = 'Work Layer Manager (loaded layers)'
WHERE t.TAS_ID = 36
  AND EXISTS (
    SELECT 1
    FROM STM_TSK_UI u
    WHERE u.TUI_ID = t.TAS_TUIID
      AND u.TUI_NAME = 'sitna.workLayerManager'
  );
