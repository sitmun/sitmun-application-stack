--liquibase formatted sql
-- Oracle final-state mirror for TipTap chip/attr + edited shape preservation QA fixture.
-- Open: /#/taskTemplate/9030/15
-- Editor: broken img / relative iframe expected until preview resolves {{foto.url}} (Source alias foto).

--changeset sitmun:69-dev-plantilla-tiptap-url-child-oracle context:dev dbms:oracle
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
  '{"parameters":[],"scope":"external-link","command":"https://sitmun.org/Documents/Imatges/8601img1320230421013907.jpg"}'
);
INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9031);
INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9031, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

--changeset sitmun:69-dev-plantilla-tiptap-chip-fixes-oracle context:dev dbms:oracle
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
  '{"parameters":[],"childTaskOrderIds":[9031],"templateHtml":"<h1>Dev Plantilla — TipTap chip / attr mustaches</h1><p><strong>QA (editor):</strong> Attribute mustaches stay literal. Broken images and a relative iframe (often the local nginx page) are expected until Sources → Execute <code>foto</code> and Template → Render. Hover the first image for title <code>{{#APP_NAME}}</code>. Binding under test: Source alias <code>foto</code> → <code>{{foto.url}}</code>.</p><!-- tip: {{foto.url}} must stay in comment after visual round-trip --><section data-e2e-attr-dq=\"\"><h2>Double-quoted attrs</h2><p>Broken img + iframe until preview; link href must stay <code>{{foto.url}}</code>.</p><img src=\"{{foto.url}}\" alt=\"{{foto.url}}\" title=\"{{#APP_NAME}}\"><p><a href=\"{{foto.url}}\">open photo</a></p><iframe src=\"{{foto.url}}\" width=\"320\" height=\"180\" title=\"foto\"></iframe></section><section data-e2e-attr-sq=\"\"><h2>Single-quoted attrs</h2><p>Same contract with single-quoted src/alt.</p><img src=''{{foto.url}}'' alt=''photo''></section><section data-e2e-text-chips=\"\"><h2>Text chips</h2><p>These mustaches should appear as chips (not attributes).</p><p>{{foto.url}}</p><p>{{#APP_NAME}}</p></section><section data-e2e-else-if=\"\"><h2>else if</h2><p>Structural chips for if / else if / else / close.</p>{{#if foto.url}}<p>has-url</p>{{else if foto.contentUrl}}<p>has-content</p>{{else}}<p>missing</p>{{/if}}</section><section data-e2e-shape-preserve=\"\"><h2>Edited shape preservation</h2><p>After a sibling visual edit: keep div, bare table cells (no colgroup/min-width), authored link without target/rel.</p><div class=\"box\"><p>keep-div</p></div><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><p><a href=\"https://example.com/authored\">authored-link</a></p></section>"}'
);
INSERT INTO STM_TASKREL (TAR_ID, TAR_TYPE, TAR_TASKID, TAR_TASKRELID, TAR_ALIAS)
VALUES (9030, 'template-task', 9030, 9031, 'foto');
INSERT INTO STM_ROL_TSK (RTS_ROLEID, RTS_TASKID) VALUES (1, 9030);
INSERT INTO STM_AVAIL_TSK (ATS_ID, ATS_TERID, ATS_TASKID, ATS_CREATED)
SELECT COALESCE(MAX(ATS_ID), 0) + 1, 4, 9030, CURRENT_TIMESTAMP FROM STM_AVAIL_TSK;

--changeset sitmun:69-dev-plantilla-tiptap-chip-fixes-qa-captions-oracle context:dev dbms:oracle
--preconditions onFail:MARK_RAN
--precondition-sql-check expectedResult:1 SELECT COUNT(*) FROM STM_TASK WHERE TAS_ID = 9030
UPDATE STM_TASK
SET TAS_PARAMS = '{"parameters":[],"childTaskOrderIds":[9031],"templateHtml":"<h1>Dev Plantilla — TipTap chip / attr mustaches</h1><p><strong>QA (editor):</strong> Attribute mustaches stay literal. Broken images and a relative iframe (often the local nginx page) are expected until Sources → Execute <code>foto</code> and Template → Render. Hover the first image for title <code>{{#APP_NAME}}</code>. Binding under test: Source alias <code>foto</code> → <code>{{foto.url}}</code>.</p><!-- tip: {{foto.url}} must stay in comment after visual round-trip --><section data-e2e-attr-dq=\"\"><h2>Double-quoted attrs</h2><p>Broken img + iframe until preview; link href must stay <code>{{foto.url}}</code>.</p><img src=\"{{foto.url}}\" alt=\"{{foto.url}}\" title=\"{{#APP_NAME}}\"><p><a href=\"{{foto.url}}\">open photo</a></p><iframe src=\"{{foto.url}}\" width=\"320\" height=\"180\" title=\"foto\"></iframe></section><section data-e2e-attr-sq=\"\"><h2>Single-quoted attrs</h2><p>Same contract with single-quoted src/alt.</p><img src=''{{foto.url}}'' alt=''photo''></section><section data-e2e-text-chips=\"\"><h2>Text chips</h2><p>These mustaches should appear as chips (not attributes).</p><p>{{foto.url}}</p><p>{{#APP_NAME}}</p></section><section data-e2e-else-if=\"\"><h2>else if</h2><p>Structural chips for if / else if / else / close.</p>{{#if foto.url}}<p>has-url</p>{{else if foto.contentUrl}}<p>has-content</p>{{else}}<p>missing</p>{{/if}}</section><section data-e2e-shape-preserve=\"\"><h2>Edited shape preservation</h2><p>After a sibling visual edit: keep div, bare table cells (no colgroup/min-width), authored link without target/rel.</p><div class=\"box\"><p>keep-div</p></div><table><tbody><tr><td>A</td><td>B</td></tr></tbody></table><p><a href=\"https://example.com/authored\">authored-link</a></p></section>"}'
WHERE TAS_ID = 9030;
