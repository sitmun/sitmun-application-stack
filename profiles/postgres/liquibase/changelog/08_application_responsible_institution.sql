--liquibase formatted sql
-- ============================================================
-- Add APP_RESPONSIBLE_INSTITUTION to STM_APP (PostgreSQL profile).
-- Built-in position cleanup is owned by BuiltInUserStartupRepairer.
-- ============================================================

--changeset sitmun:08-application-responsible-institution
ALTER TABLE STM_APP ADD COLUMN APP_RESPONSIBLE_INSTITUTION VARCHAR(250);
--rollback ALTER TABLE STM_APP DROP COLUMN APP_RESPONSIBLE_INSTITUTION;
