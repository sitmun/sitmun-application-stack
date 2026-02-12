--liquibase formatted sql
--changeset sitmun:22 context:dev,prod

-- Add relationship between layer 4109 and territory 4
INSERT INTO STM_AVAIL_GI (AGI_ID, AGI_GIID, AGI_TERID) VALUES (80, 4109, 4);
UPDATE STM_SEQUENCE SET SEQ_COUNT = 81 WHERE SEQ_NAME = 'AGI_ID';
