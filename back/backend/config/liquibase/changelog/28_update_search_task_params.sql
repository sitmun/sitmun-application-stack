--liquibase formatted sql
--changeset sitmun:28-1 context:dev,prod

-- Update search placename parameters to new schema
UPDATE STM_TASK
SET TAS_PARAMS = '{"parameters":[{"name":"placename","type":"object","value":"{\"url\":\"https://ide.cime.es/geoserver2/base_referencia/wfs\",\"featurePrefix\":\"base_referencia\",\"featureType\":[\"re007top_nomenclator_aux\"],\"geometryName\":\"the_geom\",\"dataIdProperty\":[\"gid\"],\"queryProperties\":{\"firstQueryWord\":[\"nom\",\"dstipus\",\"dsmun\",\"cerca\"]},\"suggestionListHeader\":{\"labelKey\":\"search.list.placename\",\"colorSource\":\"strokeColor\"},\"outputProperties\":[\"nom\",\"dstipus\",\"dsmun\",\"gid\"],\"suggestionTemplate\":\"{0} ({1}) - {2}\",\"outputFormat\":\"JSON\",\"searchWeight\":7,\"styles\":[{\"point\":{\"radius\":0,\"label\":\"nom\",\"fontColor\":\"#CB0000\",\"fontSize\":14,\"labelOutlineColor\":\"#FFFFFF\",\"labelOutlineWidth\":4}}]}"}]}'
WHERE TAS_ID = 24;
