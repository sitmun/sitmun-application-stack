--liquibase formatted sql
-- Upgrade LTR_LITERAL / LTV_VALUE from TEXT to VARCHAR(4000) before MIA chrome seeds.

--changeset sitmun:17-literal-translations-varchar dbms:postgresql
--preconditions onFail:MARK_RAN
--precondition-table-exists table:STM_LITERAL_TRANSLATION
ALTER TABLE STM_LITERAL_TRANSLATION ALTER COLUMN LTR_LITERAL TYPE VARCHAR(4000);
ALTER TABLE STM_LITERAL_TRANSLATION_VALUE ALTER COLUMN LTV_VALUE TYPE VARCHAR(4000);
