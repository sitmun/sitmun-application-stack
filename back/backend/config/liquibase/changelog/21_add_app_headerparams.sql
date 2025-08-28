--liquibase formatted sql
--changeset sitmun:21 dbms:postgresql

-- Add APP_HEADERPARAMS column to STM_APP table for PostgreSQL
ALTER TABLE STM_APP ADD COLUMN APP_HEADERPARAMS TEXT;

--changeset sitmun:21 dbms:oracle

-- Add APP_HEADERPARAMS column to STM_APP table for Oracle
ALTER TABLE STM_APP ADD APP_HEADERPARAMS CLOB;

--changeset sitmun:21 dbms:h2

-- Add APP_HEADERPARAMS column to STM_APP table for H2
ALTER TABLE STM_APP ADD COLUMN APP_HEADERPARAMS CLOB;
