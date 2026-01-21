--liquibase formatted sql
--changeset sitmun:30-1 context:dev,prod
--
-- Remove task rows not present in backend-core seed data
DELETE FROM STM_TASK WHERE TAS_ID IN (28, 32, 33);
