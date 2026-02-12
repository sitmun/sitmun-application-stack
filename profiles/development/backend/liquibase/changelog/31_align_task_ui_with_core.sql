--liquibase formatted sql
--changeset sitmun:31-1 context:dev,prod
--
-- Align task UI controls with backend-core seed data
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.attribution', TUI_TOOLTIP = 'attribution', TUI_ORDER = 1 WHERE TUI_ID = 1;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.basemapSelector', TUI_TOOLTIP = 'basemapSelector', TUI_ORDER = 2 WHERE TUI_ID = 2;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.click', TUI_TOOLTIP = 'click', TUI_ORDER = 3 WHERE TUI_ID = 3;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.coordinates', TUI_TOOLTIP = 'coordinates', TUI_ORDER = 4 WHERE TUI_ID = 4;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.dataLoader', TUI_TOOLTIP = 'dataLoader', TUI_ORDER = 5 WHERE TUI_ID = 5;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.download', TUI_TOOLTIP = 'download', TUI_ORDER = 6 WHERE TUI_ID = 6;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.drawMeasureModify', TUI_TOOLTIP = 'drawMeasureModify', TUI_ORDER = 7 WHERE TUI_ID = 7;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.featureInfo', TUI_TOOLTIP = 'featureInfo', TUI_ORDER = 8 WHERE TUI_ID = 8;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.fullScreen', TUI_TOOLTIP = 'fullScreen', TUI_ORDER = 9 WHERE TUI_ID = 9;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.geolocation', TUI_TOOLTIP = 'geolocation', TUI_ORDER = 10 WHERE TUI_ID = 10;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.layerCatalog', TUI_TOOLTIP = 'layerCatalog', TUI_ORDER = 11 WHERE TUI_ID = 11;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.legend', TUI_TOOLTIP = 'legend', TUI_ORDER = 12 WHERE TUI_ID = 12;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.loadingIndicator', TUI_TOOLTIP = 'loadingIndicator', TUI_ORDER = 13 WHERE TUI_ID = 13;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.measure', TUI_TOOLTIP = 'measure', TUI_ORDER = 14 WHERE TUI_ID = 14;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.multiFeatureInfo', TUI_TOOLTIP = 'multiFeatureInfo', TUI_ORDER = 15 WHERE TUI_ID = 15;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.navBar', TUI_TOOLTIP = 'navBar', TUI_ORDER = 16 WHERE TUI_ID = 16;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.offlineMapMaker', TUI_TOOLTIP = 'offlineMapMaker', TUI_ORDER = 17 WHERE TUI_ID = 17;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.overviewMap', TUI_TOOLTIP = 'overviewMap', TUI_ORDER = 18 WHERE TUI_ID = 18;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.popup', TUI_TOOLTIP = 'popup', TUI_ORDER = 19 WHERE TUI_ID = 19;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.printMap', TUI_TOOLTIP = 'printMap', TUI_ORDER = 20 WHERE TUI_ID = 20;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.scale', TUI_TOOLTIP = 'scale', TUI_ORDER = 21 WHERE TUI_ID = 21;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.scaleBar', TUI_TOOLTIP = 'scaleBar', TUI_ORDER = 22 WHERE TUI_ID = 22;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.scaleSelector', TUI_TOOLTIP = 'scaleSelector', TUI_ORDER = 23 WHERE TUI_ID = 23;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.search', TUI_TOOLTIP = 'search', TUI_ORDER = 24 WHERE TUI_ID = 24;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.share', TUI_TOOLTIP = 'share', TUI_ORDER = 25 WHERE TUI_ID = 25;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.streetView', TUI_TOOLTIP = 'streetView', TUI_ORDER = 26 WHERE TUI_ID = 26;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.threed', TUI_TOOLTIP = 'threed', TUI_ORDER = 27 WHERE TUI_ID = 27;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.WFSEdit', TUI_TOOLTIP = 'WFSEdit', TUI_ORDER = 29 WHERE TUI_ID = 29;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.WFSQuery', TUI_TOOLTIP = 'WFSQuery', TUI_ORDER = 30 WHERE TUI_ID = 30;
UPDATE STM_TSK_UI SET TUI_NAME = 'sitna.workLayerManager', TUI_TOOLTIP = 'workLayerManager', TUI_ORDER = 31 WHERE TUI_ID = 31;
DELETE FROM STM_TSK_UI WHERE TUI_ID IN (28, 32, 33);
