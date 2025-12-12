# SITMUN Application Stack

[![Build Status](https://github.com/sitmun/sitmun-admin-app/workflows/CI/badge.svg)](https://github.com/sitmun/sitmun-admin-app/workflows/CI)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=org.sitmun%3Asitmun-backend-core&metric=alert_status)](https://sonarcloud.io/dashboard?id=org.sitmun%3Asitmun-backend-core)
[![License: EUPL v1.2](https://img.shields.io/badge/License-EUPL%20v1.2-blue.svg)](LICENSE)

The **SITMUN Application Stack** is a comprehensive multi-container geospatial platform that provides a complete solution for territorial information management, geographical services, and spatial applications. This stack integrates all SITMUN components into a unified, containerized environment designed for development, testing, and production deployment.

## Table of Contents

- [About SITMUN](#about-sitmun)
- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
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

SITMUN (Sistema de Información Territorial de la Mancomunidad de Municipios) is a comprehensive geospatial information management system designed for organizations that need to manage territorial information, geographical services, and spatial applications. The Application Stack provides:

- **🗺️ Interactive Map Visualization**: High-performance web mapping with multiple base layers and SITNA integration
- **👥 User and Role Management**: Complete user lifecycle, roles, and permission management
- **🌍 Territory Administration**: Multi-level territorial organization and access control
- **🔌 Service Integration**: WMS, WFS, WMTS, JDBC, and custom service connections
- **📊 Layer Management**: Cartographic layers and background configuration
- **⚙️ Task Configuration**: Workflow setup for spatial operations
- **🔐 Security Layer**: JWT-based authentication with role-based access control
- **📱 Responsive Design**: Mobile-first approach for any device
- **🌐 Multi-language Support**: Internationalization for CA, ES, EN, FR, OC

## Architecture Overview

The SITMUN Application Stack consists of four main components:

```
┌─────────────────────────────────────────────────────────────┐
│                    SITMUN Application Stack                 │
├─────────────────────────────────────────────────────────────┤
│  Frontend Layer                                             │
│  ├── SITMUN Viewer App (Angular 16)                         │
│  └── SITMUN Admin App (Angular 16)                          │
├─────────────────────────────────────────────────────────────┤
│  Backend Layer                                              │
│  ├── SITMUN Backend Core (Spring Boot 3)                    │
│  └── SITMUN Proxy Middleware (Spring Boot 3)                │
├─────────────────────────────────────────────────────────────┤
│  Database Layer                                             │
│  ├── PostgreSQL 17 / Oracle 23c / H2                        │
│  └── Liquibase Migration                                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

| Component | Technology | Purpose | Port |
|-----------|------------|---------|------|
| **SITMUN Viewer App** | Angular 16, TypeScript | Interactive map visualization and user interface | 4200 |
| **SITMUN Admin App** | Angular 16, TypeScript | Administrative interface and configuration | 4200 |
| **SITMUN Backend Core** | Spring Boot 3, Java 17 | Core REST API and business logic | 8080 |
| **SITMUN Proxy Middleware** | Spring Boot 3, Java 17 | Secure proxy and middleware services | 8081 |
| **Database** | PostgreSQL/Oracle/H2 | Data persistence and geospatial storage | 5432/1521 |

## Technology Stack

### Frontend Technologies
- **Angular 16**: Modern web framework with TypeScript
- **Angular Material**: UI component library for consistent design
- **SITNA Library v3.0.1**: Advanced mapping capabilities
- **RxJS**: Reactive programming for asynchronous operations
- **Node.js 16+**: JavaScript runtime environment

### Backend Technologies
- **Spring Boot 3.5.4**: Java-based microservices framework
- **Spring Security**: Authentication and authorization
- **Spring Data JPA**: Data persistence layer
- **Spring Data REST**: REST API generation
- **Java 17**: Modern Java features and performance
- **Gradle**: Build system and dependency management

### Database Technologies
- **PostgreSQL 17**: Primary relational database
- **Oracle 23c**: Enterprise database support
- **H2**: In-memory database for development
- **Liquibase**: Database migration and versioning

### Infrastructure Technologies
- **Docker**: Containerization platform
- **Docker Compose**: Multi-container orchestration
- **Git Submodules**: Version control for component management
- **SonarCloud**: Code quality and security analysis

## Key Features

### Core Platform Features

- 🔐 **Secure Authentication**: JWT-based authentication with role-based access control
- 👥 **User Management**: Complete user lifecycle, roles, and permissions
- 🗺️ **Application Management**: Geospatial application configuration and deployment
- 🌍 **Territory Administration**: Territorial boundaries and geographic area management
- 🔌 **Service Integration**: WMS, WFS, WMTS, JDBC, and custom service connections
- 📊 **Layer Management**: Cartographic layers and background configuration
- ⚙️ **Task Configuration**: Workflow setup for spatial operations

### Mapping and Visualization Features

- 🗺️ **Interactive Mapping**: High-performance web mapping using SITNA library
- 🔍 **Search & Query**: Geographic search, feature queries, and WFS data access
- 📊 **Layer Visualization**: Dynamic layer management with styling and transparency
- 📏 **Measurement Tools**: Distance, area, and drawing/markup capabilities
- 🖨️ **Map Export**: Print and download functionality for maps and data
- 📱 **Street View Integration**: Google Street View integration for enhanced visualization

### Technical Features

- 📱 **Responsive Design**: Mobile-first approach with Angular Material
- 🌐 **Internationalization**: Support for multiple languages (CA, ES, EN, FR, OC)
- 🎨 **Modern UI/UX**: Clean, intuitive interface following Material Design
- 🚀 **Performance Optimized**: Lazy loading, efficient data grids, and optimized builds
- 🔧 **Developer Tools**: Comprehensive development and debugging tools
- 📈 **Monitoring**: Integration with SonarCloud for code quality and coverage
- 🔐 **ServiceWorker**: Authentication token management for API requests

## Quick Start

### Prerequisites

Before you begin, ensure you have met the following requirements:

- **Operating System**: Windows, macOS, or Linux
- **Docker**: Latest version of Docker Engine or Docker Desktop
  - [Docker Engine](https://docs.docker.com/engine/install/) + [Docker Compose](https://docs.docker.com/compose/install/)
  - Or [Docker Desktop](https://docs.docker.com/desktop/) (includes both)
- **Git**: Version control system ([Installation Guide](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git))
- **Internet Access**: Required for pulling Docker images and Git repositories
- **Minimum 16GB RAM**: Recommended for development environment

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
   ```bash
   # Copy and configure environment file
   cp .env.example .env
   
   # Edit environment variables for production
   nano .env
   ```

2. **Database Setup**
   ```bash
   # For PostgreSQL
   COMPOSE_PROFILES=postgres docker compose up -d
   
   # For Oracle
   COMPOSE_PROFILES=oracle docker compose up -d
   ```

3. **SSL Configuration**
   ```bash
   # Configure SSL certificates
   SITMUN_PUBLIC_PROTOCOL=https
   SITMUN_PUBLIC_PORT=:443
   ```

## Configuration

### Environment Variables

The SITMUN Application Stack uses environment variables for configuration. Create a `.env` file with the following variables:

| Variable | Description | Default Value |
|----------|-------------|---------------|
| `SITMUN_PUBLIC_PROTOCOL` | Protocol (http/https) | `http` |
| `SITMUN_PUBLIC_HOST` | Public hostname | `localhost` |
| `SITMUN_PUBLIC_PORT` | Public port with colon | `:9000` |
| `SITMUN_PUBLIC_FORWARDED_PORT` | Public port without colon | `9000` |
| `SITMUN_PUBLIC_CONTEXT_PATH` | Application context path | `/` |
| `SITMUN_LOCAL_PORT` | Local port | `9000` |
| `COMPOSE_PROFILES` | Active profiles (postgres/oracle) | `postgres` |
| `DATABASE` | Database name | `sitmun3` |
| `DATABASE_URL` | JDBC URL | `jdbc:postgresql://postgres:5432/` |
| `DATABASE_USERNAME` | Database username | `sitmun3` |
| `DATABASE_PASSWORD` | Database password | `sitmun3` |
| `FORCE_USE_OF_PROXY` | Force proxy middleware | `false` |

### Database Configuration

#### PostgreSQL 17 (Default)
```env
COMPOSE_PROFILES=postgres
DATABASE_URL=jdbc:postgresql://postgres:5432/
DATABASE=sitmun3
DATABASE_USERNAME=sitmun3
DATABASE_PASSWORD=sitmun3
```

#### Oracle Database 23c
```env
COMPOSE_PROFILES=oracle
DATABASE_URL=jdbc:oracle:thin:@//oracle:1521/
DATABASE=sitmun3
DATABASE_USERNAME=sitmun3
DATABASE_PASSWORD=sitmun3
```

#### External Database
```env
# Comment out COMPOSE_PROFILES
# COMPOSE_PROFILES=postgres

# Configure external database
DATABASE_URL=jdbc:postgresql://your-db-host:5432/
DATABASE=your_database
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
```

### Application Configuration

#### Frontend Configuration
```typescript
// Environment configuration for Angular apps
export const environment = {
  production: boolean,
  apiBaseURL: string,
  logLevel: LogLevel,
  hashLocationStrategy: boolean
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

| Application | URL | Description | Authentication |
|-------------|-----|-------------|----------------|
| **Viewer Application** | `${BASE_URL}viewer` | Interactive map viewer | Optional |
| **Admin Application** | `${BASE_URL}admin` | Administrative interface | Required |
| **Backend API** | `${BASE_URL}backend` | Core REST API | JWT Token |
| **Proxy Middleware** | `${BASE_URL}middleware` | Proxy services | JWT Token |

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

```
Viewer App ──┐
             ├── Backend Core ── Database
Admin App ───┘
             └── Proxy Middleware ── External Services
```

## Development

### Project Structure

The SITMUN Application Stack uses Git submodules to include the source code of all SITMUN components:

| Submodule | GitHub Repository | Docker Service | Technology Stack |
|-----------|-------------------|----------------|------------------|
| `front/admin/sitmun-admin-app` | [SITMUN Admin App](https://github.com/sitmun/sitmun-admin-app.git) | `front` | Angular 16, TypeScript |
| `front/viewer/sitmun-viewer-app` | [SITMUN Viewer App](https://github.com/sitmun/sitmun-viewer-app.git) | `front` | Angular 16, TypeScript |
| `back/backend/sitmun-backend-core` | [SITMUN Backend Core](https://github.com/sitmun/sitmun-backend-core.git) | `backend` | Spring Boot 3, Java 17 |
| `back/proxy/sitmun-proxy-middleware` | [SITMUN Proxy Middleware](https://github.com/sitmun/sitmun-proxy-middleware.git) | `proxy` | Spring Boot 3, Java 17 |

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

### Backend Core API

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

### Proxy Middleware API

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
- **Role-Based Access Control**: Fine-grained permissions based on user roles and territories
- **Application Privacy**: Applications can be marked as private to restrict public access
- **Public User Support**: Anonymous access with appropriate restrictions
- **LDAP Integration**: Enterprise authentication support

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

#### JWT Configuration
```yaml
sitmun:
  user:
    secret: ${SITMUN_USER_SECRET:auto-generated}
    token-validity-in-milliseconds: 36000000
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
```bash
# Check database connectivity
docker exec sitmun-backend ping postgres
docker exec sitmun-backend ping oracle

# Verify database configuration
curl http://localhost:9001/api/dashboard/health
```

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
docker exec sitmun-postgres psql -U sitmun3 -d sitmun3 -c "SELECT * FROM pg_stat_activity;"

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

## About SITMUN

SITMUN is an open-source platform for territorial information management, designed to help organizations manage geographical data, services, and applications effectively.

**Related Projects:**
- [SITMUN Backend Core](https://github.com/sitmun/sitmun-backend-core) - REST API and business logic
- [SITMUN Proxy Middleware](https://github.com/sitmun/sitmun-proxy-middleware) - Proxy and security middleware
- [SITMUN Admin App](https://github.com/sitmun/sitmun-admin-app) - Administrative interface
- [SITMUN Viewer App](https://github.com/sitmun/sitmun-viewer-app) - Map visualization frontend

**Technology Stack:**
- Frontend: Angular 16, TypeScript, Angular Material, SITNA Library
- Backend: Spring Boot 3, Java 17, PostgreSQL/Oracle/H2
- Infrastructure: Docker, Docker Compose, Git Submodules
- Quality: SonarCloud, GitHub Actions, Conventional Commits

For more information, visit the [SITMUN organization](https://github.com/sitmun) on GitHub.
