--liquibase formatted sql
-- ============================================================
-- DEV fixture users for testing the admin user form.
-- Username              Scenario / form state
-- ------------------------------------------------------------
-- admin                 Built-in admin: info banner, locked fields, no warnings
-- public                Built-in public: info banner, no PII/password fields
-- restringit - Menorca  position-without-details warning (user id=4)
-- dev-no-password       no-password warning
-- dev-no-roles          no-roles warning
-- dev-role-no-pos       role-without-position warning
-- dev-blocked           blocked=true account, no warnings
-- dev-complete          healthy: roles+positions+app association, no warnings
-- dev-administrator     non-built-in administrator, no warnings
-- ============================================================

--changeset sitmun:47-drop-pos-uk dbms:postgresql
-- Remove unique key on (POS_USERID, POS_TERID) to allow multiple positions
-- per user+territory. PostgreSQL schema never created this key; use IF EXISTS
-- so this is safe on both fresh installs and any DB where changelog 20 ran.
ALTER TABLE STM_POST DROP CONSTRAINT IF EXISTS UKT67T88DOKIXQN9VEHTT1AEJ1X;

--changeset sitmun:47-drop-pos-uk dbms:h2
ALTER TABLE STM_POST DROP CONSTRAINT IF EXISTS STM_POS_UK;

--changeset sitmun:47-drop-pos-uk dbms:oracle failOnError:false
-- Oracle schema (01_schema.oracle.sql) creates this UK; drop it to allow
-- multiple positions per territory. failOnError:false handles the case where
-- a previous migration already dropped it.
ALTER TABLE STM_POST DROP CONSTRAINT UKT67T88DOKIXQN9VEHTT1AEJ1X;

--changeset sitmun:47-fix-builtin-positions context:dev
-- Move position 6963 from built-in public user (id=2) to normal dev user (id=4).
-- Built-in admin and public users must not hold UserPosition rows (startup invariant).
UPDATE STM_POST SET POS_USERID = 4 WHERE POS_ID = 6963 AND POS_USERID = 2;
DELETE FROM STM_POST WHERE POS_USERID IN (1, 2);
-- Add a role for user 4 (restringit - Menorca) on territory 6 (Barcelona province),
-- matching position 6963 which has null name/org. Opening user 4 in the admin form
-- shows the position-without-details warning.
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (25, FALSE, CURRENT_TIMESTAMP, 181, 6, 4);

--changeset sitmun:47-dev-user-fixtures context:dev
-- Insert example users (ids 5-10) that exercise every supported user-form scenario.
-- Password hash ($2y$10$...) is the bcrypt hash of 'sitmun' (same as user 4).
INSERT INTO STM_USER (USE_ID, USE_USER, USE_PWD, USE_NAME, USE_SURNAME, USE_EMAIL, USE_ADM, USE_BLOCKED, USE_CREATED)
VALUES
  (5,  'dev-no-password',   NULL,
       'No', 'Password', 'dev-no-password@example.com',     FALSE, FALSE, CURRENT_TIMESTAMP),
  (6,  'dev-no-roles',      '$2y$10$/eaDr1MoA126Pio7bFLkfeSMXYfSnEAiVX0TLMIwbGovxNyO5jJdS',
       'No', 'Roles',    'dev-no-roles@example.com',        FALSE, FALSE, CURRENT_TIMESTAMP),
  (7,  'dev-role-no-pos',   '$2y$10$/eaDr1MoA126Pio7bFLkfeSMXYfSnEAiVX0TLMIwbGovxNyO5jJdS',
       'Role', 'No Position', 'dev-role-no-pos@example.com', FALSE, FALSE, CURRENT_TIMESTAMP),
  (8,  'dev-blocked',       '$2y$10$/eaDr1MoA126Pio7bFLkfeSMXYfSnEAiVX0TLMIwbGovxNyO5jJdS',
       'Blocked', 'User', 'dev-blocked@example.com',        FALSE, TRUE,  CURRENT_TIMESTAMP),
  (9,  'dev-complete',      '$2y$10$/eaDr1MoA126Pio7bFLkfeSMXYfSnEAiVX0TLMIwbGovxNyO5jJdS',
       'Complete', 'User', 'dev-complete@example.com',      FALSE, FALSE, CURRENT_TIMESTAMP),
  (10, 'dev-administrator', '$2y$10$/eaDr1MoA126Pio7bFLkfeSMXYfSnEAiVX0TLMIwbGovxNyO5jJdS',
       'Dev', 'Administrator', 'dev-administrator@example.com', TRUE, FALSE, CURRENT_TIMESTAMP);

-- Roles (STM_USR_CONF):
-- dev-no-password (5): role on territory 4 (Menorca) — has complete position, only no-password warns
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (26, FALSE, CURRENT_TIMESTAMP, 1, 4, 5);
-- dev-no-roles (6): no roles at all — no-roles warning
-- dev-role-no-pos (7): role on territory 7 (Manlleu), no matching position — role-without-position warning
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (27, FALSE, CURRENT_TIMESTAMP, 181, 7, 7);
-- dev-blocked (8): role on territory 4 (Menorca), has complete position, no warnings
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (28, FALSE, CURRENT_TIMESTAMP, 1, 4, 8);
-- dev-complete (9): two roles on two territories; UCO_ROLEM=true on territory 4 exercises
-- the appliesToChildrenTerritories boolean column in the Roles grid
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (29, TRUE,  CURRENT_TIMESTAMP, 1,   4, 9);
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (30, FALSE, CURRENT_TIMESTAMP, 181, 7, 9);
-- dev-administrator (10): role on territory 4 (Menorca), has complete position, no warnings
INSERT INTO STM_USR_CONF (UCO_ID, UCO_ROLEM, UCO_CREATED, UCO_ROLEID, UCO_TERID, UCO_USERID)
VALUES (31, FALSE, CURRENT_TIMESTAMP, 1,   4, 10);

-- Positions (STM_POST):
-- dev-no-password (5): complete position on territory 4
INSERT INTO STM_POST (POS_ID, POS_POST, POS_ORG, POS_EMAIL, POS_CREATED, POS_TERID, POS_USERID)
VALUES (6964, 'Tècnic/a SIG', 'Consell Insular de Menorca', 'dev-no-password@example.com', CURRENT_TIMESTAMP, 4, 5);
-- dev-blocked (8): complete position on territory 4
INSERT INTO STM_POST (POS_ID, POS_POST, POS_ORG, POS_EMAIL, POS_CREATED, POS_TERID, POS_USERID)
VALUES (6965, 'Tècnic/a SIG', 'Consell Insular de Menorca', 'dev-blocked@example.com', CURRENT_TIMESTAMP, 4, 8);
-- dev-complete (9): two positions on territory 4 (multi-position per territory demo)
INSERT INTO STM_POST (POS_ID, POS_POST, POS_ORG, POS_EMAIL, POS_CREATED, POS_TERID, POS_USERID)
VALUES (6966, 'Responsable SIG', 'Diputació de Barcelona', 'dev-complete@example.com', CURRENT_TIMESTAMP, 4, 9);
INSERT INTO STM_POST (POS_ID, POS_POST, POS_ORG, POS_EMAIL, POS_CREATED, POS_TERID, POS_USERID)
VALUES (6967, 'Coordinador/a de dades', 'Diputació de Barcelona', 'dev-complete@example.com', CURRENT_TIMESTAMP, 4, 9);
-- dev-complete (9): position on territory 7 (Manlleu) to match second role
INSERT INTO STM_POST (POS_ID, POS_POST, POS_ORG, POS_EMAIL, POS_CREATED, POS_TERID, POS_USERID)
VALUES (6968, 'Tècnic/a SIG', 'Ajuntament de Manlleu', 'dev-complete@example.com', CURRENT_TIMESTAMP, 7, 9);
-- dev-administrator (10): complete position on territory 4
INSERT INTO STM_POST (POS_ID, POS_POST, POS_ORG, POS_EMAIL, POS_CREATED, POS_TERID, POS_USERID)
VALUES (6969, 'Administrador/a SIG', 'SITMUN', 'dev-administrator@example.com', CURRENT_TIMESTAMP, 4, 10);

-- Applications-as-contact: dev-complete (9) is the creator/contact for the Menorca IDE app
UPDATE STM_APP SET APP_CREATORID = 9 WHERE APP_ID = 12;

--changeset sitmun:47-dev-sequences context:dev
-- Advance sequence counters to avoid PK collisions with rows inserted above.
-- Use the MAX+1 pattern so this is safe even if IDs were already partially updated.
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(USE_ID), 0) + 1 FROM STM_USER)     WHERE SEQ_NAME = 'USE_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(UCO_ID), 0) + 1 FROM STM_USR_CONF) WHERE SEQ_NAME = 'UCO_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(POS_ID), 0) + 1 FROM STM_POST)     WHERE SEQ_NAME = 'POS_ID';
