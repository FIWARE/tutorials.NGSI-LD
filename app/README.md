# FIWARE NGSI-LD Step-by-Step Tutorials Web App

[![Documentation](https://fiware.github.io/catalogue/badges/chapters/documentation.svg)](https://fiware-tutorials.rtfd.io)
[![Docker](https://img.shields.io/docker/pulls/fiware/tutorials.ngsi-ld.svg)](https://hub.docker.com/r/fiware/tutorials.ngsi-ld/)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://cim.etsi.org/NGSI-LD/official/front-page.html)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

This is a Node.js Express application that serves as the main web interface for the FIWARE NGSI-LD Step-by-Step
tutorials. It acts as a multi-purpose component, functioning as a Context Provider, a User Interface, and a secure proxy
to other FIWARE components.

## Features

*   **Context Provider**: Exposes multiple NGSI-LD endpoints to provide context data (static, random, or proxied from external APIs like Twitter and OpenWeatherMap).
*   **Web Interface**: Renders web pages using Pug templates to visualize data and interact with the system.
*   **Data Persistence**: Connects to MongoDB for storing session data and application state.
*   **History Visualization**: Fetches and aggregates historical data for visualization.
*   **NGSI-LD Proxy**: Interactions with a Context Broker (e.g., Orion-LD, Scorpio Stellio).
*   **Device Control**: Provides an interface to send commands to dummy IoT devices via the Context Broker.

## Endpoints

### NGSI-LD Context Provider Endpoints

The application provides context data under `/ngsi-ld/v1/entities/`:

-   **Random Data**: `/random/<type>/...`
-   **Static Data**: `/static/<type>/...`
-   **Twitter Data**: `/catfacts/...`, `/twitter/...`
-   **Weather Data**: `/weather/...`

### Health Checks

-   `/health`: General application health check.
-   `/random/health`, `/static/health`: Check availability of random/static context providers.
-   `/twitter/health`: Check connectivity to Twitter API.
-   `/weather/health`: Check connectivity to OpenWeatherMap API.

## Environment Variables

The application is configured using the following environment variables:

### Core Configuration

-   `WEB_APP_PORT` - Port the application listens on. Default: `3000`.
-   `NODE_ENV` - Environment mode (e.g., `production`, `development`).
-   `DEBUG` - Debug logging namespace. Recommended: `tutorial:*`.
-   `SESSION_SECRET` - Secret used for signing session cookies.
-   `SESSION_OFF` - If set to `true`, disables session management. Default: `false`.

### Database Connectivity

-   `MONGO_URL` - Connection string for MongoDB. Default: `mongodb://localhost:27017`.

### FIWARE Component Connectivity

-   `CONTEXT_BROKER` - URL of the Context Broker. Default: `http://localhost:1026/ngsi-ld/v1`.
-   `DEVICE_BROKER` - URL for device commands, usually same as Context Broker. Default: same as `CONTEXT_BROKER`.
-   `NGSI_LD_TENANT` - Tenant for NGSI-LD requests. Default: `openiot`.
-   `IOTA_JSON_LD_CONTEXT` - JSON-LD Context URL for device commands. Default: `http://localhost:3000/data-models/ngsi-context.jsonld`.

### IoT Device Connectivity

Variables to configure the connection to the Dummy IoT Devices service:

-   `DUMMY_DEVICES_PORT` - Port where the Dummy Devices service is running. Default: `3001`.
-   `DUMMY_DEVICES` - Full URL of the Dummy Devices service. Default: `http://localhost:${DUMMY_DEVICES_PORT}`.
-   `MOVE_TRACTOR` - Interval (in ms) to auto-move tractors (simulation). Default: `10000`.
-   `DUMMY_OFF` - If `true`, disables dummy device updates/interaction from this app. Default: `false`.


## License

[MIT](LICENSE) © 2020-2026 FIWARE Foundation e.V.

See the LICENSE file in the root of this project for license details.

The Program includes additional icons downloaded from www.flaticon.com which were obtained under license:

-   Smashicons - [https://www.flaticon.com/authors/smashicons](https://www.flaticon.com/authors/smashicons) - CC 3.0 BY
-   Those Icons - [https://www.flaticon.com/authors/those-icons](https://www.flaticon.com/authors/those-icons) - CC 3.0 BY
-   Freepik - [http://www.freepik.com/](http://www.freepik.com/) - CC 3.0 BY
-   Bootstrap - [https://github.com/twbs/icons](https://github.com/twbs/icons) - MIT