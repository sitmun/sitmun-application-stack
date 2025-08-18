# Changelog

All notable changes to the SITMUN Application Stack will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/sitmun/sitmun-application-stack/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/sitmun/sitmun-application-stack/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sitmun/sitmun-application-stack/releases/tag/v1.0.0
