# SITMUN Application Stack

The **SITMUN Application Stack** is an example of how to deploy SITMUN as a multi-container application, designed to work in development and testing environments.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- A `Windows/Linux/Mac` machine.
- Installed the latest version of [Docker CE](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/), or [Docker Desktop](https://www.docker.com/products/docker-desktop/).
  Docker CE is fully open-source, while Docker Desktop is a commercial product.
- Installed [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) on your machine.
- Basic understanding of Docker, Docker Compose, and Git.
- Internet access to pull Docker images and Git repositories.

## Installing SITMUN Application Stack

To install the SITMUN Application Stack, follow these steps:

1. Clone the repository and fetch and checkout nested SITMUN projects:
    ```bash
    git clone --recurse-submodules https://github.com/sitmun/sitmun-application-stack.git
    ```

2. Change to the directory of the repository:
    ```bash
    cd sitmun-application-stack
    ```

3. Start the SITMUN Application Stack:
    ```bash
    docker compose up -d
    ```
   This command will build and start all the services defined in the `docker-compose.yml` file.

4. Access the SITMUN viewer application at [http://localhost:9000/viewer](http://localhost:9000/viewer). 
   Use the public access which does not require authentication.

5. Access the SITMUN administrative application at [http://localhost:9000/admin](http://localhost:9000/admin).
   This requires authentication. The default username is `admin` and the default password is `admin`.

6. If the source code of the SITMUN stack is changed, fetch changes and rebuild the services:
    ```bash
    git pull --recurse-submodules
    docker-compose build --no-cache
    docker compose up -d
    ```

## Docker Compose Configuration

The SITMUN Application Stack uses Docker Compose to define the services, specified in the `docker-compose.yml` file.

### Available services

- `front`: SITMUN front-end services
  - `viewer`: SITMUN viewer application at <http://localhost:9000/viewer>
  - `admin`: SITMUN administrative application at <http://localhost:9000/admin>
  - Also, it acts as reverse proxy for `backend` and `proxy` services at <http://localhost:9000/backend/> and <http://localhost:9000/middleware/> endpoints respectively. 
- `backend`: SITMUN API at [http://localhost:9001/](http://localhost:9001/)
- `proxy`: SITMUN proxy at [http://localhost:9002/](http://localhost:9002/)

### Configuration Notes

For testing purposes, the use of the `proxy` is controlled by the `SITMUN_PROXY_FORCE` environment variable in `backend`, which by default is `true`.

Data is stored in the `pgdata` volume, which is used by the `postgres` service.

## Working with submodules

SITMUN Application Stack uses Git submodules to include the source code of the SITMUN viewer and administrative applications, the SITMUN Backend and the SITMUN Proxy middleware.

| Submodule                 | GitHub repository                                                                   | Docker service |
|---------------------------|-------------------------------------------------------------------------------------|----------------|
| `sitmun-admin-app`        | [SITMUN Administration application](https://github.com/sitmun/sitmun-admin-app.git) | `front`        |
| `sitmun-viewer-app`       | [SITMUN Viewer application](https://github.com/sitmun/sitmun-viewer-app.git)        | `front`        |
| `sitmun-backend-core`     | [SITMUN Backend](https://github.com/sitmun/sitmun-backend-core.git)                 | `backend`      |
| `sitmun-proxy-middleware` | [SITMUN Proxy middleware](https://github.com/sitmun/sitmun-proxy-middleware.git)    | `proxy`        |

### Changing Submodule Branches

To change the branch of a submodule, use the following command:

```bash
git submodule set-branch -b branch_name submodule_name
git submodule sync
git submodule update --init submodule_name
```

The update command updates the registered submodule to match the expected configuration by cloning it if missing, fetching missing commits and updating the working tree to the specified branch.

Next, rebuild and restarts the affected docker service:

```bash
docker compose build --no-cache service_name
docker compose up service_name -d
```

## Uninstalling SITMUN Application Stack

To stop and remove all services, volumes, and networks defined in the `docker-compose.yml` file, use:
```bash
docker compose down -v
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
