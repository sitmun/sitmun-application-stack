--liquibase formatted sql
--changeset sitmun:49-dev-dashboard-fixtures context:dev

-- Role for authenticated-only (private) dashboard fixtures.
INSERT INTO STM_ROLE (ROL_ID, ROL_NOTE, ROL_NAME)
VALUES (199, 'Dev private dashboard fixtures', 'Dev dashboard private');

-- Territory descriptions and one child territory for hierarchy demos.
UPDATE STM_TERRITORY
SET TER_DESCRIPTION = 'Balearic island used for public dashboard search, filtering, and multi-app card layout demos.'
WHERE TER_ID = 4;

UPDATE STM_TERRITORY
SET TER_DESCRIPTION = 'Regional territory for Navarra geoportal and cross-territory search suggestions.'
WHERE TER_ID = 5;

UPDATE STM_TERRITORY
SET TER_DESCRIPTION = 'Provincial territory for Barcelona geoportals and parent/child territory navigation.'
WHERE TER_ID = 6;

INSERT INTO STM_TERRITORY (
  TER_ID, TER_BLOCKED, TER_CODTER, TER_CREATED, TER_EXTENT, TER_CENTER, TER_ZOOM,
  TER_NAME, TER_SCOPE, TER_GTYPID, TER_TYPID, TER_DESCRIPTION
)
VALUES (
  11, FALSE, '08019', CURRENT_TIMESTAMP,
  '422000 4580000 430000 4590000', '426000 4585000', 12,
  'Test Municipality', 'M', NULL, 6,
  'Municipal child territory under Barcelona province for hierarchy and layout testing.'
);

INSERT INTO STM_GRP_TER (GTE_TERID, GTE_TERMID)
VALUES (6, 11);

-- Named application variants (IDs 30–37) for dashboard QA matrix.
INSERT INTO STM_APP (
  APP_ID, APP_NAME, APP_TITLE, APP_DESCRIPTION, APP_TYPE, APP_TEMPLATE,
  APP_PRIVATE, APP_UNAVAILABLE, APP_MAINTENANCE_INFORMATION,
  APP_ENTRYM, APP_ENTRYS, APP_REFRESH, APP_SCALES, APP_PROJECT, APP_THEME, APP_GGIID, APP_CREATED
)
VALUES
  (
    30, 'IDE Menorca — Multi territory', 'IDE genèric Menorca — Multi territory',
    'Multi-territory app (Menorca, Navarra, Barcelona)',
    'I', ' ', FALSE, FALSE, NULL, FALSE, FALSE, TRUE,
    '2000000,1000000,700000,600000,500000,250000,100000,75000,50000,25000,20000,15000,10000,5000,2000,1000,500',
    'EPSG:25831', 'sitmun-base', 3, CURRENT_TIMESTAMP
  ),
  (
    31, 'IDE Menorca — Private', 'IDE genèric Menorca — Private',
    'Private internal app (role-restricted)',
    'I', ' ', TRUE, FALSE, NULL, FALSE, FALSE, TRUE,
    '2000000,1000000,700000,600000,500000,250000,100000,75000,50000,25000,20000,15000,10000,5000,2000,1000,500',
    'EPSG:25831', 'sitmun-base', 3, CURRENT_TIMESTAMP
  ),
  (
    32, 'IDE Menorca — Private external', 'IDE genèric Menorca — Private external',
    'Private external link (role-restricted)',
    'E', 'https://example.com/dev-private-external', TRUE, FALSE, NULL, FALSE, FALSE, FALSE,
    NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP
  ),
  (
    33, 'IDE Menorca — Maintenance', 'IDE genèric Menorca — Maintenance',
    'Unavailable app for maintenance messaging',
    'I', ' ', FALSE, TRUE, 'Scheduled maintenance until further notice. Try again later.',
    FALSE, FALSE, TRUE,
    '2000000,1000000,700000,600000,500000,250000,100000,75000,50000,25000,20000,15000,10000,5000,2000,1000,500',
    'EPSG:25831', 'sitmun-base', 3, CURRENT_TIMESTAMP
  ),
  (
    34, 'IDE Menorca — Long title QA', 'IDE genèric Menorca — Long title for truncation and card height checks',
    'Long labels for card truncation testing',
    'I', ' ', FALSE, FALSE, NULL, FALSE, FALSE, TRUE,
    '2000000,1000000,700000,600000,500000,250000,100000,75000,50000,25000,20000,15000,10000,5000,2000,1000,500',
    'EPSG:25831', 'sitmun-base', 3, CURRENT_TIMESTAMP
  ),
  (
    35, 'Menorca coastal — Dev fixture A', 'Menorca coastal data — Dev fixture A',
    'Coastal data app for multi-card layouts',
    'I', ' ', FALSE, FALSE, NULL, FALSE, FALSE, TRUE,
    '2000000,1000000,700000,600000,500000,250000,100000,75000,50000,25000,20000,15000,10000,5000,2000,1000,500',
    'EPSG:25831', 'sitmun-base', 3, CURRENT_TIMESTAMP
  ),
  (
    36, 'Menorca urban — Dev fixture B', 'Menorca urban planning — Dev fixture B',
    'Urban planning app for batch loading tests',
    'I', ' ', FALSE, FALSE, NULL, FALSE, FALSE, TRUE,
    '2000000,1000000,700000,600000,500000,250000,100000,75000,50000,25000,20000,15000,10000,5000,2000,1000,500',
    'EPSG:25831', 'sitmun-base', 3, CURRENT_TIMESTAMP
  ),
  (
    37, 'Menorca environment — Dev fixture C', 'Menorca environment — Dev fixture C',
    'Environment app for "show more" testing',
    'I', ' ', FALSE, FALSE, NULL, FALSE, FALSE, TRUE,
    '2000000,1000000,700000,600000,500000,250000,100000,75000,50000,25000,20000,15000,10000,5000,2000,1000,500',
    'EPSG:25831', 'sitmun-base', 3, CURRENT_TIMESTAMP
  );

INSERT INTO STM_APP_ROL (ARO_APPID, ARO_ROLEID)
VALUES
  (30, 1),
  (33, 1),
  (34, 1),
  (35, 1),
  (36, 1),
  (37, 1),
  (31, 199),
  (32, 199);

INSERT INTO STM_APP_TER (ATE_ID, ATE_APPID, ATE_TERID)
VALUES
  (100, 30, 4),
  (101, 30, 5),
  (102, 30, 6),
  (103, 31, 4),
  (104, 33, 4),
  (105, 34, 4),
  (106, 35, 4),
  (107, 36, 4),
  (108, 37, 4),
  (109, 32, 4);

-- dev-complete (9) can see private dashboard fixtures.
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (1999, FALSE, CURRENT_TIMESTAMP, 199, 4, 9);

-- admin:admin (1) can also see private dashboard fixtures in Menorca.
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (2000, FALSE, CURRENT_TIMESTAMP, 199, 4, 1);

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(APP_ID), 0) + 1 FROM STM_APP) WHERE SEQ_NAME = 'APP_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TER_ID), 0) + 1 FROM STM_TERRITORY) WHERE SEQ_NAME = 'TER_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATE_ID), 0) + 1 FROM STM_APP_TER) WHERE SEQ_NAME = 'ATE_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(UCO_ID), 0) + 1 FROM STM_USR_CONF) WHERE SEQ_NAME = 'UCO_ID';
