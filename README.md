# SITMUN Application Stack

[![License: EUPL v1.2](https://img.shields.io/badge/License-EUPL%20v1.2-blue.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-1.2.2-blue.svg)

The **SITMUN Application Stack** is a comprehensive multi-container geospatial platform that provides a complete solution for territorial information management, geographical services, and spatial applications. This stack integrates all SITMUN components into a unified, containerized environment designed for development, testing, and production deployment.

## Table of Contents

- [About SITMUN](#about-sitmun)
- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Services](#services)
- [Development](#development)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## About SITMUN

SITMUN (Sistema de Información Territorial de la Mancomunidad de Municipios) is a geospatial information management system for territorial data, services, and spatial applications.

## Architecture Overview

The stack has four main components:

```text
┌─────────────────────────────────────────────────────────────┐
│                    SITMUN Application Stack                 │
├─────────────────────────────────────────────────────────────┤
│  Frontend Layer                                             │
│  ├── SITMUN Viewer App (Angular 19)                         │
│  └── SITMUN Admin App (Angular 19)                          │
├─────────────────────────────────────────────────────────────┤
│  Backend Layer                                              │
│  ├── SITMUN Backend Core (Spring Boot 3)                    │
│  └── SITMUN Proxy Middleware (Spring Boot 3)                │
├─────────────────────────────────────────────────────────────┤
│  Database Layer                                             │
│  ├── PostgreSQL 16 / Oracle 23c / H2                        │
│  └── Liquibase Migration                                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

| Component                   | Technology             | Purpose                                          | Port      |
| --------------------------- | ---------------------- | ------------------------------------------------ | --------- |
| **SITMUN Viewer App**       | Angular 19, TypeScript | Interactive map visualization and user interface | 9000      |
| **SITMUN Admin App**        | Angular 19, TypeScript | Administrative interface and configuration       | 9000      |
| **SITMUN Backend Core**     | Spring Boot 3, Java 17 | Core REST API and business logic                 | 9001      |
| **SITMUN Proxy Middleware** | Spring Boot 3, Java 17 | Secure proxy and middleware services             | 9002      |
| **Database**                | PostgreSQL/Oracle/H2   | Data persistence and geospatial storage          | 9003/9004 |

## Technology Stack

- Frontend: Angular 19, TypeScript, SITNA
- Backend: Spring Boot 3, Java 17, Gradle
- Database: PostgreSQL 16 (default), Oracle 23c, H2 (dev only), Liquibase
- Infrastructure: Docker, Docker Compose, Git submodules, SonarCloud

## Quick Start

### Prerequisites

- Docker Engine + Docker Compose (or Docker Desktop)
- Git

### Quick Setup

1. **Clone the repository with submodules**

   ```bash
   git clone --branch dev --recurse-submodules https://github.com/sitmun/sitmun-application-stack.git
   cd sitmun-application-stack
   ```

2. **Setup the environment**

   For Unix-based systems (Linux/macOS):

   ```bash
   ./setup.sh
   ```

   For Windows systems:

   ```powershell
   ./setup.ps1
   ```

3. **Start the SITMUN Application Stack**

   ```bash
   docker compose up -d
   ```

4. **Access the applications**

   - **Viewer Application**: [http://localhost:9000/viewer](http://localhost:9000/viewer) (public access)
   - **Admin Application**: [http://localhost:9000/admin](http://localhost:9000/admin) (requires authentication)
   - **Backend API**: [http://localhost:9000/backend](http://localhost:9000/backend)
   - **API Documentation**: [http://localhost:9001/swagger-ui/index.html](http://localhost:9001/swagger-ui/index.html)

5. **Default credentials**
   - Username: `admin`
   - Password: `admin`

## Installation

### Development Installation

1. **Clone the Repository**

   ```bash
   git clone --branch dev --recurse-submodules https://github.com/sitmun/sitmun-application-stack.git
   cd sitmun-application-stack
   ```

2. **Setup Environment**

   ```bash
   # Unix-based systems
   ./setup.sh

   # Windows systems
   ./setup.ps1
   ```

3. **Start Services**

   ```bash
   docker compose up -d
   ```

4. **Verify Installation**

   ```bash
   # Check service status
   docker compose ps

   # Check backend health
   curl http://localhost:9001/api/dashboard/health

   # Check proxy health
   curl http://localhost:9002/actuator/health
   ```

### Production Installation

1. **Environment Configuration**

   Copy a profile to `.env` and edit for production (see [Database Configuration](#database-configuration) for all options):

   ```bash
   # For PostgreSQL (default)
   cp profiles/postgres.env .env

   # For Oracle
   cp profiles/oracle.env .env

   # Edit environment variables for production
   nano .env
   ```

2. **Database Setup**

   Database settings are already set by the profile you copied. To change database type later, copy a different profile to `.env` or edit `SITMUN_DB_PROFILE` and `COMPOSE_PROFILES` in `.env`. See the [Database Configuration](#database-configuration) section for details and verification steps.

3. **SSL Configuration**

   ```bash
   # In .env, set for HTTPS (standard port 443)
   PUBLIC_URL_SCHEME=https
   # PUBLIC_PORT and PUBLIC_NON_STANDARD_PORT are not needed for standard port 443
   ```

## Configuration

### Environment Variables

The SITMUN Application Stack uses environment variables for configuration. Copy a profile from `profiles/` to `.env` (see [Database Configuration](#database-configuration)); the following variables are used:

| Variable                   | Description                                           | Default Value                       |
| -------------------------- | ----------------------------------------------------- | ----------------------------------- |
| `PUBLIC_URL_SCHEME`        | Protocol (http/https)                                 | `http`                              |
| `PUBLIC_HOSTNAME`          | Public hostname                                       | `localhost`                         |
| `PUBLIC_PORT`              | Public port number (blank for standard port)          | `9000`                              |
| `PUBLIC_NON_STANDARD_PORT` | Set to mark use of a non-standard port                | `1`                                 |
| `PUBLIC_BASE_PATH`         | Application context path (must start and end with /)  | `/`                                 |
| `LOCAL_PORT`               | Port the nginx container listens on                   | `9000`                              |
| `LOCAL_BASE_PATH`          | Base path in the nginx container                      | `/`                                 |
| `SITMUN_PROFILE`           | SITMUN scenario profile                               | `development`                       |
| `SITMUN_DB_PROFILE`        | Spring Boot database profile (postgres/oracle)        | `postgres`                          |
| `COMPOSE_PROFILES`         | Docker containers to start (postgres, oracle, dev)    | `postgres`                          |
| `DATABASE`                 | Database name                                         | `sitmun3`                           |
| `DATABASE_URL`             | JDBC URL                                              | `jdbc:postgresql://postgres:5432/`  |
| `DATABASE_USERNAME`        | Database username                                     | `sitmun3`                           |
| `DATABASE_PASSWORD`        | Database password                                     | `sitmun3`                           |
| `FORCE_USE_OF_PROXY`       | Force proxy middleware                                | `false`                             |
| `MIDDLEWARE_SECRET`        | Backend-proxy shared secret                           | Development default (change!)       |

### Database Configuration

The SITMUN Application Stack supports multiple database backends: **PostgreSQL 16** (default), **Oracle 23c**, and **H2** (development only). Three environment variables control setup:

- **`SITMUN_PROFILE`** -- SITMUN scenario profile. Use `development` for local development scenarios.
- **`SITMUN_DB_PROFILE`** -- Spring Boot database profile for the backend (`postgres` or `oracle`). Controls database dialect, Liquibase config, and which database service the backend depends on. Must always be set.
- **`COMPOSE_PROFILES`** -- Built-in Docker Compose variable that selects which containers start. Set to `postgres` or `oracle` for a dockerized database. Add `,dev` to also start the example demo database. Omit entirely for external databases.

`SITMUN_DB_PROFILE` and `COMPOSE_PROFILES` must agree on the database type when using a dockerized database.

The backend automatically loads the appropriate configuration from:

- `profiles/development/backend/application-postgres.yml` (for PostgreSQL)
- `profiles/development/backend/application-oracle.yml` (for Oracle)

#### Using Profile .env Files (Recommended)

Pre-configured profile `.env` files are provided in `profiles/`. Copy the desired profile to the project root as `.env`, edit as needed, then start the stack:

```bash
# Dockerized PostgreSQL
cp profiles/postgres.env .env
docker compose up -d

# Dockerized Oracle
cp profiles/oracle.env .env
docker compose up -d

# PostgreSQL + example demo database
cp profiles/development-postgres.env .env
docker compose up -d

# Oracle + example demo database
cp profiles/development-oracle.env .env
docker compose up -d

# External PostgreSQL (edit .env first)
cp profiles/postgres-external.env .env
# Edit .env with your connection details
docker compose up -d front backend proxy

# External Oracle (edit .env first)
cp profiles/oracle-external.env .env
# Edit .env with your connection details
docker compose up -d front backend proxy
```

#### PostgreSQL 16 (Default)

Using a profile `.env` file:

```bash
cp profiles/postgres.env .env
docker compose up -d
```

Or set variables directly in `.env`:

```env
SITMUN_PROFILE=development
SITMUN_DB_PROFILE=postgres
COMPOSE_PROFILES=postgres
DATABASE_URL=jdbc:postgresql://postgres:5432/
DATABASE=sitmun3
DATABASE_USERNAME=sitmun3
DATABASE_PASSWORD=sitmun3
```

Then: `docker compose up -d`

**Configuration details:**

- **Container name**: `postgres`
- **Port**: `9003:5432` (external:internal)
- **JDBC URL format**: `jdbc:postgresql://postgres:5432/`
- **Spring profile**: `postgres`
- **Hibernate dialect**: `org.hibernate.dialect.PostgreSQLDialect`

#### Oracle Database 23c

Using a profile `.env` file:

```bash
cp profiles/oracle.env .env
docker compose up -d
```

Or set variables directly in `.env`:

```env
SITMUN_PROFILE=development
SITMUN_DB_PROFILE=oracle
COMPOSE_PROFILES=oracle
DATABASE_URL=jdbc:oracle:thin:@//oracle:1521/
DATABASE=sitmun3
DATABASE_USERNAME=sitmun3
DATABASE_PASSWORD=sitmun3
```

Then: `docker compose up -d`

Oracle may take 60+ seconds on first start. Monitor with:

```bash
docker compose logs -f oracle
# Wait for "DATABASE IS READY TO USE!" message
```

**Configuration details:**

- **Container name**: `oracle`
- **Port**: `9004:1521` (external:internal)
- **JDBC URL format**: `jdbc:oracle:thin:@//oracle:1521/`
- **Spring profile**: `oracle`
- **Hibernate dialect**: `org.hibernate.dialect.OracleDialect`

#### Switching Between Databases

1. Stop all services:

   ```bash
   docker compose down
   ```

2. Copy a different profile to `.env` and start:

   ```bash
   cp profiles/oracle.env .env
   docker compose up -d
   ```

   Or update `SITMUN_DB_PROFILE` and `COMPOSE_PROFILES` in your `.env` file and run `docker compose up -d`.

3. Database migrations (Liquibase) run automatically on backend startup.

#### External Database

For an external database not managed by Docker Compose:

1. Copy the appropriate external profile to `.env` and edit with your connection details:

   ```bash
   cp profiles/postgres-external.env .env
   # Or: cp profiles/oracle-external.env .env
   # Edit .env with your connection details
   ```

2. Start services without a database container:

   ```bash
   docker compose up -d front backend proxy
   ```

   The `front backend proxy` arguments are required because `depends_on` references the database service, which is not started. This selectively starts only the application services.

Or set variables directly in `.env`:

```env
SITMUN_PROFILE=development
SITMUN_DB_PROFILE=postgres       # or oracle
# COMPOSE_PROFILES is omitted -- no database container starts
DATABASE_URL=jdbc:postgresql://your-host:5432/
DATABASE=your_database
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
```

Then: `docker compose up -d front backend proxy`

#### Example Demo Database (Optional)

An optional demo database with geospatial datasets is available for testing. It runs on port `9005` and includes UNESCO heritage sites, web publications, and materials management data from `profiles/development/demo-data/`.

To include it, use a development profile (which already sets `COMPOSE_PROFILES=postgres,dev` or `oracle,dev`):

```bash
# Using profile .env files
cp profiles/development-postgres.env .env
docker compose up -d
# Or for Oracle: cp profiles/development-oracle.env .env

# Or in .env: COMPOSE_PROFILES=postgres,dev
```

The example database is independent of the main SITMUN database and uses separate credentials (`example`/`example`).

### Application Configuration

#### Frontend Configuration

```typescript
// Environment configuration for Angular apps
export const environment = {
  production: boolean,
  apiBaseURL: string,
  logLevel: LogLevel,
  hashLocationStrategy: boolean,
};
```

#### Backend Configuration

```yaml
# Spring Boot application configuration
spring:
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:dev}
  datasource:
    url: ${DATABASE_URL}${DATABASE}
    username: ${DATABASE_USERNAME}
    password: ${DATABASE_PASSWORD}

sitmun:
  user:
    secret: ${SITMUN_USER_SECRET:auto-generated}
    token-validity-in-milliseconds: 36000000
  proxy-middleware:
    secret: ${SITMUN_PROXY_MIDDLEWARE_SECRET:auto-generated}
```

## Services

### Available Services

When the `BASE_URL` is `http://localhost:9000/`, the following services are available:

| Application            | URL                     | Description              | Authentication |
| ---------------------- | ----------------------- | ------------------------ | -------------- |
| **Viewer Application** | `${BASE_URL}viewer`     | Interactive map viewer   | Optional       |
| **Admin Application**  | `${BASE_URL}admin`      | Administrative interface | Required       |
| **Backend API**        | `${BASE_URL}backend`    | Core REST API            | JWT Token      |
| **Proxy Middleware**   | `${BASE_URL}middleware` | Proxy services           | JWT Token      |

### Service Endpoints

#### Backend Core API

- **Health Check**: `http://localhost:9001/api/dashboard/health`
- **Authentication**: `http://localhost:9001/api/authenticate`
- **User Management**: `http://localhost:9001/api/account`
- **Application Config**: `http://localhost:9001/api/config/client/application`
- **API Documentation**: `http://localhost:9001/swagger-ui/index.html`

#### Proxy Middleware API

- **Health Check**: `http://localhost:9002/actuator/health`
- **Proxy Configuration**: `http://localhost:9002/api/config/proxy`
- **Service Proxy**: `http://localhost:9002/api/proxy/*`

### Service Dependencies

```text
Viewer App ──┐
             ├── Backend Core ── Database
Admin App ───┘
             └── Proxy Middleware ── External Services
```

## Development

### Project Structure

The SITMUN Application Stack uses Git submodules to include the source code of all SITMUN components:

| Submodule                            | GitHub Repository                                                                | Docker Service | Technology Stack       |
| ------------------------------------ | -------------------------------------------------------------------------------- | -------------- | ---------------------- |
| `front/admin/sitmun-admin-app`       | [SITMUN Admin App](https://github.com/sitmun/sitmun-admin-app.git)               | `front`        | Angular 19, TypeScript |
| `front/viewer/sitmun-viewer-app`     | [SITMUN Viewer App](https://github.com/sitmun/sitmun-viewer-app.git)             | `front`        | Angular 19, TypeScript |
| `back/backend/sitmun-backend-core`   | [SITMUN Backend Core](https://github.com/sitmun/sitmun-backend-core.git)         | `backend`      | Spring Boot 3, Java 17 |
| `back/proxy/sitmun-proxy-middleware` | [SITMUN Proxy Middleware](https://github.com/sitmun/sitmun-proxy-middleware.git) | `proxy`        | Spring Boot 3, Java 17 |

### Profile-Based Development Environments

The stack includes minimum viable database profiles for rapid backend + database bootstrapping:

```text
profiles/
  development/
    backend/           # Backend Spring config (application.yml, Liquibase migrations)
    proxy/             # Proxy Spring config
  oracle/
    docker-compose.yml # Backend + Oracle DB with schema + seed data
  postgres/
    docker-compose.yml # Backend + Postgres DB with schema + seed data
```

**Running a standalone profile:**

```bash
# Start Postgres profile (backend + database with dev seed data)
cd profiles/postgres
docker compose up -d --build

# Verify backend health
curl http://localhost:8080/api/dashboard/health

# Start Oracle profile (mutually exclusive - use different terminal or stop postgres first)
cd ../oracle
docker compose up -d --build
```

**Important notes:**

- Profiles use `SPRING_LIQUIBASE_CONTEXTS=dev` to bootstrap schema + development seed data via Liquibase on startup.
- Backend listens on port `8080`, databases on standard ports (`5432` for Postgres, `1521` for Oracle).
- Profiles share the same container names and ports - run only one profile at a time locally.
- For production or custom contexts, override `SPRING_LIQUIBASE_CONTEXTS` in the compose environment section.

### Development Workflow

1. **Update Repository and Submodules**

   ```bash
   git fetch origin dev
   git checkout dev
   git submodule update --recursive --remote
   ```

2. **Change Submodule Branch (if needed)**

   ```bash
   # Switch submodule to specific branch
   git submodule set-branch -b branch_name submodule_name
   git submodule sync
   git submodule update --init
   ```

3. **Rebuild and Restart Services**

   ```bash
   # Rebuild specific service
   docker compose build --no-cache service_name
   docker compose up service_name -d

   # Rebuild all services
   docker compose build --no-cache
   docker compose up -d
   ```

### Individual Component Development

#### Frontend Development (Angular)

```bash
# Navigate to admin app
cd front/admin/sitmun-admin-app
npm ci
npm start

# Navigate to viewer app
cd front/viewer/sitmun-viewer-app
npm ci
npm start
```

#### Backend Development (Spring Boot)

```bash
# Navigate to backend core
cd back/backend/sitmun-backend-core
./gradlew bootRun --args='--spring.profiles.active=dev'

# Navigate to proxy middleware
cd back/proxy/sitmun-proxy-middleware
./gradlew bootRun --args='--spring.profiles.active=dev'
```

### Frontend Build Configurations

The frontend applications (Admin and Viewer) support three build configurations to cover different use cases:

| Configuration  | Use Case             | API URL                  | Source Maps | Optimization  |
| -------------- | -------------------- | ------------------------ | ----------- | ------------- |
| `development`  | Local `ng serve`     | `localhost:9000/backend` | Yes         | No            |
| `docker-dev`   | Docker debugging     | Template-based           | Yes         | No            |
| `production`   | Docker production    | Template-based           | No          | Yes           |

#### Local Development

For local development using `ng serve`, the `development` configuration uses `environment.ts` which points to the local docker-compose stack:

```bash
# Admin app
cd front/admin/sitmun-admin-app
npm install
npm start  # Uses development configuration

# Viewer app
cd front/viewer/sitmun-viewer-app
npm install
npm start  # Uses development configuration
```

The API URL is set to `http://localhost:9000/backend` (the docker-compose stack backend).

#### Docker Production Build

For production Docker builds, the `production` configuration is used by default:

```bash
# Build production Docker image (default)
docker compose build front
```

This creates optimized builds without source maps, using the `environment.prod.ts.template` which injects the API URL via `envsubst` at build time.

#### Docker Development Build (Debugging)

For debugging issues in a Docker environment, use the `docker-dev` configuration which includes source maps:

```bash
# Build Docker image with source maps for debugging
BUILD_MODE=docker-dev docker compose build front
```

This creates unoptimized builds with source maps enabled, while still using the template-based API URL configuration for Docker.

#### Environment Files

```text
front/
├── admin/
│   ├── environment.prod.ts.template          # Docker builds (envsubst)
│   └── sitmun-admin-app/src/environments/
│       ├── environment.ts                    # Local development
│       └── environment.prod.ts               # Production fallback
└── viewer/
    ├── environment.prod.ts.template          # Docker builds (envsubst)
    └── sitmun-viewer-app/src/environments/
        ├── environment.ts                    # Local development
        └── environment.prod.ts               # Production fallback
```

### Code Quality

```bash
# Frontend quality checks
cd front/admin/sitmun-admin-app
npm run lint
npm test

cd front/viewer/sitmun-viewer-app
npm run lint
npm test

# Backend quality checks
cd back/backend/sitmun-backend-core
./gradlew test
./gradlew spotlessCheck

cd back/proxy/sitmun-proxy-middleware
./gradlew test
./gradlew spotlessCheck
```

## API Documentation

### Backend Core API Reference

The SITMUN Backend Core provides comprehensive REST API functionality:

#### Authentication Endpoints

```http
POST /api/authenticate
Content-Type: application/json
{
  "username": "admin",
  "password": "admin"
}

GET /api/account
Authorization: Bearer <jwt-token>

POST /api/logout
Authorization: Bearer <jwt-token>
```

#### User Management Endpoints

```http
GET /api/account/all
GET /api/account/{id}
GET /api/account/public/{id}
POST /api/user-verification/verify-password
POST /api/user-verification/verify-email
POST /api/recover-password
GET /api/userTokenValid
```

#### Configuration Endpoints

```http
GET /api/config/client/application
GET /api/config/client/territory
GET /api/config/client/profile/{appId}/{territoryId}
POST /api/config/proxy
```

#### Health and Monitoring

```http
GET /api/dashboard/health
GET /api/dashboard/info
GET /api/dashboard/metrics
```

### Proxy Middleware API Reference

The SITMUN Proxy Middleware provides secure proxy functionality:

#### Proxy Endpoints

```http
GET /actuator/health
POST /api/config/proxy
GET /api/proxy/{service-type}/{service-id}
```

#### Service Types Supported

- **WMS**: Web Map Service proxy
- **WFS**: Web Feature Service proxy
- **WMTS**: Web Map Tile Service proxy
- **JDBC**: Database connection proxy
- **Custom**: Custom service proxy

### API Documentation Access

- **Backend Core Swagger**: [http://localhost:9001/swagger-ui/index.html](http://localhost:9001/swagger-ui/index.html)
- **Proxy Middleware**: Available through backend configuration endpoints
- **OpenAPI Specification**: Available in `/static/v3/` directory

## Security

### Authentication and Authorization

- **JWT Tokens**: Secure token-based authentication with configurable expiration
- **OIDC Authentication**: Multi-provider OpenID Connect support for enterprise single sign-on (new in 1.2.1)
- **Database Authentication**: Traditional username/password authentication
- **LDAP Integration**: Enterprise directory service authentication
- **Role-Based Access Control**: Fine-grained permissions based on user roles and territories
- **Application Privacy**: Applications can be marked as private to restrict public access
- **Public User Support**: Anonymous access with appropriate restrictions

### Security Features

```typescript
// Route protection example
{
  path: 'admin',
  component: AdminComponent,
  canActivate: [AuthGuard],
  data: { roles: ['ADMIN'] }
}

// HTTP interceptor for token handling
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    if (token) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }
    return next.handle(req);
  }
}
```

### Security Configuration

#### Middleware Secret

The backend and proxy services share a secret for secure authentication:

```env
# .env file
MIDDLEWARE_SECRET=your-secure-secret-here
```

**IMPORTANT for production**:

- Generate a secure random value: `openssl rand -hex 20`
- Never commit secrets to version control
- Both `SECURITY_AUTHENTICATION_MIDDLEWARE_SECRET` (backend) and `SITMUN_BACKEND_CONFIG_SECRET` (proxy) use this value
- Default development value should NOT be used in production

#### JWT Configuration

```yaml
sitmun:
  user:
    secret: ${SITMUN_USER_SECRET:auto-generated}
    token-validity-in-milliseconds: 36000000
  proxy-middleware:
    secret: ${MIDDLEWARE_SECRET:default-dev-secret}
```

#### CORS Configuration

```yaml
spring:
  web:
    cors:
      allowed-origins: "*"
      allowed-methods: GET,POST,PUT,DELETE,OPTIONS
      allowed-headers: "*"
```

#### Content Security Policy

```typescript
// Angular CSP configuration
{
  "content_security_policy": {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https:"],
    "connect-src": ["'self'", "https:"]
  }
}
```

## Troubleshooting

### Common Issues

#### Docker Issues

```bash
# Clean up Docker resources
docker compose down -v
docker system prune -f
docker volume prune -f

# Check service logs
docker compose logs service_name
docker compose logs -f service_name
```

#### Database Connection Issues

**Check database container status:**

```bash
# Check if database container is running
docker compose ps postgres  # For PostgreSQL
docker compose ps oracle    # For Oracle

# Check database logs
docker compose logs postgres
docker compose logs oracle
```

**Verify database connectivity from backend:**

```bash
# Test network connectivity
docker compose exec backend ping postgres  # For PostgreSQL
docker compose exec backend ping oracle   # For Oracle

# Check backend health (includes database connection check)
curl http://localhost:9001/api/dashboard/health
```

**PostgreSQL-specific troubleshooting:**

```bash
# Connect to PostgreSQL container
docker compose exec -it postgres psql -U sitmun3 -d sitmun3

# Check PostgreSQL logs
docker compose logs postgres | grep -i error

# Verify PostgreSQL is accepting connections
docker compose exec postgres pg_isready -U sitmun3
```

**Oracle-specific troubleshooting:**

```bash
# Oracle takes 60+ seconds to start on first run
docker compose logs -f oracle
# Wait for "DATABASE IS READY TO USE!" message

# Connect to Oracle container
docker compose exec -it oracle sqlplus sitmun3/sitmun3@//localhost:1521/sitmun3

# Check Oracle logs
docker compose logs oracle | grep -i error

# Verify Oracle is ready (may take time)
docker compose exec oracle sqlplus -L sitmun3/sitmun3@//localhost:1521/sitmun3 -c "SELECT 1 FROM DUAL;"
```

**Common database configuration errors:**

- **Wrong profile configuration**: Ensure `SITMUN_DB_PROFILE` and `COMPOSE_PROFILES` agree on the database type (both `postgres` or both `oracle`)
- **Incorrect DATABASE_URL format**:
  - PostgreSQL: `jdbc:postgresql://postgres:5432/`
  - Oracle: `jdbc:oracle:thin:@//oracle:1521/`
- **Database not ready**: Wait for health checks to pass before starting backend
- **Port conflicts**: Check if ports 9003 (PostgreSQL) or 9004 (Oracle) are already in use

#### Authentication Issues

```bash
# Check JWT token format
curl -H "Authorization: Bearer your-token" http://localhost:9001/api/account

# Verify user credentials
curl -X POST http://localhost:9001/api/authenticate \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

#### Frontend Build Issues

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm ci

# Check Node.js version
node --version  # Should be 16.x or higher
```

#### Backend Build Issues

```bash
# Clean Gradle cache
./gradlew clean

# Check Java version
java --version  # Should be 17 or higher

# Run with debug logging
./gradlew bootRun --args='--spring.profiles.active=dev --logging.level.org.sitmun=DEBUG'
```

### Debug Mode

#### Enable Debug Logging

```bash
# Backend debug logging
export LOGGING_LEVEL_ORG_SITMUN=DEBUG
export LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_SECURITY=DEBUG

# Restart services
docker compose restart backend proxy
```

#### Frontend Debug Mode

```bash
# Angular debug mode
ng serve --configuration=development --verbose

# Check browser console for errors
# Enable source maps in browser dev tools
```

### Performance Issues

#### Memory Issues

```bash
# Increase Docker memory limits
docker compose down
docker system prune -f
docker compose up -d

# Increase Java heap size
export JAVA_OPTS="-Xmx4g -Xms2g"
```

#### Database Performance

```bash
# Check database performance
docker compose exec postgres psql -U sitmun3 -d sitmun3 -c "SELECT * FROM pg_stat_activity;"

# Optimize database queries
# Check database indexes
# Monitor slow queries
```

## Contributing

### Development Guidelines

1. **Fork the repository** and create a feature branch
2. **Follow coding standards**:
   - Angular: Follow Angular style guide and use conventional commits
   - Spring Boot: Follow Spring Boot best practices and use conventional commits
   - Use functional code with complete but terse documentation
3. **Write tests** for new functionality
4. **Update documentation** as needed
5. **Ensure quality checks pass**:

   ```bash
   # Frontend
   npm run lint
   npm test
   npm run build -- --configuration=production

   # Backend
   ./gradlew test
   ./gradlew spotlessCheck
   ./gradlew build
   ```

6. **Submit a pull request** with a clear description

### Conventional Commits

We use [Conventional Commits](https://conventionalcommits.org/) for commit messages:

```bash
# Examples
git commit -m "feat(auth): add LDAP authentication support"
git commit -m "fix(api): resolve JWT token validation issue"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(components): add unit tests for user component"
git commit -m "style(formatting): apply prettier formatting"
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes

### Code Review Process

1. **Automated Checks**: All PRs must pass CI/CD pipeline
2. **Code Review**: At least one maintainer review required
3. **Quality Gate**: SonarCloud quality gate must pass
4. **Testing**: All tests must pass with adequate coverage
5. **Documentation**: Update docs for new features

## Support

### Getting Help

- **Documentation**: Check component-specific README files in submodules
- **Issues**: [GitHub Issues](https://github.com/sitmun/sitmun-application-stack/issues)
- **Component Issues**:
  - [Admin App Issues](https://github.com/sitmun/sitmun-admin-app/issues)
  - [Viewer App Issues](https://github.com/sitmun/sitmun-viewer-app/issues)
  - [Backend Core Issues](https://github.com/sitmun/sitmun-backend-core/issues)
  - [Proxy Middleware Issues](https://github.com/sitmun/sitmun-proxy-middleware/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sitmun/sitmun-application-stack/discussions)

### Reporting Issues

When reporting issues, please include:

1. **Environment**: OS, Docker version, Node.js version, Java version
2. **Steps to reproduce**: Clear step-by-step instructions
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Screenshots**: If applicable
6. **Logs**: Docker logs, browser console errors, application logs
7. **Configuration**: Relevant environment variables and configuration files

### Community Resources

- **SITMUN Documentation**: [https://sitmun.github.io/](https://sitmun.github.io/)
- **SITMUN Organization**: [https://github.com/sitmun](https://github.com/sitmun)
- **SonarCloud Quality Gates**:
  - [Backend Core](https://sonarcloud.io/dashboard?id=org.sitmun%3Asitmun-backend-core)
  - [Admin App](https://sonarcloud.io/dashboard?id=org.sitmun%3Asitmun-admin-app)
  - [Proxy Middleware](https://sonarcloud.io/dashboard?id=org.sitmun%3Asitmun-proxy-middleware)

## License

This project is licensed under the **European Union Public Licence V. 1.2** (EUPL-1.2). The EUPL is a copyleft open-source license compatible with major open-source licenses including GPL, AGPL, MPL, and others. See the [LICENSE](LICENSE) file for the full license text.

### License Compatibility

The EUPL v1.2 is compatible with:

- GNU General Public License (GPL) v2, v3
- GNU Affero General Public License (AGPL) v3
- Mozilla Public License (MPL) v2
- Eclipse Public License (EPL) v1.0
- And many others

---

## Related Projects and Links

SITMUN is an open-source platform for territorial information management, designed to help organizations manage geographical data, services, and applications effectively.

**Related Projects:**

- [SITMUN Backend Core](https://github.com/sitmun/sitmun-backend-core) - REST API and business logic
- [SITMUN Proxy Middleware](https://github.com/sitmun/sitmun-proxy-middleware) - Proxy and security middleware
- [SITMUN Admin App](https://github.com/sitmun/sitmun-admin-app) - Administrative interface
- [SITMUN Viewer App](https://github.com/sitmun/sitmun-viewer-app) - Map visualization frontend

**Technology Stack:**

- Frontend: Angular 19, TypeScript, Angular Material, SITNA Library
- Backend: Spring Boot 3, Java 17, PostgreSQL/Oracle/H2
- Infrastructure: Docker, Docker Compose, Git Submodules
- Quality: SonarCloud, GitHub Actions, Conventional Commits

For more information, visit the [SITMUN organization](https://github.com/sitmun) on GitHub.
