--liquibase formatted sql
-- ============================================================
-- Add APP_RESPONSIBLE_INSTITUTION to STM_APP (Oracle profile).
-- Built-in position cleanup is owned by BuiltInUserStartupRepairer.
-- ============================================================

--changeset sitmun:08-application-responsible-institution
ALTER TABLE STM_APP ADD APP_RESPONSIBLE_INSTITUTION VARCHAR2(250 CHAR);
--rollback ALTER TABLE STM_APP DROP COLUMN APP_RESPONSIBLE_INSTITUTION;
