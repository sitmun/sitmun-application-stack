# SITMUN root end-to-end tests

Admin browser E2E against backend-core on in-memory H2. No Docker Compose.

## Coverage (v1)

- Admin UI login (`/#/login` → `/#/dashboard`)
- Role form: validation, create, edit, reload persistence
- User form: validation, create, edit, reload persistence
- Territory form: validation, create (with type), edit, reload persistence

## Prerequisites

- Java 17
- Node ≥ 20.19
- Initialized submodules: `git submodule update --init --recursive`
- Admin dependencies: `cd front/admin/sitmun-admin-app && npm ci`
- Root dependencies: `npm ci` (from stack root)
- Chromium: `npm run e2e:install`

## Owned ports

| Process | Port |
| ------- | ---- |
| Admin (`ng serve` E2E) | 4300 |
| Backend (`bootRun` H2) | 18080 |

Do not reuse development servers. The suite fails if these ports are already occupied.

## Commands

```bash
# from stack root
npm ci
npm run e2e:install
npm run e2e

# UI mode
npm run e2e:ui

# one project / file
npm run e2e -- --project=admin-forms
npm run e2e -- --project=admin-forms e2e/admin/forms/role-form.spec.ts
```

## State model

- Fresh in-memory H2 database per `npm run e2e`
- Liquibase seeds `admin` / `admin`
- Form tests create unique entities and delete them via authenticated API cleanup
- Auth setup stores cookies in `e2e/.auth/` (gitignored)

## Failure artifacts

- HTML report: `playwright-report/`
- Traces / screenshots / videos: `test-results/`

```bash
npx playwright show-report
```

## Limitations

- H2 only (not Postgres/Oracle)
- No proxy middleware
- No OIDC login
- No Application / Layer / Task relation-grid coverage yet
