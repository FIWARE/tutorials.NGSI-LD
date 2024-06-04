[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_cim009v010801p.pdf)

**Description:** This tutorial is an introduction to
[FIWARE QuantumLeap](https://smartsdk.github.io/ngsi-timeseries-api/) - a generic enabler which is used to persist
context data into a **CrateDB** database. The tutorial activates the IoT sensors connected in the
[previous tutorial](https://github.com/FIWARE/tutorials.IoT-Agent) and persists measurements from those sensors into the
database. To retrieve time-based aggregations of such data, users can either use **QuantumLeap** query API or connect
directly to the **CrateDB** HTTP endpoint. Results are visualised on a graph or via the **Grafana** time series
analytics tool.

The tutorial uses [cUrl](https://ec.haxx.se/) commands throughout, but is also available as
[Postman documentation](https://fiware.github.io/tutorials.Time-Series-Data/ngsi-ld.html).

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/d24facc3c430bb5d5aaf)
[![Run in GitPod](https://fiware.github.io/tutorials.NGSI-LD/img/gitpod.png)](https://gitpod.io/#https://github.com/FIWARE/tutorials.Time-Series-Data/tree/NGSI-LD)

<hr class="core"/>

# Persisting and Querying Time Series Data (CrateDB)

> "Forever is composed of nows."
>
> — Emily Dickinson

FIWARE [QuantumLeap](https://smartsdk.github.io/ngsi-timeseries-api/) is a time-based data-persistence generic enabler
created specifically to persist and query time-series database (currently CrateDB and TimescaleDB). The component can
respond to NGSI-v2 or NGSI-LD subscriptions.

[CrateDB](https://crate.io/) is a distributed SQL DBMS designed for use with the internet of Things. It is capable of
ingesting a large number of data points per second and can be queried in real-time. The database is designed for the
execution of complex queries such as geospatial and time series data. Retrieval of this historic context data allows for
the creation of graphs and dashboards displaying trends over time.

[TimescaleDB](https://www.timescale.com/) scales PostgreSQL for time-series data via automatic partitioning across time
and space (partitioning key), yet retains the standard PostgreSQL interface. In other words, TimescaleDB exposes what
look like regular tables, but are actually only an abstraction (or a virtual view) of many individual tables comprising
the actual data. In combination with [PostGIS](https://postgis.net/) extension can support geo-timeseries.

## Analyzing time series data

The appropriate use of time series data analysis will depend on your use case and the reliability of the data
measurements you receive. Time series data analysis can be used to answer questions such as:

-   What was the maximum measurement of a device within a given time period?
-   What was the average measurement of a device within a given time period?
-   What was the sum of the measurements sent by a device within a given time period?

It can also be used to reduce the significance of each individual data point to exclude outliers by smoothing.

<h4>Grafana</h4>

[Grafana](https://grafana.com/) is an open source software for time series analytics tool which will be used during this
tutorial. It integrates with a variety of time-series databases including **CrateDB** and **TimescaleDB**. It is
available licensed under the Apache License 2.0. More information can be found at `https://grafana.com/`.

<h4>Device Monitor</h4>

For the purpose of this tutorial, a series of dummy agricultural IoT devices have been created, which will be attached
to the context broker. Details of the architecture and protocol used can be found in the
[IoT Sensors tutorial](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD) The state of each device can be
seen on the UltraLight device monitor web page found at: `http://localhost:3000/device/monitor`.

![FIWARE Monitor](https://fiware.github.io/tutorials.Time-Series-Data/img/farm-devices.png)

<h4>Device History</h4>

Once **QuantumLeap** has started aggregating data, the historical state of each device can be seen on the device history
web page found at: `http://localhost:3000/device/history/urn:ngsi-ld:Farm:001`.

![](https://fiware.github.io/tutorials.Time-Series-Data/img/history-graphs.png)

## Architecture

This application builds on the components and dummy IoT devices created in
[previous tutorials](https://github.com/FIWARE/tutorials.IoT-Agent/). It will use three FIWARE components: the
[Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/), the
[IoT Agent for Ultralight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/), and
[QuantumLeap](https://smartsdk.github.io/ngsi-timeseries-api/).

Therefore, the overall architecture will consist of the following elements:

-   The **FIWARE Generic Enablers**:

    -   The [Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) which will receive requests using
        [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json).
    -   The FIWARE [IoT Agent for UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/) which will
        receive southbound requests using
        [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
        and convert them to
        [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
        commands for the devices.
    -   FIWARE [QuantumLeap](https://smartsdk.github.io/ngsi-timeseries-api/) subscribed to context changes and
        persisting them into a **CrateDB** database.

-   A [MongoDB](https://www.mongodb.com/) database:

    -   Used by the **Orion Context Broker** to hold context data information such as data entities, subscriptions and
        registrations.
    -   Used by the **IoT Agent** to hold device information such as device URLs and Keys.

-   A [CrateDB](https://crate.io/) database:

    -   Used as a data sink to hold time-based historical context data.
    -   offers an HTTP endpoint to interpret time-based data queries.

-   An HTTP **Web-Server** which offers static `@context` files defining the context entities within the system.
-   The **Tutorial Application** does the following:
    -   Acts as set of dummy [agricultural IoT devices](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD)
        using the
        [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
        protocol running over HTTP.

Since all interactions between the elements are initiated by HTTP requests, the entities can be containerized and run
from exposed ports.

The overall architecture can be seen below:

![](https://fiware.github.io/tutorials.Time-Series-Data/img/architecture.png)

## Connecting FIWARE to a CrateDB Database via QuantumLeap

In the configuration, **QuantumLeap** listens to NGSI LD notifications on port `8868` and persists historic context data
to the **CrateDB**. **CrateDB** is accessible using port `4200` and can either be queried directly or attached to the
Grafana analytics tool. The rest of the system providing the context data has been described in previous tutorials.

<h3>CrateDB Database Server Configuration</h3>

```yaml
crate-db:
    image: crate:4.1.4
    hostname: crate-db
    ports:
        - "4200:4200"
        - "4300:4300"
    command:
        crate -Clicense.enterprise=false -Cauth.host_based.enabled=false  -Ccluster.name=democluster
        -Chttp.cors.enabled=true -Chttp.cors.allow-origin="*"
    environment:
        - CRATE_HEAP_SIZE=2g
```

If CrateDB exits immediately with a
`max virtual memory areas vm.max_map_count [65530] is too low, increase to at least [262144]` error, this can be fixed
by running the `sudo sysctl -w vm.max_map_count=262144` command on the host machine. For further information look within
the CrateDB [documentation](https://crate.io/docs/crate/howtos/en/latest/admin/bootstrap-checks.html#bootstrap-checks)
and Docker
[troubleshooting guide](https://crate.io/docs/crate/howtos/en/latest/deployment/containers/docker.html#troubleshooting).

<h3>QuantumLeap Configuration</h3>

```yaml
quantumleap:
    image: smartsdk/quantumleap
    hostname: quantumleap
    ports:
        - "8668:8668"
    depends_on:
        - crate-db
    environment:
        - CRATE_HOST=crate-db
```

<h3>Grafana Configuration</h3>

```yaml
grafana:
    image: grafana/grafana
    depends_on:
        - cratedb
    ports:
        - "3003:3000"
    environment:
        - GF_INSTALL_PLUGINS=https://github.com/orchestracities/grafana-map-plugin/archive/master.zip;grafana-map-plugin,grafana-clock-panel,grafana-worldmap-panel
```

The `quantumleap` container is listening on one port:

-   The Operations for port for QuantumLeap - `8668` is where the service will be listening for notifications from the
    Orion context broker and where users can query data from.

The `CRATE_HOST` environment variable defines the location where the data will be persisted.

The `cratedb` container is listening on two ports:

-   The Admin UI is available on port `4200`.
-   The transport protocol is available on `port 4300`.

The `grafana` container has connected up port `3000` internally with port `3003` externally. This is because the Grafana
UI is usually available on port `3000`, but this port has already been taken by the dummy devices UI, therefore it has
been shifted to another port. The Grafana Environment variables are described within their own
[documentation](https://grafana.com/docs/installation/configuration/). The configuration ensures we will be able to
connect to the **CrateDB** database later on in the tutorial. The configuration also imports a custom map plugin that
helps you in displaying NGSI v2 entities over a map.

### Video: NGSI-LD with Grafana

[![](https://fiware.github.io/tutorials.NGSI-LD/img/video-logo.png)](https://www.youtube.com/watch?v=Gaa23hC0teo&t=475s "NGSI-LD Grafana")

Click on the image above to watch a demo of this tutorial describing how to use the NGSI-LD with Grafana.

## Start Up

Before you start you should ensure that you have obtained or built the necessary Docker images locally. Please clone the
repository and create the necessary images by running the commands as shown:

```bash
git clone https://github.com/FIWARE/tutorials.Time-Series-Data.git
cd tutorials.Time-Series-Data
git checkout NGSI-LD

./services create
```

Thereafter, all services can be initialized from the command-line by running the
[services](https://github.com/FIWARE/tutorials.Short-Term-History/blob/NGSI-LD/services) Bash script provided within the
repository:

```bash
./services [orion|scorpio|stellio]
```

> **Note:** If you want to clean up and start over again you can do so with the following command:
>
> ```
> ./services stop
> ```

### Generating Context Data

For the purpose of this tutorial, we must be monitoring a system where the context is periodically being updated. The
dummy IoT Sensors can be used to do this.

Details of various buildings around the farm can be found in the tutorial application. Open
`http://localhost:3000/app/farm/urn:ngsi-ld:Building:farm001` to display a building with an associated filling sensor
and thermostat.

![](https://fiware.github.io/tutorials.Subscriptions/img/fmis.png)

Remove some hay from the barn, update the thermostat and open the device monitor page at
`http://localhost:3000/device/monitor` and start a **Tractor**. This can be done by selecting an appropriate command
from the drop-down list and pressing the `send` button. The stream of measurements coming from the devices can then be
seen on the same page.

## Setting up Subscriptions

Once a dynamic context system is up and running, we need to inform **QuantumLeap** directly of changes in context. As
expected this is done using the subscription mechanism of the **Orion Context Broker**.

Subscriptions will be covered in the next subsections. More details about subscriptions can be found in previous
tutorials or in the [subscriptions section](https://quantumleap.readthedocs.io/en/latest/user/#orion-subscription) of
QuantumLeap docs.

### Aggregate Filling Sensor filling Events

The rate of change of the **Filling Sensor** is driven by events in the real-world. We need to receive every event to be
able to aggregate the results.

This is done by making a POST request to the `/ngsi-ld/v1/subscriptions/` endpoint of the **Orion-LD Context Broker**.

-   The `NGSILD-Tenant` headers is used to filter the subscription to only listen to measurements from the attached IoT
    Sensors.
-   The `entities` `type` in the request body ensures that **QuantumLeap** will be informed of all
    **FillingLevelSensor** data changes.
-   The `notification` URL must match the exposed port.

With NGSI-LD the `observedAt` _property-of-property_ holds the timestamp of the measure. Because the attribute being
monitored contains this _property-of-property_, the `time_index` column within the **CrateDB** database will match the
data found within the **MongoDB** database used by the **Orion Context Broker** rather than using the creation time of
the record within the **CrateDB** itself.

#### 1 Request:

```bash
curl -L -X POST 'http://localhost:1026/ngsi-ld/v1/subscriptions/' \
-H 'Content-Type: application/ld+json' \
-H 'NGSILD-Tenant: openiot' \
--data-raw '{
  "description": "Notify me of all feedstock changes",
  "type": "Subscription",
  "entities": [{"type": "FillingLevelSensor"}],
  "watchedAttributes": ["filling"],
  "notification": {
    "attributes": ["filling", "location"],
    "format": "normalized",
    "endpoint": {
      "uri": "http://quantumleap:8668/v2/notify",
      "accept": "application/json",
      "receiverInfo": [
        {
          "key": "fiware-service",
          "value": "openiot"
        }
      ]
    }
  },
   "@context": "http://context/ngsi-context.jsonld"
}'
```

### Sample GPS Readings

The heart rate and GPS reading of the Animal Collars on the animals on the farm are constantly changing, we only need to
sample the values to be able to work out relevant statistics such as minimum and maximum values and rates of change.

This is done by making a POST request to the `/ngsi-ld/v1/subscriptions/` endpoint of the **Orion Context Broker** and
including the `throttling` attribute in the request body.

-   The `NGSILD-Tenant` headers is used to filter the subscription to only listen to measurements from the attached IoT
    Sensors.
-   The `entities` `type` in the request body ensures that **QuantumLeap** will be informed of all **Device** data
    changes.
-   The `notification` URL must match the exposed port.
-   The `throttling` value defines the rate that changes are sampled.

#### 2 Request:

```bash
curl -L -X POST 'http://localhost:1026/ngsi-ld/v1/subscriptions/' \
-H 'Content-Type: application/ld+json' \
-H 'NGSILD-Tenant: openiot' \
--data-raw '{
  "description": "Notify me of animal locations",
  "type": "Subscription",
  "entities": [{"type": "Device"}],
  "watchedAttributes": ["location", "status", "heartRate"],
  "notification": {
    "attributes": ["location", "status", "heartRate"],
    "format": "normalized",
    "endpoint": {
      "uri": "http://quantumleap:8668/v2/notify",
      "accept": "application/json",
      "receiverInfo": [
        {
          "key": "fiware-service",
          "value": "openiot"
        }
      ]
    }
  },
   "throttling": 10,
   "@context": "http://context/ngsi-context.jsonld"
}'
```

### Checking Subscriptions for QuantumLeap

Before anything, check the subscriptions you created in steps 1️⃣ and 2️⃣ are working (i.e., at least one notification for
each was sent).

#### 3 Request:

```bash
curl -X GET \
  'http://localhost:1026/ngsi-ld/v1/subscriptions/' \
  -H 'NGSILD-Tenant: openiot'
```

#### Response:

> **Tip:** Use [jq](https://www.digitalocean.com/community/tutorials/how-to-transform-json-data-with-jq) to format the
> JSON responses in this tutorial. Pipe the result by appending
>
> ```
> | jq '.'
> ```

```json
[
    {
        "id": "urn:ngsi-ld:Subscription:601157b4bc8ec912978db6e4",
        "type": "Subscription",
        "description": "Notify me of all feedstock changes",
        "entities": [
            {
                "type": "FillingLevelSensor"
            }
        ],
        "watchedAttributes": ["filling"],
        "notification": {
            "attributes": ["filling"],
            "format": "normalized",
            "endpoint": {
                "uri": "http://quantumleap:8668/v2/notify",
                "accept": "application/json",
                "receiverInfo": [
                    {
                        "key": "fiware-service",
                        "value": "openiot"
                    }
                ]
            }
        },
        "@context": "http://context/ngsi-context.jsonld"
    },
    {
        "id": "urn:ngsi-ld:Subscription:601157e3bc8ec912978db6e5",
        "type": "Subscription",
        "description": "Notify me of animal locations",
        "entities": [
            {
                "type": "Device"
            }
        ],
        "watchedAttributes": ["location", "state", "heartRate"],
        "notification": {
            "attributes": ["location", "state", "heartRate"],
            "format": "normalized",
            "endpoint": {
                "uri": "http://quantumleap:8668/v2/notify",
                "accept": "application/json",
                "receiverInfo": [
                    {
                        "key": "fiware-service",
                        "value": "openiot"
                    }
                ]
            }
        },
        "throttling": 10,
        "@context": "http://context/ngsi-context.jsonld"
    }
]
```

## Time Series Data Queries (QuantumLeap API)

**QuantumLeap** offers an API wrapping CrateDB backend, therefore you can also perform multiple types of queries. The
documentation of the API is [here](https://app.swaggerhub.com/apis/smartsdk/ngsi-tsdb/). Mind the versions. If you have
access to your `quantumleap` container (e.g. it is running in `localhost` or port-forwarding to it), you can navigate
its API via `http://localhost:8668/v2/ui`.

### QuantumLeap API - List the first N Sampled Values

Now, to check QuantumLeap is persisting values, let's get started with our first query. This example shows the first 3
sampled `filling` values from `urn:ngsi-ld:Device:filling001`.

Note the use of the `Fiware-Service` header which is the NGSI-v2 equivalent of `NGSILD-Tenant`. These are required only
when data are pushed to orion using such headers (in multitenancy scenarios). Failing to align these headers will result
in no data being returned.

#### 4 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/entities/urn:ngsi-ld:Device:filling001/attrs/filling?limit=3' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "data": {
        "attrName": "filling",
        "entityId": "urn:ngsi-ld:Device:filling001",
        "index": ["2018-10-29T14:27:26", "2018-10-29T14:27:28", "2018-10-29T14:27:29"],
        "values": [0.94, 0.87, 0.84]
    }
}
```

### QuantumLeap API - List N Sampled Values at an Offset

This example shows the fourth, fifth and sixth sampled `filling` values of `urn:ngsi-ld:Device:filling001`.

#### 5 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/entities/urn:ngsi-ld:Device:filling001/attrs/filling?offset=3&limit=3' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "data": {
        "attrName": "filling",
        "entityId": "urn:ngsi-ld:Device:filling001",
        "index": ["2018-10-29T14:23:53.804000", "2018-10-29T14:23:54.812000", "2018-10-29T14:24:00.849000"],
        "values": [0.75, 0.63, 0.91]
    }
}
```

### QuantumLeap API - List the latest N Sampled Values

This example shows the latest three sampled `filling` values from `urn:ngsi-ld:Device:filling001`.

#### 6 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/entities/urn:ngsi-ld:Device:filling001/attrs/filling?lastN=3' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "data": {
        "attrName": "filling",
        "entityId": "urn:ngsi-ld:Device:filling001",
        "index": ["2018-10-29T15:03:45.113000", "2018-10-29T15:03:46.118000", "2018-10-29T15:03:47.111000"],
        "values": [0.91, 0.67, 0.9]
    }
}
```

### QuantumLeap API - List the Sum of values grouped by a time period

This example shows last 3 total `filling` values of `urn:ngsi-ld:Device:filling001` over each minute.

You need QuantumLeap **version >= 0.4.1**. You can check your version with a simple GET like:

```bash
curl -X GET \
  'http://localhost:8668/version' \
  -H 'Accept: application/json'
```

#### 7 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/entities/urn:ngsi-ld:Device:filling001/attrs/filling?aggrMethod=count&aggrPeriod=minute&lastN=3' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "data": {
        "attrName": "filling",
        "entityId": "urn:ngsi-ld:Device:filling001",
        "index": ["2018-10-29T15:03:00.000000"],
        "values": [8]
    }
}
```

### QuantumLeap API - List the Minimum Values grouped by a Time Period

This example shows minimum `filling` values from `urn:ngsi-ld:Device:filling001` over each minute.

<!--lint disable no-blockquote-without-marker-->

> You need QuantumLeap **version >= 0.4.1**. You can check your version with a simple GET like:

> ```
> curl -X GET \
>   'http://localhost:8668/version' \
>   -H 'Accept: application/json'
> ```

<!--lint enable no-blockquote-without-marker-->

#### 8 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/entities/urn:ngsi-ld:Device:filling001/attrs/filling?aggrMethod=min&aggrPeriod=minute&lastN=3' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "data": {
        "attrName": "filling",
        "entityId": "urn:ngsi-ld:Device:filling001",
        "index": ["2018-10-29T15:03:00.000000", "2018-10-29T15:04:00.000000", "2018-10-29T15:05:00.000000"],
        "values": [0.63, 0.49, 0.03]
    }
}
```

### QuantumLeap API - List the Maximum Value over a Time Period

This example shows maximum `filling` value of `urn:ngsi-ld:Device:filling001` that occurred between from
`2018-06-27T09:00:00` to `2018-06-30T23:59:59`.

#### 9 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/entities/urn:ngsi-ld:Device:filling001/attrs/filling?aggrMethod=max&fromDate=2018-06-27T09:00:00&toDate=2018-06-30T23:59:59' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "data": {
        "attrName": "filling",
        "entityId": "urn:ngsi-ld:Device:filling001",
        "index": [],
        "values": [0.94]
    }
}
```

### QuantumLeap API - List the latest N Sampled Values of Devices near a Point

This example shows the latest heart rate sampled `heartRate` values of animal that are within a 5 km radius from
`52°31'04.8"N 13°21'25.2"E` (Tiergarten, Berlin, Germany). If you have turned on any device the animals will wander
around the Berlin Tiergarten and on the device monitor page, you should be able to see data for
`urn:ngsi-ld:Device:cow001` and `urn:ngsi-ld:Device:pig001` .

> **Note:** Geographical queries are only available starting from version `0.5` of QuantumLeap which implements the full
> set of queries detailed in the Geographical Queries section of the
> [NGSI v2 specification](http://fiware.github.io/specifications/ngsiv2/stable/).

#### 10 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/types/Device/attrs/heartRate?lastN=4&georel=near;maxDistance:5000&geometry=point&coords=52.518,13.357' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "attrName": "heartRate",
    "entities": [
        {
            "entityId": "urn:ngsi-ld:Device:cow001",
            "index": ["2021-01-27T16:52:05.925+00:00", "2021-01-27T16:52:30.769+00:00"],
            "values": [53, 50]
        },
        {
            "entityId": "urn:ngsi-ld:Device:cow002",
            "index": ["2021-01-27T16:50:50.792+00:00"],
            "values": [53]
        },
        {
            "entityId": "urn:ngsi-ld:Device:cow004",
            "index": ["2021-01-27T16:51:55.798+00:00"],
            "values": [51]
        }
    ],
    "entityType": "Device"
}
```

### QuantumLeap API - List the latest N Sampled Values of Devices in an Area

This example shows the latest four sampled `filling` values of fillins sensors that are inside a square of side 200 m
centred at `52°33'16.9"N 13°23'55.0"E` (Bornholmer Straße 65, Berlin, Germany). Even if you have turned on all the
filling sensors available on the device monitor page, you should only see data for `urn:ngsi-ld:Device:filling001`.

> **Note:** Geographical queries are only available starting from version `0.5` of QuantumLeap which implements the full
> set of queries detailed in the Geographical Queries section of the
> [NGSI v2 specification](http://fiware.github.io/specifications/ngsiv2/stable/).

#### 11 Request:

```bash
curl -X GET \
  'http://localhost:8668/v2/types/Device/attrs/heartRate?lastN=4&georel=coveredBy&geometry=polygon&coords=52.5537,13.3996;52.5557,13.3996;52.5557,13.3976;52.5537,13.3976;52.5537,13.3996' \
  -H 'Accept: application/json' \
  -H 'Fiware-Service: openiot' \
  -H 'Fiware-ServicePath: /'
```

#### Response:

```json
{
    "data": {
        "attrName": "bpm",
        "entities": [
            {
                "entityId": "urn:ngsi-ld:Device:cow001",
                "index": [
                    "2018-12-13T17:08:56.041",
                    "2018-12-13T17:09:55.976",
                    "2018-12-13T17:10:55.907",
                    "2018-12-13T17:11:55.833"
                ],
                "values": [65, 63, 63, 62]
            }
        ],
        "entityType": "Device"
    }
}
```

## Time Series Data Queries (CrateDB API)

**CrateDB** offers an [HTTP Endpoint](https://crate.io/docs/crate/reference/en/latest/interfaces/http.html) that can be
used to submit SQL queries. The endpoint is accessible under `<servername:port>/_sql`.

SQL statements are sent as the body of POST requests in JSON format, where the SQL statement is the value of the `stmt`
attribute.

> When to query **CrateDB** and when **QuantumLeap**?. As a rule of thumb, prefer working always with **QuantumLeap**
> for the following reasons:
>
> -   Your experience will be closer to FIWARE NGSI APIs like Orion's.
> -   Your application will not be tied to CrateDB's specifics nor QuantumLeap's implementation details, which could
>     change and break your app.
> -   QuantumLeap can be easily extended to other backends and your app will get compatibility for free.
> -   If your deployment is distributed, you won't need to expose the ports of your database to the outside.

If you are sure your query is not supported by **QuantumLeap**, you may have to end up querying **CrateDB**, however,
please open an issue in [QuantumLeap's GitHub repository](https://github.com/smartsdk/ngsi-timeseries-api/issues) so the
team is aware.

### CrateDB API - Checking Data persistence

Another way to see if data are being persisted is to check if a `table_schema` has been created. This can be done by
making a request to the **CrateDB** HTTP endpoint as shown:

#### 12 Request:

```bash
curl -iX POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SHOW SCHEMAS"}'
```

#### Response:

```json
{
    "cols": ["schema_name"],
    "rows": [["blob"], ["doc"], ["information_schema"], ["mtopeniot"], ["pg_catalog"], ["sys"]],
    "rowcount": 6,
    "duration": 20.3418
}
```

Schema names are formed with the `mt` prefix followed by `NGSILD-Tenant` header in lower case. The IoT Agent is
forwarding measurements from the dummy IoT devices, with the `NGSILD-Tenant` header `openiot`. These are being persisted
under the `mtopeniot` schema.

If the `mtopeniot` does not exist, then the subscription to **QuantumLeap** has not been set up correctly. Check that
the subscription exists, and has been configured to send data to the correct location.

**QuantumLeap** will persist data into separate tables within the **CrateDB** database based on the entity type. Table
names are formed with the `et` prefix and the entity type name in lowercase.

#### 13 Request:

```bash
curl -X POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SHOW TABLES"}'
```

#### Response:

```json
{
    "cols": ["table_schema", "table_name"],
    "rows": [
        ["mtopeniot", "etFillingLevelSensor"],
        ["mtopeniot", "etdevice"]
    ],
    "rowcount": 3,
    "duration": 14.2762
}
```

The response shows that both **Filling Sensor** data and **Animal Collar Device** data are being persisted in the
database.

### CrateDB API - List the first N Sampled Values

The SQL statement uses `ORDER BY` and `LIMIT` clauses to sort the data. More details can be found under within the
**CrateDB** [documentation](https://crate.io/docs/crate/reference/en/latest/sql/statements/select.html).

#### 14 Request:

```bash
curl -iX POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SELECT * FROM mtopeniot.etFillingLevelSensor WHERE entity_id = '\''urn:ngsi-ld:Device:filling001'\'' ORDER BY time_index ASC LIMIT 3"}'
```

#### Response:

```json
{
    "cols": ["entity_id", "entity_type", "fiware_servicepath", "filling", "time_index"],
    "rows": [
        ["urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 0.87, 1530262765000],
        ["urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 0.65, 1530262770000],
        ["urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 0.6, 1530262775000]
    ],
    "rowcount": 3,
    "duration": 21.8338
}
```

### CrateDB API - List N Sampled Values at an Offset

The SQL statement uses an `OFFSET` clause to retrieve the required rows. More details can be found under within the
**CrateDB** [documentation](https://crate.io/docs/crate/reference/en/latest/sql/statements/select.html).

#### 15 Request:

```bash
curl -iX POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SELECT * FROM mtopeniot.etFillingLevelSensor WHERE entity_id = '\''urn:ngsi-ld:Device:filling001'\'' order by time_index ASC LIMIT 3 OFFSET 3"}'
```

#### Response:

```json
{
    "cols": ["filling", "entity_id", "entity_type", "fiware_servicepath", "time_index"],
    "rows": [
        [0.75, "urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 1530262791452],
        [0.63, "urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 1530262792469],
        [0.5, "urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 1530262793472]
    ],
    "rowcount": 3,
    "duration": 54.215
}
```

### CrateDB API - List the latest N Sampled Values

The SQL statement uses an `ORDER BY ... DESC` clause combined with a `LIMIT` clause to retrieve the last N rows. More
details can be found under within the **CrateDB**
[documentation](https://crate.io/docs/crate/reference/en/latest/sql/statements/select.html).

#### 16 Request:

```bash
curl -iX POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SELECT * FROM mtopeniot.etFillingLevelSensor WHERE entity_id = '\''urn:ngsi-ld:Device:filling001'\''  ORDER BY time_index DESC LIMIT 3"}'
```

#### Response:

```json
{
    "cols": ["filling", "entity_id", "entity_type", "fiware_servicepath", "time_index"],
    "rows": [
        [0.51, "urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 1530263896550],
        [0.43, "urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 1530263894491],
        [0.4, "urn:ngsi-ld:Device:filling001", "FillingLevelSensor", "/", 1530263892483]
    ],
    "rowcount": 3,
    "duration": 18.591
}
```

### CrateDB API - List the Sum of values grouped by a time period

The SQL statement uses a `SUM` function and `GROUP BY` clause to retrieve the relevant data. **CrateDB** offers a range
of
[Date-Time Functions](https://crate.io/docs/crate/reference/en/latest/general/builtins/scalar.html#date-and-time-functions)
to truncate and convert the timestamps into data which can be grouped.

#### 17 Request:

```bash
curl -iX POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SELECT DATE_FORMAT (DATE_TRUNC ('\''minute'\'', time_index)) AS minute, SUM (filling) AS sum FROM mtopeniot.etFillingLevelSensor WHERE entity_id = '\''urn:ngsi-ld:Device:filling001'\'' GROUP BY minute LIMIT 3"}'
```

#### Response:

```json
{
    "cols": ["minute", "sum"],
    "rows": [
        ["2018-06-29T09:17:00.000000Z", 4.37],
        ["2018-06-29T09:34:00.000000Z", 6.23],
        ["2018-06-29T09:08:00.000000Z", 6.51],
        ["2018-06-29T09:40:00.000000Z", 3],
        ...etc
    ],
    "rowcount": 42,
    "duration": 22.9832
}
```

### CrateDB API - List the Minimum Values grouped by a Time Period

The SQL statement uses a `MIN` function and `GROUP BY` clause to retrieve the relevant data. **CrateDB** offers a range
of
[Date-Time Functions](https://crate.io/docs/crate/reference/en/latest/general/builtins/scalar.html#date-and-time-functions)
to truncate and convert the timestamps into data which can be grouped.

#### 18 Request:

```bash
curl -iX POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SELECT DATE_FORMAT (DATE_TRUNC ('\''minute'\'', time_index)) AS minute, MIN (filling) AS min FROM mtopeniot.etFillingLevelSensor WHERE entity_id = '\''urn:ngsi-ld:Device:filling001'\'' GROUP BY minute"}'
```

#### Response:

```json
{
    "cols": ["minute", "min"],
    "rows": [
        ["2018-06-29T09:34:00.000000Z", 0.5],
        ["2018-06-29T09:17:00.000000Z", 0.04],
        ["2018-06-29T09:40:00.000000Z", 0.33],
        ["2018-06-29T09:08:00.000000Z", 0.44],
        ...etc
    ],
    "rowcount": 40,
    "duration": 13.1854
}
```

### CrateDB API - List the Maximum Value over a Time Period

The SQL statement uses a `MAX` function and a `WHERE` clause to retrieve the relevant data. **CrateDB** offers a range
of [Aggregate Functions](https://crate.io/docs/crate/reference/en/latest/general/dql/selects.html#data-aggregation) to
aggregate data in different ways.

#### 19 Request:

```bash
curl -iX POST \
  'http://localhost:4200/_sql' \
  -H 'Content-Type: application/json' \
  -d '{"stmt":"SELECT MAX(filling) AS max FROM mtopeniot.etFillingLevelSensor WHERE entity_id = '\''urn:ngsi-ld:Device:filling001'\'' and time_index >= '\''2018-06-27T09:00:00'\'' and time_index < '\''2018-06-30T23:59:59'\''"}'
```

#### Response:

```json
{
    "cols": ["max"],
    "rows": [[1]],
    "rowcount": 1,
    "duration": 26.7215
}
```

## Accessing Time Series Data Programmatically

Once the JSON response for a specified time series has been retrieved, displaying the raw data is of little use to an
end user. It must be manipulated to be displayed in a bar chart, line graph or table listing. This is not within the
domain of **QuantumLeap** as it not a graphical tool, but can be delegated to a mashup or dashboard component such as
[Wirecloud](https://github.com/FIWARE/catalogue/blob/master/processing/README.md#Wirecloud) or
[Knowage](https://github.com/FIWARE/catalogue/blob/master/processing/README.md#Knowage).

It can also be retrieved and displayed using a third party graphing tool appropriate to your coding environment - for
example [chartjs](http://www.chartjs.org/). An example of this can be found within the `history` controller in the
[Git Repository](https://github.com/FIWARE/tutorials.Step-by-Step/blob/master/context-provider/controllers/history.js).

The basic processing consists of two-step - retrieval and attribute mapping, sample code can be seen below:

```javascript
function readCrateSensorfilling(id, aggMethod) {
    return new Promise(function (resolve, reject) {
        const sqlStatement =
            "SELECT DATE_FORMAT (DATE_TRUNC ('minute', time_index)) AS minute, " +
            aggMethod +
            "(filling) AS " +
            aggMethod +
            " FROM mtopeniot.etFillingLevelSensor WHERE entity_id = 'urn:ngsi-ld:Device:" +
            id +
            "' GROUP BY minute ORDER BY minute";
        const options = {
            method: "POST",
            url: crateUrl,
            headers: { "Content-Type": "application/json" },
            body: { stmt: sqlStatement },
            json: true,
        };
        request(options, (error, response, body) => {
            return error ? reject(error) : resolve(body);
        });
    });
}
```

```javascript
function crateToTimeSeries(crateResponse, aggMethod, hexColor) {
    const data = [];
    const labels = [];
    const color = [];

    if (crateResponse && crateResponse.rows && crateResponse.rows.length > 0) {
        _.forEach(crateResponse.rows, (element) => {
            const date = moment(element[0]);
            data.push({ t: date, y: element[1] });
            labels.push(date.format("HH:mm"));
            color.push(hexColor);
        });
    }

    return {
        labels,
        data,
        color,
    };
}
```

The modified data is then passed to the frontend to be processed by the third party graphing tool. The result is shown
here: `http://localhost:3000/device/history/urn:ngsi-ld:Farm:001`.

## Displaying CrateDB data as a Grafana Dashboard

**CrateDB** has been chosen as the time-series data sink for QuantumLeap, because, among
[many other benefits](https://quantumleap.readthedocs.io/en/latest/), it integrates seamlessly with the
[Grafana](https://grafana.com/) time series analytics tool. Grafana can be used to display the aggregated sensor data -
a full tutorial on building dashboards can be found [here](https://www.youtube.com/watch?v=sKNZMtoSHN4). The simplified
instructions below summarize how to connect and display a graph of the FillingLevelSensor `filling` data.

### Logging in

The `docker-compose` file has started an instance of the Grafana UI listening on port `3003`, so the login page can be
found at: `http://localhost:3003/login`. The default username is `admin` and the default password is `admin`.

### Configuring a Data Source

After logging in, a PostgreSQL datasource must be set up at `http://localhost:3003/datasources` with the following
values:

-   **Name** `CrateDB`.
-   **Host** `crate-db:5432`.
-   **Database** `mtopeniot`.
-   **User** `crate`.
-   **SSL Mode** `disable`.

![](https://fiware.github.io/tutorials.Time-Series-Data/img/grafana-crate-connect.png)

Click on the Save and test button and make sure it says _Database Connection OK_.

### Configuring a Dashboard

To display a new dashboard, you can either click the **+** button and select **Dashboard** or go directly to
`http://localhost:3003/dashboard/new?orgId=1`. Thereafter, click **Add Query**.

The following values in **bold text** need to be placed in the graphing wizard:

-   Queries to **CrateDB** (the previously created Data Source).
-   FROM **etFillingLevelSensor**.
-   Time column **time_index**.
-   Metric column **entity_id**.
-   Select value **column:filling**.

![](https://fiware.github.io/tutorials.Time-Series-Data/img/grafana-lamp-graph.png)

Then click on `ESC` on your keyboard and you will see a dashboard including the graph you created.

The click on the `Add Panel` button and select `Choose Visualisation` and pick `Map panel`.

In the map layout options set the following values:

-   Center: **custom**.
-   Latitude: **52.5031**.
-   Longitude: **13.4447**.
-   Initial Zoom: **12**.

![](https://fiware.github.io/tutorials.Time-Series-Data/img/grafana-lamp-map-config-1.png)

Click on `Queries` tab on the left and set as follows:

-   Format as: **Table**.
-   FROM **etFillingLevelSensor**.
-   Time column **time_index**.
-   Metric column **entity_id**.
-   Select value:
    -   **column:filling** **alias:value**.
    -   **column:location** **alias:geojson**.
    -   **column:entity_type** **alias:type**.

![](https://fiware.github.io/tutorials.Time-Series-Data/img/grafana-lamp-map-config-2.png)

Click on `Visualisation` tab on the left and set as follows:

-   Map Layers:
    -   FillingLevelSensor:
        -   Icon: **lightbulb-o**.
        -   ClusterType: **average**.
        -   ColorType: **fix**.
        -   Column for value: **value**.
        -   Maker color: **red**.

![](https://fiware.github.io/tutorials.Time-Series-Data/img/grafana-lamp-map-config-3.png)

The final result can be seen below:

![](https://fiware.github.io/tutorials.Time-Series-Data/img/grafana-result.png)
