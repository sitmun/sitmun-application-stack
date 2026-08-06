--liquibase formatted sql
-- Dev Plantilla TipTap chip/attr-mustache QA fixture + media placeholders + edited shapes.
-- PostgreSQL only (dbms:postgresql). Oracle final-state mirror: 69_dev_plantilla_tiptap_chip_fixes_oracle.sql
-- Open: /#/taskTemplate/9030/15
-- QA: visual ↔ HTML; mustache img/iframe show placeholders; select media for src/alt/title inspector;
--      Sources → Execute foto; Template → Render (preview links open in a new tab).
-- Expect: src/href mustaches stay attributes; no chip scaffolding; comments and else-if intact;
--         div stays div; bare table cells stay bare; authored link has no target/rel;
--         single-quoted data-sitmun-each renames with Source alias.
-- Latest templateHtml applied by changeset sitmun:69-dev-plantilla-tiptap-chip-fixes-qa-media-ux.

--changeset sitmun:69-dev-plantilla-tiptap-url-child context:dev dbms:postgresql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9031
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9031,
  'Dev URL foto (TipTap chip QA)',
  2,
  5,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"scope":"external-link","command":"https://sitmun.org/Documents/Imatges/8601img1320230421013907.jpg"}$$
);

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9031);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9031, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';

--changeset sitmun:69-dev-plantilla-tiptap-chip-fixes context:dev dbms:postgresql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:0 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9030
INSERT INTO STM_TASK (
  TAS_ID, TAS_NAME, TAS_GTASKID, TAS_TTASKID, TAS_CREATED, TAS_PARAMS
) VALUES (
  9030,
  'Dev Plantilla TipTap chip fixes (attr/else/comment)',
  1,
  15,
  CURRENT_TIMESTAMP,
  $${"parameters":[],"childTaskOrderIds":[9031],"templateHtml":"<h1>Dev Plantilla — TipTap chip / attr mustaches</h1><p><strong>QA (editor):</strong> Attribute mustaches stay literal. Broken images and a relative iframe (often the local nginx page) are expected until Sources → Execute <code>foto</code> and Template → Render. Hover the first image for title <code>{{#APP_NAME}}</code>. Binding under test: Source alias <code>foto</code> → <code>{{foto.url}}</code>.</p><!-- tip: {{foto.url}} must stay in comment after visual round-trip --><section data-e2e-attr-dq=\"\"><h2>Double-quoted attrs</h2><p>Broken img + iframe until preview; link href must stay <code>{{foto.url}}</code>.</p><img src=\"{{foto.url}}\" alt=\"{{foto.url}}\" title=\"{{#APP_NAME}}\"><p><a href=\"{{foto.url}}\">open photo</a></p><iframe src=\"{{foto.url}}\" width=\"320\" height=\"180\" title=\"foto\"></iframe></section><section data-e2e-attr-sq=\"\"><h2>Single-quoted attrs</h2><p>Same contract with single-quoted src/alt.</p><img src='{{foto.url}}' alt='photo'></section><section data-e2e-text-chips=\"\"><h2>Text chips</h2><p>These mustaches should appear as chips (not attributes).</p><p>{{foto.url}}</p><p>{{#APP_NAME}}</p></section><section data-e2e-else-if=\"\"><h2>else if</h2><p>Structural chips for if / else if / else / close.</p>{{#if foto.url}}<p>has-url</p>{{else if foto.contentUrl}}<p>has-content</p>{{else}}<p>missing</p>{{/if}}</section><section data-e2e-shape-preserve=\"\"><h2>Edited shape preservation</h2><p>After a sibling visual edit: keep div, bare table cells (no colgroup/min-width), authored link without target/rel.</p><div class=\"box\"><p>keep-div</p></div><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><p><a href=\"https://example.com/authored\">authored-link</a></p></section>"}$$
);

INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
VALUES (9030, 'template-task', 9030, 9031, 'foto');

INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9030);

INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9030, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(TAS_ID), 0) + 1 FROM STM_TASK) WHERE SEQ_NAME = 'TAS_ID';
UPDATE STM_SEQUENCE SET SEQ_COUNT = (SELECT COALESCE(MAX(ATS_ID), 0) + 1 FROM STM_AVAIL_TSK) WHERE SEQ_NAME = 'ATS_ID';
INSERT INTO STM_SEQUENCE (SEQ_NAME, SEQ_COUNT)
SELECT 'TAR_ID', (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE NOT EXISTS (SELECT 1 FROM STM_SEQUENCE WHERE SEQ_NAME = 'TAR_ID');
UPDATE STM_SEQUENCE
SET SEQ_COUNT = (SELECT COALESCE(MAX(TAR_ID), 0) + 1 FROM STM_TASKREL)
WHERE SEQ_NAME = 'TAR_ID';

--changeset sitmun:69-dev-plantilla-tiptap-chip-fixes-qa-captions context:dev dbms:postgresql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9030
-- Refresh templateHtml captions for DBs that already applied the insert changeset.
UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[],"childTaskOrderIds":[9031],"templateHtml":"<h1>Dev Plantilla — TipTap chip / attr mustaches</h1><p><strong>QA (editor):</strong> Attribute mustaches stay literal. Broken images and a relative iframe (often the local nginx page) are expected until Sources → Execute <code>foto</code> and Template → Render. Hover the first image for title <code>{{#APP_NAME}}</code>. Binding under test: Source alias <code>foto</code> → <code>{{foto.url}}</code>.</p><!-- tip: {{foto.url}} must stay in comment after visual round-trip --><section data-e2e-attr-dq=\"\"><h2>Double-quoted attrs</h2><p>Broken img + iframe until preview; link href must stay <code>{{foto.url}}</code>.</p><img src=\"{{foto.url}}\" alt=\"{{foto.url}}\" title=\"{{#APP_NAME}}\"><p><a href=\"{{foto.url}}\">open photo</a></p><iframe src=\"{{foto.url}}\" width=\"320\" height=\"180\" title=\"foto\"></iframe></section><section data-e2e-attr-sq=\"\"><h2>Single-quoted attrs</h2><p>Same contract with single-quoted src/alt.</p><img src='{{foto.url}}' alt='photo'></section><section data-e2e-text-chips=\"\"><h2>Text chips</h2><p>These mustaches should appear as chips (not attributes).</p><p>{{foto.url}}</p><p>{{#APP_NAME}}</p></section><section data-e2e-else-if=\"\"><h2>else if</h2><p>Structural chips for if / else if / else / close.</p>{{#if foto.url}}<p>has-url</p>{{else if foto.contentUrl}}<p>has-content</p>{{else}}<p>missing</p>{{/if}}</section><section data-e2e-shape-preserve=\"\"><h2>Edited shape preservation</h2><p>After a sibling visual edit: keep div, bare table cells (no colgroup/min-width), authored link without target/rel.</p><div class=\"box\"><p>keep-div</p></div><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><p><a href=\"https://example.com/authored\">authored-link</a></p></section>"}$$
WHERE TAS_ID = 9030;

--changeset sitmun:69-dev-plantilla-tiptap-chip-fixes-qa-media-ux context:dev dbms:postgresql
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9030
-- Refresh after mustache media placeholders, preview-link/language QA, single-quoted each section.
UPDATE STM_TASK
SET TAS_PARAMS = $${"parameters":[],"childTaskOrderIds":[9031],"templateHtml":"<h1>Dev Plantilla — TipTap chip / attr mustaches</h1><p><strong>QA (editor):</strong> Attribute mustaches stay literal. In visual mode, mustache <code>img</code>/<code>iframe</code> <code>src</code> show binding placeholders (not broken relative URLs); select one to inspect <code>src</code>/<code>alt</code>/<code>title</code> in the toolbar. After Sources → Execute <code>foto</code>, Template → Render resolves the photo; preview links open in a new tab. Preview language lives only on the Template preview pane. Binding: Source alias <code>foto</code> → <code>{{foto.url}}</code>.</p><!-- tip: {{foto.url}} must stay in comment after visual round-trip --><section data-e2e-attr-dq=\"\"><h2>Double-quoted attrs</h2><p>Placeholder img/iframe until preview; link href must stay <code>{{foto.url}}</code>.</p><img src=\"{{foto.url}}\" alt=\"{{foto.url}}\" title=\"{{#APP_NAME}}\"><p><a href=\"{{foto.url}}\">open photo</a></p><iframe src=\"{{foto.url}}\" width=\"320\" height=\"180\" title=\"foto\"></iframe></section><section data-e2e-attr-sq=\"\"><h2>Single-quoted attrs</h2><p>Same contract with single-quoted src/alt.</p><img src='{{foto.url}}' alt='photo'></section><section data-e2e-text-chips=\"\"><h2>Text chips</h2><p>These mustaches should appear as chips (not attributes).</p><p>{{foto.url}}</p><p>{{#APP_NAME}}</p></section><section data-e2e-else-if=\"\"><h2>else if</h2><p>Structural chips for if / else if / else / close.</p>{{#if foto.url}}<p>has-url</p>{{else if foto.contentUrl}}<p>has-content</p>{{else}}<p>missing</p>{{/if}}</section><section data-e2e-shape-preserve=\"\"><h2>Edited shape preservation</h2><p>After a sibling visual edit: keep div, bare table cells (no colgroup/min-width), authored link without target/rel.</p><div class=\"box\"><p>keep-div</p></div><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><p><a href=\"https://example.com/authored\">authored-link</a></p></section><section data-e2e-each-sq=\"\"><h2>Single-quoted data-sitmun-each</h2><p>Rename Source alias <code>foto</code> and confirm single-quoted <code>data-sitmun-each</code> updates.</p><table data-sitmun-each='foto.rows'><tbody><tr><td>{{name}}</td></tr></tbody></table></section>"}$$
WHERE TAS_ID = 9030;
