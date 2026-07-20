# SITMUN root end-to-end tests

Browser E2E against backend-core on in-memory H2. No Docker Compose.

## Coverage

### Admin (`npm run e2e`)

- Admin UI login (`/#/login` → `/#/dashboard`)
- Language chrome on login: cleared `lang` → closed BCP-47 ISO from `language.default`; open menu shows API endonyms; no language field on the login form (`e2e/admin/language-chrome.spec.ts`, project `login`)
- Role form: validation, create, edit, reload persistence
- User form: validation, create, edit, reload persistence
- Territory form: validation, create (with type), edit, reload persistence

### Viewer (`npm run e2e:viewer`)

- Language chrome on `/auth/login`: cleared `language` → closed ISO left of hamburger; open endonyms; no language entries in the hamburger menu (`e2e/viewer/language-chrome.spec.ts`, project `viewer-public`)
- Public access: dashboard configuration plus `403` for private profile `1/1` and its secured WMS
- Public access: eligible vs blocked point-of-contact email on applications 2 and 3 (institution always shown when set)
- Password access: dedicated regular user login, private profile, proxy token persistence, and secured WMS through proxy
- Layer catalog (`viewer-catalog`): radio folder children render native radios; `loadData` folders get a visible load control (checkbox, or radio when the folder is radio; title expand-only); non-radio cartography leaves get `sitmun-lcat-leaf-load` checkboxes (toggle work layer); child radios still work when `loadData` is off; queryable leaves show `.sitmun-lcat-gfi` after select when setup enables `queryableActive` + layer `queryableFeatureEnabled` (meta stamp asserted when SITNA renders info); row geometry asserts fixed 18px select/GFI controls when present (no empty spacers), level-stamped inset (`data-sitmun-lcat-level` 0/1/2…), nest step = type-icon width (16px, parent pad cancelled on nested `ul`), vertical centers, and meta ≥18×18 hit box; visible Capas disponibles rows stamp alternating `data-sitmun-lcat-zebra`; folder titles stay roman under `tc-checked`. Capas trash-then-clear after partial remove is asserted in viewer Jest (`layer-catalog-control.handler`), not yet in Playwright (WMS stub leaf-load gap).
- Local Basic-auth upstream stub; production Liquibase is not modified

### Application contact (`npx playwright test --config=playwright.application-contact.config.ts`)

- Shared one-backend suite: admin sets `responsibleInstitutionName` on application 2, reload persists, viewer public dashboard shows the value in application details
- Starts admin (4300), viewer (4400), and a single backend (18080)

### Mobile web (`npm run e2e:mobile:web`)

- Disposable setup patches application `1` to type `ED`, rewrites WMTS service `1` to the local stub, and creates a regular edition user
- Edition: `POST /api/authenticate/mobile` returns JSON `access_token` (no cookie); viewer/admin cookie logins remain empty-body
- Edition: Bearer `access_token` exchanges for distinct `proxy_token`; client apps list only `ED` and never includes `config.mbtilesUrl`
- Edition: mobile token cannot call account/admin APIs
- Touristic: anonymous client application list includes type `T`; private profile denied
- Proxy/MBTiles: missing bearer and `access_token`-as-proxy denied; authorized `proxy_token` estimate/create through `/middleware/proxy/{app}/{ter}/mbtiles...`; opaque `jobHandle`; direct gateway `/mbtiles` is `404`
- Starts backend (18080), proxy (18082), MBTiles (18084), WMTS stub (18094), and gateway (18081)
- Ionic web shells on :4500/:4501 are not required; mobile web coverage is API-only through the gateway

### Mobile Android (`npm run e2e:mobile:android`)

- Builds debug APKs from temporary copies of pinned `apps/*` sources (does not commit Android projects); runs `cap add android` when the native project is absent
- Requires `adb`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, Maestro CLI, and a connected API 34 emulator/device
- Uses `adb reverse tcp:18081` and Maestro flows under `e2e/mobile/android/`
- Records source SHA and APK SHA-256 under `test-results/mobile-android/`
- Split coverage (Phase 8):
  - **Maestro UI**: edition invalid login (`#login-error` via `androidWebViewHierarchy: devtools`), edition valid login/profile, touristic public profile (auto-enter after tree provisioning)
  - **Gateway/API contracts** (before APK builds): missing bearer, wrong territory, `access_token` rejected as proxy, estimate/create/status/file with opaque `jobHandle`, direct `/mbtiles` is `404`
- Orchestrator runs `adb shell am kill-all` before Maestro to avoid stale WebView DevTools sockets on Maestro 2.6.1
- Separate `e2e-mobile-touristic.mjs` / `e2e-mobile-edition.mjs` shell scripts are not used; Ionic web shells are covered by API-only `e2e:mobile:web`
- CI installs Maestro `2.6.1` with SHA-256 verification of `maestro.zip`

## Prerequisites

- Java 17
- Node ≥ 20.19
- Initialized submodules: `git submodule update --init --recursive`
- Admin dependencies: `cd front/admin/sitmun-admin-app && npm ci`
- Viewer dependencies: `cd front/viewer/sitmun-viewer-app && npm ci`
- Root dependencies: `npm ci` (from stack root)
- Chromium: `npm run e2e:install`

## Owned ports

| Process | Port |
| ------- | ---- |
| Admin (`ng serve` E2E) | 4300 |
| Viewer (`ng serve` E2E) | 4400 |
| Backend (`bootRun` H2) | 18080 |
| Mobile gateway (`/backend`, `/middleware`) | 18081 |
| Proxy middleware | 18082 |
| Secured WMS stub | 18093 |
| WMTS stub (mobile) | 18094 |
| MBTiles (internal; not on gateway) | 18084 |

Do not reuse development servers. The suite fails if these ports are already occupied.
Do not run admin, viewer, application-contact, and mobile suites in parallel on one host; they share port 18080 and/or 18082.

## Commands

```bash
# from stack root
npm ci
npm run e2e:install

# admin
npm run e2e
npm run e2e:ui
npm run e2e -- --project=admin-forms

# viewer (+ proxy + secured stub)
npm run e2e:viewer
npm run e2e:viewer:ui
npm run e2e:viewer -- --project=viewer-public
npm run e2e:viewer -- --project=viewer-password
npm run e2e:viewer -- --project=viewer-catalog

# admin → viewer responsible institution (shared backend)
npx playwright test --config=playwright.application-contact.config.ts

# mobile edition auth + MBTiles via middleware
npm run e2e:mobile:web
# optional: Android emulator + Maestro
# npm run e2e:mobile:android
```

## Credential boundaries (mobile edition)

| Credential | Used for |
| ---------- | -------- |
| `access_token` (JSON Bearer) | Backend `/api/authenticate/mobile` session; ED client reads; `POST /api/authenticate/proxy` |
| `proxy_token` (JSON Bearer) | Middleware `/middleware/**` only (map proxy + MBTiles) |
| `X-SITMUN-Proxy-Key` | Proxy → backend `/api/config/proxy` and `/api/config/proxy/mbtiles` |
| Opaque `jobHandle` | MBTiles status/file; bound to principal/app/territory |

Browser `/api/authenticate` and `/api/authenticate/admin` remain cookie-only empty-body logins. Pre-change edition APKs that called `/api/authenticate` for JWT JSON are unsupported.

## TDD workflow

For covered behavior spanning a browser and multiple components:

1. Add or extend the smallest spec that reproduces the expected behavior.
2. Run its file or Playwright project and confirm the expected failure.
3. Implement the minimum change and rerun the targeted test.
4. Run focused tests in each changed submodule.
5. Run the full affected root suite before handoff.

Use submodule unit or slice tests for isolated logic and both layers when a
cross-stack regression also has meaningful local contracts. Extend this
harness or document the gap when the behavior is outside current coverage.

## State model

- Fresh in-memory H2 database per suite run
- Liquibase seeds `admin` / `admin`
- Admin form tests create unique entities and delete them via authenticated API cleanup
- Viewer setup provisions a dedicated regular user (password suite) plus disposable PoC users for applications 2/3; rewrites seeded WMS service 3 to the local stub through the admin API; adds task-availability for `sitna.layerCatalog` / `workLayerManager` and patches tree-node `loadData`/`active` fixtures for catalog E2E; H2 is discarded when backend exits
- Application-contact suite uses one shared backend for admin write and viewer read of the same application row
- Auth/fixture files live under `e2e/.auth/` (gitignored)

## Credential boundaries (viewer)

| Credential | Used for |
| ---------- | -------- |
| `viewer_access_token` cookie | Backend APIs after password login |
| `proxy_token` (IndexedDB) | Bearer on `/middleware/**` only |
| `X-SITMUN-Proxy-Key` | Proxy → backend `/api/config/proxy` |
| Upstream Basic auth | Proxy → local WMS stub |

## Failure artifacts

- HTML report: `playwright-report/`
- Traces / screenshots / videos: `test-results/`
- Treat reports as restricted CI artifacts; do not paste Authorization values from traces into tickets

```bash
npx playwright show-report
```

## Limitations

- H2 only (not Postgres/Oracle)
- No OIDC login
- Admin suite does not cover Application / Layer / Task relation grids (except the dedicated application-contact cross-stack flow)
- Viewer suite covers configuration + proxy GetCapabilities, plus layer-catalog radio/`loadData` DOM contracts; not full SITNA tile painting
- Mobile web suite is API-level (gateway + backend + proxy + MBTiles); it does not drive the Ionic UI in Chromium
- Mobile Android suite does not harden release manifests (app Android source is unchanged)
- MBTiles protected-source credentials, job-handle key rotation multi-key support, rate/size/time limits, and iOS are absent from this harness
