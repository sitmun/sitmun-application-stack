--liquibase formatted sql
--changeset sitmun:40-1 context:dev,prod
--
-- Rename sitna.moreInfo to sitmun.moreInfo
-- Addresses GitHub issue #31: https://github.com/sitmun/sitmun-application-stack/issues/31
UPDATE STM_TSK_UI SET TUI_NAME = 'sitmun.moreInfo' WHERE TUI_NAME = 'sitna.moreInfo';
