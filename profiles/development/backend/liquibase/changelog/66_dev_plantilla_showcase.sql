--liquibase formatted sql
-- Dev Plantilla showcase (table-each + param nesting). Merged former 66 + 67 files.
-- PostgreSQL only (dbms:postgresql). Oracle final-state mirror: 66_dev_plantilla_showcase_oracle.sql
-- Open table-each: /#/taskTemplate/9003/15
-- Open param showcase: /#/taskTemplate/9013/15
-- Contract: plantilla params are declared-only; default ⇒ optional; parent values pass to a child only if that child declares the name.
-- Nested fill 9012 declares nameFilter (see 66g). Menorca OR007RPT_solrustic GFI demo: see 66h.

-- Manual QA fixture for Plantilla Sources + data-sitmun-each table rebind (#441).
-- Open in admin: /#/taskTemplate/9003/15  (Tasks → Templates → "Dev Plantilla table-each (#441)")
-- Sources tab already links consulta_sql + consulta_padron. Template tab has the R-chip table.
-- Sources → Execute on consulta_sql, then Template → Render to expand rows from STM_TSK_UI.
-- Note: 66 inserts a minimal fixture; 66b widens consulta_sql to all STM_TSK_UI columns.

--changeset sitmun:66-dev-plantilla-self-jdbc context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_table_each.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_CONNECT WHERE CON_ID = 90
INSERT INTO STM_CONNECT (CON_ID, CON_NAME, CON_DRIVER, CON_USER, CON_PWD, CON_CONNECTION)
VALUES (
  90,
  'Dev Sitmun self (Plantilla SQL)',
  'org.postgresql.Driver',
  'sitmun3',
  'sitmun3',
  'jdbc:postgresql://postgres:5432/sitmun3'
);
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(CON_ID), 0) + 1 FROM STM_CONNECT) WHERE SEQ_NAME = 'CON_ID';

--changeset sitmun:66-dev-plantilla-sql-sources context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_table_each.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9001
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CONNID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9001,
  'Dev SQL UI controls (consulta_sql)',
  2,
  5,
  90,
  CURRENT_TIMESTAMP,
  '{"parameters":[],"scope":"sql-query","command":"SELECT TUI_NAME AS tui_name FROM STM_TSK_UI ORDER BY TUI_ID LIMIT 10"}'
);

INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CONNID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9002,
  'Dev SQL UI names (consulta_padron)',
  2,
  5,
  90,
  CURRENT_TIMESTAMP,
  '{"parameters":[],"scope":"sql-query","command":"SELECT TUI_NAME AS name FROM STM_TSK_UI ORDER BY TUI_ID DESC LIMIT 5"}'
);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9001), (1, 9002);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9001, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9002, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';

--changeset sitmun:66-dev-plantilla-table-each context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_table_each.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9003
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9003,
  'Dev Plantilla table-each (#441)',
  1,
  15,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"childTaskOrderIds":[9001,9002],"templateHtml":"<p>Dev Plantilla — table each (#441)</p><table data-sitmun-each=\"consulta_sql.rows\"><thead><tr><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_name}}</td></tr></tbody></table>"}$$
);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
VALUES
  (9001, 'template-task', 9003, 9001, 'consulta_sql'),
  (9002, 'template-task', 9003, 9002, 'consulta_padron');

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9003);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9003, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';
INSERT INTO STM_SEQUENCE (SEQ_NAME, SEQ_COUNT)
SELECT 'TAR_ID', (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE NOT EXISTS (SELECT 1 FROM STM_SEQUENCE WHERE SEQ_NAME = 'TAR_ID');
UPDATE STM_SEQUENCE
SET SEQ_COUNT = (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE SEQ_NAME = 'TAR_ID';

--changeset sitmun:66b-dev-plantilla-multicolumn context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_table_each.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9001
UPDATE STM_TASK
SET TAS_PARAMS = '{"parameters":[],"scope":"sql-query","command":"SELECT TUI_ID AS tui_id, TUI_NAME AS tui_name, TUI_ORDER AS tui_order, TUI_TOOLTIP AS tui_tooltip, TUI_TYPE AS tui_type FROM STM_TSK_UI ORDER BY TUI_ID LIMIT 10"}'
WHERE TAS_ID = 9001;

UPDATE STM_TASK
SET TAS_PARAMS = '{"parameters":[],"scope":"sql-query","command":"SELECT TUI_ID AS id, TUI_NAME AS name, TUI_TOOLTIP AS tooltip FROM STM_TSK_UI ORDER BY TUI_ID DESC LIMIT 5"}'
WHERE TAS_ID = 9002;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[],"childTaskOrderIds":[9001,9002],"templateHtml":"<p>Dev Plantilla — table each (#441)</p><table data-sitmun-each=\"consulta_sql.rows\"><thead><tr><th>tui_id</th><th>tui_name</th><th>tui_order</th><th>tui_tooltip</th><th>tui_type</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td><td>{{tui_order}}</td><td>{{tui_tooltip}}</td><td>{{tui_type}}</td></tr></tbody></table>"}$$
WHERE TAS_ID = 9003;

-- Manual QA fixture for Plantilla full placeholder showcase (system vars, $param, URL, nested HTML, each).
-- Open in admin: /#/taskTemplate/9013/15
-- Parameters tab: nameFilter on 9013. Sources → Execute consulta / enllac / fill (nested_sql under fill inherits nameFilter), then Template → Render.
-- Admin Preview has no app/ter coords: APP_*/TERR_* show as bare known names; USER_* may resolve; omit Execute for colored unknown task mustaches.
-- 67d: nested SQL 9014 + parent nameFilter pass-through into fill / nested_sql.
-- 67e: showcase HTML documents how root Parameter defaults merge into nested Execute.
-- 67f: 9014 saved default %zzzz% so parent %sitna% override is visible after Execute fill.

--changeset sitmun:67-dev-plantilla-param-sql context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9010
-- Ensure JDBC 90 from changelog 66 exists (mark-ran if missing so this changeset can wait for 66).
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_CONNECT WHERE CON_ID = 90
-- Param is rowLimit (not limit): client "limit" is reserved for SQL pagination.
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CONNID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9010,
  'Dev SQL UI controls + rowLimit (consulta)',
  2,
  5,
  90,
  CURRENT_TIMESTAMP,
  $${"parameters":[{"name":"rowLimit","label":"rowLimit","type":"query","required":false,"value":"5"}],"scope":"sql-query","command":"SELECT TUI_ID AS tui_id, TUI_NAME AS tui_name, TUI_ORDER AS tui_order, TUI_TOOLTIP AS tui_tooltip, TUI_TYPE AS tui_type FROM STM_TSK_UI ORDER BY TUI_ID LIMIT CAST(${rowLimit} AS bigint)"}$$
);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9010);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9010, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';

--changeset sitmun:67-dev-plantilla-param-link context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9011
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9011,
  'Dev external link (enllac)',
  2,
  5,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"scope":"external-link","command":"https://example.com/demo?app=#{APP_ID}"}$$
);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9011);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9011, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';

--changeset sitmun:67-dev-plantilla-param-nested context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9012
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9012,
  'Dev nested Plantilla (fill)',
  1,
  15,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"templateHtml":"<p>Nested for {{#APP_NAME}}</p>"}$$
);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9012);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9012, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';

--changeset sitmun:67-dev-plantilla-param-showcase context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9013
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9013,
  'Dev Plantilla full param showcase',
  1,
  15,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"childTaskOrderIds":[9010,9011,9012],"templateHtml":"<h1>Dev Plantilla — full param showcase</h1><section><h2>System variables</h2><ul><li>APP_NAME: {{#APP_NAME}}</li><li>APP_ID: {{#APP_ID}}</li><li>TERR_NAME: {{#TERR_NAME}}</li><li>TERR_ID: {{#TERR_ID}}</li><li>USER_NAME: {{#USER_NAME}}</li><li>USER_ID: {{#USER_ID}}</li></ul></section><section><h2>Parameters</h2><p>rowLimit: {{consulta.$rowLimit}}</p></section><section><h2>SQL first-row + table</h2><p>First: {{consulta.tui_name}}</p><table data-sitmun-each=\"consulta.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section><section><h2>URL</h2><p><a href=\"{{enllac.url}}\">{{enllac.url}}</a></p></section><section><h2>Nested HTML</h2>{{fill.html}}</section>"}$$
);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
VALUES
  (9010, 'template-task', 9013, 9010, 'consulta'),
  (9011, 'template-task', 9013, 9011, 'enllac'),
  (9012, 'template-task', 9013, 9012, 'fill');

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9013);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9013, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';
INSERT INTO STM_SEQUENCE (SEQ_NAME, SEQ_COUNT)
SELECT 'TAR_ID', (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE NOT EXISTS (SELECT 1 FROM STM_SEQUENCE WHERE SEQ_NAME = 'TAR_ID');
UPDATE STM_SEQUENCE
SET SEQ_COUNT = (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE SEQ_NAME = 'TAR_ID';

--changeset sitmun:67b-dev-plantilla-param-rowlimit context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9010
-- Repair already-applied 67: rename limit→rowLimit; CAST for PostgreSQL JDBC string bind.
UPDATE STM_TASK
SET TAS_NAME = 'Dev SQL UI controls + rowLimit (consulta)',
    TAS_PARAMS = $${"parameters":[{"name":"rowLimit","label":"rowLimit","type":"query","required":false,"value":"5"}],"scope":"sql-query","command":"SELECT TUI_ID AS tui_id, TUI_NAME AS tui_name, TUI_ORDER AS tui_order, TUI_TOOLTIP AS tui_tooltip, TUI_TYPE AS tui_type FROM STM_TSK_UI ORDER BY TUI_ID LIMIT CAST(${rowLimit} AS bigint)"}$$
WHERE TAS_ID = 9010;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[],"childTaskOrderIds":[9010,9011,9012],"templateHtml":"<h1>Dev Plantilla — full param showcase</h1><section><h2>System variables</h2><ul><li>APP_NAME: {{#APP_NAME}}</li><li>APP_ID: {{#APP_ID}}</li><li>TERR_NAME: {{#TERR_NAME}}</li><li>TERR_ID: {{#TERR_ID}}</li><li>USER_NAME: {{#USER_NAME}}</li><li>USER_ID: {{#USER_ID}}</li></ul></section><section><h2>Parameters</h2><p>rowLimit: {{consulta.$rowLimit}}</p></section><section><h2>SQL first-row + table</h2><p>First: {{consulta.tui_name}}</p><table data-sitmun-each=\"consulta.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section><section><h2>URL</h2><p><a href=\"{{enllac.url}}\">{{enllac.url}}</a></p></section><section><h2>Nested HTML</h2>{{fill.html}}</section>"}$$
WHERE TAS_ID = 9013;

--changeset sitmun:67c-dev-plantilla-param-limit-cast context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9010
-- PostgreSQL: JDBC binds ${rowLimit} as varchar; LIMIT needs CAST(... AS bigint).
UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"rowLimit","label":"rowLimit","type":"query","required":false,"value":"5"}],"scope":"sql-query","command":"SELECT TUI_ID AS tui_id, TUI_NAME AS tui_name, TUI_ORDER AS tui_order, TUI_TOOLTIP AS tui_tooltip, TUI_TYPE AS tui_type FROM STM_TSK_UI ORDER BY TUI_ID LIMIT CAST(${rowLimit} AS bigint)"}$$
WHERE TAS_ID = 9010;

--changeset sitmun:67d-dev-plantilla-nested-namefilter context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9013
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_CONNECT WHERE CON_ID = 90
-- Nested SQL under fill; root 9013 nameFilter defaults forward into nested Execute.
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CONNID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9014,
  'Dev SQL nested nameFilter (nested_sql)',
  2,
  5,
  90,
  CURRENT_TIMESTAMP,
  $${"parameters":[{"name":"nameFilter","label":"nameFilter","type":"string","required":false,"value":"%sitna%"}],"scope":"sql-query","command":"SELECT TUI_ID AS tui_id, TUI_NAME AS tui_name, TUI_ORDER AS tui_order, TUI_TOOLTIP AS tui_tooltip, TUI_TYPE AS tui_type FROM STM_TSK_UI WHERE TUI_NAME ILIKE ${nameFilter} ORDER BY TUI_ID LIMIT 10"}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9014);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9014
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9014);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9014, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9014 AND ATS_TERID = 4);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
SELECT 9014, 'template-task', 9012, 9014, 'nested_sql'
WHERE NOT EXISTS (
  SELECT 1 FROM STM_TASKREL WHERE TAR_TASKID = 9012 AND TAR_TASKRELID = 9014
);

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[],"childTaskOrderIds":[9014],"templateHtml":"<section><h2>Nested Plantilla (fill / 9012)</h2><p>This task declares <strong>no Parameters</strong>. When Execute runs from parent 9013, the backend posts <code>templateTaskId=9013</code>, loads 9013 Parameter defaults, and injects them here as <code>$nameFilter</code> and into child SQL binds.</p><p>APP_NAME (system): {{#APP_NAME}}</p><p>Inherited from parent: <code>$nameFilter</code> = {{$nameFilter}}</p><p>Bound into nested SQL: <code>nested_sql.$nameFilter</code> = {{nested_sql.$nameFilter}}</p><p>First filtered row: {{nested_sql.tui_name}}</p><table data-sitmun-each=\"nested_sql.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section>"}$$
WHERE TAS_ID = 9012;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"nameFilter","label":"nameFilter","type":"string","required":false,"value":"%sitna%"}],"childTaskOrderIds":[9010,9011,9012],"templateHtml":"<h1>Dev Plantilla — full param showcase</h1><section><h2>How parameters work</h2><p>This Plantilla (9013) owns Parameter <code>nameFilter</code> (default <code>%sitna%</code>) on the Parameters tab. Direct Sources children (<code>consulta</code>, <code>enllac</code>) use their own task Parameter definitions (or none). Nested Plantilla <code>fill</code> (9012) has no Parameters of its own.</p><p>On Sources → Execute for a nested child, admin sends the open form id as <code>templateTaskId</code>. The backend merges child params as: <strong>(1)</strong> saved Parameter defaults from that root Plantilla, <strong>(2)</strong> any parameters posted for the current plantilla execute, <strong>(3)</strong> explicit <code>childTaskParameters[taskId]</code> (wins). Undeclared keys on SQL tasks are ignored by the SQL binder.</p><p>Inherited values also appear in nested Handlebars as <code>{{$nameFilter}}</code>. So Execute on <code>fill</code> forwards <code>nameFilter</code> into HTML context and into nested SQL <code>9014</code> (<code>WHERE TUI_NAME ILIKE ${nameFilter}</code>) without re-entering the value on the nested card.</p></section><section><h2>Parameter definitions (static)</h2><ul><li><strong>9013</strong> this Plantilla — <code>nameFilter</code> string, default <code>%sitna%</code> (root; forwarded into nested Execute)</li><li><strong>9010</strong> consulta — <code>rowLimit</code> default <code>5</code> (own Sources card; <code>LIMIT CAST(${rowLimit} AS bigint)</code>)</li><li><strong>9011</strong> enllac — no parameters</li><li><strong>9012</strong> fill — no own parameters; inherits root defaults as <code>$nameFilter</code></li><li><strong>9014</strong> nested_sql (under fill) — <code>nameFilter</code> (same name so inheritance binds <code>${nameFilter}</code>)</li></ul></section><section><h2>Live values (after Execute)</h2><p><code>consulta.$rowLimit</code>: {{consulta.$rowLimit}}</p><p>Parent <code>nameFilter</code> live proof is inside nested HTML below (<code>{{fill.html}}</code> shows <code>$nameFilter</code> and filtered rows).</p></section><section><h2>System variables</h2><ul><li>APP_NAME: {{#APP_NAME}}</li><li>APP_ID: {{#APP_ID}}</li><li>TERR_NAME: {{#TERR_NAME}}</li><li>TERR_ID: {{#TERR_ID}}</li><li>USER_NAME: {{#USER_NAME}}</li><li>USER_ID: {{#USER_ID}}</li></ul></section><section><h2>SQL first-row + table (consulta)</h2><p>First: {{consulta.tui_name}}</p><table data-sitmun-each=\"consulta.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section><section><h2>URL (enllac)</h2><p><a href=\"{{enllac.url}}\">{{enllac.url}}</a></p></section><section><h2>Nested HTML (fill)</h2>{{fill.html}}</section>"}$$
WHERE TAS_ID = 9013;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';
INSERT INTO STM_SEQUENCE (SEQ_NAME, SEQ_COUNT)
SELECT 'TAR_ID', (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE NOT EXISTS (SELECT 1 FROM STM_SEQUENCE WHERE SEQ_NAME = 'TAR_ID');
UPDATE STM_SEQUENCE
SET SEQ_COUNT = (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE SEQ_NAME = 'TAR_ID';

--changeset sitmun:67e-dev-plantilla-param-how-it-works context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9013
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9012
-- Repair already-applied 67d: showcase HTML explains root→nested Parameter inheritance.
UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[],"childTaskOrderIds":[9014],"templateHtml":"<section><h2>Nested Plantilla (fill / 9012)</h2><p>This task declares <strong>no Parameters</strong>. When Execute runs from parent 9013, the backend posts <code>templateTaskId=9013</code>, loads 9013 Parameter defaults, and injects them here as <code>$nameFilter</code> and into child SQL binds.</p><p>APP_NAME (system): {{#APP_NAME}}</p><p>Inherited from parent: <code>$nameFilter</code> = {{$nameFilter}}</p><p>Bound into nested SQL: <code>nested_sql.$nameFilter</code> = {{nested_sql.$nameFilter}}</p><p>First filtered row: {{nested_sql.tui_name}}</p><table data-sitmun-each=\"nested_sql.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section>"}$$
WHERE TAS_ID = 9012;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"nameFilter","label":"nameFilter","type":"string","required":false,"value":"%sitna%"}],"childTaskOrderIds":[9010,9011,9012],"templateHtml":"<h1>Dev Plantilla — full param showcase</h1><section><h2>How parameters work</h2><p>This Plantilla (9013) owns Parameter <code>nameFilter</code> (default <code>%sitna%</code>) on the Parameters tab. Direct Sources children (<code>consulta</code>, <code>enllac</code>) use their own task Parameter definitions (or none). Nested Plantilla <code>fill</code> (9012) has no Parameters of its own.</p><p>On Sources → Execute for a nested child, admin sends the open form id as <code>templateTaskId</code>. The backend merges child params as: <strong>(1)</strong> saved Parameter defaults from that root Plantilla, <strong>(2)</strong> any parameters posted for the current plantilla execute, <strong>(3)</strong> explicit <code>childTaskParameters[taskId]</code> (wins). Undeclared keys on SQL tasks are ignored by the SQL binder.</p><p>Inherited values also appear in nested Handlebars as <code>{{$nameFilter}}</code>. So Execute on <code>fill</code> forwards <code>nameFilter</code> into HTML context and into nested SQL <code>9014</code> (<code>WHERE TUI_NAME ILIKE ${nameFilter}</code>) without re-entering the value on the nested card.</p></section><section><h2>Parameter definitions (static)</h2><ul><li><strong>9013</strong> this Plantilla — <code>nameFilter</code> string, default <code>%sitna%</code> (root; forwarded into nested Execute)</li><li><strong>9010</strong> consulta — <code>rowLimit</code> default <code>5</code> (own Sources card; <code>LIMIT CAST(${rowLimit} AS bigint)</code>)</li><li><strong>9011</strong> enllac — no parameters</li><li><strong>9012</strong> fill — no own parameters; inherits root defaults as <code>$nameFilter</code></li><li><strong>9014</strong> nested_sql (under fill) — <code>nameFilter</code> (same name so inheritance binds <code>${nameFilter}</code>)</li></ul></section><section><h2>Live values (after Execute)</h2><p><code>consulta.$rowLimit</code>: {{consulta.$rowLimit}}</p><p>Parent <code>nameFilter</code> live proof is inside nested HTML below (<code>{{fill.html}}</code> shows <code>$nameFilter</code> and filtered rows).</p></section><section><h2>System variables</h2><ul><li>APP_NAME: {{#APP_NAME}}</li><li>APP_ID: {{#APP_ID}}</li><li>TERR_NAME: {{#TERR_NAME}}</li><li>TERR_ID: {{#TERR_ID}}</li><li>USER_NAME: {{#USER_NAME}}</li><li>USER_ID: {{#USER_ID}}</li></ul></section><section><h2>SQL first-row + table (consulta)</h2><p>First: {{consulta.tui_name}}</p><table data-sitmun-each=\"consulta.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section><section><h2>URL (enllac)</h2><p><a href=\"{{enllac.url}}\">{{enllac.url}}</a></p></section><section><h2>Nested HTML (fill)</h2>{{fill.html}}</section>"}$$
WHERE TAS_ID = 9013;

--changeset sitmun:67f-dev-plantilla-parent-overrides-child-default context:dev dbms:postgresql logicalFilePath:changelog/67_dev_plantilla_param_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9014
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9013
-- Child 9014 keeps a different saved default so parent %sitna% override is visible.
UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"nameFilter","label":"nameFilter","type":"string","required":false,"value":"%zzzz%"}],"scope":"sql-query","command":"SELECT TUI_ID AS tui_id, TUI_NAME AS tui_name, TUI_ORDER AS tui_order, TUI_TOOLTIP AS tui_tooltip, TUI_TYPE AS tui_type FROM STM_TSK_UI WHERE TUI_NAME ILIKE ${nameFilter} ORDER BY TUI_ID LIMIT 10"}$$
WHERE TAS_ID = 9014;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[],"childTaskOrderIds":[9014],"templateHtml":"<section><h2>Nested Plantilla (fill / 9012)</h2><p>No own Parameters. Root 9013 prefills / forwards <code>nameFilter</code>.</p><p>Child SQL 9014 saved default is <code>%zzzz%</code>; parent override should show <code>%sitna%</code> below.</p><p>Inherited <code>$nameFilter</code>: {{$nameFilter}}</p><p>Bound <code>nested_sql.$nameFilter</code>: {{nested_sql.$nameFilter}}</p><p>First filtered row: {{nested_sql.tui_name}}</p><table data-sitmun-each=\"nested_sql.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section>"}$$
WHERE TAS_ID = 9012;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"nameFilter","label":"nameFilter","type":"string","required":false,"value":"%sitna%"}],"childTaskOrderIds":[9010,9011,9012],"templateHtml":"<h1>Dev Plantilla — full param showcase</h1><section><h2>How parameters work</h2><p>This Plantilla (9013) owns Parameter <code>nameFilter</code> (default <code>%sitna%</code>) on the Parameters tab. Direct Sources children (<code>consulta</code>, <code>enllac</code>) use their own task Parameter definitions (or none). Nested Plantilla <code>fill</code> (9012) has no Parameters of its own.</p><p>On Sources → Execute for a nested child, admin sends the open form id as <code>templateTaskId</code>. The backend merges child params as: <strong>(1)</strong> saved Parameter defaults from that root Plantilla, <strong>(2)</strong> any parameters posted for the current plantilla execute, <strong>(3)</strong> explicit <code>childTaskParameters[taskId]</code> (wins). Undeclared keys on SQL tasks are ignored by the SQL binder.</p><p><strong>Parent overrides child default:</strong> nested SQL <code>9014</code> saves its own default <code>%zzzz%</code> (would match nothing useful). Sources under this Plantilla prefills that field from root <code>%sitna%</code>, and Execute on <code>fill</code> binds the parent value unless you edit the nested card. Live proof: <code>nested_sql.$nameFilter</code> should be <code>%sitna%</code>, not <code>%zzzz%</code>.</p><p>Inherited values also appear in nested Handlebars as <code>{{$nameFilter}}</code>.</p></section><section><h2>Parameter definitions (static)</h2><ul><li><strong>9013</strong> this Plantilla — <code>nameFilter</code> string, default <code>%sitna%</code> (root; forwarded / prefills nested)</li><li><strong>9010</strong> consulta — <code>rowLimit</code> default <code>5</code> (own Sources card; <code>LIMIT CAST(${rowLimit} AS bigint)</code>)</li><li><strong>9011</strong> enllac — no parameters</li><li><strong>9012</strong> fill — no own parameters; inherits root defaults as <code>$nameFilter</code></li><li><strong>9014</strong> nested_sql (under fill) — <code>nameFilter</code> saved default <code>%zzzz%</code> (overridden by parent <code>%sitna%</code> when Execute runs from 9013)</li></ul></section><section><h2>Live values (after Execute)</h2><p><code>consulta.$rowLimit</code>: {{consulta.$rowLimit}}</p><p>Parent <code>nameFilter</code> live proof is inside nested HTML below (<code>{{fill.html}}</code> shows <code>$nameFilter</code> / <code>nested_sql.$nameFilter</code> = parent value).</p></section><section><h2>System variables</h2><ul><li>APP_NAME: {{#APP_NAME}}</li><li>APP_ID: {{#APP_ID}}</li><li>TERR_NAME: {{#TERR_NAME}}</li><li>TERR_ID: {{#TERR_ID}}</li><li>USER_NAME: {{#USER_NAME}}</li><li>USER_ID: {{#USER_ID}}</li></ul></section><section><h2>SQL first-row + table (consulta)</h2><p>First: {{consulta.tui_name}}</p><table data-sitmun-each=\"consulta.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section><section><h2>URL (enllac)</h2><p><a href=\"{{enllac.url}}\">{{enllac.url}}</a></p></section><section><h2>Nested HTML (fill)</h2>{{fill.html}}</section>"}$$
WHERE TAS_ID = 9013;

--changeset sitmun:66g-dev-plantilla-declared-only-contract context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9012
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9013
-- 9012 must declare nameFilter so $nameFilter / pass-through remains valid under declared-only contract.
UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"nameFilter","label":"nameFilter","type":"string","required":false}],"childTaskOrderIds":[9014],"templateHtml":"<section><h2>Nested Plantilla (fill / 9012)</h2><p>Declares Parameter <code>nameFilter</code> (no own default). Root 9013 default <code>%sitna%</code> passes through only because this name is declared here.</p><p>Child SQL 9014 saved default is <code>%zzzz%</code>; parent override should show <code>%sitna%</code> below.</p><p>Declared <code>$nameFilter</code>: {{$nameFilter}}</p><p>Bound <code>nested_sql.$nameFilter</code>: {{nested_sql.$nameFilter}}</p><p>First filtered row: {{nested_sql.tui_name}}</p><table data-sitmun-each=\"nested_sql.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section>"}$$
WHERE TAS_ID = 9012;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"nameFilter","label":"nameFilter","type":"string","required":false,"value":"%sitna%"}],"childTaskOrderIds":[9010,9011,9012],"templateHtml":"<h1>Dev Plantilla — full param showcase</h1><section><h2>How parameters work</h2><p>This Plantilla (9013) owns Parameter <code>nameFilter</code> (default <code>%sitna%</code>). Nested Plantilla <code>fill</code> (9012) also <strong>declares</strong> <code>nameFilter</code> (no default) so parent values can enter its <code>$…</code> context. Undeclared keys are dropped. Blank invoke values fall back to saved defaults.</p><p>On Sources → Execute for a nested child, admin sends the open form id as <code>templateTaskId</code>. Effective child params: declared defaults, then non-blank parent/root pipeline values for declared names, then non-blank <code>childTaskParameters[taskId]</code> (wins).</p></section><section><h2>Parameter definitions (static)</h2><ul><li><strong>9013</strong> — <code>nameFilter</code> string, default <code>%sitna%</code></li><li><strong>9010</strong> consulta — <code>rowLimit</code> default <code>5</code></li><li><strong>9011</strong> enllac — no parameters</li><li><strong>9012</strong> fill — declares <code>nameFilter</code> (receives parent value)</li><li><strong>9014</strong> nested_sql — <code>nameFilter</code> saved default <code>%zzzz%</code> (overridden by parent when Execute runs from 9013)</li></ul></section><section><h2>Live values (after Execute)</h2><p><code>consulta.$rowLimit</code>: {{consulta.$rowLimit}}</p><p>Parent <code>nameFilter</code> live proof is inside nested HTML below.</p></section><section><h2>System variables</h2><ul><li>APP_NAME: {{#APP_NAME}}</li><li>APP_ID: {{#APP_ID}}</li><li>TERR_NAME: {{#TERR_NAME}}</li><li>TERR_ID: {{#TERR_ID}}</li><li>USER_NAME: {{#USER_NAME}}</li><li>USER_ID: {{#USER_ID}}</li></ul></section><section><h2>SQL first-row + table (consulta)</h2><p>First: {{consulta.tui_name}}</p><table data-sitmun-each=\"consulta.rows\"><thead><tr><th>tui_id</th><th>tui_name</th></tr></thead><tbody><tr><td>{{tui_id}}</td><td>{{tui_name}}</td></tr></tbody></table></section><section><h2>URL (enllac)</h2><p><a href=\"{{enllac.url}}\">{{enllac.url}}</a></p></section><section><h2>Nested HTML (fill)</h2>{{fill.html}}</section>"}$$
WHERE TAS_ID = 9013;

--changeset sitmun:66h-dev-menorca-solrustic-mia-plantilla context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_GEOINFO WHERE GEO_ID = 4658
-- Enable GFI on OR007RPT_solrustic (GEO 4658 / node 12660) and seed MIA + Plantilla for IDE Menorca.
UPDATE STM_GEOINFO
SET GEO_QUERYABL = true,
    GEO_QUERYACT = true,
    GEO_QUERYLAY = 'OR007RPT_solrustic'
WHERE GEO_ID = 4658;

UPDATE STM_TREE_NOD
SET TNO_ACTIVE = true,
    TNO_QUERYACT = true
WHERE TNO_ID = 12660;

-- Ensure GEO 4658 is a member of a role-visible cartography group (idempotent).
INSERT INTO STM_GGI_GI (GGG_GGIID, GGG_GIID)
SELECT ggi.GGI_ID, 4658
FROM STM_GRP_GI ggi
WHERE ggi.GGI_TYPE = 'C'
  AND NOT EXISTS (
    SELECT 1 FROM STM_GGI_GI x WHERE x.GGG_GIID = 4658
  )
ORDER BY ggi.GGI_ID
LIMIT 1;

INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9020,
  'Dev Plantilla OR007RPT_solrustic',
  1,
  15,
  CURRENT_TIMESTAMP,
  $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"templateHtml":"<p data-e2e-seeded-plantilla=\"or007rpt-solrustic\">E2E seeded Plantilla OR007RPT_solrustic <span data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</span></p>"}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9020);

INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_GIID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9021,
  'Dev MIA OR007RPT_solrustic',
  1,
  16,
  4658,
  CURRENT_TIMESTAMP,
  $${"parentLayout":"tabs","moreInfoAdvanced":true,"childTaskOrderIds":[9020],"parameters":[{"label":"Feature name","value":"name","description":"GFI attribute name"}],"childTaskParameters":{"9020":{"featureName":"name"}}}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9021);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9020
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9020);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9021
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9021);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9020, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9020 AND ATS_TERID = 4);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9021, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9021 AND ATS_TERID = 4);

-- MIA control + FeatureInfo availability on Menorca territory (role 1 already has many; ensure tasks).
INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 43, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 43)
  AND NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 43 AND ATS_TERID = 4);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 8, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 8)
  AND NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 8 AND ATS_TERID = 4);

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';

--changeset sitmun:66i-dev-menorca-solrustic-gfi-attr-mapping context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9020
-- Map GFI attribute `name` → Plantilla `$featureName` for overlay rendering.
UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"templateHtml":"<p data-e2e-seeded-plantilla=\"or007rpt-solrustic\">E2E seeded Plantilla OR007RPT_solrustic <span data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</span></p>"}$$
WHERE TAS_ID = 9020;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parentLayout":"tabs","moreInfoAdvanced":true,"childTaskOrderIds":[9020],"parameters":[{"label":"Feature name","value":"name","description":"GFI attribute name"}],"childTaskParameters":{"9020":{"featureName":"name"}}}$$
WHERE TAS_ID = 9021;

--changeset sitmun:66j-dev-mia-control-task-menorca context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TSK_UI WHERE TUI_NAME = 'sitna.moreInfoAdvanced'
-- Docker seed had the MIA UI control (changelog 59) but no STM_TASK, so profile 12/4 never exposed sitna.moreInfoAdvanced.
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_TUIID, TAS_CREATED
)
SELECT
  43,
  'More Info Advanced',
  1,
  1,
  tui.TUI_ID,
  CURRENT_TIMESTAMP
FROM STM_TSK_UI tui
WHERE tui.TUI_NAME = 'sitna.moreInfoAdvanced'
  AND NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 43)
  AND NOT EXISTS (
    SELECT 1 FROM STM_TASK x WHERE x.TAS_TUIID = tui.TUI_ID
  );

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, t.TAS_ID
FROM STM_TASK t
JOIN STM_TSK_UI tui ON tui.TUI_ID = t.TAS_TUIID
WHERE tui.TUI_NAME = 'sitna.moreInfoAdvanced'
  AND NOT EXISTS (
    SELECT 1 FROM STM_ROL_TSK r WHERE r.RTS_ROLEID = 1 AND r.RTS_TASKID = t.TAS_ID
  );

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, t.TAS_ID, CURRENT_TIMESTAMP
FROM STM_TASK t
JOIN STM_TSK_UI tui ON tui.TUI_ID = t.TAS_TUIID
WHERE tui.TUI_NAME = 'sitna.moreInfoAdvanced'
  AND NOT EXISTS (
    SELECT 1 FROM STM_AVAIL_TSK a WHERE a.ATS_TASKID = t.TAS_ID AND a.ATS_TERID = 4
  );

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';

--changeset sitmun:66k-dev-menorca-ccavalls-mia-plantilla context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_GEOINFO WHERE GEO_ID = 1304
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9021
-- Retarget GFI/MIA from WMS group OR007RPT_solrustic to single layer tu007rts_ccavalls (GEO 1304 / node 12094).
UPDATE STM_GEOINFO
SET GEO_QUERYABL = true,
    GEO_QUERYACT = true,
    GEO_QUERYLAY = 'tu007rts_ccavalls'
WHERE GEO_ID = 1304;

UPDATE STM_TREE_NOD
SET TNO_ACTIVE = true
WHERE TNO_ID IN (12102, 12062);

UPDATE STM_TREE_NOD
SET TNO_ACTIVE = true,
    TNO_QUERYACT = true
WHERE TNO_ID = 12094;

INSERT INTO STM_GGI_GI (GGG_GGIID, GGG_GIID)
SELECT ggi.GGI_ID, 1304
FROM STM_GRP_GI ggi
WHERE ggi.GGI_TYPE = 'C'
  AND NOT EXISTS (
    SELECT 1 FROM STM_GGI_GI x WHERE x.GGG_GIID = 1304
  )
ORDER BY ggi.GGI_ID
LIMIT 1;

UPDATE STM_TASK
SET TAS_NAME = 'Dev Plantilla tu007rts_ccavalls',
    TAS_PARAMS = $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"templateHtml":"<p data-e2e-seeded-plantilla=\"tu007rts-ccavalls\">E2E seeded Plantilla tu007rts_ccavalls <span data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</span></p>"}$$
WHERE TAS_ID = 9020;

UPDATE STM_TASK
SET TAS_NAME = 'Dev MIA tu007rts_ccavalls',
    TAS_GIID = 1304,
    TAS_PARAMS = $${"parentLayout":"tabs","moreInfoAdvanced":true,"childTaskOrderIds":[9020],"parameters":[{"label":"Route name","value":"nomruta","description":"GFI attribute nomruta"}],"childTaskParameters":{"9020":{"featureName":"nomruta"}}}$$
WHERE TAS_ID = 9021;

--changeset sitmun:66l-dev-ccavalls-plantilla-sql-sources context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_CONNECT WHERE CON_ID = 90
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9020
-- Richer Plantilla 9020: three JDBC queries against Sitmun self + GFI $featureName echo.
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CONNID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9022,
  'Dev SQL languages (ccavalls langs)',
  2,
  5,
  90,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"scope":"sql-query","command":"SELECT LAN_ID AS lan_id, LAN_NAME AS lan_name, LAN_SHORTNAME AS lan_shortname FROM STM_LANGUAGE ORDER BY LAN_ID LIMIT 10"}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9022);

INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CONNID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9023,
  'Dev SQL territories (ccavalls territories)',
  2,
  5,
  90,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"scope":"sql-query","command":"SELECT TER_ID AS ter_id, TER_NAME AS ter_name, TER_CODTER AS ter_codter FROM STM_TERRITORY ORDER BY TER_ID LIMIT 8"}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9023);

INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CONNID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9024,
  'Dev SQL GFI echo (ccavalls gfi_echo)',
  2,
  5,
  90,
  CURRENT_TIMESTAMP,
  $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"scope":"sql-query","command":"SELECT CAST(${featureName} AS varchar) AS gfi_route, (SELECT COUNT(*) FROM STM_TSK_UI) AS ui_control_count, (SELECT COUNT(*) FROM STM_TASK) AS task_count"}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9024);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9022
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9022);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9023
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9023);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9024
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9024);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9022, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9022 AND ATS_TERID = 4);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9023, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9023 AND ATS_TERID = 4);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9024, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9024 AND ATS_TERID = 4);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
SELECT 9022, 'template-task', 9020, 9022, 'langs'
WHERE NOT EXISTS (SELECT 1 FROM STM_TASKREL WHERE TAR_TASKID = 9020 AND TAR_TASKRELID = 9022);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
SELECT 9023, 'template-task', 9020, 9023, 'territories'
WHERE NOT EXISTS (SELECT 1 FROM STM_TASKREL WHERE TAR_TASKID = 9020 AND TAR_TASKRELID = 9023);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
SELECT 9024, 'template-task', 9020, 9024, 'gfi_echo'
WHERE NOT EXISTS (SELECT 1 FROM STM_TASKREL WHERE TAR_TASKID = 9020 AND TAR_TASKRELID = 9024);

UPDATE STM_TASK
SET TAS_NAME = 'Dev Plantilla tu007rts_ccavalls',
    TAS_PARAMS = $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"childTaskOrderIds":[9022,9023,9024],"templateHtml":"<article data-e2e-seeded-plantilla=\"tu007rts-ccavalls\"><h2>Camí de cavalls — MIA Plantilla</h2><p>GFI <code>nomruta</code> → <code>$featureName</code>: <strong data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</strong></p><p data-e2e-system-vars=\"\">App <code>{{#APP_NAME}}</code> · Territory <code>{{#TERR_NAME}}</code> · User <code>{{#USER_NAME}}</code></p><section data-e2e-sql=\"langs\"><h3>Languages (JDBC)</h3><p>First: {{langs.lan_name}} (<code>{{langs.lan_shortname}}</code>)</p><table data-sitmun-each=\"langs.rows\"><thead><tr><th>lan_id</th><th>lan_name</th><th>lan_shortname</th></tr></thead><tbody><tr><td>{{lan_id}}</td><td>{{lan_name}}</td><td>{{lan_shortname}}</td></tr></tbody></table></section><section data-e2e-sql=\"territories\"><h3>Territories (JDBC)</h3><p>First: {{territories.ter_name}}</p><table data-sitmun-each=\"territories.rows\"><thead><tr><th>ter_id</th><th>ter_name</th><th>ter_codter</th></tr></thead><tbody><tr><td>{{ter_id}}</td><td>{{ter_name}}</td><td>{{ter_codter}}</td></tr></tbody></table></section><section data-e2e-sql=\"gfi_echo\"><h3>GFI echo + counts (JDBC bind)</h3><p>SQL saw route <code data-e2e-sql-gfi-route=\"\">{{gfi_echo.gfi_route}}</code>; UI controls {{gfi_echo.ui_control_count}}; tasks {{gfi_echo.task_count}}</p></section></article>"}$$
WHERE TAS_ID = 9020;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL) WHERE SEQ_NAME = 'TAR_ID';

--changeset sitmun:66m-dev-ccavalls-mia-multi-plantilla-tabs context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9021
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9024
-- MIA 9021 tabs: Full report (9020) + Route/GFI (9025) + Reference data (9026).
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9025,
  'Dev Plantilla route (GFI)',
  1,
  15,
  CURRENT_TIMESTAMP,
  $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"childTaskOrderIds":[9024],"templateHtml":"<section data-e2e-seeded-plantilla=\"tu007rts-ccavalls-route\"><h2>Route from GFI</h2><p><strong data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</strong></p><p>JDBC echo: <code data-e2e-sql-gfi-route=\"\">{{gfi_echo.gfi_route}}</code></p><p>UI controls {{gfi_echo.ui_control_count}} · tasks {{gfi_echo.task_count}}</p></section>"}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9025);

INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
)
SELECT
  9026,
  'Dev Plantilla reference data',
  1,
  15,
  CURRENT_TIMESTAMP,
  $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"childTaskOrderIds":[9022,9023],"templateHtml":"<section data-e2e-seeded-plantilla=\"tu007rts-ccavalls-ref\"><h2>Reference data</h2><p>GFI context: <span data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</span></p><section data-e2e-sql=\"langs\"><h3>Languages</h3><table data-sitmun-each=\"langs.rows\"><thead><tr><th>lan_id</th><th>lan_name</th><th>lan_shortname</th></tr></thead><tbody><tr><td>{{lan_id}}</td><td>{{lan_name}}</td><td>{{lan_shortname}}</td></tr></tbody></table></section><section data-e2e-sql=\"territories\"><h3>Territories</h3><table data-sitmun-each=\"territories.rows\"><thead><tr><th>ter_id</th><th>ter_name</th><th>ter_codter</th></tr></thead><tbody><tr><td>{{ter_id}}</td><td>{{ter_name}}</td><td>{{ter_codter}}</td></tr></tbody></table></section></section>"}$$
WHERE NOT EXISTS (SELECT 1 FROM STM_TASK WHERE TAS_ID = 9026);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9025
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9025);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID)
SELECT 1, 9026
WHERE NOT EXISTS (SELECT 1 FROM STM_ROL_TSK WHERE RTS_ROLEID = 1 AND RTS_TASKID = 9026);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9025, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9025 AND ATS_TERID = 4);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE((SELECT MAX(ATS_ID) FROM STM_AVAIL_TSK), 0) + 1, 4, 9026, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM STM_AVAIL_TSK WHERE ATS_TASKID = 9026 AND ATS_TERID = 4);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
SELECT 9125, 'template-task', 9025, 9024, 'gfi_echo'
WHERE NOT EXISTS (SELECT 1 FROM STM_TASKREL WHERE TAR_TASKID = 9025 AND TAR_TASKRELID = 9024);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
SELECT 9126, 'template-task', 9026, 9022, 'langs'
WHERE NOT EXISTS (SELECT 1 FROM STM_TASKREL WHERE TAR_TASKID = 9026 AND TAR_TASKRELID = 9022);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
SELECT 9127, 'template-task', 9026, 9023, 'territories'
WHERE NOT EXISTS (SELECT 1 FROM STM_TASKREL WHERE TAR_TASKID = 9026 AND TAR_TASKRELID = 9023);

UPDATE STM_TASK
SET TAS_NAME = 'Dev Plantilla tu007rts_ccavalls (full)',
    TAS_PARAMS = $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"childTaskOrderIds":[9022,9023,9024],"templateHtml":"<article data-e2e-seeded-plantilla=\"tu007rts-ccavalls\"><h2>Camí de cavalls — full report</h2><p>GFI <code>nomruta</code> → <code>$featureName</code>: <strong data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</strong></p><p data-e2e-system-vars=\"\">App <code>{{#APP_NAME}}</code> · Territory <code>{{#TERR_NAME}}</code> · User <code>{{#USER_NAME}}</code></p><section data-e2e-sql=\"langs\"><h3>Languages (JDBC)</h3><p>First: {{langs.lan_name}} (<code>{{langs.lan_shortname}}</code>)</p><table data-sitmun-each=\"langs.rows\"><thead><tr><th>lan_id</th><th>lan_name</th><th>lan_shortname</th></tr></thead><tbody><tr><td>{{lan_id}}</td><td>{{lan_name}}</td><td>{{lan_shortname}}</td></tr></tbody></table></section><section data-e2e-sql=\"territories\"><h3>Territories (JDBC)</h3><p>First: {{territories.ter_name}}</p><table data-sitmun-each=\"territories.rows\"><thead><tr><th>ter_id</th><th>ter_name</th><th>ter_codter</th></tr></thead><tbody><tr><td>{{ter_id}}</td><td>{{ter_name}}</td><td>{{ter_codter}}</td></tr></tbody></table></section><section data-e2e-sql=\"gfi_echo\"><h3>GFI echo + counts (JDBC bind)</h3><p>SQL saw route <code data-e2e-sql-gfi-route=\"\">{{gfi_echo.gfi_route}}</code>; UI controls {{gfi_echo.ui_control_count}}; tasks {{gfi_echo.task_count}}</p></section></article>"}$$
WHERE TAS_ID = 9020;

UPDATE STM_TASK
SET TAS_PARAMS = $${"parentLayout":"tabs","moreInfoAdvanced":true,"childTaskOrderIds":[9020,9025,9026],"parameters":[{"label":"Route name","value":"nomruta","description":"GFI attribute nomruta"}],"childTaskParameters":{"9020":{"featureName":"nomruta"},"9025":{"featureName":"nomruta"},"9026":{"featureName":"nomruta"}}}$$
WHERE TAS_ID = 9021;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL) WHERE SEQ_NAME = 'TAR_ID';

--changeset sitmun:66n-dev-ccavalls-plantilla-all-system-vars context:dev dbms:postgresql logicalFilePath:changelog/66_dev_plantilla_showcase.sql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9020
-- Plantilla 9020: list every configured sitmun.variables.system key.
UPDATE STM_TASK
SET TAS_NAME = 'Dev Plantilla tu007rts_ccavalls (full)',
    TAS_PARAMS = $${"parameters":[{"name":"featureName","label":"featureName","type":"string","required":false}],"childTaskOrderIds":[9022,9023,9024],"templateHtml":"<article data-e2e-seeded-plantilla=\"tu007rts-ccavalls\"><h2>Camí de cavalls — full report</h2><p>GFI <code>nomruta</code> → <code>$featureName</code>: <strong data-e2e-gfi-name=\"{{$featureName}}\">{{$featureName}}</strong></p><section data-e2e-system-vars=\"\"><h3>System variables</h3><ul><li>APP_NAME: <code>{{#APP_NAME}}</code></li><li>APP_ID: <code>{{#APP_ID}}</code></li><li>TERR_NAME: <code>{{#TERR_NAME}}</code></li><li>TERR_ID: <code>{{#TERR_ID}}</code></li><li>TERR_COD: <code>{{#TERR_COD}}</code></li><li>USER_NAME: <code>{{#USER_NAME}}</code></li><li>USER_ID: <code>{{#USER_ID}}</code></li></ul></section><section data-e2e-sql=\"langs\"><h3>Languages (JDBC)</h3><p>First: {{langs.lan_name}} (<code>{{langs.lan_shortname}}</code>)</p><table data-sitmun-each=\"langs.rows\"><thead><tr><th>lan_id</th><th>lan_name</th><th>lan_shortname</th></tr></thead><tbody><tr><td>{{lan_id}}</td><td>{{lan_name}}</td><td>{{lan_shortname}}</td></tr></tbody></table></section><section data-e2e-sql=\"territories\"><h3>Territories (JDBC)</h3><p>First: {{territories.ter_name}}</p><table data-sitmun-each=\"territories.rows\"><thead><tr><th>ter_id</th><th>ter_name</th><th>ter_codter</th></tr></thead><tbody><tr><td>{{ter_id}}</td><td>{{ter_name}}</td><td>{{ter_codter}}</td></tr></tbody></table></section><section data-e2e-sql=\"gfi_echo\"><h3>GFI echo + counts (JDBC bind)</h3><p>SQL saw route <code data-e2e-sql-gfi-route=\"\">{{gfi_echo.gfi_route}}</code>; UI controls {{gfi_echo.ui_control_count}}; tasks {{gfi_echo.task_count}}</p></section></article>"}$$
WHERE TAS_ID = 9020;
