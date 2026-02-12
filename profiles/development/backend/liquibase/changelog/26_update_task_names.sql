--liquibase formatted sql
--changeset sitmun:26-1 context:dev,prod

-- Normalize task names to standard SITNA wording
UPDATE STM_TASK SET TAS_NAME = 'Draw, Measure and Modify (API SITNA)' WHERE TAS_ID = 7;
UPDATE STM_TASK SET TAS_NAME = 'Feature Information (API SITNA)' WHERE TAS_ID = 8;
UPDATE STM_TASK SET TAS_NAME = 'Layer Catalog (API SITNA)' WHERE TAS_ID = 11;
UPDATE STM_TASK SET TAS_NAME = 'Popup Window (API SITNA)' WHERE TAS_ID = 19;
UPDATE STM_TASK SET TAS_NAME = 'Search (API SITNA)' WHERE TAS_ID = 24;
UPDATE STM_TASK SET TAS_NAME = 'Street View (API SITNA)' WHERE TAS_ID = 26;
UPDATE STM_TASK SET TAS_NAME = 'Work Layer Manager (API SITNA)' WHERE TAS_ID = 31;
UPDATE STM_TASK SET TAS_NAME = 'Basemap Selector (API SITNA)' WHERE TAS_ID = 34;
