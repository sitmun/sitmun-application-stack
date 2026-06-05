# Changelog

All notable changes to the SITMUN Application Stack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Admin Application

- **Trees**: improved authoring and validation flow (image constraints, duplicate-name checks, cartography/task linkage, hidden-in-viewer indicators, unsaved-change confirmation) with shared `TreeRulesService` rules.
- **User management**: richer hints/counters/warnings, improved role/position guidance, new read-only applications-as-contact tab, and expanded list columns.
- **Data grid**: dedicated clientSide/infinite column strategies, improved relation-grid sizing, and centered selection-checkbox rendering.
- **i18n**: completed user/form warning and guidance keys across all five locales.

#### Backend Core

- **Dashboard API**: added paginated application listing and suggestions for viewer dashboard consumption.
- **Security**: account endpoints tightened, blocked-user JWT handling enforced, and proxy/client-config RBAC checks aligned for blocked/public principals.
- **Profile payloads**: locator-task mapping, territory metadata fields, computed territory view usage, and institutional-email contact publication refined for profile and little DTO contracts.
- **Validation**: user-field size alignment and built-in user integrity checks added (including aligned seed data).

#### Viewer Application

- **Auth**: stale authenticated sessions are cleared before `/public/**` activation via `publicAuthClearGuard` and `clearAuthentication()`.
- **Dashboard**: server-side infinite scroll, public/private tabs, and shared list shell enabled across dashboard, territory, and application pages.
- **Map**: profile `defaultZoomLevel` and initial-view behavior are applied consistently after extent fit.

#### Profile-level

- **Development profile**: `47_fix_builtin_user_positions.sql` reassigns position 6963 from built-in `public` user (id=2) to normal dev user (id=4), satisfying the startup invariant that built-in users must not hold `UserPosition` rows.
- **Development profile**: `49_dev_dashboard_fixtures.sql` adds dashboard pagination/tab test data.
- **Locator**: added locator task-type and `sitmun.locator` UI seed data for Oracle/PostgreSQL profiles, plus development Liquibase include `51_add_locator_control.yaml` to backfill existing databases.

### Changed

#### Admin Application

- Territory and user forms were reorganized for clearer validation flow, stronger warning visibility, and cleaner tab-driven editing behavior.
- Tooling and tests were modernized for Angular 19-era provider patterns and updated TypeScript/ESLint alignment.

#### Viewer Application

- Auth/session lifecycle now routes through explicit cleanup (`clearAuthentication`) with redirect-suppression controls for failure paths.
- Dashboard and map initialization behavior were aligned with profile-driven defaults and shared list shell architecture.

#### Backend Core

- Task/profile resolution for locator/query flows and territory-derived initial view computation were streamlined.

### Fixed

#### Admin Application

- Territory relation loading and `memberOf` relation resolution issues were corrected ([#383](https://github.com/sitmun/sitmun-admin-app/issues/383)).
- Login/password handling no longer relies on CSS masking and avoids recursive logout error paths.

#### Viewer Application

- Catalog, tooltip, i18n, and identify reliability fixes landed for map UI and layer operations ([#137](https://github.com/sitmun/sitmun-viewer-app/issues/137), [#139](https://github.com/sitmun/sitmun-viewer-app/issues/139), [#140](https://github.com/sitmun/sitmun-viewer-app/issues/140), [#155](https://github.com/sitmun/sitmun-viewer-app/issues/155), [#156](https://github.com/sitmun/sitmun-viewer-app/issues/156)).
- Contact rendering now uses API-provided point-of-contact values directly ([#159](https://github.com/sitmun/sitmun-viewer-app/issues/159)).
- Proxy/session reliability improved through explicit 401 refresh handling and service-worker/IndexedDB sequencing hardening ([#256](https://github.com/sitmun/sitmun-viewer-app/issues/256)).

#### Backend Core

- Auth endpoint authorization fixes restored viewer refresh/logout compatibility (`POST /api/authenticate/proxy` for `ROLE_USER`, `POST /api/authenticate/logout` as `permitAll`) ([#256](https://github.com/sitmun/sitmun-viewer-app/issues/256)).
- **Database Schema**: Oracle `STM_TREE_NOD` bootstrap defaults now use numeric `DEFAULT 0` (instead of `DEFAULT FALSE`) for `TNO_LOAD_DATA` and `TNO_FILTERABLE`, fixing Oracle 24 setup failures ([#43](https://github.com/sitmun/sitmun-application-stack/issues/43)). Existing Oracle databases that already ran changeset `sitmun:1` may need Liquibase checksum reconciliation during upgrade.

## [1.2.6] - 2026-05-08

### Added

#### Stack-level

- Middleware: `LOGGING_LEVEL_ROOT`, `LOGGING_LEVEL_ORG_SITMUN` in root `docker-compose.yml` (`INFO` / `DEBUG` defaults).

#### Profile-level

- Middleware: `LOGGING_LEVEL_*` in `profiles/postgres` and `profiles/oracle` compose (`WARN` / `INFO` defaults; optional `LOGGING_LEVEL_ORG_SITMUN_PROXY_MIDDLEWARE`).
- Database seeds: UI control `sitna.moreInfo` renamed to `sitmun.moreInfo` ([#31](https://github.com/sitmun/sitmun-application-stack/issues/31)). New installations use the updated name; existing databases are migrated via Liquibase changeset `43_rename_moreinfo_control.sql`.

#### Backend Core

- Parametrizable proxy: `RequestCoordinates`, HTTP/SQL user parametrization decorators, `JdbcSqlDialect`, `HttpPayloadDto`, extended `HttpSecurityDto`, `SensitiveDataMasking`, tests.
- **Connections**: Microsoft SQL Server JDBC driver and codelist (`databaseConnection.driver`; `com.microsoft.sqlserver.jdbc.SQLServerDriver`).
- **Client configuration profile** (`GET /api/config/client/profile/{appId}/{terrId}`): layers may include `metadataURL`, `datasetURL`, `description` (i18n-translated abstract from `Cartography.description`), `minScaleDenominator`/`maxScaleDenominator` from cartography scale configuration (previously listed: `order`, `transparency`).
- **Task Query Services**: `TaskQueryUrlService` mapper for `external-link` scope query tasks; `TaskScopeNormalizer` utility for admin-to-viewer scope mapping; `ParameterValidator` helpers for detecting `#{...}` patterns and system variables.
- **Parameter expansion**: `BasicParameterValueConverter` component for type-based conversion logic with `BasicParameterValueType` enum.

#### Proxy Middleware

- Multi API-key headers, `HttpSecurityConstants`, `HttpContextSecurity` alignment, masked debug logging, contract/regression tests.
- Microsoft SQL Server JDBC driver (`mssql-jdbc`) alongside PostgreSQL and Oracle for JDBC proxy connections.
- `HttpRequestDecoratorAddQueryParamSecurity` to append OpenAPI-style API key query parameters; `HttpSecurityDto#queryParams` and `HttpContextSecurity#getQueryParams()` for security query parameters.
- `HttpRequestExecutor#addParameter` for merging individual query parameters.
- `SensitiveDataMasking` for masked HTTP debug logging (e.g. OkHttp headers); `HttpSecurityConstants` for shared security literals.

### Changed

#### Stack-level

- `front/Dockerfile`: copy `front/admin/sitmun-admin-app/.npmrc` before the admin `npm ci` step so image builds apply the same `legacy-peer-deps` lockfile semantics as local and CI workflows.
- `front/viewer/index.html.template`: register `ServiceWorker.js` on window load without the previous `navigator.serviceWorker.getRegistration()` reload when a worker was active but not controlling (avoids fragile reload behavior; aligns with the viewer application’s service worker integration).

#### Profile-level

- `profiles/development/proxy/application.yml`: drop fixed `org.sitmun.proxy.middleware` log level.

#### Backend Core

- Submodule bump: cookie-backed session JWT (`access_token`), `POST /api/authenticate/proxy` proxy token, `POST /api/authenticate/logout` cookie clearing, and related filters/tests (see `sitmun-backend-core` `[Unreleased]`).
- Client configuration profile: optional layer **`order`** in JSON (maps from cartography); integration tests and fixtures updated (see `sitmun-backend-core` `[Unreleased]`).
- `SystemVariableResolver` / WMS+HTTP proxy paths use `RequestCoordinates`; decorator pipeline and pagination behavior updated; `QueryVaryFiltersDecorator` → `SqlUserParametrizationDecorator`.
- **Task parameter pipeline**: centralized in `TaskParameterProcessor` service with unified parsing, classification, filtering, and effective-value computation; removes ~9 helper methods from `ProxyConfigurationService`.
- **Task Query Web Service Proxying**: `TaskQueryWebService.map(...)` proxy decision now based solely on scope (`web-api-query` → always proxied; `web-api-query-no-proxy` → always direct).
- **Client profile (`web-api-query`, proxied)**: configuration profile omits parameters with `type=template` for proxied tasks; URI path placeholders resolved server-side.
- **Task Query Validator Enforcement**: `TaskQueryValidator.validate(...)` extended with strict `validateDirectExecutionScope(...)` for `web-api-query-no-proxy` and `external-link` tasks.
- **Task Query Cartography Service**: `TaskQueryCartographyService.map(...)` now sets `TaskDto.cartographyId` to `String.valueOf(cartography.getId())` for viewer consumption.

#### Proxy Middleware

- HTTP security decorators, executor logging, configuration/executor wiring and tests.
- `HttpSecurityDto` implements `HttpContextSecurity`; supports custom header and query-param maps for API keys alongside Basic auth.
- `HttpRequestDecoratorAddHeaderSecurity` replaces `HttpRequestDecoratorAddApiKeyHeader` to forward the full security header map.
- `HttpRequestExecutor` masks sensitive values in debug logs.

#### Admin Application

- Submodule bump: HttpClient sessions with credentials, authenticated route guard, OIDC callback and login/logout alignment with the backend cookie model (see `sitmun-admin-app` `[Unreleased]`).
- Layer form: cartography **order** is always shown (removed `LAYERS_ORDER_FEATURE`); hints describe viewer **zIndex** / working-layer behavior; `cartography-scale-i18n` Jest spec asserts required layer-form and feature-flag i18n keys; `cartography-scale-i18n` uses `readFileSync` instead of `require()` for locale JSON (ESLint).

#### Viewer Application

- Submodule bump: route guards, credentials and authentication interceptors, IndexedDB and service worker wiring for proxy-backed map traffic (see `sitmun-viewer-app` `[Unreleased]`).
- Client profile layer **order** is applied as SITNA **zIndex** when adding from the layer catalog (see `sitmun-viewer-app` `[Unreleased]`).
- `MoreInfoService`: updated task filter to recognize `sitmun.moreInfo` control (was `sitna.moreInfo`) per database seed rename ([#31](https://github.com/sitmun/sitmun-application-stack/issues/31)).
- **Layer catalog info modal**: exposes `metadataURL`/`datasetURL` from client profile and OGC WMS `MetadataURL`/`DataURL` from upstream GetCapabilities.
- **`SitnaCapabilitiesInterceptor`** (root-scoped): owns `meld.around` advice on `SITNA.layer.Layer.prototype.getCapabilitiesOnline`; shared by basemap-only and catalog-enabled apps for virtual/real GetCapabilities post-processing.
- **`AppLayer.title`/`AppLayer.description`** (profile JSON keys) merged onto matched real WMS GetCapabilities layers as OGC `Title`/`Abstract` in `RasterLayerService.processWmtCapabilitiesResult`.
- Profile `transparency` (0..100, 0 = opaque) mapped to SITNA opacity (`(100 - transparency) / 100`) on layer add in addition to `order`/`zIndex`.

### Removed

#### Backend Core

- `SqlTemplateExpander`, `QueryFixedFiltersDecorator` (superseded by new decorators).

### Fixed

#### Backend Core

- **Basic parameter conversion**: `BasicParameterValueConverter.convert(...)` now treats a `null` raw value uniformly — `STRING` yields `""` and every other type yields `null`. Previously, `NUMBER`, `ARRAY`, and `OBJECT` raised unchecked `NullPointerException`.
- **Security**: `JsonWebTokenFilter` continues the filter chain when the JWT username has no matching persisted user (previously returned without delegating).
- Improved app configuration loading times by replacing `@EntityGraph` with `@BatchSize` to avoid Cartesian product when fetching members and roles in `CartographyPermission` ([#250](https://github.com/sitmun/sitmun-backend-core/pull/250)).

#### Admin Application

- Task forms: align parameter modals and fix duplicate columns in task-edit grid.

## [1.2.5] - 2026-03-11

### Added

#### Stack-level

- Added `tools/scripts/bump-version.sh` to propagate stack version updates across submodules and profile/configuration consumers, including lockfile refresh for frontend applications.

### Changed

#### Stack-level

- Moved root helper scripts into `tools/`: `check_changelog_integrity.py` → `tools/bin/check_changelog_integrity.py`, `checkout-latest-tags.sh` → `tools/scripts/checkout-latest-tags.sh`.
- Updated changelog integrity checker to resolve git repository root dynamically from `tools/bin` and use the current backend changelog path (`back/backend/sitmun-backend-core/config/db/changelog`).

## [1.2.4] - 2026-03-04

### Added

#### Stack-level

- Tools layout under `tools/`: `tools/bin/` (Python), `tools/scripts/`, `tools/tests/`, `tools/seed-data/` with scenario-based workflows.
  - Python: generate_all_seed_outputs, generate_seed_files, generate_translation_files, extract_seed_data, extract_translatable, import_from_csv, import_from_generated_csvs, import_missing_translations, switch_default_language, sort_codelist.
  - Scripts: `apply-seed-data.sh` (remote DB apply), Docker-based Liquibase tests for postgres and oracle.
  - Seed-data baselines: master-seed-data.json, master-i18n.*.json, i18n-active-baseline.json.
  - Documentation: tools/README.md, tools/seed-data/README.md.

#### Profile-level

- Liquibase changelogs 36 (cartography tree folder type), 37 (merge treenode.node.type), 38 (remove legacy treenode codelists).

#### Backend Core

- English translation CSV support for postgres and oracle profiles.
- `messageCode` on validation Problem Detail `FieldError` (set in exception handlers) for client-side i18n of validation messages.
- `SitmunConstants`: application-wide keys for default language and proxy configuration.
- Proxy setup: proxy middleware URL configured via `sitmun.proxy-middleware.url` and exposed to client in profile `global.proxy`.

#### Admin Application

- Detailed validation error messages in notifications: show field-level errors from RFC 9457 `errors` array, i18n for `messageCode` (e.g. `validation.NotBlank`, `validation.BoundingBox`), multi-line display in notification component.
- Tree view mode handling with icons and labels for different view modes.
- Task properties regression tests to prevent model drift.

#### Viewer Application

- ESLint flat config migration and updated dependencies.

### Changed

#### Stack-level

- Liquibase: keep 35 (fix missing UI controls); add 36/37/38 (cartography folder type, merge treenode types, remove legacy codelists).
- Tools: consolidated translations and seed workflows from tools/translations and tools/front-i18n into tools/bin, tools/seed-data, tools/scripts, tools/tests.
- Regenerated production profile codelists, task types, seed data, translations, params, sequences (postgres and oracle).

#### Backend Core

- Unified tree node type constants (`CodeListsConstants`) and application configuration for node type handling.
- OIDC: added provider/client constants (`AuthProviderIds`, `OidcClientTypes`), improved tests and documentation.
- Locale resolution: use `SitmunConstants.LANGUAGE_DEFAULT_CONF_KEY` for DB default language; `sitmun.language` default set to `en`.

#### Admin Application

- Node.js requirement updated to `>=20.19.0` (engines).
- Angular framework upgraded to version 19 (^19.2.x) with latest features and performance improvements.
- Tree node type unification: consolidated `treenode.folder.type` and `treenode.leaf.type` into unified `treenode.node.type`.
- Task properties made opaque to improve encapsulation and type safety.

#### Viewer Application

- Node.js requirement updated to `>=20.19.0` (engines).
- Angular framework upgraded to version 19 with latest features and performance improvements.
- ESLint configuration migrated from legacy `.eslintrc.js` to flat config `eslint.config.js`.

### Fixed

#### Admin Application

- Save failure: show a single error notification (interceptor only) and skip post-save logic; log error in component catch instead of calling ErrorHandlerService to avoid duplicate snackbar.
- Development API URL set to `http://localhost:9000/backend` so `ng serve` uses the Nginx proxy path and CORS works correctly.
- Tree duplication: await recursive node updates so child nodes complete before navigation; strip `_links` on duplicated nodes for clean create path (fixes #359).
- Tree node type handling and mapping dialog state stabilization.
- Aranés flag SVG metadata removed to fix language selector label display on login screen (fixes #360).

### Removed

#### Stack-level

- tools/translations/ (scripts and master-translations.json), tools/front-i18n/README.md, tools/sort_codelist.py (root).

#### Backend Core

- Proxy URL from seed config `STM_CONF` (proxy URL now from Spring property only).

#### Viewer Application

- Removed `.eslintignore` and `.eslintrc.js` legacy configuration files.
- Removed deploy configuration from `angular.json`.

## [1.2.3] - 2026-02-26

### Added

#### Backend Core

- More Information task type support with backend parameter and system-variable resolution.

#### Proxy Middleware

- PreparedStatement execution support for parameterized SQL requests.
- API key and URI template support for API Padro integrations.

#### Admin Application

- More Information task configuration support for API/SQL/URL scopes.
- New form guidance and i18n entries for More Information parameterization.

#### Viewer Application

- More Information task handling with URL scope and RFC 6570 templates.

### Changed

#### Backend Core

- Consolidated legacy tree-node type codelists (`treenode.folder.type`, `treenode.leaf.type`) into `treenode.node.type` and updated translations.
- Updated Liquibase scripts and backend services for More Information workflows.

#### Viewer Application

- Refactored More Information handling to centralize logic and reduce duplication.

### Fixed

#### Backend Core

- Fixed sequence ordering and JSON/properties issues in More Information Liquibase changesets.

#### Viewer Application

- Fixed More Information feature-info behavior when highlighting table information.

### Removed

#### Admin Application

- Removed redundant More Information parameter fields (`key`, `name`, `type`) from admin payloads.

## [1.2.2] - 2026-02-16

### Added

#### Stack-level

- Profile-based configuration layout under `profiles/` (development/postgres/oracle) with ready-to-copy `.env` profiles:
  - `profiles/development-postgres.env`, `profiles/development-oracle.env` (development + demo DB)
  - `profiles/postgres.env`, `profiles/oracle.env` (dockerized DB, seed data)
  - Profile compose files: `profiles/postgres/docker-compose.yml`, `profiles/oracle/docker-compose.yml`
- Translation and Liquibase helper tooling under `tools/`:
  - Translations/seed data: `tools/seed-data/*` (extract/generate/import/validate workflows)
  - Liquibase: `tools/validate-liquibase-changelogs.sh`
  - CSV helpers: `tools/sort_codelist*.py`, `tools/front-i18n/sort_and_complete_translations.py`

#### Backend Core

- Request-scoped translation cache and database-driven locale resolution for i18n lookups.
- Health endpoint reports healthy only after startup completes.

#### Admin Application

- System configuration menu for admin users.
- Tree type constraints enforcement for node type selection and validation.

#### Viewer Application

- Reload map and layer tree when language changes.

### Changed

#### Stack-level

- Reorganized backend config and demo data paths to be driven by `SITMUN_CONFIG_DIR` and profile folders under `profiles/`.
- Updated `docker-compose.yml` to support profile-based configuration mounting, improved database healthchecks, and optional dev/demo database profile.
- Updated frontend Docker build to use `ENVIRONMENT` (development/production) and inject `APP_VERSION` into frontend environment templates.
- Removed legacy `.env.example` in favor of profile `.env` files under `profiles/`.

#### Backend Core

- Refactored Liquibase configuration and removed legacy Heroku-related setup.
- Lowered translation application logs from info to debug level to reduce noise in normal operation.
- Updated README structure and formatting for consistency.

#### Viewer Application

- Added test coverage for language parameter behavior and improved related test quality.

#### Proxy Middleware

- Build configuration: override Axion SCM version with explicit `1.2.2` in `build.gradle`.
- Documentation: update README version badge to `1.2.2`.

### Fixed

#### Backend Core

- Corrected tree node codelist naming (`code-list-name`) handling.
- Stabilized test execution for parallel runs and database-specific scenarios (PostgreSQL/Oracle/WebMvcTest).

#### Viewer Application

- Fixed catalog switching state and button visibility after app switch or language change.
- Increased contrast for loaded layers list text.

#### Backend Core / Development data

- Print Map task (TAS_ID 20): logo parameter updated from `https://ide.cime.es/stm3/admin/assets/img/logos/logo_sitmun.svg` to `https://avatars.githubusercontent.com/u/24718368?s=200&v=4` to avoid CORS issues when embedding the image in the printed map.

## [1.2.1] - 2026-02-06

### Added

#### Backend Core

- Multi-provider OIDC authentication support alongside existing database/LDAP authentication options
- Multi-client frontend redirect URLs based on query parameter appended to OIDC auth requests
- Integration tests for redirect service and complete OIDC authentication flow
- Unit tests for OIDC authentication

#### Admin Application

- OIDC authentication support with dynamically configured providers
- Callback component to handle backend redirection and JWT storage
- Cookie-based JWT transport using ngx-cookie-service for future HttpOnly cookie support
- OIDC provider buttons dynamically rendered below separator in login form
- Translation strings for OIDC authentication flows
- Callback component tests

#### Viewer Application

- OIDC authentication support with dynamically configured providers
- Callback component to handle backend redirection and JWT storage
- Cookie-based JWT transport using ngx-cookie-service for future HttpOnly cookie support
- OIDC provider buttons dynamically rendered below login form
- Translation strings for OIDC authentication flows
- Callback component tests
- Query parameter for proper backend to frontend redirection

### Changed

#### Backend Core

- Centralized redirect logic and removed redundant attributes

#### Admin Application

- Refactored auth constants for better organization
- Updated to Material spinner component
- Enhanced authentication test coverage

#### Viewer Application

- Improved mobile view for authentication
- Made SITNA paths relative by default
- Enhanced existing authentication code with readonly/keydown attributes and extracted methods

### Fixed

#### Backend Core

- Consistency mismatch between success and failure handlers

#### Viewer Application

- Cookie removal on logout

## [1.2.0] - 2026-01-27

### Added

#### Backend Core

- **Build System**: Parametrizable build output with support for JAR or WAR packaging via `-Ppackaging` property
- **Deployment**: ServletInitializer for WAR deployment to external servlet containers (Tomcat, WildFly, WebSphere)
- **Performance**: Entity graphs for cartography and task repositories
- **Validation**: Tree type validation endpoint
- **Mapping**: CRS support in service profile mapping
- **DTOs**: Application name field in DTOs
- **Language Controller**: New LanguageController to manage language-related endpoints
- **MBTiles Service Configuration**: MBTiles service URL configuration support for enhanced mapping capabilities
- **Tree Node View Mode**: New viewmode option for tree nodes in codelist configuration
- **Enhanced User Management**: Comprehensive user management and security system with position tracking and OTP password reset functionality
- **Test Coverage**: Comprehensive tests for MBTiles and security-related changes
- **Recovery Token Management**: STM_TOKEN_USER table for managing user tokens with relevant fields, USE_LAST_PASSWORD_CHANGE column in STM_USER table

#### Admin Application

- **Tree Node View Mode**: New tree node view mode functionality
- **Help Tooltips**: Help tooltips in node mapping and task edit attributes forms

#### Viewer Application

- **Basemap Selector**: Basemap selector and comparator component with improved UI
- **Projection Data Patch**: Projection data patch for EPSG coordinate system handling with caching support
- **SITNA Integration**: API Sitna integrated as npm module dependency
- **Navigation Enhancement**: Navigation method that accepts both application and territory IDs for explicit routing
- **Territory Count Display**: Territory count label displayed on application presentation page
- **Animation Modules**: BrowserAnimation and MatExpansion modules for enhanced user interface
- **Description Truncation**: Description max length truncation pipe for managing long text in cards
- **Error Handling Infrastructure**: New ErrorTrackingService and GlobalErrorHandler for centralized error management
- **Error Details Sidebar**: New component for enhanced error reporting and debugging
- **About Dialog**: New component for displaying application information and version details
- **New Services**: catalog-switching, layer-info, map-interface, map-service-worker, raster-layer, sidebar-manager
- **Standard Control Handlers**: feature-info-control and search-control handlers (replacing custom silme implementations)
- **Testing**: Search control handler with comprehensive test coverage
- **Assets**: Barcelona background image asset for application branding

#### Proxy Middleware

- **Build System**: Parametrizable build output with support for JAR or WAR packaging via `-Ppackaging` property
- **Deployment**: ServletInitializer for WAR deployment to external servlet containers
- **Error Handling**: RFC 9457 Problem Details for standardized HTTP error responses
- **Error Types**: ProblemDetail and ProblemTypes classes for structured error handling

### Changed

#### Backend Core

- **Error Responses**: RFC 9457 problem details for error responses (standardized error format)
- **Password Verification**: Improved password verification implementation with enhanced security measures
- **Language Endpoints**: Restructured language endpoints and improved password verification system
- **Spring Boot Tests**: Modernized Spring Boot test annotations and removed deprecated testing patterns
- **Code Quality**: Applied comprehensive code formatting and cleanup across the codebase

#### Admin Application

- **Angular Framework**: Upgraded to Angular 19 with latest features and performance improvements
- **Dependencies**: Updated Angular Material, TypeScript, and related dependencies to match Angular 19 requirements

#### Viewer Application

- **Angular Framework**: Upgraded to Angular 19 with latest features and performance improvements
- **Dependencies**: Updated Angular Material, TypeScript, and related dependencies to match Angular 19 requirements

- **SITNA API Upgrade**: SITNA API upgraded from version 4.1.0 to 4.8.0 (major version update with new features and improvements)
- **Control Handler Refactoring**: Major architectural refactoring - migrated from custom "silme" control handlers to standard SITNA handlers for better maintainability
- **Layer Catalog Simplification**: Refactored layer-catalog-control.handler with significant simplification (reduced from ~2,000 to ~500 lines)
- **Service Worker Configuration**: Updated Service Worker configuration for better scope handling with PUBLIC_BASE_PATH support
- **Webpack Configuration**: Updated webpack configuration with PUBLIC_BASE_PATH variable support for flexible deployment paths
- **Password Reset Flow**: Password reset flow consolidated and improved for better security
- **UI/UX Enhancements**: Application presentation page now displays territory counts with orange hover effects, territory section background changed to white, dashboard card layout and visual design improvements
- **Header Navigation**: Header navigation bar enhanced with improved menu component and language selection
- **Territory List**: Territories list component accent color changed to orange
- **Mobile View**: Card content on mobile view now uses expansion panels with text truncation
- **Profile Security**: Profile update security improved by verifying user credentials directly in update function
- **Dashboard Filtering**: Dashboard filtering changed to use appPrivate field instead of public field
- **HTTP Methods**: User account and territory position update requests changed from PUT to POST method

#### Proxy Middleware

- **Error Responses**: Error responses now use RFC 9457 Problem Details format (`application/problem+json`)
- **Error Handling**: Migrated from ErrorResponseDto to ProblemDetail across all error handlers
- **Testing**: Updated test assertions to reflect external service changes

#### Stack-Level

- **Workshop Data**: Updated with data required for the workshop in Girona
- **Docker Images**: Updated Node.js base image from 18 to 20 in frontend Dockerfile to match project requirements (.nvmrc and package.json engines)
- **Docker Images**: Updated Amazon Corretto from 17.0.16 to 17.0.17 in all backend and proxy Dockerfiles for latest security patches
- **Security Configuration**: Externalized middleware authentication secret to environment variable (MIDDLEWARE_SECRET) for production deployments
- **Documentation**: Added MIDDLEWARE_SECRET to environment variables documentation and security configuration guide

### Fixed

#### Backend Core

- **Database Schema**: Oracle schema updates for STM_USER and STM_TOKEN_USER tables
- **Exception Handling**: LazyInitializationException handling during constraint violations
- **Database Constraints**: STM_TSK_UI.TUI_NAME column size increased to 50 characters
- **Client Configuration i18n**: Prevented unnecessary internationalization updates on client configuration requests to improve performance
- **Profile Security Updates**: Fixed profile update security issues with enhanced validation
- **Password Reset Token Operations**: Fixed token password reset operation to ensure proper security handling
- **Profile Security**: Updated profile update mechanism for enhanced security measures
- **Tree Node View Mode Description**: Updated description for tree node viewmode in application configuration
- **Code Formatting**: Improved code formatting and removed duplicate imports

#### Admin Application

- **WMS Capabilities**: Numeric layer names handling in WMS capabilities processing
- **Translation Infrastructure**: Translation infrastructure with defensive programming and null checks
- **Role Form**: Role form save payload to include form values via createObject
- **Field Rename**: Field rename from spatialSelectionConnectionId to spatialSelectionServiceId in layers form

#### Viewer Application

- **Template Type Errors**: Template type errors in dashboard item and menu components
- **Navigation Redirection**: Navigation redirection issues in dashboard item component
- **Missing Selectors**: Missing nav-home selector in DrawMeasureModify component
- **EPSG.io Endpoint**: EPSG.io broken endpoint with workaround patches
- **Global TC Object**: Global TC object accessibility in patch files
- **Template Syntax**: Invalid template syntax by removing this and .content references

#### Stack-Level

- **Docker Configuration**: Fixed proxy service healthcheck endpoint to include correct port (8080) and path (/actuator/health)

### Removed

#### Backend Core

- **Tests**: Stale test removal for cleaner test suite

#### Viewer Application

- **Unused Dependencies**: Unused library dependencies in basemap control
- **Reset Password Component**: Reset password component in favor of consolidated forgot password flow
- **Legacy Control Handlers**: Removed custom "silme" control handler implementations (draw-measure-modify, feature-info, layer-catalog, popup, search) - replaced with standard SITNA handlers
- **Legacy Utilities**: Removed sitna-helpers.ts utility file (functionality integrated into dedicated services)
- **Legacy Controls**: Removed ExternalWMSSilme.js custom control (replaced with standard SITNA controls)
- **Unused Assets**: Removed unused logo asset (bck_no_logo.jpg)

### Notes

#### Backend Core & Proxy Middleware

- Docker builds only support JAR format (default)
- WAR builds are intended for deployment to external application servers (Tomcat, WildFly, WebSphere, etc.)
- Use `-Ppackaging=war` for building WAR packages locally

## [1.1.1] - 2025-08-28

### Added

#### Backend Core

- **Configuration**: Default header parameters configuration for SITMUN applications
- **Testing**: Comprehensive test coverage for authorization components, test coverage for application default values functionality

#### Admin Application

- **Header Configuration**: Application header parameter configuration with customizable left and right sections, header display controls for SITMUN logo, application switcher, home menu, language selector, profile and logout buttons
- **Task Management**: Enhanced task selection functionality on tree nodes with improved validation
- **Application Controls**: Application privacy controls through `appPrivate` property configuration

#### Viewer Application

- **Navigation**: New territories list component for better territory management, enhanced navigation bar with app/territory switching functionality
- **UI Components**: New UI icons for improved user interface (change, check, menu, dropdown), map section navigation controls with show/hide navbar functionality
- **Internationalization**: Additional internationalization strings for new features
- **Development**: GitHub workflow for managing stale issues and pull requests

#### Proxy Middleware

- **HTTP Support**: HTTP POST request support for proxy endpoints, enhanced HTTP protocol interface with method and body accessor methods
- **Testing**: Comprehensive test suite for HTTP protocol components with SSL/TLS testing, extended test coverage for request configuration services

### Changed

#### Backend Core

- **Architecture**: Reorganized authorization package structure into client and proxy subpackages
- **Performance**: Enhanced SQL generation robustness in QueryVaryFiltersDecorator

#### Admin Application

- **Component Architecture**: Modernized territory form component with BaseFormComponent pattern for consistency, enhanced tree node task selection with better validation and error messaging
- **UI Components**: Improved warnings panel component with expandable interface and badge notifications

#### Viewer Application

- **Navigation**: Enhanced navigation bar component with improved functionality
- **UI Components**: Updated secondary button component styling and behavior, improved notification component styling, enhanced map styles with updated CSS configurations

#### Proxy Middleware

- **Architecture**: Refactored HTTP request body decorator to use generic context interface, enhanced proxy controller with POST request handling capabilities
- **Performance**: Improved HTTP request processing and execution, updated request configuration DTOs for better request support

### Fixed

#### Backend Core

- **Data Integrity**: QueryVaryFiltersDecorator: prevent mutation of input target map, HashMapConverter: add null safety to prevent NPE
- **UI Components**: Filter out null tree nodes in profile's tree list
- **Configuration**: Update application version to use project.version variable

#### Admin Application

- **Angular Issues**: Angular compiler strict template compliance issues across multiple components
- **UI Components**: Background maps filtering in layers-permits grid to prevent display conflicts
- **Error Handling**: Error handling with localized messages for initialization and service capabilities, fallback message translation handling for better internationalization
- **Form Management**: Application form initialization to ensure `isUnavailable` property is properly set
- **Authentication**: Route-driven authentication layout with simplified auth flow, core/HAL module with dropped Node polyfills and modernized RxJS error handling

#### Viewer Application

- **Navigation**: Fixed navbar not updating on in-app navigation, resolved navbar override issues on page refresh
- **UI Components**: Fixed ChangeAppTerritory button visibility logic (now shows when there's one app and one territory)

#### Proxy Middleware

- **Request Processing**: Improved HTTP request body handling and processing, enhanced request method detection and routing

### Removed

#### Proxy Middleware

- **Dependencies**: Apache HTTP Client 5.x dependency and related configuration

## [1.1.0] - 2025-08-18

### Added

#### Admin Application

- **User Management**: Warnings panel to surface user validation issues from backend, user info component to toolbar, email field to user form with validation
- **Application Controls**: Application privacy controls with `appPrivate` property, application dashboard field, creator field and maintenance information to application form
- **Feature System**: Feature flag system with directive, pipe, component, and service
- **Task Management**: Task edit management components for enhanced task administration
- **Form Enhancements**: Description field to territory form and model, character counter and validation to various forms
- **Tree Management**: Roles management tab to trees form, touristic tree tree form, touristic tree node mapping.
- **Data Grid**: Search and replace functionality to data grid, router link renderer for improved data grid functionality
- **Development Tools**: Comprehensive logging facilities and URI template support, Docker support for development environment

#### Backend Core

- **Validation & Integrity**: User validation service with warning system for data integrity, application privacy controls for restricted and public applications
- **Multilingual Support**: Extended multilingual support for client configuration endpoints
- **Territory Management**: Territory preferred SRS priority for map viewer configuration, support for touristic applications and touristic trees
- **Development Tools**: Enhanced test messages and debugging information

#### Proxy Middleware

- **Request Processing**: Protocol-specific request executors for HTTP, JDBC, and WMS services
- **Code Quality**: Comprehensive code quality tools with Spotless and enhanced JaCoCo, Git hooks for automated code quality enforcement and conventional commit validation
- **Deployment**: Docker configuration with multi-stage builds using Amazon Corretto 17, external configuration mounting for containerized deployments (replaced basic docker-compose.yml)
- **Development Tools**: Spring configuration metadata for better IDE support, Gradle Version Catalog for centralized dependency management, Axion Release plugin for automated version management

#### Viewer Application

- **Configuration**: Node.js version specification (.nvmrc) for v16, engine requirements specification in package.json (Node >=16.0.0, npm >=8.0.0)
- **Documentation**: Comprehensive documentation improvements in README.md
- **UI Components**: Enhanced notification system with dedicated service and component, additional Angular Material UI components (autocomplete, form-field, input, icon), new UI components for application details, territory details, and profile information

### Changed

#### Backend Core

- Migrated to Spring Boot 3.5.4 & Java 17
- Migrated dependencies to Version Catalog
- Updated to Oracle JDBC 11

#### Admin Application

- **Component Architecture**: Migrated multiple components to `BaseFormComponent` pattern for consistency, modernized territory form component with `BaseFormComponent` pattern, modernized component architecture with base component patterns
- **Code Quality**: Migrated from TSLint to ESLint for better code quality, replaced Karma with Jest testing framework
- **Error Handling**: Enhanced error handling with localized messages, improved database connection validation
- **Module Organization**: Migrated from frontend-core to domain module architecture for better organization, reorganized HAL module as part of core with functional structure
- **UI Structure**: Standardized side menu structure and translation handling
- **Dependencies**: Updated RxJS from v6.6.0 to v7.8.1 for Angular 16 compatibility

#### Viewer Application

- **Framework Updates**: Upgraded Angular from v16.0.0 to v16.2.12 for improved performance and modern features, updated TypeScript from v4.9.5 to v5.1.6 for enhanced type safety, updated Angular Material from v15.2.3 to v16.2.12 for consistent UI components
- **Internationalization**: Updated ngx-translate packages for better internationalization
- **Code Quality**: Updated ESLint and related development dependencies for improved code quality
- **Project Structure**: Modernized project structure and configuration with improved component organization, enhanced module imports in app.module.ts and ui.module.ts, updated tsconfig.json and angular.json configurations for better build optimization, restructured UI components with better folder organization

#### Proxy Middleware

- **Framework Migration**: Migrated to Spring Boot 3.5.4 & Java 17, migrated dependencies to Version Catalog
- **Architecture**: Reorganized codebase into protocol-based architecture (http, jdbc, wms)
- **Documentation**: Completely rewrote documentation with detailed architecture guide
- **Testing**: Improved test organization with protocol-specific test classes
- **Deployment**: Restructured Docker configuration with environment-specific configs

### Fixed

#### Backend Core

- Modernized SITMUN backend core configuration and deployment structure
- Improved database connection validation error handling
- Oracle CLOB and PostgreSQL TEXT handling
- Minor fixes
- Fix test data

#### Admin Application

- **Authentication**: Route-driven authentication layout and simplified auth flow, 403 errors now properly redirect to login page, logout functionality issues and prevented API request loops, login functionality restoration
- **Angular Issues**: Angular compiler strict template compliance issues, TypeScript compilation errors for Angular 16 compatibility, deprecated AG Grid and Angular form APIs
- **UI Components**: Background maps filtering in layers-permits grid, empty SCSS files and restored variables.scss, AG Grid autoresize functionality, dashboard component issues
- **Data Management**: Multiple territories assignment to multiple roles, task form validation and UI improvements, layer permissions and roles components
- **Error Handling**: Error handling and fallback message translation

#### Viewer Application

- Resolved dependency conflicts and compatibility issues
- Fixed build configuration problems
- Corrected module import issues

#### Proxy Middleware

- Modernized SITMUN proxy middleware configuration and deployment structure
- Improved request processing and error handling
- Enhanced backward compatibility with existing APIs
- Build system with quality gates and automated checks

### Removed

#### Backend Core

- **Legacy Code**: Java 7 and Java 8 legacy code, code deprecated in version 1.0.0
- **Legacy Modules**: Legacy modules: heroku-dev-full, preprod, heroku-dev-lite, cli
- **Database**: Legacy database tables: STM_PAR_TSK, STM_DOWNLOAD, STM_THEMATIC, STM_THE_RANK, STM_QUERY

#### Admin Application

- **Dependencies**: Node polyfills from core/hal module, Syncfusion dependencies, Protractor testing framework
- **Code Cleanup**: Unused save methods from domain services, redundant translations and improved structure

#### Viewer Application

- **Configuration**: Removed Docker and nginx configuration files, cleaned up obsolete configuration files
- **Dependencies**: Removed unused dependencies (fflate, hammerjs, igniteui-angular)

#### Proxy Middleware

- **Legacy Components**: Legacy Spring Boot dependencies and deprecated components, deprecated security configurations
- **Configuration**: Unused configuration files and redundant code, legacy deployment and build scripts

## [1.0.0] - 2024-11-12

### Added

#### Admin Application

- Initial stable release of SITMUN Admin Application
- Comprehensive user management interface
- Territory and application administration
- Cartography and service management
- Task management system with multiple task types (basic, query, edit)
- Tree and node management
- Background layers administration
- Role-based access control interface
- Connection management for database connections
- Multilingual support (Catalan, English, Spanish, French, Occitan)
- Responsive design with modern UI components
- Form validation and error handling
- Data grid functionality with AG Grid
- Authentication and authorization system
- REST API integration with HAL+JSON
- Comprehensive test suite with Karma and Jasmine

#### Backend Core

- Initial stable release of SITMUN Backend Core
- Spring Boot application with JPA/Hibernate
- REST API with Spring Data REST
- Spring Security implementation
- Liquibase database migration
- Multi-database support (H2, PostgreSQL, Oracle)
- User management and authentication
- Territory and application management
- Cartography and service management
- Task management system
- Tree and node management
- Background and parameter management
- Role-based access control
- LDAP integration
- Mail functionality
- OpenAPI/Swagger documentation
- Health monitoring endpoints
- Docker support
- Comprehensive test suite

#### Proxy Middleware

- Initial stable release of SITMUN Proxy Middleware
- Basic API gateway functionality
- Request routing and proxy capabilities
- Security and authentication middleware
- CORS handling
- Basic request/response processing

#### Viewer Application

- Initial stable release of SITMUN Viewer Application
- Basic map viewer with SITNA library integration
- User and Territory-based application configuration
- User authentication and session management
- Responsive design with Angular Material
- Multilingual support (Catalan, English, Spanish, French)
- Basic cartography tools and layer management
- Service integration capabilities

### Changed

#### Backend Core

- Modernized from legacy Spring Boot versions
- Implemented proper dependency management
- Enhanced code quality and maintainability

#### Admin Application

- Implemented proper dependency management
- Enhanced code quality and maintainability

### Fixed

#### Backend Core

- Various bug fixes and improvements from development phase

#### Admin Application

- Various bug fixes and improvements from development phase

#### Viewer Application

- Various bug fixes and improvements from development phase
- Basic functionality stabilization and error handling

#### Proxy Middleware

- Various bug fixes and improvements from development phase
- Basic proxy functionality stabilization

---

## Component-Specific Changelogs

For detailed changelogs of individual components, see:

- [Backend Core Changelog](back/backend/sitmun-backend-core/CHANGELOG.md)
- [Admin Application Changelog](front/admin/sitmun-admin-app/CHANGELOG.md)
- [Viewer Application Changelog](front/viewer/sitmun-viewer-app/CHANGELOG.md)
- [Proxy Middleware Changelog](back/proxy/sitmun-proxy-middleware/CHANGELOG.md)

## Links

[unreleased]: https://github.com/sitmun/sitmun-application-stack/compare/sitmun-application-stack/1.2.6...HEAD
[1.2.6]: https://github.com/sitmun/sitmun-application-stack/compare/sitmun-application-stack/1.2.5...sitmun-application-stack/1.2.6
[1.2.5]: https://github.com/sitmun/sitmun-application-stack/compare/sitmun-application-stack/1.2.4...sitmun-application-stack/1.2.5
[1.2.4]: https://github.com/sitmun/sitmun-application-stack/compare/sitmun-application-stack/1.2.3...sitmun-application-stack/1.2.4
[1.2.3]: https://github.com/sitmun/sitmun-application-stack/compare/sitmun-application-stack/1.2.2...sitmun-application-stack/1.2.3
[1.2.2]: https://github.com/sitmun/sitmun-application-stack/compare/sitmun-application-stack/1.2.1...sitmun-application-stack/1.2.2
[1.2.1]: https://github.com/sitmun/sitmun-application-stack/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/sitmun/sitmun-application-stack/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/sitmun/sitmun-application-stack/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/sitmun/sitmun-application-stack/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sitmun/sitmun-application-stack/releases/tag/v1.0.0
