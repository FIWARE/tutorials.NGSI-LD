
[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

This tutorial introduces the idea of using an existing **NGSI-v2** Context Broker as a Context Source within an
**NGSI-LD** data space, and how to combine both JSON-based and JSON-LD based context data into a unified structure
through introducing a simple **NGSI-LD** façade pattern with a fixed `@context`. The tutorial re-uses the data from the
original **NGSI-v2** getting started tutorial but uses API calls from the **NGSI-LD** interface.

The tutorial uses [cUrl](https://ec.haxx.se/) commands throughout, but is also available as
[Postman documentation](https://fiware.github.io/tutorials.Linked-Data/ngsi-ld.html)

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/125db8d3a1ea3dab8e3f)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/FIWARE/tutorials.Linked-Data/tree/NGSI-LD)

This tutorial is designed for exisiting **NGSI-v2** developers looking to attach existing **NGSI-v2** systems to an
**NGSI-LD** federation. If you are building a linked data system from scratch you should start from the beginnning of
the [NGSI-LD developers tutorial](getting-started.md) documentation.

Similarly, if you an existing **NGSI-v2** developer and you just want to understand linked data concepts in general,
checkout the equivalent [**NGSI-v2** tutorial](https://github.com/FIWARE/tutorials.Linked-Data/tree/NGSI-v2) on
upgrading **NGSI-v2** data sources to **NGSI-LD**

<hr class="core"/>

# Adding Linked Data concepts to NGSI-v2 Data Entities.

> “Always be a first rate version of yourself and not a second rate version of someone else.”
>
> ― Judy Garland


## NGSI-v2/NGSI-LD Data Spaces

The first introduction to FIWARE [Getting Started tutorial](https://github.com/FIWARE/tutorials.Getting-Started)
introduced the [NGSI v2](https://fiware.github.io/specifications/OpenAPI/ngsiv2) JSON-based interface that is commonly
used to create and manipulate context data entities.
[NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
is an evolution of that interface which enhances context data entities through adding the concept of **linked data**.

There is a need for two separate interfaces since:

-   **NGSI-v2** offers [JSON](https://www.json.org/json-en.html) based interoperability used in individual Smart Systems
-   **NGSI-LD** offers [JSON-LD](https://json-ld.org/) based interoperability used for Federations and Data Spaces

**NGSI-v2** is ideal for creating individual applications offering interoperable interfaces for web services or IoT
devices. It is easier to understand than NGSI-LD and does not require a JSON-LD `@context`, However **NGSI-v2** without
linked data falls short when attempting to offer federated data across a data space. Once multiple apps and
organisations are involved each individual data owner is no longer in control of the structure of the data used
internally by the other participants within the data space. This is where the `@context` of **NGSI-LD** comes in, acting
as a mapping mechanism for attributes allowing the each local system to continue to use its own preferred terminology
within the data it holds and for federated data from other users within the data space to be renamed using a standard
expansion/compaction operation allowing each individual system understand data holistically from across the whole data
space.



### Creating a common data space

For example, imagine a simple "Buildings" data space consisting of two participants pooling their data together:

-   Details of a series of [supermarkets](https://fiware-tutorials.readthedocs.io/en/latest/) from the **NGSI-v2**
    tutorials.
-   Details of a series of [farms](https://ngsi-ld-tutorials.readthedocs.io/en/latest/) from the **NGSI-LD** tutorials.

Although the two participants have agreed to use a common
[data model](https://ngsi-ld-tutorials.readthedocs.io/en/latest/datamodels.html#building) between them, internally they
hold their data in a slightly different structure.

#### NGSI-LD (Farm)

Within the **NGSI-LD** Smart Farm, all of the Building Entities are marked using `"type":"Building"` as a shortname
which can be expanded to a full URI `https://uri.fiware.org/ns/dataModels#Building` using JSON-LD expansion rules. All
the attributes of each Building entity (such as `name`, `category` etc are defined using the
[User `@context`](./data-models/ngsi-context.jsonld) and are structured as NGSI-LD attributes. The standard NGSI-LD
Keywords are used to define the nature of each attribute - e.g. `Property`, `GeoProperty`, `VocabularyProperty`,
`Relationship` and each of these terms is also defined within the
[core `@context`](https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld).

```json
{
    "id": "urn:ngsi-ld:Building:farm001",
    "type": "Building",
    "category": {
        "type": "VocabularyProperty",
        "vocab": "farm"
    },
    "address": {
        "type": "Property",
        "value": {
            "streetAddress": "Großer Stern 1",
            "addressRegion": "Berlin",
            "addressLocality": "Tiergarten",
            "postalCode": "10557"
        }
    },
    "location": {
        "type": "GeoProperty",
        "value": {
            "type": "Point",
            "coordinates": [13.3505, 52.5144]
        }
    },
    "name": {
        "type": "Property",
        "value": "Victory Farm"
    },
    "owner": {
        "type": "Relationship",
        "object": "urn:ngsi-ld:Person:person001"
    }
}
```

#### **NGSI-v2** (Supermarket)

Within the **NGSI-v2** Smart Supermarket, every entity must have a `id` and `type` - this is part of the data model and
a prerequisite for joining the data space. However due to the backend systems used, the internal short name is
`"type":"Store"`. Within an **NGSI-v2** system there is no concept of `@context` - every attribute has a `type` and a
`value` and the attribute `type` is usually aligned with the datatype (e.g. `Text`, `PostalAddress`) although since
**NGSI-LD** keyword types such as `Relationship`, `VocabularyProperty` are also permissible and set by convention.

```json
{
    "id": "urn:ngsi-ld:Store:001",
    "type": "Store",
    "address": {
        "type": "PostalAddress",
        "value": {
            "streetAddress": "Bornholmer Straße 65",
            "addressRegion": "Berlin",
            "addressLocality": "Prenzlauer Berg",
            "postalCode": "10439"
        }
    },
    "category": {
        "type": "VocabularyProperty",
        "value": "supermarket"
    },
    "location": {
        "type": "geo:json",
        "value": {
            "type": "Point",
            "coordinates": [13.3986, 52.5547]
        }
    },
    "name": {
        "type": "Text",
        "value": "Bösebrücke Einkauf"
    },
    "owner": {
        "type": "Relationship",
        "value": "urn:ngsi-ld:Person:person001"
    }
}
```

### Types of data space

When joining a data space, a participant must abide by the rules that govern that data space. One of the first decisions
a common data space must make is to defined the nature of the data space itself. There are three primary approaches to
this, which can broadly be defined as follows:

-   An **Integrated** data space requires that every participant uses exactly the same payloads and infrastructure - for
    example _"Use Scorpio 4.1.15 only"_ . This could be a requirement for a lottery ticketing system where every
    terminal sends ticket data in the same format.
-   A **unified** data space defines a common data format, but allows for the underlying infrastructure to differ
    between participants - for example _"Use NGSI-LD only for all payloads"_
-   A **federated** data space is even looser and defines a common meta structure so each participants has more
    flexibility regarding it underlying technologies for example "All payloads must be translatable as GeoJSON"\_ for a
    combined GIS, NGSI-LD data space.

Using this terminology, in this example we are creating a **unified** data space in this example, since participants are
using NGSI-LD in common for data exchange, but their underlying systems are different.

## Architecture

The demo application will send and receive NGSI-LD calls within a data space. This demo application will only make use
of three FIWARE components.

Currently, both Orion and Orion-LD Context Brokers rely on open source [MongoDB](https://www.mongodb.com/) technology to
keep persistence of the context data they hold. Therefore, the architecture will consist of two elements:

-   The [Smart Farm Context Broker](https://fiware-orion.readthedocs.io/en/latest/) which will receive requests using
    [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
-   The [Smart Supermarket Context Broker](https://fiware-orion.readthedocs.io/en/latest/) which will receive requests
    using
    [NGSI-v2](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
-   Two instances of underlying [MongoDB](https://www.mongodb.com/) database
    -   Used by both NGSI-v2 and NGSI-LD Context Brokers to hold context data information such as data entities,
        subscriptions and registrations
-   The FIWARE [Lepus](https://github.com/jason-fox/lepus) proxy which will translate NGSI-LD to NGSI-v2 and vice-versa
-   An HTTP **Web-Server** which offers static `@context` files defining the context entities within the system.

Since all interactions between the two elements are initiated by HTTP requests, the elements can be containerized and
run from exposed ports.

![](https://fiware.github.io/tutorials.Linked-Data/img/architecture-lepus.png)

The necessary configuration information can be seen in the services section of the associated `common.yml` and
`orion-ld.yml` files:

<h4>Orion-LD (NGSI-LD)</h4>

```yaml
orion-ld:
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

<h4>Orion (NGSI-v2)</h4>

```yaml
orion:
    image: quay.io/fiware/orion
    hostname: orion2
    container_name: fiware-orion-v2
    depends_on:
        - mongo-for-orion-v2
    networks:
        - default
    ports:
        - "1027:1026" # localhost:1026
    command: -dbURI mongodb://mongo-db2 -logLevel DEBUG
    healthcheck:
        test: curl --fail -s http://orion2:1026/version || exit 1
```

<h4>Lepus</h4>

```yaml
lepus:
    image: quay.io/fiware/lepus
    hostname: adapter
    container_name: fiware-lepus
    networks:
        - default
    expose:
        - "3005"
    ports:
        - "3005:3000"
    environment:
        - DEBUG=adapter:*
        - NGSI_V2_CONTEXT_BROKER=http://orion2:1026
        - USER_CONTEXT_URL=http://context/fixed-context.jsonld
        - CORE_CONTEXT_URL=https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld
        - NOTIFICATION_RELAY_URL=http://adapter:3000/notify
```

All containers are residing on the same network - the Orion-LD Context Broker is listening on Port `1026` and the first
MongoDB is listening on the default port `27017`. The Orion NGSI-v2 Context Broker is listening on Port `1027` and
second MongoDB is listening on port `27018`. Lepus uses port `3000`, but since that clashes with the tutorial
application, it has been amended externally to `3005`.

Lepus is driven by the environment variables as shown:

| Key                    | Value                                                              | Description                                                                        |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| DEBUG                  | `adapter:*`                                                        | Debug flag used for logging                                                        |
| NGSI_V2_CONTEXT_BROKER | `http://orion2:1026`                                               | Hostname and port of the underlying NGSI-v2 context broker                         |
| USER_CONTEXT_URL       | `http://context/fixed-context.jsonld`                              | The location of the User-defined `@context` file used to define the data models    |
| CORE_CONTEXT_URL       | `https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld` | The location of the core `@context` file used to the structure of NGSI-LD entities |
| NOTIFICATION_RELAY_URL | `http://adapter:3000/notify`                                       | Callback URL used for converting notification payloads from NGSI-v2 to NGSI-LD     |

## Start Up

All services can be initialised from the command-line by running the
[services](https://github.com/FIWARE/tutorials.Linked-Data/blob/NGSI-LD/services) Bash script provided within the
repository. Please clone the repository and create the necessary images by running the commands as shown:

```bash
git clone https://github.com/FIWARE/tutorials.Linked-Data.git
cd tutorials.Linked-Data
git checkout NGSI-LD

./services orion|scorpio|stellio
```

> [!NOTE]
>
> If you want to clean up and start over again you can do so with the following command:
>
> ```
> ./services stop
> ```

---

## Offering NGSI-v2 Entities as part of an NGSI-LD Data Space

This tutorial starts up both the NGSI-LD Smart Farm (on port `1027`) and NGSI-v2 Smart Supermarket (on port `1027`) and thenoffers the NGSI-v2 entities into the building finder to the Smart Farm FMIS as part of a federated data space.

### Reading NGSI-v2 Data directly

As usual, you can check if NGSI-v2 context broker holding the supermarket data is running by making an HTTP request to the exposed port, the request is in NGSI-v2 format. It does not require a `Link` header for the `@context`

#### 1️⃣ Request:

```console
curl -G -X GET \
  'http://localhost:1027/v2/entities/urn:ngsi-ld:Store:001'
```

#### Response:

The response will be in NGSI-v2 format as follows:

```json
{
    "id": "urn:ngsi-ld:Store:001",
    "type": "Store",
    "address": {
        "type": "PostalAddress",
        "value": {
            "streetAddress": "Bornholmer Straße 65",
            "addressRegion": "Berlin",
            "addressLocality": "Prenzlauer Berg",
            "postalCode": "10439"
        }, "metadata": {}
    },
    "category": {
        "type": "VocabularyProperty", "value": "supermarket", "metadata": {}
    },
    "location": {
        "type": "geo:json",
        "value": {
            "type": "Point",
            "coordinates": [
                13.3986,
                52.5547
            ]
        }, "metadata": {}
    },
    "name": {
        "type": "Text", "value": "Bösebrücke Einkauf", "metadata": {}
    },
    "owner": {
        "type": "Relationship", "value": "urn:ngsi-ld:Person:001",
        "metadata": {
            "objectType": {
                "type": "VocabularyProperty", "value": "Person"
            }
        }
    }
}
```

The `type` attribute in NGSI-v2 is loosely defined, but in this case, with the exception of ordinary properties, we are using `type` to correspond to the terms used in NGSI-LD such as `Relationship` or `VocabularyProperty`. For ordinary NGSI-v2 properties, the `type` corresponds to a datatype such as `Text` or `PostalAddress`, each of these datatypes will need to be mapped to a JSON-LD `@context` if the data is to be understood in an NGSI-LD system.

### Reading NGSI-v2 Data in NGSI-LD format

To read the data in NGSI-LD format, make an NGSI-LD request via the Lepus adaptor listening on port `3005`

#### 2️⃣ Request:

```console
curl -G -X GET \
  'http://localhost:3005/ngsi-ld/v1/entities/urn:ngsi-ld:Store:001' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json' \
-H 'Accept: application/ld+json'
```

#### Response:

The response will be in NGSI-LD format as follows:


```json
{
    "@context": [
        "http://context/fixed-context.jsonld",
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld"
    ],
    "id": "urn:ngsi-ld:Store:001",
    "type": "Store",
    "address": {
        "type": "Property",
        "value": {
            "streetAddress": "Bornholmer Straße 65",
            "addressRegion": "Berlin",
            "addressLocality": "Prenzlauer Berg",
            "postalCode": "10439"
        }
    },
    "category": {
        "type": "VocabularyProperty", "vocab": "supermarket"
    },
    "location": {
        "type": "GeoProperty",
        "value": {
            "type": "Point",
            "coordinates": [
                13.3986,
                52.5547
            ]
        }
    },
    "name": {
        "type": "Property", "value": "Bösebrücke Einkauf"
    },
    "owner": {
        "type": "Relationship", "object": "urn:ngsi-ld:Person:001", "objectType": "Person"
    }
}
```

It should be noted that the `@context` supplied in the `Link` header has been totally ignored, and a fixed `@context` used configured for the adaptor has been returned instead. The Adaptor doesn't fully understand NGSI-LD, it merely formats the underlying NGSI-v2 as NGSI-LD. You will notice that the NGSI-v2 `"type": "VocabularyProperty", "value": "supermarket"` has been amended to a valid **VocabularyProperty** - `"type": "VocabularyProperty", "vocab": "supermarket"`, and similarly the **Relationship** is now using `object` and `objectType` as defined in the core `@context`



#### 3️⃣ Request:

The `fixed-context` JSON-LD `@context` file fully defines all the terms found within the NGSI-v2 system in terms of IRIs - the file can be accessed as shown.

```console
curl -L 'http://localhost:3004/fixed-context.jsonld'
```

#### Response:

The response is a valid JSON-LD `@context`. As can be seen the NGSI-v2 `Store` is being mapped to `fiware>Building` which corresponds to a `https://uri.fiware.org/ns/dataModels#Building`

```json
{
    "@context": {
        "type": "@type",
        "id": "@id",
        "ngsi-ld": "https://uri.etsi.org/ngsi-ld/",
        "fiware": "https://uri.fiware.org/ns/dataModels#",
        "schema": "https://schema.org/",
        "tutorial": "https://fiware.github.io/tutorials.Step-by-Step/schema/",
        "openstreetmap": "https://wiki.openstreetmap.org/wiki/Tag:building%3D",
        "Bell": "tutorial:Bell",
        "Store": "fiware:Building",
        "Door": "tutorial:Door",
        "Lamp": "tutorial:Lamp",
        "Motion": "tutorial:Motion",
        "Person": "fiware:Person",
        "Product": "tutorial:Product",
        "Shelf": "tutorial:Shelf",
        "StockOrder": "tutorial:StockOrder",
        "additionalName": "schema:additionalName",
        "address": "schema:address",
        "addressCountry": "schema:addressCountry",
        "addressLocality": "schema:addressLocality",
        "addressRegion": "schema:addressRegion",
... etc
    }
}
```


The Lepus adaptor aims to offer all the endpoints of an NGSI-LD context broker, except that it has no understanding of JSON-LD `@context` - hence all terms must always be compacted - a query for all `Stores` would be `/ngsi-ld/v1/entities/?type=Store` for example. One of the endpoints defined in the 1.8.1 NGSI-LD specification is `/info/sourceIdentity`, which gives informatation about the underlying context broker - uptime, aliasing and detailed information. In this case the adaptor is merely standardizing the data from the Orion broker's `/version` endpoint:

#### 4️⃣ Request:

```console
curl -G -X GET \
    'http://localhost:3005/ngsi-ld/v1/info/sourceIdentity' \
-H 'Accept: application/ld+json'
```

#### Response:

The response holds an `contextSourceAlias` (or nickname) for the adapter as well as data corresponding to the uptime in ISO 8601 duration format, and also the server time. The attribute  `contextSourceExtras` is a freeform JSON object (defined as `"@type": "@JSON"`) which can hold any additional unspecified data about the context broker:

```json
{
    "id": "urn:ngsi-ld:ContextSourceIdentity:16d6f0c6-ce4d-4568-bd0b-c261135354ea",
    "type": "ContextSourceIdentity",
    "contextSourceExtras": {
        "version": "4.0.0",
        "uptime": "0 d, 0 h, 45 m, 58 s",
        "git_hash": "4f9f34df07395c54387a53074f98bef00b1130a3",
        "compile_time": "Thu Jun 6 07:35:47 UTC 2024",
        "compiled_by": "root",
        "compiled_in": "buildkitsandbox",
        "release_date": "Thu Jun 6 07:35:47 UTC 2024",
        "machine": "x86_64",
        "doc": "https://fiware-orion.rtfd.io/en/4.0.0/"
    },
    "contextSourceUptime": "P0DT0H45M58S",
    "contextSourceTimeAt": "2024-08-02T11:16:06.376Z",
    "contextSourceAlias": "lepus",
    "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.8.jsonld"
}
```



### Creating a federation registration

This NGSI-LD **ContextSourceRegistration** example informs the NGSI-LD context broker, that data is also available from the adapter:

#### 5️⃣ Request:

```console
curl -L 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json' \
-H 'Content-Type: application/json' \
-d '{
    "type": "ContextSourceRegistration",
    "information": [
        {"entities": [{"type": "Building"}]}
    ],
    "contextSourceInfo": [
        {"key": "jsonldContext","value": "http://context/fixed-context.jsonld"},
        {"key": "Prefer", "value": "ngsi-ld=1.6"}
    ],
    "mode": "inclusive",
    "operations": ["federationOps"],
    "endpoint": "http://adapter:3000"
}'
```

The registration is structured as follows:

- `information.entities` is stating that `Building` entities are potentially available on the `endpoint`. The `Link` header holds a JSON-LD `@context` which is mapping the short name `Building` to the IRI `https://uri.fiware.org/ns/dataModels#Building`.
- The `mode` of the registration is `inclusive`, which means that the context broker will add together `Building` data from all registered and combine it with any `Building` entities found locally.
- The `operation` mode indicates the `endpoint` is capable of handling subscriptions and retrieval of entities only.
- The `contextSourceInfo` holds key-value pairs which are used when forwarding requests to the `endpoint`:
    -  `jsonldContext` is a special key, which is used to apply a JSON-LD compaction operation on the payload before forwarding to the registrant endpoint. This corresponds to the fixed terms used by Lepus itself and ensures that the NGSI-v2 broker behind it is always supplied with its preferred short name terms.
    -  `Prefer` appends a `Prefer` header to the forwarded request, which ensures that Lepus only returns elements which correspond to the 1.6.1 NGSI-LD specification
- The `endpoint` holds the location of the adaptor which is in front of the NGSI-v2 context broker


Once a registration is in place, it is possible to read information about the NGSI-v2 Stores by querying the
NGSI-LD FMIS system:

#### 6️⃣ Request:

```console
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Store:001' \
-H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json'
```

#### Response:

Because of `Prefer: ngsi-ld=1.6` had been set in the registration, the retrieved entity does not a **VocabularyProperty** and `objectType` has been quietly dropped from the response. This ensures backwards compatibility to context brokers conformant to an earlier version of the NGSI-LD specification - in this case version 1.6.

```json
{
    "id": "urn:ngsi-ld:Store:001",
    "type": "Building",
    "address": {
        "type": "Property",
        "value": {
            "streetAddress": "Bornholmer Straße 65",
            "addressRegion": "Berlin",
            "addressLocality": "Prenzlauer Berg",
            "postalCode": "10439"
        }
    },
    "category": {"type": "Property", "value": "supermarket"},
    "location": {
        "type": "GeoProperty",
        "value": {
            "type": "Point",
            "coordinates": [
                13.3986,
                52.5547
            ]
        }
    },
    "name": {"type": "Property", "value": "Bösebrücke Einkauf"},
    "owner": {"type": "Relationship", "object": "urn:ngsi-ld:Person:001"}
}
```

### Retrieve entities

This example returns all known `Building` entities in the "Supermarket" `category`

#### 7️⃣ Request:

```console
curl -G -X GET \
    'http://localhost:1026/ngsi-ld/v1/entities' \
    -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
    -H 'Accept: application/ld+json' \
    -d 'type=Building' \
    -d 'q=category==%22supermarket%22' \
    -d 'attrs=name' \
    -d 'options=keyValues'
```

#### Response:

The response returns all **Building** entities known locally, and all **Building** entities found on registered context brokers.


```json
[
    {
        "id": "urn:ngsi-ld:Store:001",
        "type": "Store",
        "name": "Bösebrücke Einkauf"
    },
    {
        "id": "urn:ngsi-ld:Store:002",
        "type": "Store",
        "name": "Checkpoint Markt"
    },
    {
        "id": "urn:ngsi-ld:Store:003",
        "type": "Store",
        "name": "East Side Galleria"
    },
    {
        "id": "urn:ngsi-ld:Store:004",
        "type": "Store",
        "name": "Tower Trödelmarkt"
    }
]
```

This can be checked using the FMIS system itself on `localhost:3000` where both farm buildings and supermarket stores can be accessed:

![](https://fiware.github.io//tutorials.Linked-Data/img/buildings.png)


### Using an alternate `@context`

Neither Lepus nor the NGSI-v2 context broker able to handle alternative `@context` files, however, when requesting data from the NGSI-LD context broker, JSON-LD is fully supported, so a response can be returned using the preferred short names of the user agent.

In the example below, the **Building** entity `urn:ngsi-ld:Store:001` is requested using terms in German.


#### 8️⃣ Request:

```console
curl -G -X GET \
  'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Store:001' \
-H 'Link: <http://context/alternate-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json'
```

#### Response:

The response is returned in JSON format with short form attribute names in German. The true source of the entity (NGSI-v2 data via the adapter) is not visible to the end user.

```json
{
    "id": "urn:ngsi-ld:Store:001",
    "type": "Gebäude",
    "adresse": {
        "type": "Property",
        "value": {
            "streetAddress": "Bornholmer Straße 65",
            "addressRegion": "Berlin",
            "addressLocality": "Prenzlauer Berg",
            "postalCode": "10439"
        }
    },
    "kategorie": {"type": "Property", "value": "supermarket"},
    "location": {
        "type": "GeoProperty",
        "value": {
            "type": "Point",
            "coordinates": [
                13.3986,
                52.5547
            ]
        }
    },
    "name": {"type": "Property", "value": "Bösebrücke Einkauf"},
    "inhaber": {"type": "Relationship", "object": "urn:ngsi-ld:Person:001"}
}
```

