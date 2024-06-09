# SITMUN Application Stack

The **SITMUN Application Stack** is an example of how to deploy SITMUN as a multi-container application. SITMUN Application Stack is designed to work in development and testing environments. 

## Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed the latest version of [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/).
- You have a `Windows/Linux/Mac` machine.

**Docker Compose** is a tool for defining and running multi-container applications. Compose simplifies the control of SITMUN application stack, making it easy to manage SITMUN services, networks, and volumes in a single, comprehensible YAML configuration file. Then, with a single command, you can create and start all the SITMUN services from your configuration file.

## Installing SITMUN Application Stack

To install SITMUN Application Stack, follow these steps:

1. Clone the repository:

    ```bash
    git clone https://github.com/sitmun/sitmun-application-stack.git
    ```

2. Change to the directory of the repository:

    ```bash
    cd sitmun-application-stack
    ```

3. Start the SITMUN Application Stack:

    ```bash
    docker-compose up
    ```
    
4. Access the SITMUN viewer application at [http://localhost:9000/viewer](http://localhost:9000/viewer)

5. Access the SITMUN administrative application at [http://localhost:9000/admin](http://localhost:9000/admin)

## Configuration

### Environment Variables

he SITMUN Application Stack uses environment variables to configure the services. The environment variables are defined in the `.env` file.

The following environment variables are available:

- `GITUB_TOKEN`: [GitHub personal access token (classic)](https://docs.github.com/en/packages/learn-github-packages/introduction-to-github-packages#authenticating-to-github-packages). The token is required to get `npm` packages from [GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/introduction-to-github-packages#about-github-packages).

### Docker Compose Configuration

The SITMUN Application Stack uses Docker Compose to define the services. The services are defined in the `docker-compose.yml` file.

The following services are available:

- `viewer`: SITMUN viewer application
- `admin`: SITMUN administrative application
- `backend`: SITMUN API
- `proxy`: SITMUN proxy

For testing purposes, the use of the `proxy` is controlled by the `sitmun.proxy.force` environment variable in `backend` which by default is false.

## Contributing to SITMUN Application Stack

To contribute to SITMUN Application Stack, follow these steps:

1. Fork this repository.
2. Create a branch: `git checkout -b <branch_name>`.
3. Make your changes and commit them: `git commit -m '<commit_message>'`
4. Push to the original branch: `git push origin <project_name>/<location>`
5. Create the pull request.

Alternatively see the GitHub documentation on [creating a pull request](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request).

## License

This project uses the following license: [European Union Public Licence V. 1.2](LICENSE).

