# FIWARE NGSI-LD Step-by-Step Tutorials Context Provider

[![Documentation](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/documentation.svg)](https://fiware-tutorials.rtfd.io)
[![Docker](https://img.shields.io/docker/pulls/fiware/tutorials.ngsi-ld.svg)](https://hub.docker.com/r/fiware/tutorials.ngsi-ld/)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://cim.etsi.org/NGSI-LD/official/front-page.html)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

Simple nodejs express application for use with the FIWARE Step-by-Step tutorials. This is a **Context Provider** that can
be used to proxy and amend requests to a Context Broker.

This application provides various sources of context and demonstrates various aspects of FIWARE. Its main features include:

*   **Proxying**: Forwards requests to a target Context Broker.
*   **Header Injection**: Can automatically inject headers such as `NGSILD-Tenant` and Wallet information
    (`Wallet-type`, `Wallet-Token`, `Wallet-address`) into proxied requests.
*   **Verification**: Optionally verifies tokens using Verifiable Credentials, integrating with a Credentials Config
    Service and Trusted Issuer Registry.
*   **Event Emission**: Emits events to a companion Tutorial Web App.

To run the application in debug mode add `DEBUG=broker:*`.

## Environment Variables

### Core Configuration

-   `PORT` - Port the application listens on. Default: `80`.
-   `DEBUG` - Debug level. Set to `broker:*` for full output.

### Proxy Target

-   `CONTEXT_BROKER` - URL of the target Context Broker. Default: `http://orion:1026`.

### Header Injection

These variables configure headers to be added to proxied requests:

-   `TENANT` - Sets the `NGSILD-Tenant` header.
-   `WALLET_TYPE` - Sets the `Wallet-type` header (for Canis Major).
-   `WALLET_TOKEN` - Sets the `Wallet-Token` header (for Canis Major).
-   `WALLET_ADDRESS` - Sets the `Wallet-address` header (for Canis Major).
-   `ACCEPT_ENCODING` - Sets the `accept-encoding` header.

### Verifiable Credentials Verification

-   `VERIFY_CREDENTIALS` - Set to `true` to enable credential verification. Default: `false`.
-   `CONFIG_SERVICE` - Host and port of the Credentials Config Service. Default: `localhost:8081`.
-   `TRUSTED_ISSUER_LIST` - URL of the Trusted Issuer List. If set, this overrides the list obtained from the Config
    Service.

### Event Emission

-   `WEB_APP_HOST` - Hostname of the Tutorial Web App to emit events to. Default: `localhost`.
-   `WEB_APP_PORT` - Port of the Tutorial Web App. Default: `3000`.

### Healthcheck

-   `HEALTHCHECK_PATH` - Path for the healthcheck endpoint. Default: `/health`.
-   `HEALTHCHECK_CODE` - HTTP Code expected for a healthy response. Default: `200`.

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

---

## License

[MIT](LICENSE) © 2020-2026 FIWARE Foundation e.V.
