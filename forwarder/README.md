# FIWARE NGSI-LD Step-by-Step Tutorials Context Provider

[![Documentation](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/documentation.svg)](https://fiware-tutorials.rtfd.io)
[![Docker](https://img.shields.io/docker/pulls/fiware/tutorials.ngsi-ld.svg)](https://hub.docker.com/r/fiware/tutorials.ngsi-ld/)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_cim009v010801p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

Simple nodejs express application for use with the FIWARE Step-by-Step tutorials. This component can be used to proxy and amend requests.

This application provides various sources of context and demonstrates various aspects of FIWARE To run the application
in debug mode add `DEBUG=broker:*`

## Target Context Broker

- `CONTEXT_BROKER` - location of the Context Broker

## Additional Request Headers

- `TENANT` - sets an NGSI-LD Tenant header
- `WALLET_TYPE` - Sets a Wallet Type for Canis Major
- `WALLET_TOKEN` - Sets a Wallet Token for Canis Major
- `WALLET_ADDRESS` - Sets a Wallet Address for Canis Major

## Verifiable Credentials Verifier

- `VERIFY_CREDENTIALS` - set to `true` to enable verification
- `CONFIG_SERVICE` - location of the Credentials Config Service
- `WEB_APP_HOST` - location of the Tutorial App to display on screen
- `WEB_APP_PORT` - port of the Tutorial App

## How to build your own image

The [Dockerfile](https://github.com/fiware/tutorials.NGSI-LD/blob/master/docker/Dockerfile) associated with this image
can be used to build an image in several ways:

-   By default, the `Dockerfile` retrieves the **latest** version of the codebase direct from GitHub (the `build-arg` is
    optional):

```console
docker build -t fiware/tutorials.Forwarder . --build-arg DOWNLOAD=latest
```

-   You can alter this to obtain the last **stable** release run this `Dockerfile` with the build argument
    `DOWNLOAD=stable`

```console
docker build -t fiware/tutorials.NGSI-LD . --build-arg DOWNLOAD=stable
```

-   You can also download a specific release by running this `Dockerfile` with the build argument `DOWNLOAD=<version>`

```console
docker build -t fiware/tutorials.NGSI-LD . --build-arg DOWNLOAD=1.7.0
```

-   To download code from your own fork of the GitHub repository add the `GITHUB_ACCOUNT` and `GITHUB_REPOSITORY`
    arguments to the `docker build` command.

```console
docker build -t fiware/tutorials.NGSI-LD . --build-arg GITHUB_ACCOUNT=<your account> --build-arg GITHUB_REPOSITORY=<your repo>
```

Alternatively, if you want to build directly from your own sources, please copy the existing `Dockerfile` into file the
root of the repository and amend it to copy over your local source using :

```Dockerfile
COPY app /usr/src/app
```

Full instructions can be found within the `Dockerfile` itself.
