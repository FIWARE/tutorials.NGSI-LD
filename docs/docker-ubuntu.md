# Installing the Docker Engine on Ubuntu

Further details can be found under: `https://docs.docker.com/engine/install/ubuntu/#set-up-the-repository`

## Install using the repository

Before you install Docker Engine for the first time on a new host machine, you need to set up the Docker repository.
Afterward, you can install and update Docker from the repository.

-   Set up the repository: Update the apt package index and install packages to allow apt to use a repository over
    HTTPS:

```bash
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg lsb-release
```

-   Add Docker’s official GPG key:

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

-   Use the following command to set up the repository:

```bash
echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
$(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

-   Install Docker Engine Update the apt package index:

```bash
sudo apt-get update
```

-   Install latest Docker Engine, containerd, and Docker Compose:

```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**Docker Compose** is a tool for defining and running multi-container Docker applications. A series of `*.yaml` files
are used configure the required services for the application. This means all container services can be brought up in a
single command.

You can check your current **Docker** and **Docker Compose** versions using the following commands:

```bash
docker version
docker compose version
```

> **Important** In recent versions, `docker-compose` is already included as part of of the main `docker` client, Please
> ensure that you are using Docker version 24.0.4 or higher and Docker Compose 2.29.1 or higher and upgrade if
> necessary. If you are unable to upgrade and stuck using an older version you can still run the tutorials by adding a
> `legacy` parameter at the end the `./services` script commands e.g. `services start legacy`

If using a Linux distro with an outdated `docker-compose`, the files can be installed directly as shown:

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/1.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

If you are using docker-compose in Ubuntu with VMWare and faced the following error: _ERROR: Couldn't connect to Docker
daemon at http+docker://localunixsocket - is it running?_

It can be solved by owning the `/var/run/docker.sock` Unix socket as shown:

```bash
sudo chown $USER /var/run/docker.sock
```
