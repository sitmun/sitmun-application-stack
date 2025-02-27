# SITMUN Application Stack

The **SITMUN Application Stack** is an example of how to deploy SITMUN as a multi-container application, designed to work in development and testing environments.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- A `Windows/Mac/Linux` machine.
- Installed the latest version of `Docker`. Installation scenarios:
  - Scenario one: Install [Docker Engine](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/).
  - Scenario two: Install [Docker Desktop](https://docs.docker.com/desktop/) (one-click-install commercial product), which includes `Docker Engine` and `Docker Compose.
- Installed Git.  See [Installing Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).
- Internet access to pull Docker images and Git repositories.

## Installing SITMUN Application Stack

To install the SITMUN Application Stack, follow these steps:

1. Clone the repository and fetch and checkout nested SITMUN projects:

    ```bash
    git clone --branch dev --recurse-submodules https://github.com/sitmun/sitmun-application-stack.git
    ```

2. Change to the directory of the repository:

    ```bash
    cd sitmun-application-stack
    ```

3. Setup the environment using the appropriate script for your system:

   For Unix-based systems (Linux/macOS):

   ```bash
   ./setup.sh
   ```

   For Windows systems:

   ```powershell
   ./setup.ps1
   ```

   If the script fails, you must create an `.env` file with the following content:

    ```env
    PUBLIC_PORT=9000
    PUBLIC_NON_STANDARD_PORT=1
    COMPOSE_PROFILES=postgres    
    ```

4. Start the SITMUN Application Stack:

    ```bash
    docker compose up -d
    ```

   This command will build and start all the services defined in the `docker-compose.yml` file.

5. Access the SITMUN viewer application at [http://localhost:9000/viewer](http://localhost:9000/viewer).
   Use the public access which does not require authentication.

6. Access the SITMUN administrative application at [http://localhost:9000/admin](http://localhost:9000/admin).
   This requires authentication. The default username is `admin` and the default password is `admin`.

7. If the source code of the SITMUN stack is changed, fetch changes and rebuild the services:

    ```bash
    git pull --recurse-submodules
    docker-compose build --no-cache
    docker compose up -d
    ```

## Available services

If the `BASE_URL` is `http://localhost:9000/`, the following services are available:

| Application                | URL                                                                                            |
|----------------------------|------------------------------------------------------------------------------------------------|
| Viewer application         | `${BASE_URL}viewer` (e.g. <http://localhost:9000/viewer>)                                      |
| Administrative application | `${BASE_URL}admin` (e.g. <http://localhost:9000/admin>)                                        |
| Backend API                | `${BASE_URL}backend` (e.g. <http://localhost:9000/backend>) and <http://localhost:9001/>       |
| Proxy Middleware API       | `${BASE_URL}middleware` (e.g. <http://localhost:9000/middleware>) and <http://localhost:9002/> |

## Configuration Notes

The SITMUN Application Stack uses Docker Compose to define the services, specified in the `docker-compose.yml` file.

Data is stored in the `pgdata` volume, which is used by the `postgres` service.

Environment variables are defined in the `.env` file. The following variables can be modified.

| Variable                       | Description                                                 | Default value                         |
|--------------------------------|-------------------------------------------------------------|---------------------------------------|
| `SITMUN_PUBLIC_PROTOCOL`       | The protocol used.                                          | `http`                                |
| `SITMUN_PUBLIC_HOST`           | The hostname or IP address where the application is hosted. | `localhost`                           |
| `SITMUN_PUBLIC_PORT`           | The port where the services are exposed with `:`.           | `:9000`                               |
| `SITMUN_PUBLIC_FORWARDED_PORT` | The port where the services are exposed without `:`.        | `9000`                                |
| `SITMUN_PUBLIC_CONTEXT_PATH`   | The context path of the application.                        | `/`                                   |
| `SITMUN_LOCAL_PORT`            | The local port where the services are exposed.              | `9000`                                |
| `COMPOSE_PROFILES`             | The active profiles (postgres or oracle)                    | `postgres`                            |
| `DATABASE`                     | The name of the database.                                   | `sitmun3`                             |
| `DATABASE_URL`                 | The JDBC URL of the database.                               | `jdbc:postgresql://postgres:5432/` |
| `DATABASE_USERNAME`            | The username to access the database.                        | `sitmun3`                             |
| `DATABASE_PASSWORD`            | The password to access the database.                        | `sitmun3`                             |
| `FORCE_USE_OF_PROXY`           | Forces the use of the proxy middleware.                     | `false`                               |

Notes:

- The full **Base URL** is computed by concatenating these variables `SITMUN_PUBLIC_PROTOCOL`, `SITMUN_PUBLIC_HOST`, `SITMUN_PUBLIC_PORT` and `SITMUN_PUBLIC_CONTEXT_PATH`: `${SITMUN_PUBLIC_PROTOCOL}://${SITMUN_PUBLIC_HOST}${SITMUN_PUBLIC_PORT}${SITMUN_PUBLIC_CONTEXT_PATH}`
- When the public address of the service uses standards ports (80 for http and 443 for https), `SITMUN_PUBLIC_PORT` is empty.
- The effective **JDBC URL** is composed by the concatenation of `DATABASE_URL` and `DATABASE`: `${DATABASE_URL}${DATABASE}`.
- The default value of `DATABASE_URL` points to `postgres`, which is one of the services defined in the `docker-compose.yml` file. It is a PostgreSQL database.
- `FORCE_USE_OF_PROXY` is disabled by default.

## Running modes

### Postgres 17 Container

The **PostgreSQL** database is used as the default database. This is the default configuration in the `.env` file. PostgreSQL is an object-relational database system known for its reliability and data integrity.

The image used is [postgres:17-alpine](https://hub.docker.com/_/postgres), which is a **Docker Official Image**.

To use this configuration, set the `COMPOSE_PROFILES` variable to `postgres` and ensure the `DATABASE_URL` variable is uncommented in the `.env` file.

### Oracle Database 23ai Free Container

**Oracle Database 23c Free** allows you to experience Oracle Database, which is relied upon by businesses worldwide for their mission-critical workloads. The resource limits for Oracle Database Free are up to 2 CPUs for foreground processes, 2 GB of RAM, and 12 GB of user data on disk.


The image used is [gvenzl/oracle-free:23-slim](https://hub.docker.com/r/gvenzl/oracle-free), which is the version used by [Spring Data](https://github.com/spring-projects/spring-data-relational/commit/3cac9d145618a073736393b62961c94dae77117f).

To use this configuration, set the `COMPOSE_PROFILES` variable to `oracle` and ensure the `DATABASE_URL` variable is set to `jdbc:oracle:thin:@//oracle:1521/` in the `.env` file.

### External Database

To use an external database, modify the `DATABASE`, `DATABASE_URL`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD` variables in the `.env` file.

The `COMPOSE_PROFILES` variable must be commented out.

## Developing SITMUN

SITMUN Application Stack uses Git submodules to include the source code of the SITMUN viewer and administrative applications, the SITMUN Backend and the SITMUN Proxy middleware.

| Submodule                 | GitHub repository                                                                   | Docker service |
|---------------------------|-------------------------------------------------------------------------------------|----------------|
| `sitmun-admin-app`        | [SITMUN Administration application](https://github.com/sitmun/sitmun-admin-app.git) | `front`        |
| `sitmun-viewer-app`       | [SITMUN Viewer application](https://github.com/sitmun/sitmun-viewer-app.git)        | `front`        |
| `sitmun-backend-core`     | [SITMUN Backend](https://github.com/sitmun/sitmun-backend-core.git)                 | `backend`      |
| `sitmun-proxy-middleware` | [SITMUN Proxy middleware](https://github.com/sitmun/sitmun-proxy-middleware.git)    | `proxy`        |

### Instructions for Updating a Submodule and Docker Service

1. **Update the repository and submodules**
   Ensure the repository and its submodules are up-to-date before rebuilding the Docker service:

    ```bash
   git fetch origin dev
   git checkout dev
   git submodule update --recursive --remote
   ```

2. **Change the branch of a submodule (if needed)**
   To switch a submodule (e.g. `submodule_name`) to a specific branch (e.g. to `branch_name`), use the following commands:

    ```bash
    git submodule set-branch -b branch_name submodule_name
    git submodule sync
    git submodule update --init
    ```

    The `git submodule update` command ensures the submodule is cloned if missing, fetches any missing commits, and updates the working tree to the specified branch.

3. **Rebuild and restart the affected Docker service**
    Replace `service_name` with the name of the service you want to update:

    ```bash
    docker compose build --no-cache service_name
    docker compose up service_name -d
    ```

## Contributing to SITMUN Application Stack

To contribute to SITMUN Application Stack, follow these steps:

1. **Fork this repository** on GitHub.
2. **Clone your forked repository** to your local machine.
3. **Create a new branch** for your changes.
4. **Make your changes** and commit them.
5. **Push your changes** to your forked repository.
6. **Create the pull request** from your branch on GitHub.

Alternatively, see the GitHub documentation on [creating a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request).

## License

This project uses the following license: [European Union Public Licence V. 1.2](LICENSE).
