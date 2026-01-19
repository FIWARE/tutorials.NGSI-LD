# FIWARE NGSI-LD Step-by-Step Tutorials Dummy Devices

[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://cim.etsi.org/NGSI-LD/official/front-page.html)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

This is a Node.js Express application used to simulate IoT devices for the FIWARE Step-by-Step tutorials. It can mimic various devices (e.g., sensors, actuators) and supports communication over HTTP and MQTT using different payload formats (Ultralight, JSON, XML).

## Features

*   **Device Simulation**: Simulates various IoT devices like:
    *   **Motion Sensor**: Detects motion.
    *   **Lamp**: Reports luminosity.
    *   **Water Sprinkler**: Actuator to turn water on/off.
    *   **Tractor**: Actuator to start/stop a tractor.
    *   **Filling Station**: Actuator to fill/remove contents.
    *   **Animal Collars**: Reports animal location and status.
*   **Multi-Protocol Support**: Can communicate via **HTTP** (Southbound commands) or **MQTT** (Northbound measurements and Southbound commands).
*   **Payload Formats**: Supports multiple payload formats configurable via environment variables:
    *   `ultralight` (default)
    *   `json`
    *   `xml`
    *   `lorawan` (placeholder)
    *   `sigfox` (placeholder)
*   **Event Emission**: Emits events to the Tutorial Web App to visualize device actions.
*   **Security**: Integration with Keyrock IDM for OAuth2 token management.

## API Endpoints

### Actuators (Southbound HTTP)

-   `POST /iot/water:id` - Turn water sprinkler on/off.
-   `POST /iot/tractor:id` - Start/Stop tractor.
-   `POST /iot/filling:id` - Add/remove/fill filling level.

### Device State & Information

-   `GET /status` - Get status of weather and barn door.
-   `GET /devices/:type` - Get status of devices of a specific type.
-   `GET /animals` - Get status of animal collars.

### Control & Simulation (Northbound/Internal)

-   `PUT /devices/tractor` - Update tractor status.
-   `PUT /devices` - Initialize or update device cache.
-   `PUT /barndoor` - Toggle barn door open/shut.
-   `PUT /weather` - Change weather conditions (sunny/cloudy/raining).
-   `PUT /temperature/:id` - Change target temperature of a device.

## Environment Variables

The application is configured using the following environment variables:

### Core Configuration

-   `DUMMY_DEVICES_PORT` - Port the application listens on. Default: `3001`.
-   `DEBUG` - Debug mode configuration. e.g., `devices:*`.
-   `HISTORY_LOG` - File path to log measures (if set).

### Device Configuration

-   `DUMMY_DEVICES_TRANSPORT` - Transport protocol to use. Options: `HTTP`, `MQTT`. Default: `HTTP`.
-   `DUMMY_DEVICES_PAYLOAD` - Payload format to use. Options: `ultralight`, `json`, `xml`. Default: `ultralight`.
-   `DUMMY_DEVICES_API_KEYS` or `DUMMY_DEVICES_API_KEY` - API Key(s) for MQTT topics. Default: `1234`.

### Connectivity

-   `MQTT_BROKER_URL` - URL of the MQTT Broker. Default: `mqtt://mosquitto`.
-   `WEB_APP_HOST` - Hostname of the Tutorial Web App to emit events to. Default: `localhost`.
-   `WEB_APP_PORT` - Port of the Tutorial Web App. Default: `3000`.

### Security (Keyrock IDM)

-   `KEYROCK_URL` - Public URL of the Keyrock IDM. Default: `http://localhost:3005`.
-   `KEYROCK_IP_ADDRESS` - Internal IP/URL of the Keyrock IDM. Default: `http://127.0.0.1:3005`.
-   `KEYROCK_PORT` - Port of the Keyrock IDM. Default: `3005`.
-   `KEYROCK_CLIENT_ID` - OAuth2 Client ID.
-   `KEYROCK_CLIENT_SECRET` - OAuth2 Client Secret.
-   `CALLBACK_URL` - OAuth2 Callback URL for the web app (referenced in security config).

---

## License

[MIT](LICENSE) © 2020-2026 FIWARE Foundation e.V.