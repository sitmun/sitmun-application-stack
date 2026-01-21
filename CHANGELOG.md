# Changelog

All notable changes to the SITMUN Application Stack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0-rc.1] - 2026-01-21

### Added

#### Backend Core

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

### Changed

#### Backend Core

- **Password Verification**: Improved password verification implementation with enhanced security measures
- **Language Endpoints**: Restructured language endpoints and improved password verification system
- **Spring Boot Tests**: Modernized Spring Boot test annotations and removed deprecated testing patterns
- **Code Quality**: Applied comprehensive code formatting and cleanup across the codebase

#### Viewer Application

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

#### Stack-Level

- **Workshop Data**: Updated with data required for the workshop in Girona

### Fixed

#### Backend Core

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

### Removed

#### Viewer Application

- **Unused Dependencies**: Unused library dependencies in basemap control
- **Reset Password Component**: Reset password component in favor of consolidated forgot password flow
- **Legacy Control Handlers**: Removed custom "silme" control handler implementations (draw-measure-modify, feature-info, layer-catalog, popup, search) - replaced with standard SITNA handlers
- **Legacy Utilities**: Removed sitna-helpers.ts utility file (functionality integrated into dedicated services)
- **Legacy Controls**: Removed ExternalWMSSilme.js custom control (replaced with standard SITNA controls)
- **Unused Assets**: Removed unused logo asset (bck_no_logo.jpg)

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

[unreleased]: https://github.com/sitmun/sitmun-application-stack/compare/v1.2.0-rc.1...HEAD
[1.2.0-rc.1]: https://github.com/sitmun/sitmun-application-stack/compare/v1.1.1...v1.2.0-rc.1
[1.1.1]: https://github.com/sitmun/sitmun-application-stack/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/sitmun/sitmun-application-stack/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sitmun/sitmun-application-stack/releases/tag/v1.0.0
