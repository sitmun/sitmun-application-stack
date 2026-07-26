--liquibase formatted sql
-- ============================================================
-- Add APP_RESPONSIBLE_INSTITUTION to STM_APP.
-- Dev seed: sample institution on application 12 (Menorca IDE / PoC user 9).
-- Built-in position cleanup is owned by BuiltInUserStartupRepairer.
-- ============================================================

--changeset sitmun:53-application-responsible-institution dbms:h2,postgresql
ALTER TABLE STM_APP ADD COLUMN APP_RESPONSIBLE_INSTITUTION VARCHAR(250);
--rollback ALTER TABLE STM_APP DROP COLUMN APP_RESPONSIBLE_INSTITUTION;

--changeset sitmun:53-application-responsible-institution dbms:oracle
ALTER TABLE STM_APP ADD APP_RESPONSIBLE_INSTITUTION VARCHAR2(250 CHAR);
--rollback ALTER TABLE STM_APP DROP COLUMN APP_RESPONSIBLE_INSTITUTION;

--changeset sitmun:53-dev-responsible-institution context:dev
UPDATE STM_APP
SET APP_RESPONSIBLE_INSTITUTION = 'Servei d''Informació Geogràfica de l''administració local de Menorca'
WHERE APP_ID = 12;
--rollback UPDATE STM_APP SET APP_RESPONSIBLE_INSTITUTION = NULL WHERE APP_ID = 12;
