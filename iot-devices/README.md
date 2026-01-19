# FIWARE NGSI-LD Step-by-Step Tutorials Dummy Devices

[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://cim.etsi.org/NGSI-LD/official/front-page.html)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

Simple nodejs express application for use with the FIWARE Step-by-Step tutorials.

This application provides sends information about devices on the farm.

### Actuators

- POST `/iot/water:id`  - Actuate the water sprinkler on/off
- POST `/iot/tractor:id`  - Actuate the tractor start/stop
- POST `/iot/filling:id` - Actuate the filling level add/remove/fill

### Fire devices

- GET `/status` - send the status of the weather and the barn door
- GET `/devices/:type` - send the status of devices of a given type
- GET `/animals` - send the status of the animal collars

### Set device states

- PUT `/devices/tractor` - - update the status of tractors
- PUT `/devices` - initialise the cache of all devices
- PUT `/barndoor` - toggle the barn door open/shut
- PUT `/weather` - amend the weather - sunny/cloudy/raining
- PUT `/temperature/:id` - amend the target temperature of a device

To run the application in debug mode add `DEBUG=devices:*`

---

## License

[MIT](LICENSE) © 2020-2026 FIWARE Foundation e.V.