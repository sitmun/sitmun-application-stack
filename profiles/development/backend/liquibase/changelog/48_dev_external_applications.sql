--liquibase formatted sql
--changeset sitmun:48-dev-external-applications context:dev

INSERT INTO STM_APP (APP_ID, APP_NAME, APP_DESCRIPTION, APP_TYPE, APP_TEMPLATE, APP_PRIVATE, APP_UNAVAILABLE, APP_ENTRYM, APP_ENTRYS, APP_CREATED)
VALUES
  (20, 'CIME Geoportal — Menorca', 'External link to the Menorca island council geoportal (CIME).', 'E', 'https://ide.cime.es/visor/', FALSE, FALSE, FALSE, FALSE, CURRENT_TIMESTAMP),
  (21, 'IDENA Geoportal — Navarra', 'External link to the Navarra regional geoportal (IDENA).', 'E', 'https://geoportal.navarra.es/es/idena', FALSE, FALSE, FALSE, FALSE, CURRENT_TIMESTAMP),
  (22, 'IDEBarcelona — Diputació de Barcelona', 'External link to the Barcelona provincial geoportal (IDEBarcelona). Available for Barcelona province and associated municipal public roles.', 'E', 'https://www.diba.cat/ca/web/idebarcelona', FALSE, FALSE, FALSE, FALSE, CURRENT_TIMESTAMP);

INSERT INTO STM_APP_ROL (ARO_APPID, ARO_ROLEID)
VALUES
  (20, 1),
  (21, 180),
  (22, 181);

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(APP_ID), 0) + 1 FROM STM_APP) WHERE SEQ_NAME = 'APP_ID';

INSERT INTO STM_TRANSLATION (TRA_ID, TRA_ELEID, TRA_COLUMN, TRA_LANID, TRA_NAME) VALUES
  (3020701, 20, 'Application.description', 2, 'Enlace externo al geoportal del Consell Insular de Menorca (CIME).'),
  (3020702, 20, 'Application.description', 3, 'Enllaç extern al geoportal del Consell Insular de Menorca (CIME).'),
  (3020703, 20, 'Application.description', 4, 'Ligam extèrn al geoportal del Consell Insular de Menorca (CIME).'),
  (3020704, 20, 'Application.description', 5, 'Lien externe vers le géoportail du conseil insulaire de Minorque (CIME).'),
  (3020705, 21, 'Application.description', 2, 'Enlace externo al geoportal regional de Navarra (IDENA).'),
  (3020706, 21, 'Application.description', 3, 'Enllaç extern al geoportal regional de Navarra (IDENA).'),
  (3020707, 21, 'Application.description', 4, 'Ligam extèrn al geoportal regionau de Navarra (IDENA).'),
  (3020708, 21, 'Application.description', 5, 'Lien externe vers le géoportail régional de Navarra (IDENA).'),
  (3020709, 22, 'Application.description', 2, 'Enlace externo al geoportal provincial de Barcelona (IDEBarcelona). Disponible para la provincia de Barcelona y los roles públicos municipales asociados.'),
  (3020710, 22, 'Application.description', 3, 'Enllaç extern al geoportal provincial de Barcelona (IDEBarcelona). Disponible per a la província de Barcelona i els rols públics municipals associats.'),
  (3020711, 22, 'Application.description', 4, 'Ligam extèrn al geoportal provinciau de Barcelona (IDEBarcelona). Disponible ta la província de Barcelona e los ròls publics municipaus associats.'),
  (3020712, 22, 'Application.description', 5, 'Lien externe vers le géoportail provincial de Barcelone (IDEBarcelona). Disponible pour la province de Barcelone et les rôles publics municipaux associés.');

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TRA_ID), 0) + 1 FROM STM_TRANSLATION) WHERE SEQ_NAME = 'TRA_ID';
