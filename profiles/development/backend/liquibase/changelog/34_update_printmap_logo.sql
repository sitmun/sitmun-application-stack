--liquibase formatted sql
--changeset sitmun:34-1 context:dev,prod

-- Update Print Map task logo to a CORS-friendly URL (GitHub avatars) instead of ide.cime.es asset
UPDATE STM_TASK
SET TAS_PARAMS = '{"parameters":[{"name":"logo","type":"string","value":"https://avatars.githubusercontent.com/u/24718368?s=200&v=4"},{"name":"legend","type":"object","value":"{\"visible\":true}"}]}'
WHERE TAS_ID = 20;
