# SITMUN root end-to-end tests

Browser E2E against backend-core on in-memory H2. No Docker Compose.

## Coverage

### Admin (`npm run e2e`)

- Admin UI login (`/#/login` → `/#/dashboard`)
- Role form: validation, create, edit, reload persistence
- User form: validation, create, edit, reload persistence
- Territory form: validation, create (with type), edit, reload persistence

### Viewer (`npm run e2e:viewer`)

- Public access: dashboard configuration plus `403` for private profile `1/1` and its secured WMS
- Password access: dedicated regular user login, private profile, proxy token persistence, and secured WMS through proxy
- Local Basic-auth upstream stub; production Liquibase is not modified

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
| Proxy middleware | 18082 |
| Secured WMS stub | 18093 |

Do not reuse development servers. The suite fails if these ports are already occupied.
Do not run admin and viewer suites in parallel on one host; both own backend port 18080.

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
```

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
- Viewer setup provisions a dedicated regular user and rewrites seeded WMS service 3 to the local stub through the admin API; H2 is discarded when backend exits
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
- Admin suite does not cover Application / Layer / Task relation grids
- Viewer suite covers configuration + proxy GetCapabilities, not full SITNA tile painting
