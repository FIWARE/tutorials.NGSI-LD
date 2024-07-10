[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_cim009v010801p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/) <br/>

**Description:** This tutorial introduces the concise NGSI-LD format and demonstrates its use and explains the
differences between concise and normalized NGSI-LD payloads.

The tutorial uses [cUrl](https://ec.haxx.se/) commands throughout, but is also available as
[Postman documentation](https://fiware.github.io/tutorials.Concise-Format/ngsi-ld.html)

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/d24facc3c430bb5d5aaf)

# Concise NGSI-LD Payloads

> "To speak much is one thing; to speak to the point another!"
>
> — Sophocles, Oedipus at Colonus

The NGSI-LD API is a flexible mechanism for producing context data in multiple formats. This was demonstrated in the
initial Getting Started [tutorial](working-with-@context.md) where both "normalized" and "key-values" pairs format were
produced. The default, verbose data format is so-called "normalized" NGSI-LD where every **Property** is defined by
`"type": "Property"` and every **Relationship** is defined by `"type": "Relationship"`. These keywords ( `type`,
`Property` and `Relationship`) are in turn strictly defined JSON-LD terms which can be found in the core @context served
with every request.

## NGSI-LD Payloads

### Normalized NGSI-LD

The full "normalized" form is an excellent choice for data exchange, since through the `@context` and the definition of
JSON-LD keywords, machines are given all the tools to fully comprehend the payload format. Responses return the complete
current state of each entity, with payloads all including sub-attributes such as Properties-of-Properties,
Properties-of-Relationships and other standard metadata terms like `observedAt` and `unitCode`. Furthermore normalized
payloads are exceedingly regular and parseable, and can easily be reduced down to the relevant `value` elements if such
an operation necessary. However with the normalized format, is necessary to repeatedly supply common defining attributes
such as `"type": "Property"` throughout the payload to ensure that machines can fully understand the data represented.

#### Normalized NGSI-LD using `options=normalized`

```json
{
    "@context": [
        "https://fiware.github.io/tutorials.Step-by-Step/example.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.6.jsonld"
    ],
    "id": "urn:nsgi-ld:Beatle:John_Lennon",
    "type": "Beatle",
    "age": { "type": "Property", "value": 40, "unitCode": "ANN" },
    "name": { "type": "Property", "value": "John Lennon" },
    "born": { "type": "Property", "value": "1940-10-09" },
    "spouse": {
        "type": "Relationship",
        "object": "urn:nsgi-ld:Person:Cynthia_Lennon"
    },
    "location": {
        "type": "GeoProperty",
        "value": {
            "type": "Point",
            "coordinates": [-73.975, 40.775556]
        }
    }
}
```

Open in [**JSON-LD Playground**](https://tinyurl.com/4nw9z83m)

### Simplified NGSI-LD

The use of the normalized format can be contrast with the "key-values" pairs format, which is a simplified version
concentrating purely on the values of the first level of attributes only. The payloads remain regular, but are much
shorter and to the point, and not all information is returned by the request - second level attributes such as
`unitCode` and `observedAt` will not be returned in the payload for example.

#### Simplified NGSI-LD using `options=keyValues`

```json
{
    "@context": [
        "https://fiware.github.io/tutorials.Step-by-Step/example.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.6.jsonld"
    ],
    "id": "urn:nsgi-ld:Beatle:John_Lennon",
    "name": "John Lennon",
    "born": "1940-10-09",
    "spouse": "urn:nsgi-ld:Person:Cynthia_Lennon",
    "age": 40,
    "location": {
        "type": "Point",
        "coordinates": [-73.975, 40.775556]
    }
}
```

Open in [**JSON-LD Playground**](https://tinyurl.com/2p93h8p6)

This key-values payload matches the simple JSON-LD payload which can be seen on the front-page of the official
[JSON-LD site](https://json-ld.org/).

Both normalized and key-values NGSI-LD formats are valid JSON-LD, but since the key-values format is lossy, until
recently, all updates to an NGSI-LD context broker must be made using the normalized format.

### Concise NGSI-LD

To make the API easier to use and reduce the burden on developers, NGSI-LD now accepts an intermediate "concise" format
which still offers all of the context data in the payload, but removes the redundancy of repeatedly adding
`"type": "Property"` throughout each payload. The concise representation is a terser, lossless form of the normalized
representation, where redundant "type" members are omitted and the following rules are applied:

-   Every **Property** without further sub-attributes is represented by the Property value only.
-   Every **Property** that includes further sub-attributes is represented by a value key-value pair.
-   Every **GeoProperty** without further sub-attributes is represented by the GeoProperty’s GeoJSON representation only
-   Every **GeoProperty** that includes further sub-attributes is represented by a value key-value pair.
-   Every **LanguageProperty** is defined by a `languageMap` key-value pair.
-   Every **Relationship** is defined by an `object` key-value pair.

#### Concise NGSI-LD using `options=concise`

```json
{
    "@context": [
        "https://fiware.github.io/tutorials.Step-by-Step/example.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.6.jsonld"
    ],
    "id": "urn:nsgi-ld:Beatle:John_Lennon",
    "name": "John Lennon",
    "born": "1940-10-09",
    "spouse": {
        "object": "urn:nsgi-ld:Person:Cynthia_Lennon"
    },
    "age": { "value": 40, "unitCode": "ANN" },
    "location": {
        "type": "Point",
        "coordinates": [-73.975, 40.775556]
    }
}
```

Open in [**JSON-LD Playground**](https://tinyurl.com/32shtpp6)

It can be seen from the payload above that the concise format (like normalized) is also lossless as it still includes
Properties-of-Properties like `unitCode` (the units of the `age` attribute is obviously years following the UN/CEFACT
code `ANN` for example) and also clearly distinguishes between **Properties** and **Relationships** (since
**Relationships** always have an `object`).

In summary, all NGSI-LD formats provide a structured, well-defined payloads, but the "normalized" format is verbose and
lossless, "key-values" is short and lossy, and third format - "concise" is a secondary, intermediate lossless format
designed to bridge the gap between the two.

#### Device Monitor

For the purpose of this tutorial, a series of dummy agricultural IoT devices have been created, which will be attached
to the context broker. Details of the architecture and protocol used can be found in the
[IoT Sensors tutorial](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD) The state of each device can be
seen on the UltraLight device monitor web page found at: `http://localhost:3000/device/monitor`.

![FIWARE Monitor](https://fiware.github.io/tutorials.Concise-Format/img/farm-devices.png)

![](https://fiware.github.io/tutorials.Concise-Format/img/history-graphs.png)

## Architecture

This application builds on the components and dummy IoT devices created in
[previous tutorials](https://github.com/FIWARE/tutorials.IoT-Agent/). It will use two FIWARE components: the
[Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) and the
[IoT Agent for Ultralight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/).

Therefore the overall architecture will consist of the following elements:

-   The **FIWARE Generic Enablers**:

    -   The [Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) which will receive requests using
        [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
    -   The FIWARE [IoT Agent for UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/) which will
        receive southbound requests using
        [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
        and convert them to
        [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
        commands for the devices

-   A [MongoDB](https://www.mongodb.com/) database:

    -   Used by the **Orion Context Broker** to hold context data information such as data entities, subscriptions and
        registrations
    -   Used by the **IoT Agent** to hold device information such as device URLs and Keys

-   An HTTP **Web-Server** which offers static `@context` files defining the context entities within the system.
-   The **Tutorial Application** does the following:
    -   Acts as set of dummy [agricultural IoT devices](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD)
        using the
        [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
        protocol running over HTTP.

Since all interactions between the elements are initiated by HTTP requests, the entities can be containerized and run
from exposed ports.

The overall architecture can be seen below:

![](https://fiware.github.io/tutorials.Concise-Format/img/architecture.png)

The necessary configuration information can be seen in the services section of the associated `docker-compose.yml` file.
It has been described in a previous tutorial.

### Video: Concise Payloads

[![](https://fiware.github.io/tutorials.NGSI-LD/img/video-logo.png)](https://www.youtube.com/watch?v=-XPGyM7K_kU&t=605s "NGSI-LD Concise")

Click on the image above to watch a demo of this tutorial describing how to use the NGSI-LD Concise format

## Start Up

Before you start, you should ensure that you have obtained or built the necessary Docker images locally. Please clone
the repository and create the necessary images by running the commands as shown:

```bash
git clone https://github.com/FIWARE/tutorials.Concise-Format.git
cd tutorials.Concise-Format
git checkout NGSI-LD

./services create
```

Thereafter, all services can be initialized from the command-line by running the
[services](https://github.com/FIWARE/tutorials.Concise-Format/blob/NGSI-LD/services) Bash script provided within the
repository. To start the system with your preferred [context broker](https://www.fiware.org/catalogue/#components), run
the following command:

```bash
./services [orion|scorpio|stellio]
```

> **Note:** If you want to clean up and start over again you can do so with the following command:
>
> ```
> ./services stop
> ```

---

## Concise NGSI-LD Operations

Any context-broker operation which uses a normalized NGSI-LD payload can also be triggered using a concise payload.

## Create Operations

Create Operations map to HTTP POST.

-   The `/ngsi-ld/v1/entities` endpoint is used for creating new entities
-   The `/ngsi-ld/v1/entities/<entity-id>/attrs` endpoint is used for adding new attributes

Any newly created entity must have `id` and `type` attributes and a valid `@context` definition. All other attributes
are optional and will depend on the system being modelled. If additional attributes are present though, a concise
**Property** must be encapsulated within a `value`. If a **Relationship** is added it must be encapsulated within an
`object`.

The response will be **201 - Created** if the operation is successful or **409 - Conflict** if the operation fails.

### Create a New Data Entity

This example adds a new **TemperatureSensor** entity to the context.

#### 1 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entities/' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
      "id": "urn:ngsi-ld:TemperatureSensor:001",
      "type": "TemperatureSensor",
      "category": "sensor",
      "temperature": {
            "value": 25,
            "unitCode": "CEL"
      }
}'
```

New entities can be added by making a POST request to the `/ngsi-ld/v1/entities` endpoint. Notice that because
`category` has no sub-attributes, it does not require a `value` element.

As usual, the request will fail if the entity already exists in the context.

#### 2 Request:

You can check to see if the new **TemperatureSensor** can be found in the context by making a GET request. This returns
the full normalized form:

```bash
curl -L -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

### Create New Attributes

This example adds a new `batteryLevel` Property and a `controlledAsset` Relationship to the existing
**TemperatureSensor** entity with `id=urn:ngsi-ld:TemperatureSensor:001`.

#### 3 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
       "batteryLevel": {
            "value": 0.8,
            "unitCode": "C62"
      },
      "controlledAsset": {
            "object": "urn:ngsi-ld:Building:barn002"
      }
}'
```

New attributes can be added by making a POST request to the `/ngsi-ld/v1/entities/<entity>/attrs` endpoint.

The payload should consist of a JSON object holding the attribute names and values as shown.

All **Property** attributes with additional sub-attributes must have a `value` associated with them. All
**Relationship** attributes must have an `object` associated with them which holds the URN of another entity.
Well-defined common metadata elements such as `unitCode` can be provided as strings, all other metadata should be passed
as a JSON object with its own `type` and `value` attributes.

Subsequent requests using the same `id` will update the value of the attribute in the context.

#### 4 Request:

You can check to see if the new **TemperatureSensor** can be found in the context by making a GET request.

```bash
curl -L -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

As you can see there are now two additional attributes (`batteryLevel` and `controlledAsset`) added to the entity. These
attributes have been defined in the `@context` as part of the **Device** model and therefore can be read using their
short names.

### Batch Create New Data Entities or Attributes

This example uses the convenience batch processing endpoint to add three new **TemperatureSensor** entities to the
context. Batch create uses the `/ngsi-ld/v1/entityOperations/create` endpoint.

#### 5 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/create' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/ld+json' \
--data-raw '[
    {
      "id": "urn:ngsi-ld:TemperatureSensor:002",
      "type": "TemperatureSensor",
      "category": ["sensor"],
      "temperature": {
            "value": 20,
            "unitCode": "CEL"
      }
    },
    {
      "id": "urn:ngsi-ld:TemperatureSensor:003",
      "type": "TemperatureSensor",
      "category":  ["sensor" , "actuator"],
      "temperature": {
            "value": 2,
            "unitCode": "CEL"
      }
    },
     {
      "id": "urn:ngsi-ld:TemperatureSensor:004",
      "type": "TemperatureSensor",
      "category": {
            "type": "Property",
            "value": "sensor"
      },
      "temperature": {
            "type": "Property",
            "value": 100,
            "unitCode": "CEL"
      }
    }
]'
```

It can be seen that `"type": "Property"` can be optionally added to concise payloads and the format is still recognized.
This means that any normalized payload automatically a valid concise payload. Care should be taken when adding arrays
using NGSI-LD due to the existing constraints of JSON-LD. Effectively there is no difference between an array of one
entry `"category": ["sensor"]` and a simple string value `"category": "sensor"`. Furthermore, order within the array is
not maintained.

> **Note:** In NGSI-LD, an ordered array value could be encoded as a JSON Literal
> `"category" : {"@type": "@json", "@value":[1,2,3]}`.

The request will fail if any of the attributes already exist in the context. The response highlights which actions have
been successful and the reason for failure (if any has occurred).

```json
{
    "@context": [
        "http://context/user-context.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ],
    "success": [
        "urn:ngsi-ld:TemperatureSensor:002",
        "urn:ngsi-ld:TemperatureSensor:003",
        "urn:ngsi-ld:TemperatureSensor:004"
    ],
    "errors": []
}
```

### Batch Create/Overwrite New Data Entities

This example uses the convenience batch processing endpoint to add or amend two **TemperatureSensor** entities in the
context.

-   if an entity already exists, the request will update that entity's attributes.
-   if an entity does not exist, a new entity will be created.

#### 6 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/upsert' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/ld+json' \
--data-raw '[
    {
      "id": "urn:ngsi-ld:TemperatureSensor:002",
      "type": "TemperatureSensor",
      "category": "sensor",
      "temperature": {
            "value": 21,
            "unitCode": "CEL"
      }
    },
    {
      "id": "urn:ngsi-ld:TemperatureSensor:003",
      "type": "TemperatureSensor",
      "category":  "sensor",
      "temperature": {
            "type": "Property",
            "value": 27,
            "unitCode": "CEL"
      }
    }
]'
```

Batch processing for create/overwrite uses the `/ngsi-ld/v1/entityOperations/upsert` endpoint.

A subsequent request containing the same data (i.e. same entities and `actionType=append`) will also succeed won't
change the context state. The `modifiedAt` metadata will be amended however.

## Read Operations

-   The `/ngsi-ld/v1/entities` endpoint is used for listing entities
-   The `/ngsi-ld/v1/entities/<entity>` endpoint is used for retrieving the details of a single entity.

For read operations the `@context` must be supplied in a `Link` header.

### Filtering

-   The `options` parameter (combined with the `attrs` parameter) can be used to filter the returned fields
-   The `q` parameter can be used to filter the returned entities

### Read a Data Entity (concise)

This example reads the state of an existing **TemperatureSensor** entity with a known `id` and returns in concise
format.

#### 7 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'options=concise,sysAttrs'
```

#### Response:

> **Tip:** Use [jq](https://www.digitalocean.com/community/tutorials/how-to-transform-json-data-with-jq) to format the
> JSON responses in this tutorial. Pipe the result by appending
>
> ```
> | jq '.'
> ```

TemperatureSensor `urn:ngsi-ld:TemperatureSensor:001` is returned as _concise_ NGSI-LD. Additional metadata is returned
because `options=sysAttrs`. By default the `@context` is returned in the payload body (although this could be moved due
to content negotiation if the `Accept:application/json` had been set). The full response is shown below:

```json
{
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "createdAt": "2020-08-27T14:33:06Z",
    "modifiedAt": "2020-08-27T14:33:10Z",
    "category": {
        "createdAt": "2020-08-27T14:33:06Z",
        "modifiedAt": "2020-08-27T14:33:06Z",
        "value": "sensor"
    },
    "temperature": {
        "createdAt": "2020-08-27T14:33:06Z",
        "modifiedAt": "2020-08-27T14:33:06Z",
        "value": 25,
        "unitCode": "CEL"
    },
    "batteryLevel": {
        "value": 0.8,
        "createdAt": "2020-08-27T14:33:10Z",
        "modifiedAt": "2020-08-27T14:33:10Z",
        "unitCode": "C62"
    },
    "controlledAsset": {
        "object": "urn:ngsi-ld:Building:barn002",
        "createdAt": "2020-08-27T14:33:10Z",
        "modifiedAt": "2020-08-27T14:33:10Z"
    }
}
```

Individual context data entities can be retrieved by making a GET request to the `/ngsi-ld/v1/entities/<entity>`
endpoint.

### Read an Attribute from a Data Entity

This example reads the value of a single attribute (`temperature`) from an existing **TemperatureSensor** entity with a
known `id`.

#### 8 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'attrs=temperature'
```

#### Response:

The sensor `urn:ngsi-ld:TemperatureSensor:001` is reading at 25°C. The response is shown below:

```json
{
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "temperature": {
        "value": 25,
        "unitCode": "CEL"
    }
}
```

Because `options=concise` was used this is response includes the metadata such as `unitCode` but not
`"type": "Property"` Context data can be retrieved by making a GET request to the `/ngsi-ld/v1/entities/<entity-id>`
endpoint and selecting the `attrs` using a comma separated list.

### Read a Data Entity (concise)

This example reads the concise NGSI-LD format from the context of an existing **TemperatureSensor** entities with a
known `id`.

#### 9 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json' \
-d 'options=concise'
```

#### Response:

The sensor `urn:ngsi-ld:TemperatureSensor:001` is reading at 25°C. The response is shown below:

```json
{
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "category": "sensor",
    "temperature": {
        "value": 25,
        "unitCode": "CEL"
    },
    "batteryLevel": {
        "value": 0.8,
        "unitCode": "C62"
    },
    "controlledAsset": {
        "object": "urn:ngsi-ld:Building:barn002"
    }
}
```

The response contains an unfiltered list of context data from an entity containing all of the attributes of the
`urn:ngsi-ld:TemperatureSensor:001`. The payload body does not contain an `@context` attribute since the
`Accept: application/json` was set.

Combine the `options=concise` parameter with the `attrs` parameter to retrieve a limited set of key-value pairs.

### Read Multiple attributes values from a Data Entity

This example reads the value of two attributes (`category` and `temperature`) from the context of an existing
**TemperatureSensor** entity with a known `id`.

#### 10 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json' \
-d 'options=concise' \
-d 'attrs=category,temperature'
```

#### Response:

The sensor `urn:ngsi-ld:TemperatureSensor:001` is reading at 25°C. The response is shown below:

```json
{
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "category": "sensor",
    "temperature": {
        "value": 25,
        "unitCode": "CEL"
    }
}
```

Combine the `options=concise` parameter and the `attrs` parameter to return a list of values.

### List all Data Entities (concise)

This example lists the full context of all **TemperatureSensor** entities.

#### 11 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'type=TemperatureSensor' \
-d 'options=concise'
```

#### Response:

On start-up the context was empty, four **TemperatureSensor** entities have been added by create operations so the full
context will now contain four sensors.

```json
[
    {
        "id": "urn:ngsi-ld:TemperatureSensor:004",
        "type": "TemperatureSensor",
        "category": "sensor",
        "temperature": {
            "value": 100,
            "unitCode": "CEL"
        }
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:002",
        "type": "TemperatureSensor",
        "category": "sensor",
        "temperature": {
            "value": 21,
            "unitCode": "CEL"
        }
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:003",
        "type": "TemperatureSensor",
        "category": "sensor",
        "temperature": {
            "type": "Property",
            "value": 27,
            "unitCode": "CEL"
        }
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:001",
        "type": "TemperatureSensor",
        "batteryLevel": {
            "value": 0.8,
            "unitCode": "C62"
        },
        "category": "sensor",
        "controlledAsset": {
            "object": "urn:ngsi-ld:Building:barn002"
        },
        "temperature": {
            "value": 25,
            "unitCode": "CEL"
        }
    }
]
```

### List all Data Entities (filtered)

This example lists the `temperature` attribute of all **TemperatureSensor** entities in concise format.

#### 12 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json' \
-d 'type=TemperatureSensor' \
-d 'options=concise' \
-d 'attrs=temperature'
```

#### Response:

The full context contains four sensors, they are returned in a random order:

```json
[
    {
        "id": "urn:ngsi-ld:TemperatureSensor:004",
        "type": "TemperatureSensor",
        "temperature": {
            "value": 100,
            "unitCode": "CEL"
        }
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:002",
        "type": "TemperatureSensor",
        "temperature": {
            "value": 21,
            "unitCode": "CEL"
        }
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:003",
        "type": "TemperatureSensor",
        "temperature": {
            "value": 27,
            "unitCode": "CEL"
        }
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:001",
        "type": "TemperatureSensor",
        "temperature": {
            "value": 25,
            "unitCode": "CEL"
        }
    }
]
```

Context data for a specified entity type can be retrieved by making a GET request to the `/ngsi-ld/v1/entities/`
endpoint and supplying the `type` parameter, combine this with the `options=keyValues` parameter and the `attrs`
parameter to retrieve key-values.

### Filter Data Entities by ID

This example lists selected data from two **TemperatureSensor** entities chosen by `id`. Note that every `id` must be
unique, so `type` is not required for this request. To filter by `id` add the entries in a comma delimited list.

#### 13 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/'' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: 'application/json' \
-d 'id=urn:ngsi-ld:TemperatureSensor:001,urn:ngsi-ld:TemperatureSensor:002' \
-d 'attrs=temperature' \
-d 'options=concise'
```

#### Response:

The response details the selected attributes from the selected entities.

```json
[
    {
        "id": "urn:ngsi-ld:TemperatureSensor:002",
        "type": "TemperatureSensor",
        "temperature": {
            "value": 21,
            "unitCode": "CEL"
        }
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:001",
        "type": "TemperatureSensor",
        "temperature": {
            "value": 25,
            "unitCode": "CEL"
        }
    }
]
```

### Returning data as GeoJSON

The concise format is also available for the GeoJSON format which can be requested by setting the `Accept` header to
`application/geo+json` and setting the `options=concise` parameter.

#### 14 Request:

```bash
curl -G -iX GET 'http://localhost:1026//ngsi-ld/v1/entities/' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/geo+json' \
-H 'NGSILD-Tenant: openiot' \
-d 'id=urn:ngsi-ld:Animal:pig010,urn:ngsi-ld:Animal:pig006' \
-d 'options=concise'
```

#### Response:

The response details the selected attributes from the selected entities is returned as a GeoJSON feature collection. The
`properties` section holds data in concise format.

```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "id": "urn:ngsi-ld:Animal:pig010",
            "type": "Feature",
            "properties": {
                "type": "Animal",
                "heartRate": {
                    "value": 71,
                    "providedBy": {
                        "object": "urn:ngsi-ld:Device:pig010"
                    },
                    "observedAt": "2022-03-01T15:49:57.039Z",
                    "unitCode": "5K"
                },
                "phenologicalCondition": "femaleAdult",
                "reproductiveCondition": "active",
                "name": "Carnation",
                "legalID": "M-sow010-Carnation",
                "sex": "female",
                "species": "pig",
                "location": {
                    "value": {
                        "type": "Point",
                        "coordinates": [13.346, 52.52]
                    },
                    "providedBy": {
                        "object": "urn:ngsi-ld:Device:pig010"
                    },
                    "observedAt": "2022-03-01T15:49:57.039Z"
                }
            },
            "geometry": {
                "type": "Point",
                "coordinates": [13.346, 52.52]
            }
        },
        {
            "id": "urn:ngsi-ld:Animal:pig006",
            "type": "Feature",
            "properties": {
                "type": "Animal",
                "heartRate": {
                    "value": 62,
                    "providedBy": {
                        "object": "urn:ngsi-ld:Device:pig006"
                    },
                    "observedAt": "2022-03-01T15:49:57.287Z",
                    "unitCode": "5K"
                },
                "phenologicalCondition": "femaleAdult",
                "reproductiveCondition": "inCalf",
                "name": "Peach",
                "legalID": "M-sow006-Peach",
                "sex": "female",
                "species": "pig",
                "location": {
                    "value": {
                        "type": "Point",
                        "coordinates": [13.347, 52.522]
                    },
                    "providedBy": {
                        "object": "urn:ngsi-ld:Device:pig006"
                    },
                    "observedAt": "2022-03-01T15:49:57.287Z"
                }
            },
            "geometry": {
                "type": "Point",
                "coordinates": [13.347, 52.522]
            }
        }
    ]
}
```

## Update Operations

Overwrite operations are mapped to HTTP PATCH:

-   The `/ngsi-ld/v1/entities/<entity-id>/attrs/<attribute>` endpoint is used to update an attribute
-   The `/ngsi-ld/v1/entities/<entity-id>/attrs` endpoint is used to update multiple attributes

### Overwrite the value of an Attribute value

This example updates the value of the `category` attribute of the Entity with `id=urn:ngsi-ld:TemperatureSensor:001`.

#### 15 Request:

```bash
curl -iX PATCH 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs/category' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
    "value": ["sensor", "actuator"]
}'
```

Existing attribute values can be altered by making a PATCH request to the
`/ngsi-ld/v1/entities/<entity-id>/attrs/<attribute>` endpoint. The appropriate `@context` should be supplied as a `Link`
header. The only difference between a normalized and concise payload is the missing `type` attribute.

### Overwrite Multiple Attributes of a Data Entity

This example simultaneously updates the values of both the `category` and `controlledAsset` attributes of the Entity
with `id=urn:ngsi-ld:TemperatureSensor:001`.

#### 16 Request:

```bash
curl -iX PATCH 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
      "category": {
            "value": [
                  "sensor",
                  "actuator"
            ]
      },
      "controlledAsset": {
            "object": "urn:ngsi-ld:Building:barn001"
      }
}'
```

### Batch Update Attributes of Multiple Data Entities

This example uses the convenience batch processing endpoint to update existing sensors.

#### 17 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/upsert?options=update' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '[
  {
    "id": "urn:ngsi-ld:TemperatureSensor:003",
    "type": "TemperatureSensor",
    "category": [
        "actuator",
        "sensor"
    ]
  },
  {
    "id": "urn:ngsi-ld:TemperatureSensor:004",
    "type": "TemperatureSensor",
    "category":  [
        "actuator",
        "sensor"
    ]
  }
]'
```

Batch processing uses the `/ngsi-ld/v1/entityOperations/upsert` endpoint. The payload body holds an array of the
entities and attributes we wish to update. The `options=update` parameter indicates we will not remove existing
attributes if they already exist and have not been included in the payload.

An alternative would be to use the `/ngsi-ld/v1/entityOperations/update` endpoint. Unlike `upsert`, the `update`
operation will not silently create any new entities - it fails if the entities do not already exist.

### Batch Replace Entity Data

This example uses the convenience batch processing endpoint to replace entity data of existing sensors.

#### 18 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/update?options=replace' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '[
  {
    "id": "urn:ngsi-ld:TemperatureSensor:003",
    "type": "TemperatureSensor",
    "category":[
        "actuator",
        "sensor"
      ]
  },
  {
    "id": "urn:ngsi-ld:TemperatureSensor:004",
    "type": "TemperatureSensor",
    "temperature": {
      "value": 16,
      "unitCode": "CEL"
      "observedAt": "2022-03-01T15:00:00.000Z"
    }
  }
]'
```

Batch processing uses the `/ngsi-ld/v1/entityOperations/update` endpoint with a payload with the `options=replace`
parameter, this means we will overwrite existing entities. `/ngsi-ld/v1/entityOperations/upsert` could also be used if
new entities are also to be created.

## Setting up concise Subscriptions

### Concise Notification

The concise format can also be used when generating a notification from a subscription. Simply set the
`"format": "concise"` within the `notification` element as shown:

#### 19 Request:

```bash
curl -iX POST
 'http://{{orion}}/ngsi-ld/v1/subscriptions/' \
-H 'Content-Type: application/ld+json' \
-H 'NGSILD-Tenant: openiot' \
--data-raw '{
  "description": "Notify me of low feedstock on Farm:001",
  "type": "Subscription",
  "entities": [{"id": "urn:ngsi-ld:Animal:pig003", "type": "Animal"}],
  "notification": {
    "format": "concise",
    "endpoint": {
      "uri": "http://tutorial:3000/subscription/low-stock-farm001-ngsild",
      "accept": "application/json"
    }
  },
   "@context": "http://context/user-context.jsonld"
}'
```

Then go to the Device Monitor `http://localhost:3000/app/farm/urn:ngsi-ld:Building:farm001` and remove some hay from the
barn. Eventually a request is sent to `subscription/low-stock-farm001` as shown:

#### `http://localhost:3000/app/monitor`

#### Subscription Payload:

```json
{
    "id": "urn:ngsi-ld:Notification:6220b4e464f3729a8527f8a0",
    "type": "Notification",
    "subscriptionId": "urn:ngsi-ld:Subscription:6220b4a964f3729a8527f88c",
    "notifiedAt": "2022-03-03T12:30:28.237Z",
    "data": [
        {
            "id": "urn:ngsi-ld:Animal:pig003",
            "type": "Animal",
            "heartRate": {
                "value": 67,
                "unitCode": "5K",
                "observedAt": "2022-03-03T12:30:27.000Z",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:pig003"
                }
            },
            "phenologicalCondition": "maleAdult",
            "reproductiveCondition": "active",
            "name": "Flamingo",
            "legalID": "M-boar003-Flamingo",
            "sex": "male",
            "species": "pig",
            "location": {
                "value": {
                    "type": "Point",
                    "coordinates": [13.357, 52.513]
                },
                "observedAt": "2022-03-03T12:30:27.000Z",
                "providedBy": {
                    "object": "urn:ngsi-ld:Device:pig003"
                }
            }
        }
    ]
}
```

### Concise GeoJSON Notification

#### 20 Request:

It is also possible to send GeoJSON notifications if the `"accept": "application/geo+json"` attribute is set. Combining
this with `"format": "concise"` results in a `FeatureCollection` with properties in concise format.

```bash
curl -iX POST
 'http://{{orion}}/ngsi-ld/v1/subscriptions/' \
-H 'Content-Type: application/ld+json' \
-H 'NGSILD-Tenant: openiot' \
--data-raw '{
  "description": "Notify me of low feedstock on Farm:001",
  "type": "Subscription",
  "entities": [{"id": "urn:ngsi-ld:Animal:pig003", "type": "Animal"}],
  "notification": {
    "format": "concise",
    "endpoint": {
      "uri": "http://tutorial:3000/subscription/low-stock-farm001-ngsild",
      "accept": "application/geo+json"
    }
  },
   "@context": "http://context/user-context.jsonld"
}'
```

#### Subscription Payload:

The result of a concise GeoJSON notification can be seen below.

```json
{
    "id": "urn:ngsi-ld:Notification:6220b50264f3729a8527f8ab",
    "type": "Notification",
    "subscriptionId": "urn:ngsi-ld:Subscription:6220b47764f3729a8527f886",
    "notifiedAt": "2022-03-03T12:30:58.294Z",
    "data": {
        "type": "FeatureCollection",
        "features": [
            {
                "id": "urn:ngsi-ld:Animal:pig003",
                "type": "Feature",
                "properties": {
                    "type": "Animal",
                    "heartRate": {
                        "value": 63,
                        "unitCode": "5K",
                        "observedAt": "2022-03-03T12:30:58.000Z",
                        "providedBy": {
                            "object": "urn:ngsi-ld:Device:pig003"
                        }
                    },
                    "phenologicalCondition": "maleAdult",
                    "reproductiveCondition": "active",
                    "name": "Flamingo",
                    "legalID": "M-boar003-Flamingo",
                    "sex": "male",
                    "species": "pig",
                    "location": {
                        "value": {
                            "type": "Point",
                            "coordinates": [13.357, 52.513]
                        },
                        "observedAt": "2022-03-03T12:30:58.000Z",
                        "providedBy": {
                            "object": "urn:ngsi-ld:Device:pig003"
                        }
                    }
                },
                "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.6.jsonld",
                "geometry": {
                    "value": {
                        "type": "Point",
                        "coordinates": [13.357, 52.513]
                    },
                    "observedAt": "2022-03-03T12:30:58.000Z",
                    "providedBy": {
                        "object": "urn:ngsi-ld:Device:pig003"
                    }
                }
            }
        ]
    }
}
```
