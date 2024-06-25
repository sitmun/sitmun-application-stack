# SITMUN Application Stack

The **SITMUN Application Stack** is an example of how to deploy SITMUN as a multi-container application.
It is designed to work in development and testing environments.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- You have a `Windows/Linux/Mac` machine.
- You have installed the latest version of [Docker CE](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/), or [Docker Desktop](https://www.docker.com/products/docker-desktop/).
  Docker CE is fully open-source, while Docker Desktop is a commercial product.
- You have installed [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) on your machine.
- You have a GitHub account to [create a personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).
- You have a basic understanding of Docker, Docker Compose, and Git.
- You have internet access on your machine to pull Docker images and Git repositories.

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

3. Create a new file named `.env` inside the directory.
   Open the `.env` file in a text editor and add your GitHub personal access token (`GITHUB_TOKEN`) in the following format:
    ```properties
    GITHUB_TOKEN=your_personal_access_token
    ```

4. Start the SITMUN Application Stack:
    ```bash
    docker compose up
    ```
   This command will build and start all the services defined in the `docker-compose.yml` file.

5. Access the SITMUN viewer application at [http://localhost:9000/viewer](http://localhost:9000/viewer). 
   Use the public access which does not require authentication.

6. Access the SITMUN administrative application at [http://localhost:9000/admin](http://localhost:9000/admin).
   This requires authentication. The default username is `admin` and the default password is `admin`.

7. If the source code of the SITMUN stack is changed, fetch changes and rebuild the services:
    ```bash
    git pull --recurse-submodules
    docker compose up --build
    ```

## Configuration

### Environment Variables

The SITMUN Application Stack uses environment variables to configure the services.
The environment variables are defined in the `.env` file.

The following environment variables are available:

- `GITHUB_TOKEN`: [GitHub personal access token (classic)](https://docs.github.com/en/packages/learn-github-packages/introduction-to-github-packages#authenticating-to-github-packages).
  The token is required to get `npm` packages from [GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/introduction-to-github-packages#about-github-packages).

### Docker Compose Configuration

The SITMUN Application Stack uses Docker Compose to define the services.
The services are defined in the `docker-compose.yml` file.

The following services are available:

- `viewer`: SITMUN viewer application
- `admin`: SITMUN administrative application
- `backend`: SITMUN API
- `proxy`: SITMUN proxy

For testing purposes, the use of the `proxy` is controlled by the `sitmun.proxy.force` environment variable in `backend`, which by default is `true`.

Data is stored in the `pgdata` volume, which is used by the `postgres` service.

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
