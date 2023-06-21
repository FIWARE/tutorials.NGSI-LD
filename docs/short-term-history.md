[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

**Description:** This tutorial is an introduction to the temporal interface of NGSI-LD, an **optional** add-on to
context broker implementations. The tutorial activates the IoT animal collars connected in the
[previous tutorial](https://github.com/FIWARE/tutorials.IoT-Agent/tree/NGSI-LD) and persists measurements from those
sensors into a database and retrieves time-based aggregations of that data.

The tutorial uses [cUrl](https://ec.haxx.se/) commands throughout, but is also available as
[Postman documentation](https://fiware.github.io/tutorials.Short-Term-History/ngsi-ld.html).

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/4824d3171f823935dcab)

<hr class="core"/>

# Temporal Operations

> "I could dance with you till the cows come home. Better still, I'll dance with the cows and you come home."
>
> — Groucho Marx (Duck Soup)

NGSI-LD introduces a standardized mechanism for persisting and retrieving historical context data. Conventionally,
context brokers only deal with current context - they have no memory, however NGSI-LD context brokers can be extended to
offer historical context data in a variety of JSON based formats. Temporal functions are classified as an optional
interface for NGSI-LD context brokers, since the additional functionality comes at a cost, and is not mandatory by
default for performance reasons.

Context broker with the temporal interface enabled can persist historic context using the database of their choice. The
NGSI-LD temporal interface is agnostic to the actual persistence mechanism to be used by the context broker - the
interface merely specifies the outputs required when various queries take place. Furthermore, NGSI-LD also specifies a
mechanism for amending values of historic context using the `instanceId` attribute.

The result is a series of data points timestamped using the `observedAt` _property-of-a-property_. Each time-stamped
data point represents the state of context entities at a given moment in time. The individual data points are not
particularly useful on their own, it is only through combining a series data points that meaningful statistics such as
maxima, minima and trends can be observed.

The creation and analysis of trend data is a common requirement of context-driven systems. Within FIWARE, there are two
common paradigms in use - either activating the temporal interface or subscribing to individual context entities and
persisting them into a time-series database (using a component such as QuantumLeap) - the latter is described in a
[separate tutorial](https://github.com/FIWARE/tutorials.IoT-Agent/tree/NGSI-LD).

Which mechanism to use should be it should be borne in mind when architecting such a system. The advantage of using a
subscription mechanism is that only the subscribed entities are persisted, saving disk space. The advantage of the
temporal interface is that it is provided by the context broker directly - no subscriptions are needed and HTTP traffic
is reduced. Furthermore, the temporal interface can be queried across all context entities, not merely those which
satisfy a subscription.

<h4>Device Monitor</h4>

For the purpose of this tutorial, a series of dummy animal collar IoT devices have been created, which will be attached
to the context broker. Details of the architecture and protocol used can be found in the
[IoT Sensors tutorial](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD). The state of each device can be
seen on the UltraLight device monitor web page found at: `http://localhost:3000/device/monitor`.

![FIWARE Monitor](https://fiware.github.io/tutorials.Time-Series-Data/img/farm-devices.png)

## Architecture

This application builds on the components and dummy IoT devices created in
[previous tutorials](https://github.com/FIWARE/tutorials.IoT-Agent/tree/NGSI-LD). It will use two FIWARE components: the
[Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) and the
[IoT Agent for Ultralight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/). In addition, the optional temporal
interface is serviced using an add-on called **Mintaka**.

Therefore the overall architecture will consist of the following elements:

-   The [Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) which will receive requests using
    [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json).
-   The FIWARE [IoT Agent for UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/) which will receive
    northbound device measures requests using
    [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
    syntax and convert them to
    [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json).
-   The underlying [MongoDB](https://www.mongodb.com/) database :
    -   Used by the **Orion Context Broker** to hold context data information such as data entities, subscriptions and
        registrations.
    -   Used by the **IoT Agent** to hold device information such as device URLs and Keys.
-   A [Timescale](https://www.timescale.com/) timeseries database for persisting historic context.
-   The **Mintaka** add-on which services the temporal interface and is also responsible for persisting the context.
-   The **Tutorial Application** does the following:
    -   Acts as set of dummy [agricultural IoT devices](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD)
        using the
        [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
        protocol running over HTTP.
-   An HTTP **Web-Server** which offers static `@context` files defining the context entities within the system.

Since all interactions between the elements are initiated by HTTP requests, the entities can be containerized and run
from exposed ports.

## Start Up

Before you start you should ensure that you have obtained or built the necessary Docker images locally. Please clone the
repository and create the necessary images by running the commands as shown:

```bash
git clone https://github.com/FIWARE/tutorials.Short-Term-History.git
cd tutorials.Short-Term-History
git checkout NGSI-LD

./services create
```

Thereafter, all services can be initialized from the command-line by running the
[services](https://github.com/FIWARE/tutorials.Short-Term-History/blob/NGSI-LD/services) Bash script provided within the
repository:

```bash
./services orion|scorpio
```

> :information_source: **Note:** If you want to clean up and start over again you can do so with the following command:
>
> ```bash
> ./services stop
> ```

<h2>Configuring Orion and Mintaka for Temporal Operations</h2>

Within our Smart Farm, context data about the state of the animals is received via various devices. Therefore, an IoT
Agent is used to convert the data into NGSI-LD format. This is then received at the context broker. Normally the context
broker would only hold the latest state of the system (in Mongo-DB), however with a temporally enabled context broker,
Orion also persists data into a Timescale database. In this instance Orion is only responsible for writing data into the
timescale database. This keeps the system fast and responsive. The Mintaka component is responsible for listening for
temporal interface requests and constructing the relevant query to run against Timescale. The overall architecture can
be seen below:

![](https://fiware.github.io/tutorials.Short-Term-History/img/architecture-ld.png)

<h3>Mintaka Configuration</h3>

```yaml
mintaka:
    image: quay.io/fiware/mintaka:${MINTAKA_VERSION}
    hostname: mintaka
    container_name: fiware-mintaka
    depends_on:
        - timescale-db
    environment:
        - DATASOURCES_DEFAULT_HOST=timescale-db
        - DATASOURCES_DEFAULT_USERNAME=orion
        - DATASOURCES_DEFAULT_PASSWORD=orion
        - DATASOURCES_DEFAULT_DATABSE=orion
        - DATASOURCES_DEFAULT_MAXIMUM_POOL_SIZE=2
    expose:
        - "8080"
    ports:
        - "8080:8080"
```

The `mintaka` container is listening on one port:

-   Temporal operations must be requested on port `8080` is where the service will be listening.

The `mintaka` container is driven by environment variables as shown:

| Key                                   | Value          | Description                                                                                             |
| ------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| DATASOURCES_DEFAULT_HOST              | `timescale-db` | The address where the Timescale database is hosted                                                      |
| DATASOURCES_DEFAULT_USERNAME          | `orion`        | User to log in as when accessing the Timescale database                                                 |
| DATASOURCES_DEFAULT_PASSWORD          | `orion`        | The password to use if none is provided                                                                 |
| DATASOURCES_DEFAULT_DATABASE          | `orion`        | The name of the database used when the `NGSILD-Tenant` header has not been used with persisting context |
| DATASOURCES_DEFAULT_MAXIMUM_POOL_SIZE | `2`            | The maximum number of concurrent requests                                                               |

<h3>Orion Configuration</h3>

```yaml
orion:
    image: quay.io/fiware/orion-ld:${ORION_LD_VERSION}
    hostname: orion
    container_name: fiware-orion
    depends_on:
        - mongo-db
    ports:
        - "1026:1026"
    environment:
        - ORIONLD_TROE=TRUE
        - ORIONLD_TROE_USER=orion
        - ORIONLD_TROE_PWD=orion
        - ORIONLD_TROE_HOST=timescale-db
        - ORIONLD_MONGO_HOST=mongo-db
        - ORIONLD_MULTI_SERVICE=TRUE
        - ORIONLD_DISABLE_FILE_LOG=TRUE
    command: -dbhost mongo-db -logLevel ERROR -troePoolSize 10 -forwarding
```

The `orion` container is listening on its standard port `1026`, the `troePoolSize` flag in the command limits the number
of concurrent connections to use.

| Key                      | Value          | Description                                             |
| ------------------------ | -------------- | ------------------------------------------------------- |
| ORIONLD_TROE             | `TRUE`         | Whether to offer temporal representation of entities    |
| ORIONLD_TROE_USER        | `orion`        | User to log in as when accessing the Timescale database |
| ORIONLD_TROE_PWD         | `orion`        | The password to use if none is provided                 |
| ORIONLD_TROE_HOST        | `timescale-db` | The address where the Timescale database is hosted      |
| ORIONLD_MULTI_SERVICE    | `TRUE`         | Whether to enable multitenancy                          |
| ORIONLD_DISABLE_FILE_LOG | `TRUE`         | The file log is disabled to improve speed               |

To start the system, run the following command:

```bash
./services start
```

### Mintaka - Checking Service Health

Once Mintaka is running, you can check the status by making an HTTP request to the `info` endpoint on the exposed port.
Since the configuration includes `ENDPOINTS_INFO_ENABLED=true` and `ENDPOINTS_INFO_SENSITIVE=false` the endpoint should
return a response.

#### 1 Request:

```bash
curl -L -X GET \
  'http://localhost:8080/info'
```

#### Response:

The response will look similar to the following:

```json
{
    "git": {
        "revision": "e2352fc668dd8fc8ed340bc15447acc3c9ad40be"
    },
    "build": {
        "time": "15 September 2021, 13:48:25 +0000"
    },
    "project": {
        "artifact-id": "mintaka",
        "group-id": "org.fiware",
        "version": "0.3.26"
    }
}
```

> **Troubleshooting:** What if the response is blank ?
>
> -   To check that a docker container is running try:
>
> ```bash
> docker ps
> ```
>
> You should see several containers running. If `orion` or `mintaka` is not running, you can restart the containers as
> necessary.

### Generating Context Data

For the purpose of this tutorial, we must be monitoring a system where the context is periodically being updated. The
dummy IoT Sensors can be used to do this.

Details of various buildings around the farm can be found in the tutorial application. Open
`http://localhost:3000/app/farm/urn:ngsi-ld:Building:farm001` to display a building with an associated filling sensor
and thermostat.

![](https://fiware.github.io/tutorials.Subscriptions/img/fmis.png)

Remove some hay from the barn, update the thermostat and open the device monitor page at
`http://localhost:3000/device/monitor` and start a **Tractor** and switch on a **Smart Lamp**. This can be done by
selecting an appropriate command from the drop-down list and pressing the `send` button. The stream of measurements
coming from the devices can then be seen on the same page.

## Querying Temporal Data

Once the system is up and running, context data is updated automatically, historical information can be queried using
the `/temporal/entities/` endpoint. The port to query will vary based on the context broker used - for Scorpio
`/temporal/entities/` is integrated in the standard `9090`port, for Orion + Mintaka, `/entities` are requested on port
`1026` and `/temporal/entities/` on port `8080`. These port mappings can be altered by amending the `docker-compose`
file of course.

### List the last N sampled values for an entity

This example shows the last 3 changes from the entity `urn:ngsi-ld:Animal:cow002`. To obtain temporal data of a context
entity attribute, send a GET request to `../temporal/entities/<entity-id>`, the `lastN` parameter restricts the result
to N values.

#### :one: Request:

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/urn:ngsi-ld:Animal:cow002' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'lastN=3'
```

Note that when requesting a single entity, `timerel=before` and `timeAt=<current_time>` are implied by the Mintaka
implementation of the temporal interface, these parameters may need to be explicitly added when working with other
context brokers.

#### Response:

The response is a single entity - if an attribute is changing (like `heartRate`) up to N values are returned. The
request is returning full normalized JSON-LD for every value, which includes _properties of properties_, so you can see
which Devices have the provided various readings and which units are being used. Every value has an associated
`instanceId` which can be used for further manipulation of the individual entries where supported.

In the example below, `heartRate` and `location` have been provided by a single Device.

```json
{
    "id": "urn:ngsi-ld:Animal:cow002",
    "type": "Animal",
    "heartRate": [
        {
            "type": "Property",
            "value": 51.0,
            "observedAt": "2021-09-15T13:41:37.888Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:a6d2045e-162a-11ec-93ed-0242ac120106",
            "unitCode": "5K",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow002",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:a6d20a6c-162a-11ec-93ed-0242ac120106"
            }
        },
        {
            "type": "Property",
            "value": 50.0,
            "observedAt": "2021-09-15T13:41:34.568Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:a4b64b62-162a-11ec-9bda-0242ac120106",
            "unitCode": "5K",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow002",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:a4b64d4c-162a-11ec-9bda-0242ac120106"
            }
        },
        {
            "type": "Property",
            "value": 51.0,
            "observedAt": "2021-09-15T13:41:33.508Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:a43b6852-162a-11ec-9dd5-0242ac120106",
            "unitCode": "5K",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow002",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:a43b6ba4-162a-11ec-9dd5-0242ac120106"
            }
        }
    ],
    "location": [
        {
            "type": "GeoProperty",
            "value": {
                "type": "Point",
                "coordinates": [13.404, 52.47, 0.0]
            },
            "observedAt": "2021-09-15T13:41:37.888Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:a6d20ce2-162a-11ec-93ed-0242ac120106",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow002",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:a6d21782-162a-11ec-93ed-0242ac120106"
            }
        },
        {
            "type": "GeoProperty",
            "value": {
                "type": "Point",
                "coordinates": [13.404, 52.471, 0.0]
            },
            "observedAt": "2021-09-15T13:41:34.568Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:a4b64e00-162a-11ec-9bda-0242ac120106",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow002",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:a4b650c6-162a-11ec-9bda-0242ac120106"
            }
        },
        {
            "type": "GeoProperty",
            "value": {
                "type": "Point",
                "coordinates": [13.404, 52.471, 0.0]
            },
            "observedAt": "2021-09-15T13:41:33.508Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:a43b6d20-162a-11ec-9dd5-0242ac120106",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow002",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:a43b70a4-162a-11ec-9dd5-0242ac120106"
            }
        }
    ],
    "species": {
        "type": "Property",
        "value": "dairy cattle",
        "instanceId": "urn:ngsi-ld:attribute:instance:c6ef9a04-1629-11ec-aced-0242ac120106"
    },
    "reproductiveCondition": {
        "type": "Property",
        "value": "active",
        "instanceId": "urn:ngsi-ld:attribute:instance:c6efa292-1629-11ec-aced-0242ac120106"
    }
}
```

### List the last N sampled values of an attribute of an entity

All the usual query parameters from the `/entities` endpoint are also supported with `/temporal/entities` - to obtain
results for a single attribute, just add the `attrs` parameter and include a comma-delimited list of attributes to
receive.

This example shows just the last 3 changes of `heartRate` from the entity `urn:ngsi-ld:Animal:cow002`.

#### 2 Request:

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/urn:ngsi-ld:Animal:cow001' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'lastN=3' \
  -d 'attrs=heartRate'
```

#### Response:

The response is a single entity with a single attribute array holding values of`heartRate`:

```json
{
    "id": "urn:ngsi-ld:Animal:cow001",
    "type": "Animal",
    "heartRate": [
        {
            "type": "Property",
            "value": 52.0,
            "observedAt": "2021-09-16T10:26:41.108Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:95b296d0-16d8-11ec-90f3-0242ac120106",
            "unitCode": "5K",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow001",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:95b2991e-16d8-11ec-90f3-0242ac120106"
            }
        },
        {
            "type": "Property",
            "value": 53.0,
            "observedAt": "2021-09-16T10:26:31.178Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:8f4e048c-16d8-11ec-8e17-0242ac120106",
            "unitCode": "5K",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow001",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:8f4e061c-16d8-11ec-8e17-0242ac120106"
            }
        },
        {
            "type": "Property",
            "value": 52.0,
            "observedAt": "2021-09-16T10:26:26.308Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:8ca9e408-16d8-11ec-b8cd-0242ac120106",
            "unitCode": "5K",
            "providedBy": {
                "object": "urn:ngsi-ld:Device:cow001",
                "type": "Relationship",
                "instanceId": "urn:ngsi-ld:attribute:instance:8ca9e570-16d8-11ec-b8cd-0242ac120106"
            }
        }
    ]
}
```

### Simplified temporal representation of an entity

In much the same manner as the `options=keyValues` parameter reduces entities to simple key-value pairs, the equivalent
`options=temporalValues` reduces each attribute to a series of tuples - one value and one timestamp for each entry.

The simplified temporal representation can be requested by adding the `options` parameter as shown:

#### 3 Request:

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/urn:ngsi-ld:Animal:cow001' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'lastN=3' \
  -d 'options=temporalValues'
```

#### Response:

The response is a single entity with an array of tuples for each attribute which has an
`observedAt`_property-of-a-property_. In this case `heartRate` and `location` are returned. As can be seen, the first
element of each tuple corresponds to the historic `value` of the attribute. The `type` of each attribute is also
returned.

```json
{
    "id": "urn:ngsi-ld:Animal:cow002",
    "type": "Animal",
    "location": {
        "type": "GeoProperty",
        "values": [
            [{ "type": "Point", "coordinates": [13.416, 52.485, 0.0] }, "2021-09-16T10:59:58.790Z"],
            [{ "type": "Point", "coordinates": [13.417, 52.485, 0.0] }, "2021-09-16T10:59:54.038Z"],
            [{ "type": "Point", "coordinates": [13.417, 52.484, 0.0] }, "2021-09-16T10:59:52.138Z"]
        ]
    },
    "heartRate": {
        "type": "Property",
        "values": [
            [52.0, "2021-09-16T10:59:58.790Z"],
            [51.0, "2021-09-16T10:59:54.038Z"],
            [50.0, "2021-09-16T10:59:52.138Z"]
        ]
    }
}
```

### Temporal Queries without observedAt

Temporal Operations rely heavily on the use of the `observedAt` _property of a property_, queries but can also be made
against static attributes using the `timeproperty` parameter to switch the time index for the query to make a look-up
against `modifiedAt`.

#### 4 Request:

The following query is requesting data about the bulls within the herd. Because the `sex`attribute is unchanging,
`timeproperty=modifiedAt` must be used.

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Animal' \
  -d 'pageSize=2' \
  -d 'lastN=3' \
  -d 'q=sex==%22male%22' \
  -d 'timeproperty=modifiedAt' \
  -d 'options=count' \
  -d 'attrs=sex,heartRate' \
  -d 'timerel=before' \
  -d 'timeAt=<current_time>' \

```

`timerel=before` and `timeAt=<current_time>` are required parameters. `<current_time>` is a date-time expressed in UTC
format like `2021-09-16T11:00Z` - seconds and milliseconds are optional.

#### Response:

The response returns two entities along with the two requested attributes as shown. As can be seen. the `heartRate` is
returning three previous values and the `sex` is returning a single property. Single value static attributes are reduced
from an Array of one element down to an object because this is the format specified in JSON-LD syntax:

```json
[
    {
        "id": "urn:ngsi-ld:Animal:cow001",
        "type": "Animal",
        "sex": {
            "type": "Property",
            "value": "male",
            "modifiedAt": "2021-09-16T10:22:39.650Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:0776b1b2-16d8-11ec-9e96-0242ac120106"
        },
        "heartRate": [
            {
                "type": "Property",
                "value": 52.0,
                "observedAt": "2021-09-16T10:26:41.108Z",
                "modifiedAt": "2021-09-16T10:26:41.108Z",
                "instanceId": "urn:ngsi-ld:attribute:instance:95b296d0-16d8-11ec-90f3-0242ac120106",
                "unitCode": "5K",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:cow001",
                    "type": "Relationship",
                    "instanceId": "urn:ngsi-ld:attribute:instance:95b2991e-16d8-11ec-90f3-0242ac120106"
                }
            },
            {
                "type": "Property",
                "value": 53.0,
                "observedAt": "2021-09-16T10:26:31.178Z",
                "modifiedAt": "2021-09-16T10:26:31.108Z",
                "instanceId": "urn:ngsi-ld:attribute:instance:8f4e048c-16d8-11ec-8e17-0242ac120106",
                "unitCode": "5K",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:cow001",
                    "type": "Relationship",
                    "instanceId": "urn:ngsi-ld:attribute:instance:8f4e061c-16d8-11ec-8e17-0242ac120106"
                }
            },
            {
                "type": "Property",
                "value": 52.0,
                "observedAt": "2021-09-16T10:26:26.308Z",
                "modifiedAt": "2021-09-16T10:26:26.108Z",
                "instanceId": "urn:ngsi-ld:attribute:instance:8ca9e408-16d8-11ec-b8cd-0242ac120106",
                "unitCode": "5K",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:cow001",
                    "type": "Relationship",
                    "instanceId": "urn:ngsi-ld:attribute:instance:8ca9e570-16d8-11ec-b8cd-0242ac120106"
                }
            }
        ]
    },
    {
        "id": "urn:ngsi-ld:Animal:cow021",
        "type": "Animal",
        "sex": {
            "type": "Property",
            "value": "male",
            "modifiedAt": "2021-09-16T10:22:39.650Z",
            "instanceId": "urn:ngsi-ld:attribute:instance:07792b40-16d8-11ec-9e96-0242ac120106"
        },
        "heartRate": [
            {
                "type": "Property",
                "value": 52.0,
                "observedAt": "2021-09-16T10:26:41.108Z",
                "modifiedAt": "2021-09-16T10:26:41.108Z",
                "instanceId": "urn:ngsi-ld:attribute:instance:95b296d0-16d8-11ec-90f3-0242ac120106",
                "unitCode": "5K",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:cow021",
                    "type": "Relationship",
                    "instanceId": "urn:ngsi-ld:attribute:instance:95b2991e-16d8-11ec-90f3-0242ac120106"
                }
            },
            {
                "type": "Property",
                "value": 53.0,
                "observedAt": "2021-09-16T10:26:31.178Z",
                "modifiedAt": "2021-09-16T10:26:31.108Z",
                "instanceId": "urn:ngsi-ld:attribute:instance:8f4e048c-16d8-11ec-8e17-0242ac120106",
                "unitCode": "5K",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:cow021",
                    "type": "Relationship",
                    "instanceId": "urn:ngsi-ld:attribute:instance:8f4e061c-16d8-11ec-8e17-0242ac120106"
                }
            },
            {
                "type": "Property",
                "value": 52.0,
                "observedAt": "2021-09-16T10:26:26.308Z",
                "modifiedAt": "2021-09-16T10:26:41.308Z",
                "instanceId": "urn:ngsi-ld:attribute:instance:8ca9e408-16d8-11ec-b8cd-0242ac120106",
                "unitCode": "5K",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:cow021",
                    "type": "Relationship",
                    "instanceId": "urn:ngsi-ld:attribute:instance:8ca9e570-16d8-11ec-b8cd-0242ac120106"
                }
            }
        ]
    }
]
```

The equivalent simplified format can be retrived by setting `options=temporalValues`.

#### 5 Request:

The following query is requesting data about the bulls within the herd. Because the `sex`attribute is unchanging,
`timeproperty=modifiedAt` must be used.

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Animal' \
  -d 'pageSize=2' \
  -d 'lastN=3' \
  -d 'q=sex==%22male%22' \
  -d 'timeproperty=modifiedAt' \
  -d 'options=temporalValues' \
  -d 'attrs=sex,heartRate' \
  -d 'timerel=before' \
  -d 'timeAt=<current_time>' \

```

#### Response:

The response returns two entities along with the two requested attributes as shown. As can be seen. the `heartRate` is
returning three previous values and the `sex` is returning a single property. The second element within each tuple - the
timestamp represents the `modifiedAt` property:

```json
[
    {
        "id": "urn:ngsi-ld:Animal:cow001",
        "type": "Animal",
        "heartRate": {
            "type": "Property",
            "values": [
                [52.0, "2021-09-16T10:59:59.329Z"],
                [51.0, "2021-09-16T10:59:54.169Z"],
                [50.0, "2021-09-16T10:59:52.479Z"]
            ]
        },
        "sex": {
            "type": "Property",
            "values": [["male", "2021-09-16T10:22:39.650Z"]]
        }
    },
    {
        "id": "urn:ngsi-ld:Animal:cow021",
        "type": "Animal",
        "heartRate": {
            "type": "Property",
            "values": [
                [52.0, "2021-09-16T10:59:59.375Z"],
                [51.0, "2021-09-16T10:59:54.167Z"],
                [51.0, "2021-09-16T10:59:52.441Z"]
            ]
        },
        "sex": {
            "type": "Property",
            "values": [["male", "2021-09-16T10:22:39.650Z"]]
        }
    }
]
```

### Pagination operations

Because temporal operations can end up returning very large payloads, it is possible to reduce the scope of the request,
the `pageSize=2` parameter means that only two entities are returned:

#### 6 Request:

```bash
curl -G -I -X GET 'http://localhost:8080/temporal/entities/' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Animal' \
  -d 'pageSize=2' \
  -d 'lastN=3' \
  -d 'q=sex==%22male%22' \
  -d 'timeproperty=modifiedAt' \
  -d 'options=temporalValues,count' \
  -d 'attrs=sex,heartRate' \
  -d 'timerel=before' \
  -d 'timeAt=<current_time>'
```

It should be noted that the API also responded with a **206 Partial Content** HTTP Code, indicating that more data is
available which would match the query. Adding `count` to the `options` parameter returns additional information in the
headers of the response:

#### Response Headers:

```text
Content-Range: date-time 2021-09-16T11:00-2021-09-16T10:22:39.650/3
Page-Size: 2
Next-Page: urn:ngsi-ld:Animal:pig001
NGSILD-Results-Count: 17
Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"
Date: Thu, 16 Sep 2021 14:12:32 GMT
Content-Type: application/ld+json
content-length: 540
connection: keep-alive
```

-   The **Content-Range** header describes the overall range of timestamps retrieved.
-   The **Page-Size** header returns the number entries in the array - this may be fewer than requested.
-   The **Next-Page** header indicates the next entity to be retrieved.
-   The **NGSILD-Results-Count** indicates the total number of entities which matched the request.

In the example above, where two Animals were retrieved, the returned headers indicate that 17 male animals are living on
the farm and that the next entity to be returned would be `urn:ngsi-ld:Animal:pig001`.

Making the same request with an additional `pageAnchor` parameter will retrieve the next two entities:

#### 7 Request:

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Animal' \
  -d 'pageSize=2' \
  -d 'lastN=3' \
  -d 'q=sex==%22male%22' \
  -d 'timeproperty=modifiedAt' \
  -d 'options=temporalValues,count' \
  -d 'attrs=sex,heartRate' \
  -d 'timerel=before' \
  -d 'timeAt=<current_time>' \
  -d 'pageAnchor=urn:ngsi-ld:Animal:pig001'
```

#### Response Headers:

If the `pageAnchor` parameter is sent, an additional `Previous-Page` header is added to the response, indicating the
first entity of the previous query:

```text
Content-Range: date-time 2021-09-16T11:00-2021-09-16T10:22:39.650/3
Page-Size: 2
Next-Page: urn:ngsi-ld:Animal:pig005
Previous-Page: urn:ngsi-ld:Animal:cow001
NGSILD-Results-Count: 17
Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"
Date: Thu, 16 Sep 2021 14:27:14 GMT
Content-Type: application/ld+json
content-length: 540
connection: keep-alive
```

#### Response:

Within the response body, two male pigs are now returned, once again the API also responded with a **206 Partial
Content** HTTP Code, indicating further male animals can be found on the farm:

```json
[
    {
        "id": "urn:ngsi-ld:Animal:pig003",
        "type": "Animal",
        "heartRate": {
            "type": "Property",
            "values": [
                [63.0, "2021-09-16T10:59:59.201Z"],
                [62.0, "2021-09-16T10:59:53.916Z"],
                [63.0, "2021-09-16T10:59:52.453Z"]
            ]
        },
        "sex": {
            "type": "Property",
            "values": [["male", "2021-09-16T10:22:39.650Z"]]
        }
    },
    {
        "id": "urn:ngsi-ld:Animal:pig001",
        "type": "Animal",
        "heartRate": {
            "type": "Property",
            "values": [
                [61.0, "2021-09-16T10:59:59.089Z"],
                [62.0, "2021-09-16T10:59:53.726Z"],
                [63.0, "2021-09-16T10:59:52.449Z"]
            ]
        },
        "sex": {
            "type": "Property",
            "values": [["male", "2021-09-16T10:22:39.650Z"]]
        }
    }
]
```

### Filtering Temporal requests using the `q` parameter

A device such as an animal collar, sends its data to the context broker via an IoT Agent, the corresponding entity is
stored in the context broker.

#### 8 Request:

```bash
curl -L -X GET \
  'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Device:pig003' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'NGSILD-Tenant: openiot'
```

#### Response:

The entity is following the standard **Device** data model and has attributes such as `location` and`controlledAsset`
(i.e. the **Animal** entity that is wearing the device). Because the animal collars are monitoring `heartRate`, that
attribute has also been added to the model:

```json
{
    "@context": "http://context/ngsi-context.jsonld",
    "id": "urn:ngsi-ld:Device:pig003",
    "type": "Device",
    "heartRate": {
        "value": 65,
        "type": "Property",
        "unitCode": "5K",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "status": {
        "value": "3",
        "type": "Property",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "location": {
        "value": {
            "type": "Point",
            "coordinates": [13.356, 52.511]
        },
        "type": "GeoProperty",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "controlledAsset": {
        "object": "urn:ngsi-ld:Animal:pig003",
        "type": "Relationship",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "description": {
        "value": "Animal Collar",
        "type": "Property",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "category": {
        "value": "sensor",
        "type": "Property",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "controlledProperty": {
        "value": ["heartRate", "location", "status"],
        "type": "Property",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "supportedProtocol": {
        "value": "ul20",
        "type": "Property",
        "observedAt": "2021-09-16T15:24:15.781Z"
    },
    "d": {
        "value": "FORAGING",
        "type": "Property",
        "observedAt": "2021-09-16T15:24:15.781Z"
    }
}
```

As can be seen, every returned attribute has an `observedAt` _property of a property_, this means that any attributes
can be used as part of the filter for a temporal request.

The following request returns the `heartRate` registered when the state of an animal is described as `FORAGING`, and
also returns the associated animal entity that wears it.

#### 9 Request:

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Device' \
  -d 'q=d==%22FORAGING%22' \
  -d 'attrs=heartRate,controlledAsset' \
  -d 'options=temporalValues' \
  -d 'timerel=before' \
  -d 'timeAt=<current_time>' \
  -d 'pageSize=2' \
  -d 'lastN=2'
```

#### Response:

The response returns the requested attributes in simplified temporal format.

```json
[
    {
        "id": "urn:ngsi-ld:Device:pig001",
        "type": "Device",
        "heartRate": {
            "type": "Property",
            "values": [
                [64.0, "2021-09-16T15:45:58.455Z"],
                [63.0, "2021-09-16T15:45:53.586Z"]
            ]
        },
        "controlledAsset": {
            "type": "Relationship",
            "objects": [
                ["urn:ngsi-ld:Animal:pig001", "2021-09-16T15:45:58.455Z"],
                ["urn:ngsi-ld:Animal:pig001", "2021-09-16T15:45:53.586Z"]
            ]
        }
    },
    {
        "id": "urn:ngsi-ld:Device:pig002",
        "type": "Device",
        "heartRate": {
            "type": "Property",
            "values": [
                [64.0, "2021-09-16T15:50:00.659Z"],
                [65.0, "2021-09-16T15:49:56.099Z"]
            ]
        },
        "controlledAsset": {
            "type": "Relationship",
            "objects": [
                ["urn:ngsi-ld:Animal:pig002", "2021-09-16T15:50:00.659Z"],
                ["urn:ngsi-ld:Animal:pig002", "2021-09-16T15:49:56.099Z"]
            ]
        }
    }
]
```

### Geofencing Temporal requests using the `georel` parameter

In the same fashion that entities with a `location` can be geofiltered using the `georel` parameter, temporal queries
can be made against GeoProperty attributes which are observed over time. As could be seen from the **Device** query
previously, the `location` attribute of each animal collar has an `observedAt` _property-of-a-property_ and therefore
can be used to trace location over time.

The following request returns the `heartRate` registered when the state of an animal is when it is less than 800 meters
from a fixed point, and also returns the associated animal entity that wears it.

#### 10 Request:

```bash
curl -G -X GET 'http://localhost:8080/temporal/entities/' \
  -H 'NGSILD-Tenant: openiot' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Device' \
  -d 'georel=near%3BmaxDistance==800' \
  -d 'geometry=Point' \
  -d 'coordinates=%5B13.364,52.52%5D' \
  -d 'attrs=heartRate,controlledAsset' \
  -d 'options=temporalValues' \
  -d 'timerel=before' \
  -d 'timeAt=<current_time>' \
  -d 'pageSize=2' \
  -d 'lastN=3'
```

#### Response:

The response returns the requested attributes in simplified temporal format.

```json
[
    {
        "id": "urn:ngsi-ld:Device:pig001",
        "type": "Device",
        "heartRate": {
            "type": "Property",
            "values": [
                [66.0, "2021-09-16T15:21:59.574Z"],
                [66.0, "2021-09-16T15:21:54.788Z"],
                [64.0, "2021-09-16T15:21:44.759Z"]
            ]
        },
        "controlledAsset": {
            "type": "Relationship",
            "objects": [
                ["urn:ngsi-ld:Animal:pig001", "2021-09-16T15:21:59.574Z"],
                ["urn:ngsi-ld:Animal:pig001", "2021-09-16T15:21:54.788Z"],
                ["urn:ngsi-ld:Animal:pig001", "2021-09-16T15:21:44.759Z"]
            ]
        }
    },
    {
        "id": "urn:ngsi-ld:Device:pig002",
        "type": "Device",
        "heartRate": {
            "type": "Property",
            "values": [
                [64.0, "2021-09-16T16:23:57.731Z"],
                [63.0, "2021-09-16T16:23:52.839Z"],
                [62.0, "2021-09-16T16:23:47.102Z"]
            ]
        },
        "controlledAsset": {
            "type": "Relationship",
            "objects": [
                ["urn:ngsi-ld:Animal:pig002", "2021-09-16T16:23:57.731Z"],
                ["urn:ngsi-ld:Animal:pig002", "2021-09-16T16:23:52.839Z"],
                ["urn:ngsi-ld:Animal:pig002", "2021-09-16T16:23:47.102Z"]
            ]
        }
    }
]
```
