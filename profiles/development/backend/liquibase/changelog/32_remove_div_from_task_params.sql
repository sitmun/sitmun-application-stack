--liquibase formatted sql
--changeset sitmun:32-1 context:dev,prod

-- Remove div parameter from printMap task configuration
UPDATE STM_TASK
SET TAS_PARAMS = '{"parameters":[{"name":"logo","type":"string","value":"https://ide.cime.es/stm3/admin/assets/img/logos/logo_sitmun.svg"},{"name":"legend","type":"object","value":"{\"visible\":true}"}]}'
WHERE TAS_ID = 20;
