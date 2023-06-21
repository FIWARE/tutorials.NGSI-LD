[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/) <br/>

**Description:** This tutorial teaches **NGSI-LD** users about CRUD Operations. The tutorial outlines example usage of
the various ways of amending context as detailed within the
[NGSI-LD specification](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf). A
series of entities representing temperature sensors are created, modified and deleted based on the temperature sensor
model defined in an [earlier tutorial](https://github.com/FIWARE/tutorials.Understanding-At-Context).

The tutorial uses [cUrl](https://ec.haxx.se/) commands throughout, but is also available as
[Postman documentation](https://fiware.github.io/tutorials.CRUD-Operations/ngsi-ld.html).

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/cc52b59aaf5a55d04b42)

<hr class="core"/>

# NGSI-LD CRUD Operations

> “Ninety-percent of everything is crud.”
>
> ― Theodore Sturgeon, Venture Science Fiction Magazine

**CRUD** Operations (**Create**, **Read**, **Update** and **Delete**) are the four basic functions of persistent
storage. For a smart system based on **NGSI-LD**, **CRUD** actions allow the developer to manipulate the context data
within the system. Every **CRUD** operation is clearly defined within the
[NGSI-LD specification](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf), so all
NGSI-LD compliant context brokers offer the same interface with the same NGSI-LD operations.

This tutorial will describe the rationale behind each operation, when to use it and how to execute the various **CRUD**
operations. Since **NGSI-LD** is based on **JSON-LD** passing of `@context` as part of each request in mandatory. For
**CRUD** operations this is typically passed as a `Link` header, although as we have seen is also possible to pass an
`@context` attribute as part of the body of the request if `Content-Type: application/ld+json`. However, for GET
requests, the `@context` cannot be placed in the payload body technique as GET requests have nobody.

<h3>Context Entity CRUD Operations</h3>

There are four endpoints used for CRUD operations on an individual data entity. These follow the usual rules for
hierarchical entities within RESTful applications.

For operations where the `<entity-id>` is not yet known within the context, or is unspecified, the
`/ngsi-ld/v1/entities` endpoint is used. As an example, this is used for creating new entities.

Once an `<entity-id>` is known within the context, individual data entities can be manipulated using the
`/ngsi-ld/v1/entities/<entity-id>` endpoint.

General Attribute operations on a known entity occur on the `/ngsi-ld/v1/entities/<entity-id>/attrs` endpoint and
operations on individual attributes occur on the `/ngsi-ld/v1/entities/<entity-id>/attrs/<attr-id>`.

When requesting data or modifying individual entities, the various CRUD operations map naturally to HTTP verbs.

-   **GET** - for reading data.
-   **POST** - for creating new entities and attributes.
-   **PATCH** - for amending entities and attributes.
-   **DELETE** - for deleting entities and attributes.

<h3>Context Entity Batch Operations</h3>

Batch operations allow users to modify multiple data entities with a single request. All batch operations are mapped to
the **POST** HTTP verb.

-   `/entityOperations/create`
-   `/entityOperations/update`
-   `/entityOperations/upsert`
-   `/entityOperations/delete`

## Architecture

The demo application will send and receive NGSI-LD calls to a compliant context broker. Since the standardized NGSI-LD
interface is available across multiple context brokers, so we only need to pick one - for example the
[Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/). The application will therefore only make use of
one FIWARE component.

Currently, the Orion Context Broker relies on open source [MongoDB](https://www.mongodb.com/) technology to keep
persistence of the context data it holds.

To promote interoperability of data exchange, NGSI-LD context brokers explicitly expose a
[JSON-LD `@context` file](https://json-ld.org/spec/latest/json-ld/#the-context) to define the data held within the
context entities. This defines a unique URI for every entity type and every attribute so that other services outside the
NGSI domain are able to pick and choose the names of their data structures. Every `@context` file must be available on
the network. In our case the tutorial application will be used to host a series of static files.

Therefore, the architecture will consist of three elements:

-   The [Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) which will receive requests using
    [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json).
-   The underlying [MongoDB](https://www.mongodb.com/) database:
    -   Used by the Orion Context Broker to hold context data information such as data entities, subscriptions and
        registrations.
-   An HTTP **Web-Server** which offers static `@context` files defining the context entities within the system.
-   The **Tutorial Application** does the following:
    -   Acts as set of dummy [agricultural IoT devices](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD)
        using the
        [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
        protocol running over HTTP.

Since all interactions between the three elements are initiated by HTTP requests, the elements can be containerized and
run from exposed ports.

![](https://fiware.github.io/tutorials.CRUD-Operations/img/architecture-ld.png)

The necessary configuration information can be seen in the services' section of the associated `orion-ld.yml` file:

<h3>Orion-LD Configuration</h3>

```yaml
orion:
    image: quay.io/fiware/orion-ld
    hostname: orion
    container_name: fiware-orion
    depends_on:
        - mongo-db
    networks:
        - default
    ports:
        - "1026:1026"
    command: -dbhost mongo-db -logLevel DEBUG
    healthcheck:
        test: curl --fail -s http://orion:1026/version || exit 1
```

```yaml
mongo-db:
    image: mongo:4.2
    hostname: mongo-db
    container_name: db-mongo
    expose:
        - "27017"
    ports:
        - "27017:27017"
    networks:
        - default
    command: --nojournal
```

```yaml
ld-context:
    image: httpd:alpine
    hostname: context
    container_name: fiware-ld-context
    ports:
        - "3004:80"
```

The necessary configuration information can be seen in the services' section of the associated `docker-compose.yml`
file. It has been described in a [previous tutorial (Working with `@context`)](working-with-@context.md).

## Start Up

All services can be initialised from the command-line by running the
[services](https://github.com/FIWARE/tutorials.CRUD-Operations/blob/NGSI-LD/services) Bash script provided within the
repository. Please clone the repository and create the necessary images by running the commands as shown:

```bash
#!/bin/bash
git clone https://github.com/FIWARE/tutorials.CRUD-Operations.git
cd tutorials.CRUD-Operations
git checkout NGSI-LD

./services [orion|scorpio]
```

> **Note:** If you want to clean up and start over again you can do so with the following command:
>
> ```
> ./services stop
> ```

---

## Create Operations

Create Operations map to HTTP POST.

-   The `/ngsi-ld/v1/entities` endpoint is used for creating new entities.
-   The `/ngsi-ld/v1/entities/<entity-id>/attrs` endpoint is used for adding new attributes.

Any newly created entity must have `id` and `type` attributes and a valid `@context` definition. All other attributes
are optional and will depend on the system being modelled. If additional attributes are present though, each should
specify both a `type` and a `value`.

The response will be **201 - Created** if the operation is successful or **409 - Conflict** if the operation fails.

### Create a New Data Entity

This example adds a new **TemperatureSensor** entity to the context.

#### 1 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entities/' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
      "id": "urn:ngsi-ld:TemperatureSensor:001",
      "type": "TemperatureSensor",
      "category": {
            "type": "Property",
            "value": "sensor"
      },
      "temperature": {
            "type": "Property",
            "value": 25,
            "unitCode": "CEL"
      }
}'
```

New entities can be added by making a POST request to the `/ngsi-ld/v1/entities` endpoint.

The request will fail if the entity already exists in the context.

#### 2 Request:

You can check to see if the new **TemperatureSensor** can be found in the context by making a GET request:

```bash
curl -L -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

### Create New Attributes

This example adds a new `batteryLevel` Property and a `controlledAsset` Relationship to the existing
**TemperatureSensor** entity with `id=urn:ngsi-ld:TemperatureSensor:001`.

#### 3 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
       "batteryLevel": {
            "type": "Property",
            "value": 0.9,
            "unitCode": "C62"
      },
      "controlledAsset": {
            "type": "Relationship",
            "object": "urn:ngsi-ld:Building:barn002"
      }
}'
```

New attributes can be added by making a POST request to the `/ngsi-ld/v1/entities/<entity>/attrs` endpoint.

The payload should consist of a JSON object holding the attribute names and values as shown.

All `type=Property` attributes must have a `value` associated with them. All `type=Relationship` attributes must have an
`object` associated with them which holds the URN of another entity. Well-defined common metadata elements such as
`unitCode` can be provided as strings, all other metadata should be passed as a JSON object with its own `type` and
`value` attributes.

Subsequent requests using the same `id` will update the value of the attribute in the context.

#### 4 Request:

You can check to see if the new **TemperatureSensor** can be found in the context by making a GET request:

```bash
curl -L -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
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
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/ld+json' \
--data-raw '[
    {
      "id": "urn:ngsi-ld:TemperatureSensor:002",
      "type": "TemperatureSensor",
      "category": {
            "type": "Property",
            "value": "sensor"
      },
      "temperature": {
            "type": "Property",
            "value": 20,
            "unitCode": "CEL"
      }
    },
    {
      "id": "urn:ngsi-ld:TemperatureSensor:003",
      "type": "TemperatureSensor",
      "category": {
            "type": "Property",
            "value": "sensor"
      },
      "temperature": {
            "type": "Property",
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

The request will fail if any of the attributes already exist in the context. The response highlights which actions have
been successful and the reason for failure (if any has occurred).

```json
{
    "@context": "http://context/ngsi-context.jsonld",
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
context:

-   If an entity already exists, the request will update that entity's attributes.
-   If an entity does not exist, a new entity will be created.

#### 6 Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/upsert' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/ld+json' \
--data-raw '[
    {
      "id": "urn:ngsi-ld:TemperatureSensor:002",
      "type": "TemperatureSensor",
      "category": {
            "type": "Property",
            "value": "sensor"
      },
      "temperature": {
            "type": "Property",
            "value": 21,
            "unitCode": "CEL"
      }
    },
    {
      "id": "urn:ngsi-ld:TemperatureSensor:003",
      "type": "TemperatureSensor",
      "category": {
            "type": "Property",
            "value": "sensor"
      },
      "temperature": {
            "type": "Property",
            "value": 27,
            "unitCode": "CEL"
      }
    }
]'
```

Batch processing for create/overwrite uses the `/ngsi-ld/v1/entityOperations/upsert` endpoint.

A subsequent request containing the same data (i.e. same entities and `actionType=append`) will also succeed will not
change the context state, however, the `modifiedAt` metadata will be amended.

## Read Operations

-   The `/ngsi-ld/v1/entities` endpoint is used for listing entities.
-   The `/ngsi-ld/v1/entities/<entity>` endpoint is used for retrieving the details of a single entity.

For read operations the `@context` must be supplied in a `Link` header.

### Filtering

-   The `options` parameter (combined with the `attrs` parameter) can be used to filter the returned fields.
-   The `q` parameter can be used to filter the returned entities.

### Read a Data Entity (verbose)

This example reads the full context from an existing **TemperatureSensor** entity with a known `id`.

#### 7 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'options=sysAttrs'
```

#### Response:

TemperatureSensor `urn:ngsi-ld:TemperatureSensor:001` is returned as _normalized_ NGSI-LD. Additional metadata is
returned because `options=sysAttrs`. By default, the `@context` is returned in the payload body (although this could be
moved due to content negotiation if the `Accept:application/json` had been set). The full response is shown below:

```json
{
    "@context": "http://context/ngsi-context.jsonld",
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "createdAt": "2020-08-27T14:33:06Z",
    "modifiedAt": "2020-08-27T14:33:10Z",
    "category": {
        "type": "Property",
        "createdAt": "2020-08-27T14:33:06Z",
        "modifiedAt": "2020-08-27T14:33:06Z",
        "value": "sensor"
    },
    "temperature": {
        "type": "Property",
        "createdAt": "2020-08-27T14:33:06Z",
        "modifiedAt": "2020-08-27T14:33:06Z",
        "value": 25,
        "unitCode": "CEL"
    },
    "batteryLevel": {
        "value": 0.8,
        "type": "Property",
        "createdAt": "2020-08-27T14:33:10Z",
        "modifiedAt": "2020-08-27T14:33:10Z",
        "unitCode": "C62"
    },
    "controlledAsset": {
        "object": "urn:ngsi-ld:Building:barn002",
        "type": "Relationship",
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
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'attrs=temperature'
```

#### Response:

The sensor `urn:ngsi-ld:TemperatureSensor:001` is reading at 25°C. The response is shown below:

```json
{
    "@context": "http://context/ngsi-context.jsonld",
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "temperature": {
        "type": "Property",
        "value": 25,
        "unitCode": "CEL"
    }
}
```

Because `options=keyValues` was not used this is the normalized response including the metadata such as `unitCode`.
Context data can be retrieved by making a GET request to the `/ngsi-ld/v1/entities/<entity-id>` endpoint and selecting
the `attrs` using a comma separated list.

### Read a Data Entity (key-value pairs)

This example reads the key-value pairs from the context of an existing **TemperatureSensor** entities with a known `id`.

#### 9 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/json-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json' \
-d 'options=keyValues'
```

#### Response:

The sensor `urn:ngsi-ld:TemperatureSensor:001` is reading at 25°C. The response is shown below:

```json
{
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "category": "sensor",
    "temperature": 25,
    "batteryLevel": 0.8,
    "controlledAsset": "urn:ngsi-ld:Building:barn002"
}
```

The response contains an unfiltered list of context data from an entity containing all the attributes of the
`urn:ngsi-ld:TemperatureSensor:001`. The payload body does not contain an `@context` attribute since the
`Accept: application/json` was set.

Combine the `options=keyValues` parameter with the `attrs` parameter to retrieve a limited set of key-value pairs.

### Read Multiple attributes values from a Data Entity

This example reads the value of two attributes (`category` and `temperature`) from the context of an existing
**TemperatureSensor** entity with a known ID.

#### 10 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001' \
-H 'Link: <http://context/json-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json' \
-d 'options=keyValues' \
-d 'attrs=category,temperature'
```

#### Response:

The sensor `urn:ngsi-ld:TemperatureSensor:001` is reading at 25°C. The response is shown below:

```json
{
    "id": "urn:ngsi-ld:TemperatureSensor:001",
    "type": "TemperatureSensor",
    "category": "sensor",
    "temperature": 25
}
```

Combine the `options=keyValues` parameter and the `attrs` parameter to return a list of values.

### List all Data Entities (verbose)

This example lists the full context of all **TemperatureSensor** entities.

#### 11 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'type=TemperatureSensor'
```

### Response:

On start-up the context was empty, four **TemperatureSensor** entities have been added by create operations so the full
context will now contain four sensors.

```json
[
    {
        "@context": "http://context/ngsi-context.jsonld",
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
    },
    {
        "@context": "http://context/ngsi-context.jsonld",
        "id": "urn:ngsi-ld:TemperatureSensor:002",
        "type": "TemperatureSensor",
        "category": {
            "type": "Property",
            "value": "sensor"
        },
        "temperature": {
            "type": "Property",
            "value": 21,
            "unitCode": "CEL"
        }
    },
    {
        "@context": "http://context/ngsi-context.jsonld",
        "id": "urn:ngsi-ld:TemperatureSensor:003",
        "type": "TemperatureSensor",
        "category": {
            "type": "Property",
            "value": "sensor"
        },
        "temperature": {
            "type": "Property",
            "value": 27,
            "unitCode": "CEL"
        }
    },
    {
        "@context": "http://context/ngsi-context.jsonld",
        "id": "urn:ngsi-ld:TemperatureSensor:001",
        "type": "TemperatureSensor",
        "batteryLevel": {
            "type": "Property",
            "value": 0.8,
            "unitCode": "C62"
        },
        "category": {
            "type": "Property",
            "value": "sensor"
        },
        "controlledAsset": {
            "type": "Relationship",
            "object": "urn:ngsi-ld:Building:barn002"
        },
        "temperature": {
            "type": "Property",
            "value": 25,
            "unitCode": "CEL"
        }
    }
]
```

### List all Data Entities (key-value pairs)

This example lists the `temperature` attribute of all **TemperatureSensor** entities.

#### 12 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
-H 'Link: <http://context/json-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json' \
-d 'type=TemperatureSensor' \
-d 'options=keyValues' \
-d 'attrs=temperature'
```

#### Response:

The full context contains four sensors, they are returned in a random order:

```json
[
    {
        "id": "urn:ngsi-ld:TemperatureSensor:004",
        "type": "TemperatureSensor",
        "temperature": 100
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:002",
        "type": "TemperatureSensor",
        "temperature": 21
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:003",
        "type": "TemperatureSensor",
        "temperature": 27
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:001",
        "type": "TemperatureSensor",
        "temperature": 25
    }
]
```

Full context data for a specified entity type can be retrieved by making a GET request to the `/ngsi-ld/v1/entities`
endpoint and supplying the `type` parameter, combine this with the `options=keyValues` parameter and the `attrs`
parameter to retrieve key-values.

### Filter Data Entities by ID

This example lists selected data from two **TemperatureSensor** entities chosen by `id`. Note that every `id` must be
unique, so `type` is not required for this request. To filter by `id` add the entries in a comma delimited list.

#### 13 Request:

```bash
curl -G -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/'' \
-H 'Link: <http://context/json-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json' \
-d 'id=urn:ngsi-ld:TemperatureSensor:001,urn:ngsi-ld:TemperatureSensor:002' \
-d 'options=keyValues' \
-d 'attrs=temperature'
```

#### Response:

The response details the selected attributes from the selected entities.

```json
[
    {
        "id": "urn:ngsi-ld:TemperatureSensor:002",
        "type": "TemperatureSensor",
        "temperature": 21
    },
    {
        "id": "urn:ngsi-ld:TemperatureSensor:001",
        "type": "TemperatureSensor",
        "temperature": 25
    }
]
```

## Update Operations

Overwrite operations are mapped to HTTP PATCH:

-   The `/ngsi-ld/v1/entities/<entity-id>/attrs/<attribute>` endpoint is used to update an attribute.
-   The `/ngsi-ld/v1/entities/<entity-id>/attrs` endpoint is used to update multiple attributes.

### Overwrite the value of an Attribute value

This example updates the value of the `category` attribute of the Entity with `id=urn:ngsi-ld:TemperatureSensor:001`:

#### 14 Request:

```bash
curl -iX PATCH 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs/category' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
    "value": ["sensor", "actuator"],
    "type": "Property"
}'
```

Existing attribute values can be altered by making a PATCH request to the
`/ngsi-ld/v1/entities/<entity-id>/attrs/<attribute>` endpoint. The appropriate `@context` should be supplied as a `Link`
header.

### Overwrite Multiple Attributes of a Data Entity

This example simultaneously updates the values of both the `category` and `controlledAsset` attributes of the Entity
with `id=urn:ngsi-ld:TemperatureSensor:001`:

#### 15 Request:

```bash
curl -iX PATCH 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
      "category": {
            "value": [
                  "sensor",
                  "actuator"
            ],
            "type": "Property"
      },
      "controlledAsset": {
            "type": "Relationship",
            "object": "urn:ngsi-ld:Building:barn001"
      }
}'
```

### Batch Update Attributes of Multiple Data Entities

This example uses the convenience batch processing endpoint to update existing products:

#### 16 Request:

```bash
curl -G -iX POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/upsert' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'options=update'
--data-raw '[
  {
    "id": "urn:ngsi-ld:TemperatureSensor:003",
    "type": "TemperatureSensor",
    "category": {
      "type": "Property",
      "value": [
        "actuator",
        "sensor"
      ]
    }
  },
  {
    "id": "urn:ngsi-ld:TemperatureSensor:004",
    "type": "TemperatureSensor",
    "category": {
      "type": "Property",
      "value": [
        "actuator",
        "sensor"
      ]
    }
  }
]'
```

Batch processing uses the `/ngsi-ld/v1/entityOperations/upsert` endpoint. The payload body holds an array of the
entities and attributes we wish to update.The `options=update` parameter indicates we will not remove existing
attributes if they already exist and have not been included in the payload.

An alternative would be to use the `/ngsi-ld/v1/entityOperations/update` endpoint. Unlike `upsert`, the `update`
operation will not silently create any new entities - it fails if the entities do not already exist.

### Batch Replace Entity Data

This example uses the convenience batch processing endpoint to replace entity data of existing sensors.

#### 17 Request:

```bash
curl -G -iX POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/update' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-d 'options=replace'
--data-raw '[
  {
    "id": "urn:ngsi-ld:TemperatureSensor:003",
    "type": "TemperatureSensor",
    "category": {
      "type": "Property",
      "value": [
        "actuator",
        "sensor"
      ]
    }
  },
  {
    "id": "urn:ngsi-ld:TemperatureSensor:004",
    "type": "TemperatureSensor",
    "temperature": {
      "type": "Property",
      "value": [
        "actuator",
        "sensor"
      ]
    }
  }
]'
```

Batch processing uses the `/ngsi-ld/v1/entityOperations/update` endpoint with a payload with the - `options=replace`
parameter, this means we will overwrite existing entities. `/ngsi-ld/v1/entityOperations/upsert` could also be used if
new entities are also to be created.

## Delete Operations

Delete Operations map to HTTP DELETE.

-   The `/ngsi-ld/v1/entities/<entity-id>` endpoint can be used to delete an entity.
-   The `/ngsi-ld/v1/entities/<entity-id>/attrs/<attribute>` endpoint can be used to delete an attribute.

The response will be **204 - No Content** if the operation is successful or **404 - Not Found** if the operation fails.

### Data Relationships

If there are entities within the context which relate to one another, you must be careful when deleting an entity. You
will need to check that no references are left dangling once the entity has been deleted.

Organizing a cascade of deletions is beyond the scope of this tutorial, but it would be possible using a batch delete
request.

### Delete an Entity

This example deletes the entity with `id=urn:ngsi-ld:TemperatureSensor:004` from the context:

#### 18 Request:

```bash
curl -iX DELETE 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:004'
```

Entities can be deleted by making a DELETE request to the `/ngsi-ld/v1/entities/<entity>` endpoint.

Subsequent requests using the same `id` will result in an error response since the entity no longer exists in the
context.

### Delete an Attribute from an Entity

This example removes the `batteryLevel` attribute from the entity with `id=urn:ngsi-ld:TemperatureSensor:001`:

#### 19 Request:

```bash
curl -L -X DELETE 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs/batteryLevel' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

Attributes can be deleted by making a DELETE request to the `/ngsi-ld/v1/entities/<entity>/attrs/<attribute>` endpoint.
It is important to supply the appropriate `@context` in the request in the form of a `Link` header to ensure that the
attribute name can be recognised.

If the entity does not exist within the context or the attribute cannot be found on the entity, the result will be an
error response.

### Batch Delete Multiple Entities

This example uses the convenience batch processing endpoint to delete some **TemperatureSensor** entities:

#### 20 Request:

```bash
curl -L -X POST 'http://localhost:1026/ngsi-ld/v1/entityOperations/delete' \
-H 'Content-Type: application/json' \
--data-raw '[
  "urn:ngsi-ld:TemperatureSensor:002",
  "urn:ngsi-ld:TemperatureSensor:003"
]'
```

Batch processing uses the `/ngsi-ld/v1/entityOperations/delete` endpoint with a payload consisting of an array of
elements to delete.

If an entity does not exist in the context, the result will be an error response.

### Batch Delete Multiple Attributes from an Entity

This example uses the PATCH `/ngsi-ld/v1/entities/<entity-id>/attrs` endpoint to delete some attributes from a
**TemperatureSensor** entity:

#### 21 Request:

```bash
curl -L -X PATCH 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:TemperatureSensor:001/attrs' \
-H 'Content-Type: application/json' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
--data-raw '{
      "category": {
            "value": null,
            "type": "Property"
      },
      "controlledAsset": {
            "type": "Relationship",
            "object": null
      }
}'
```

If a value is set to `null` the attribute is deleted.

### Find existing data relationships

This example returns a header indicating whether any linked data relationships remain against the entity
`urn:ngsi-ld:Building:barn002`:

#### 22 Request:

```bash
curl -iX GET 'http://localhost:1026/ngsi-ld/v1/entities/?type=TemperatureSensor&limit=0&count=true&q=controlledAsset==%22urn:ngsi-ld:Building:barn002%22' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
-H 'Accept: application/json'
```

#### Response:

```json
[]
```

Because the `limit=0` parameter has been used **no entities** are listed in the payload body, however the `count=true`
means that the count is passed as a header instead:

```text
NGSILD-Results-Count: 1
```

If `limit` was not present the payload would hold the details of every matching entity instead.
