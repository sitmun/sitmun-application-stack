# SITMUN Coordinated Release Runbook

This runbook describes the coordinated release workflow for the stack repository and its submodules:

- `front/admin/sitmun-admin-app`
- `front/viewer/sitmun-viewer-app`
- `back/backend/sitmun-backend-core`
- `back/proxy/sitmun-proxy-middleware`

It assumes:

- `dev` is the integration branch.
- `main` is the stable branch.
- Tags use the repository prefix format (for example: `sitmun-admin-app/1.2.6`).
- Release version follows Semantic Versioning (for example: `1.2.6`).

## 1) Preflight Checks

1. Ensure local branches are up to date:
   - `git checkout dev && git pull` in stack and every submodule.
2. Ensure no unresolved conflicts and no unintended local changes.
3. Confirm release target version and date.
4. Confirm CI pipelines are green on `dev`.

## 2) Prepare Submodule Releases on `dev`

For each submodule (`admin`, `viewer`, `backend-core`, `proxy`):

1. Update changelog:
   - Move `## [Unreleased]` release-ready entries into `## [X.Y.Z] - YYYY-MM-DD`.
   - Keep a fresh empty `## [Unreleased]`.
   - Update compare links at file bottom.
2. Bump versioned files to `X.Y.Z`:
   - Frontend: `package.json`, environments, README badge (and lockfile if needed).
   - Backend/proxy: `build.gradle`, API docs/app config versions, README badge.
3. Run repository checks (build/tests/lint as applicable).
4. Commit release changes on `dev`.
5. Create and push tag on `dev` commit:
   - Example: `sitmun-admin-app/1.2.6`.

## 3) Merge Submodule `dev -> main` (Gate)

For each submodule, after tag and CI pass:

1. `git checkout main`
2. `git merge --no-ff dev`
3. Resolve conflicts if any, then run validation checks.
4. Push `main`.
5. Verify `main` contains the tagged commit.

## 4) Sync Stack to Released Submodule SHAs

In stack repo (`dev` branch):

1. Update submodule pointers to intended released commits.
2. Verify each pointer matches the expected `X.Y.Z` tag commit in its submodule.
3. Commit submodule pointer updates.

## 5) Bump Stack Version and Changelog

1. Set stack `VERSION` to `X.Y.Z`.
2. Run version propagation script:
   - `bash tools/scripts/bump-version.sh X.Y.Z`
   - Verify with `bash tools/scripts/bump-version.sh --status`
3. Verify lockfile updates were generated and are staged for both frontend submodules:
   - `front/admin/sitmun-admin-app/package-lock.json`
   - `front/viewer/sitmun-viewer-app/package-lock.json`
   - If either lockfile did not update but `package.json` did, run `npm install --package-lock-only` in that submodule and re-check.
4. Run immediate post-bump validation gates (mandatory):
   - JSON parse checks:
     - `node -e "JSON.parse(require('fs').readFileSync('front/admin/sitmun-admin-app/package.json','utf8'))"`
     - `node -e "JSON.parse(require('fs').readFileSync('front/viewer/sitmun-viewer-app/package.json','utf8'))"`
   - Frontend compile checks:
     - Admin: run build/watch compile and ensure no TypeScript errors.
     - Viewer: run build/watch compile and ensure no TypeScript errors.
   - If any parse/type error appears, stop release and fix before proceeding.
5. Update `CHANGELOG.md`:
   - Move release-ready `Unreleased` entries into `## [X.Y.Z]`.
   - Update compare links.
6. Commit stack release metadata changes.

## 6) Stack Release Gate and Publish

1. Run stack validation checks (compose/build/tests as required).
2. Confirm active dev terminals/watchers are free of compile errors before tagging.
3. Ensure submodule pointer policy is explicit and documented in commit message:
   - Either pointers reference the tagged `X.Y.Z` commit in each submodule, or
   - pointers reference merged `main` commits that include `X.Y.Z`.
   - Recommended: reference merged `main` commits after submodule `dev -> main` gates.
4. Create stack tag:
   - `sitmun-application-stack/X.Y.Z`
5. Push `dev` and tags.

## 7) Merge Stack `dev -> main`

1. `git checkout main`
2. `git merge --no-ff dev`
3. Resolve conflicts, run quick verification, push `main`.

## 8) Evidence Checklist

Keep release evidence (links/screenshots/log excerpts):

- Submodule tags created and pushed.
- Submodule `main` includes release commits.
- Stack submodule pointers match released commits.
- Stack `VERSION` and `bump-version.sh --status` are consistent.
- Frontend lockfiles (`admin` and `viewer`) were updated and committed with the release bump.
- Changelogs updated (stack + submodules).
- Stack tag created and pushed.
- Final `dev -> main` merges complete.

## Notes

- Prefer one coordinated version across stack and submodules for each release wave.
- If a submodule has no functional changes, still document explicit release alignment in changelog when bumping version.
- Do not force-push release branches.

## Troubleshooting During Release

- **Malformed frontend environment object after bump**
  - Symptom: TypeScript errors around `environment.version` / `buildTimestamp`.
  - Action: repair `src/environments/environment.ts` and `environment.prod.ts` object syntax, then re-run compile checks.
- **Malformed `package.json` after bump**
  - Symptom: `Unexpected token` JSON parse errors.
  - Action: fix malformed `version` line in `package.json`, then run `npm install --package-lock-only` and re-check.
- **Angular component missing from compilation/module**
  - Symptom: `is missing from TypeScript compilation` or `is not a known element`.
  - Action: restore file inclusion/module declaration, then re-run build/watch compile.
- **After any fix**
  - Re-run `bash tools/scripts/bump-version.sh --status` and all validation gates before continuing.

## Post-Release Correction and Retag (Dev-Centric)

Use this only when `X.Y.Z` tags were published with incorrect content and must be corrected on `dev`.

1. For each affected submodule, checkout and update `dev`:
   - `git checkout dev && git pull origin dev`
2. Apply the required correction(s) on `dev` and commit.
3. Move local release tag to the corrected `dev` commit:
   - `git tag -d <repo-prefix>/X.Y.Z`
   - `git tag -a <repo-prefix>/X.Y.Z -m "<repo-prefix> X.Y.Z (retag)"`
4. Update remote tag to point at corrected commit:
   - `git push origin :refs/tags/<repo-prefix>/X.Y.Z`
   - `git push origin <repo-prefix>/X.Y.Z`
5. Push corrected `dev` branch:
   - `git push origin dev`
6. Repeat for all submodules, then update stack submodule pointers on stack `dev`, commit, and retag stack if needed:
   - `git tag -d sitmun-application-stack/X.Y.Z`
   - `git tag -a sitmun-application-stack/X.Y.Z -m "sitmun-application-stack X.Y.Z (retag)"`
   - `git push origin :refs/tags/sitmun-application-stack/X.Y.Z`
   - `git push origin sitmun-application-stack/X.Y.Z`
7. Record explicit release evidence noting this was a corrective retag.
