[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://cim.etsi.org/NGSI-LD/official/0--1.html)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)

**Description:** This tutorial discusses the use of registrations within an NGSI-LD data space. The four different forms of registration
are explained and detailed examples given. Based on a simple data space of interacting context brokers, a complete Farm
Management Information System is created using the _System-of-Systems_ approach, displaying a holistic overview of the
entire farm.

The tutorial uses [cUrl](https://ec.haxx.se/) commands throughout, but is also available as
[Postman documentation](https://fiware.github.io/tutorials.Context-Providers/ngsi-ld.html)

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/2c53b7c2bce9fd7b7b47)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/FIWARE/tutorials.LD-Subscriptions-Registrations/tree/NGSI-LD)

<hr class="core"/>

# NGSI-LD Registrations

> “It is a capital mistake to theorize before one has data. Insensibly one begins to twist facts to suit theories,
> instead of theories to suit facts.”
>
> ― Sherlock Holmes (A Scandal in Bohemia by Sir Arthur Conan Doyle)

NGSI-LD Registrations provide the basic mechanism to allow the components within a Smart Linked Data Solution to share
information and interact with each other.

As a brief reminder, within a distributed system, subscriptions inform a third party component that a change in the
context data has occurred (and the component needs to take further actions), whereas registrations inform the context
broker that additional context information is available from another context source.

In constrast to NGSI-v2, NGSI-LD is designed to supports federated, distributed deployments with multiple context
sources, which can also be full context brokers forming a data space, and potentially coming from external systems not
under the control of the implementor themselves. NGSI-LD context sources, may be context brokers, but they may also be
IoT agents or other context sources which only implement part of the NGSI-LD API. For example an IoT Actuator may only
support a single **PATCH** endpoint to alter the status of the device and nothing more.

A context broker uses an internal registry to understand what information is available, which entity types can be found
where and which NGSI-LD API endpoints (or subset of endpoints) are available from each context source. The context
broker then uses this information from the registry to access and aggregate information to be returned - for example
merging two views of an entity to retrieve the full information when making a **GET** request.

The actual source of any context data is hidden from the end user since NGSI-LD interactions are purely based around
interfaces, this enables the creation of a hierarchy of context brokers - **Broker A** requests data from **Broker B**
which in turn requests data from **Broker C** and so on. Securing the data space using distribute trust mechanisms is
vital since no central control that can be assumed. Furthermore the standard JSON-LD concepts of `@context` and
expansion/compaction operations mean that data can always be retrieved using the preferred terminology of the end user.

There are four basic types of registration in NGSI-LD - these are described in more detail below:

## Additive Registrations

With additive registrations, a Context Broker is permitted to hold context data about the Entities and Attributes
locally itself, and also obtain data from (possibly multiple) external sources:

- An **inclusive** Context Source Registration specifies that the Context Broker considers all registered Context
  Sources as equals and will distribute operations to those Context Sources even if relevant context data is available
  directly within the Context Broker itself (in which case, all results will be integrated in the final response).
  This is the default mode of operation.
- An **auxiliary** Context Source Registration never overrides data held directly within a Context Broker. Auxiliary
  distributed operations are limited to context information consumption operations (see clause 5.7). Context data from
  auxiliary context sources is only included if it is supplementary to the context data otherwise available to the
  Context Broker.

## Proxied Registrations

With proxied registrations, Context Broker is **not permitted** to hold context data about the Entities and Attributes
locally itself. All context data is obtained from the external registered sources.

- An **exclusive** Context Source Registration specifies that all of the registered context data is held in a single
  location external to the Context Broker. The Context Broker itself holds no data locally about the registered
  Attributes and no overlapping proxied Context Source Registrations shall be supported for the same combination of
  registered Attributes on the Entity. An exclusive registration must be fully specified. It always relates to
  specific Attributes found on a single Entity. It can be used for actuations
- A **redirect** Context Source Registration also specifies that the registered context data is held in a location
  external to the Context Broker, but potentially multiple distinct redirect registrations can apply at the same time.

>
> - **Inclusive** registrations are the default operation mode for NGSI-LD systems.
> - **Exclusive** registrations remain as the default operation mode for simpler NGSI-v2 systems.
>
> This is because NGSI-v2 uses JSON - not JSON-LD. JSON-based systems NGSI-v2 are unable to freely function within a federated data space
> without the concept of `@context`. Therefore an NGSI-v2 context broker always forms the leaf node in a broker hierarchy. A comparision
> between NGSI-v2 and NGSI-LD registrations can be found
> [here](https://github.com/FIWARE/tutorials.LD-Subscriptions-Registrations/).
>
> It remains possible to attach NGSI-v2 data sources into an NGSI-LD data space using a proxy serving a fixed
> `@context` - this is described in more detail [here](https://github.com/FIWARE/tutorials.Linked-Data/tree/NGSI-LD)

<h3>Entities within a Farm Management Information System (FMIS)</h3>

An animal is livestock found on the farm. Each **Animal** entity would have properties such as:

- A name of the Animal e.g. "Twilight the Cow"
- A physical location e.g. _52.5075 N, 13.3903 E_
- The weight of the Animal
- An association to the store in which the shelf is present
- Relationships to their parental lineage `calvedBy` / `siredBy`
- Relationship to their feedstock e.g. "Oats"

An **Animal** can be `locatedAt` either a **Building** or an **AgriParcel**

- A building is a real world bricks and mortar farm building. **Building** entities would have properties such as:

- A name of the building e.g. "The Big Red Barn"
- An address "Friedrichstraße 44, 10969 Kreuzberg, Berlin"
- A physical location e.g. _52.5075 N, 13.3903 E_
- A relationship to the owner of the building.

An AgriParcel is a plot of land on the farm, sometimes called a partfield. **AgriParcel** entities would have
properties such as:

- A name of the parcel e.g. "The Northern Hay Meadow"
- A physical location e.g. _52.5075 N, 13.3903 E_
- A crop type - e.g. _Pasture_
- A soil temperature.

Additionally devices such as a **TemperatureSensor** can be placed in a **Building** or an **AgriParcel** to measure the
`temperature`

![](https://fiware.github.io/tutorials.Context-Providers/img/ngsi-ld-entities.png)

<h3>FMIS System</h3>

The simple Node.js Express application has updated to use NGSI-LD in the previous
[tutorial](https://github.com/FIWARE/tutorials.Getting-Started/). We will use the application to monitor the data being
received from the data space as a whole. It can accessed from the following URLs:

The FMIS can be found at: `http://localhost:3000/`

![FIWARE Monitor](https://fiware.github.io/tutorials.Context-Providers/img/fmis.png)

<h4>Animals</h4>

Animals can be found under `http://localhost:3000/app/animal/<urn>`

![Store](https://fiware.github.io/tutorials.Context-Providers/img/cow-101-buttercup.png)

<h4>Buildings</h4>

Buildings can be found under `http://localhost:3000/app/building/<urn>`

![Store2](https://fiware.github.io/tutorials.Context-Providers/img/animal-farm.png)

<h4> AgriParcels</h4>

Animals can be found under `http://localhost:3000/app/agriparcel/<urn>`


## Architecture

The demo Farm Management Information System (FMIS) application will send and receive NGSI-LD calls using a compliant
context broker. To keep the archirecture simple, the demo will make use of only one FIWARE component, with data from a
single context broker being split across a series of subsystems each using a different tenant in emulation of a full
data space.

Currently, the Orion Context Broker relies on open source [MongoDB](https://www.mongodb.com/) technology to keep
persistence of the context data it holds. To request context data from external sources, a simple Context Provider NGSI
proxy has also been added. To visualize and interact with the Context we will add a simple Express application

Therefore the overall architecture will consist of the following elements:

- The [Orion Context Broker](https://fiware-orion.readthedocs.io/en/latest/) which will send and receive requests
  using
  [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json).
  This is split into the following systems, each running on their own tenant:
  - The default tenant which holds **Building** data and is used for collating data from all systems
  - The `farmer` tenant which holds **Animal**, **Device** and **AgriParcel** information
  - The `contractor` tenant holds **Animal** data about animals needing additional care.
  - The `vet` tenant which holds **Animal** data about new-born animals
- The FIWARE [IoT Agent for UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/) which will receive
  southbound requests using
  [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
  and convert them to
  [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
  commands for the devices
- The underlying [MongoDB](https://www.mongodb.com/) database :
  - Used by the **Orion Context Broker** to hold context data information such as data entities, subscriptions and
    registrations
  - Used by the **IoT Agent** to hold device information such as device URLs and Keys
- An HTTP **Web-Server** which offers static `@context` files defining the context entities within the system.
- The **Tutorial Application** does the following:
  - Acts as set of dummy [agricultural IoT devices](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD)
    using the
    [UltraLight 2.0](https://fiware-iotagent-ul.readthedocs.io/en/latest/usermanual/index.html#user-programmers-manual)
    protocol running over HTTP.
  - Displays a running Farm Management Information System (FMIS)

Since all interactions between the elements are initiated by HTTP requests, the entities can be containerized and run
from exposed ports.

![](https://fiware.github.io/tutorials.Context-Providers/img/architecture-ngsi-ld.png)

The necessary configuration information can be seen in the services section of the associated `orion-ld.yml` file. It
has been described in a [previous tutorial](https://github.com/FIWARE/tutorials.Working-with-Linked-Data/)

## Start Up

All services can be initialised from the command-line by running the
[services](https://github.com/FIWARE/tutorials.Context-Providers/blob/NGSI-LD/services) Bash script provided within the
repository. Please clone the repository and create the necessary images by running the commands as shown:

```bash
git clone https://github.com/FIWARE/tutorials.Context-Providers.git
cd tutorials.Context-Providers
git checkout NGSI-LD

./services [orion|scorpio|stellio]
```

> **Note:** If you want to clean up and start over again you can do so with the following command:
>
> ```
> ./services stop
> ```

---

## Redirection Registration

Before adding the registration, goto `http://localhost:3000/` to display and interact with the FMIS data. Initially,
only the Building data from the previous tutorial is available, since this has been loaded onto the default tenant.

### Reading Animal data

Animals are not available on the default tenant, Data about animals on the farm has been preloaded into the **farmer's context broker**

- for simplicitiy this is actually set up as the `farmer` tenant and a simple forwarding proxy set up on port `1027`. The farmer's data
- can be read as shown:

#### 1️⃣ Request:

```bash
curl -L 'http://localhost:1027/ngsi-ld/v1/entities/?type=Animal&limit=100&options=concise' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

Or directly on port `1026` with the `NGSILD-Tenant` header present:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=Animal&limit=100&options=concise' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```


#### Response:

The response on port `1027` consists of the details of the **Animal** entities held within the **farmer's context broker**.

```json
[
  {
    "id": "urn:ngsi-ld:Animal:cow001",
    "type": "Animal",
    "name": "Beany",
    "fedWith": "Grass",
    "legalId": "M-bull001-Beany",
    "phenologicalCondition": {
      "vocab": "maleAdult"
    },
    "reproductiveCondition": {
      "vocab": "active",
      "observedAt": "2024-01-01T15:00:00.000Z"
    },
    "sex": {
      "vocab": "Male"
    },
    "species": "dairy cattle"
  },
   ...etc
```

#### 2️⃣ Request:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=Animal&limit=100&options=concise' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

Since no registrations have been created yet, the equivalent request on the **FMIS system context broker** initially returns no data

```json
[]
```

### Creating a redirection registration

A redirection registration informs a context broker that **all data** for a given `type` is held externally - in another context source.

| Request    | Action at **Context Broker** (Primary)                                      | Action at **Context Source** (Secondary)                                                           |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **GET**    | Pass request to **Context Provider**, proxy the response back unaltered.    | Respond to context broker with the result of the GET request based on the entities held internally |
| **PATCH**  | Pass request to **Context Consumer**, proxy back the HTTP back status code. | Update the entity within the **Context Source**, Respond to the context broker with a status code  |
| **DELETE** | Pass request to **Context Consumer**                                        | Delete the entity within the **Context Source**, Respond to the context broker with a status code  |

In the case that multiple redirection registrations have been set up on the same entity `type`, the following occurs:

| Request    | Action at **Context Broker** (Primary)                                                                         | Action at **Context Source** (Secondary)                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **GET**    | Pass request to the **Context Providers**, merge the responses based on the most recent `observedAt` timestamp | Each provider responds to context broker with the result of the GET request based on the entities held internally |
| **PATCH**  | Pass request to the **Context Consumers**, proxy back the HTTP back status code.                               | Update the entity within the **Context Source**, Respond to the context broker with a status code                 |
| **DELETE** | Pass request to the **Context Consumers**                                                                      | Delete the entity within the **Context Source**, Respond to the context broker with a status code                 |

Similarly, if a subscription CRUD request is passed into the primary context broker, it is passed onto the secondary sources to deal with.

The result of a `redirect` registration is a hierarchy of context brokers, in that each of the registered **Context Sources** should end up with a duplicate copy of the data,
but no data is held in the primary context broker whatsoever.

#### 3️⃣ Request:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
  -H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'Content-Type: application/json' \
  -d '{
  "type": "ContextSourceRegistration",
  "information": [
    {
      "entities": [
        {
          "type": "Animal"
        }
      ]
    }
  ],
  "mode": "redirect",
  "operations": [
    "redirectionOps"
  ],
  "endpoint": "http://farmer"
}'
```

`"mode":"redirect"` prevents the **FMIS context broker** from holding any `type=Animal` data whatsoever. All `type=Animal`
requests are forwarded elsewhere. `operations": "redirectionOps"` is a short-hand for all NGSI-LD endpoints - any CRUD
operations will now affect the farmer sub-system (i.e. the farmer tenant), not the FMIS system (i.e. the default
tenant). Effectively this registration has ceded the control of `type=Animal` to the farmer's subsystem. After creating
the registration, resending the `type=Animal` request on the FMIS system (the default tenant) now returns all the
animals from the farmer subsystem:

#### 4️⃣ Request:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=Animal&limit=100&options=concise' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

```json
[
  {
    "id": "urn:ngsi-ld:Animal:cow001",
    "type": "Animal",
    "name": "Beany",
    "fedWith": "Grass",
    "legalId": "M-bull001-Beany",
    "phenologicalCondition": {
      "vocab": "maleAdult"
    },
    "reproductiveCondition": {
      "vocab": "active",
      "observedAt": "2024-01-01T15:00:00.000Z"
    },
    "sex": {
      "vocab": "Male"
    },
    "species": "dairy cattle"
  },
   ...etc
```

The animals are now also visible within the tutorial application `http://localhost:3000/`.

![](https://fiware.github.io/tutorials.Context-Providers/img/fmis.png)

### Read Registration Details

Registration details can be read by making a GET request to the `/ngsi-ld/v1/csourceRegistrations/`. All registration CRUD
actions continue to be mapped to the same HTTP verbs as before. For NGSI-LD systems, the request must be limited somehow.
In this case we are looking for registrations regarding **Animal** entities, `type=Animal` the mapping of which is defined
by the associated `@context` file.

#### 5️⃣ Request:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/?type=Animal' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

The response consists of the details of the registration within the system. The `management.timeout` is the default length of time a
registration will wait to receive a response.

```json
[
  {
    "id": "urn:ngsi-ld:ContextSourceRegistration:-225064078",
    "type": "ContextSourceRegistration",
    "endpoint": "http://farmer",
    "information": [
      {
        "entities": [
          {
            "type": "AgriParcel"
          },
          {
            "type": "Animal"
          }
        ]
      }
    ],
    "management": {
      "timeout": 1000
    },
    "mode": "redirect",
    "operations": "redirectionOps"
  }
]
```

## Inclusive Registration

The default type of registration within **NGSI-LD** systems is `inclusive` mode. In this case, data from all context sources is considered
to be equally valid and the context broker returns the most recent data found from across all registered context sources. `inclusive` mode is typically used
to create a federation of peers (i.e. ``"operations": "federationOps"`) where context brokers are able to augment their understanding of the
world with data from other sources, but more often than not are unable to **PATCH** or **POST** onto each other.

Imagine the situation where the farmer has his own animal data, but wishes to add additional data from the vet and the contract labourer.
In this case there is data within the farmer's context broker, as well as the other context sources.

In the case where an `inclusive` registrations has been set up, the following occurs:

| Request    | Action at **Context Broker** (Primary)                                                                                                                                                                      | Action at **Context Source** (Secondary)                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **GET**    | Pass request to the **Context Providers**, merge the responses based on the data held locally and the data received from elsewhere using the most recent `observedAt` timestamp as the arbiter of freshness | Each provider responds to context broker with the result of the GET request based on the entities held internally |
| **PATCH**  | Update the data locally and pass request to the **Context Consumers**, proxy back the HTTP back status code.                                                                                                | Update the entity within the **Context Source**, Respond to the context broker with a status code                 |
| **DELETE** | Delete the data locally, pass request to the **Context Consumers**                                                                                                                                          | Delete the entity within the **Context Source**, Respond to the context broker with a status code                 |

Similarly, if a subscription CRUD request is passed into the primary context broker, it is passed onto the secondary sources to deal with.

Effectively every `inclusive` registration is saying _"this entity is held both locally and elsewhere"_.

### Reading Vetenary Data

The **Vet's Context Broker** can be found on port `1030`, a simple query can be made to retrieve the data directly:

#### 6️⃣ Request:

```bash
curl -G -X GET \
  'http://localhost:1030/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'attrs=name,comment'
```

Or directly on port `1026` with the `NGSILD-Tenant` header present:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=Animal&limit=100&options=concise' \
  -H 'NGSILD-Tenant: vet' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

```json
{
  "id": "urn:ngsi-ld:Animal:cow001",
  "type": "Animal",
  "comment": {
    "type": "Property",
    "value": "Please check hooves.",
    "observedAt": "2024-01-01T15:00:00.000Z"
  }
}
```

### Creating an inclusive registration

An `inclusive` federative registration can be invoked on the **Farmer's Context Broker** - this is merely stating that the farmer will coalesce Animal data from their
own broker and the vet:

#### 7️⃣ Request:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Content-Type: application/json' \
  -d '{
  "type": "ContextSourceRegistration",
  "information": [
    {
      "entities": [
        {
          "type": "Animal"
        }
      ]
    }
  ],
  "mode": "inclusive",
  "operations": [
    "federationOps"
  ],
  "management": {
    "timeout": 1000
  },
  "endpoint": "http://vet"
}'
```

A subsequent request on the **Farmer's Context Broker** - port `1027`, will receive more information on the cow than previously - Farmer data + Vet data:

#### 8️⃣ Request:

```bash
curl -G -X GET \
  'http://localhost:1027/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
```

Or directly on port `1026` with the `NGSILD-Tenant` header present:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=Animal&limit=100&options=concise' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/user-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

The response now includes the Farmer's own data as well as the `comment` attribute found only within the **Vet's context broker**

```json
{
  "id": "urn:ngsi-ld:Animal:cow001",
  "type": "Animal",
  "name": {
    "type": "Property",
    "value": "Beany"
  },
  "comment": {
    "type": "Property",
    "value": "Please check hooves.",
    "observedAt": "2024-01-01T15:00:00.000Z"
  },
  "fedWith": {
    "type": "Property",
    "value": "Grass"
  },
  "legalId": {
    "type": "Property",
    "value": "M-bull001-Beany"
  },
  "phenologicalCondition": {
    "type": "VocabProperty",
    "vocab": "maleAdult"
  },
  "reproductiveCondition": {
    "type": "VocabProperty",
    "vocab": "active",
    "observedAt": "2024-01-01T15:00:00.000Z"
  },
  "sex": {
    "type": "VocabProperty",
    "vocab": "Male"
  },
  "species": {
    "type": "Property",
    "value": "dairy cattle"
  }
}
```

Furthermore, additional **Animal** entities only found within the **Vet's Context Broker** are now also visible within the tutorial application `http://localhost:3000/` -
this is the response from the FMIS (which holds no animals locally) plus the response from the Farmer, plus the response from the Vet. The result is a listing which
includes all the animals on the farm, plus all the animals which are requiring vetenary care.

It is still possible to retrieve the locally held data in the **Farmer's Context Broker** without invoking the registration, through adding the `local=true` parameter

#### 9️⃣ Request:

```bash
curl -G -X GET \
  'http://localhost:1027/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'local=true'
```

#### Response:

The response now includes the Farmer's own data only without the `comment` attribute found only within the **Vet's context broker**

```json
{
  "id": "urn:ngsi-ld:Animal:cow001",
  "type": "Animal",
  "name": {
    "type": "Property",
    "value": "Beany"
  },
  "fedWith": {
    "type": "Property",
    "value": "Grass"
  },
  "legalId": {
    "type": "Property",
    "value": "M-bull001-Beany"
  },
  "phenologicalCondition": {
    "type": "VocabProperty",
    "vocab": "maleAdult"
  },
  "reproductiveCondition": {
    "type": "VocabProperty",
    "vocab": "active",
    "observedAt": "2024-01-01T15:00:00.000Z"
  },
  "sex": {
    "type": "VocabProperty",
    "vocab": "Male"
  },
  "species": {
    "type": "Property",
    "value": "dairy cattle"
  }
}
```

A second source of federative data can be found within the `Contractor` tenant - the information can be requested directly

#### 1️⃣0️⃣ Request:

```bash
curl -G -X GET \
 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001' \
  -H  'Accept: application/json' \
  -H  'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H  'NGSILD-Tenant: contractor' \
  -d 'attrs=name%2Ccomment'
```

#### Response:

The response now includes the Contractor's own data only. Note that the `comment` attribute holds more recent information than the Vet's context broker. This is differenciated by the `observedAt` _Property-of-a-Property_

```json
{
  "id": "urn:ngsi-ld:Animal:cow001",
  "type": "Animal",
  "comment": {
    "type": "Property",
    "value": "Checked Hooves, Bull is OK.",
    "observedAt": "2024-02-02T15:00:00.000Z"
  }
}
```

#### 1️⃣1️⃣ Request:

The contractor data can be federated by the farmer as shown:

```bash
curl -iX POST \
  'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Content-Type: application/json' \
  -d '{
  "type": "ContextSourceRegistration",
  "information": [
    {
      "entities": [
        {
          "type": "Animal"
        }
      ]
    }
  ],
  "mode": "inclusive",
  "operations": [
    "federationOps"
  ],
  "endpoint": "http://contractor"
}'
```

#### 1️⃣2️⃣ Request:

Now when requesting data from the farmer's context broker, the response includes the most recent information found across all brokers in the federation.

```bash
curl -G -X GET \
 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001' \
  -H  'Accept: application/json' \
  -H  'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H  'NGSILD-Tenant: farmer' \
  -d 'attrs=name%2Ccomment'
```

#### Response:

The response has requested `comment` data from three sources - the farmer, the vet and the contractor. The attribute value with the most recent timestamp has been returned.

```json
{
  "id": "urn:ngsi-ld:Animal:cow001",
  "type": "Animal",
  "comment": {
    "type": "Property",
    "value": "Checked Hooves, Bull is OK.",
    "observedAt": "2024-02-02T15:00:00.000Z"
  }
}
```

## Exclusive registration

`exclusive` registrations should be familiar to anyone who has used an IoT Agent with NGSI-v2. An exclusive registration informs a context broker that a given set of attributes for an `id` is held externally - in another context source. Frequently this context source itself is not a context broker.

Imagine for example a sensor system where you do not want to rely on the sensor pushing values to a context broker, but every time a request is made you wish to obtain values direct from the device itself. This sort of "lazy" attribute technique is useful for GET requests when the attribute would not usually send data a regular intervals - requesting `batteryLevel` of charge for example. `exclusive` registrations can also be used for actuators where a PATCH request on the context broker should actuate a response on a device in the real world.

`exclusive` registrations form a proxy for the local data within the context broker - they differ from `redirection` registrations in that there can only ever be a single source for the registered attributes, whereas in theory multiple `redirection` registrations could be in place.

| Request    | Action at **Context Broker** (Primary)                                                                                                 | Action at **Context Source** (Device)                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **GET**    | Pass attributes request to **Context Provider**, combine the result of device attributes and locally held attributes _(if any)_        | Respond to context broker with the registered attributes of the GET request                                 |
| **PATCH**  | Deal with local attributes locally _(if any)_, Pass other attributes to **Context Consumer**, proxy back the overall HTTP status code. | Update the registered attributes n the **Context Source**, Respond to the context broker with a status code |
| **DELETE** | Delete local attributes locally _(if any)_, Pass attribute request to **Context Consumer**                                             | Delete the attributes held within the **Context Source**, Respond to the context broker with a status code  |

The result of a `exclusive` registration is that no data for the registered attributes are held directly in the context broker and a single **Context Source** acts as a proxy location for the request instead.

### Reading Animal Data via an IoT Agent

#### 1️⃣3️⃣ Request:

Consider for example an Animal collar which supplies data for the entity `urn:ngsi-ld:Animal:cow001` - this is likely to be a device attached to an IoT Agent. The underlying device protocol and payload doesn't matter, since we are able to make an NGSI-LD request to the IoT Agent which then requests information from the device itself:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001' \
  -H 'Accept: application/json' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H  'NGSILD-Tenant: openiot'
```

#### Response:

The response shows the live readings from the device itself.

```json
{
  "id": "urn:ngsi-ld:Animal:cow001",
  "type": "Animal",
  "heartRate": {
    "type": "Property",
    "value": 10.4,
    "unitCode": "5K",
    "observedAt": "2024-02-02T15:00:00.000Z",
    "providedBy": {
      "type": "Relationship",
      "object": "urn:ngsi-ld:Device:cow001"
    }
  },
  "location": {
    "type": "GeoProperty",
    "value": {
      "type": "Point",
      "coordinates": [13.404, 52.47]
    },
    "observedAt": "2024-02-02T15:00:00.000Z",
    "providedBy": {
      "type": "Relationship",
      "object": "urn:ngsi-ld:Device:cow001"
    }
  }
}
```

### Creating an exclusive registration

#### 1️⃣4️⃣ Request:

An exclusive registration can be made on the **Farmer** context broker to always receive **live** information from the IoT Agent. The `mode` is set to `"exclusive"`, and since the IoT Agent is only accepting **GET** requests the `"operations` attribute is set to `"retrieveOps"` only. A fixed `contextSourceInfo` can be used if the endpoint does not understand JSON-LD expansion/compaction.

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H  'NGSILD-Tenant: farmer' \
  -H 'Content-Type: application/json' \
  -d '{
  "type": "ContextSourceRegistration",
  "information": [
    {
      "entities": [
        {
          "type": "Animal",
          "id": "urn:ngsi-ld:Animal:cow001"
        }
      ],
      "propertyNames": [
        "heartRate",
        "location"
      ]
    }
  ],
  "mode": "exclusive",
  "operations": [
    "retrieveOps"
  ],
  "endpoint": "http://devices",
  "contextSourceInfo": [
    {
      "key": "jsonldContext",
      "value": "http://context/ngsi-context.jsonld"
    }
  ]
}'
```

#### 1️⃣5️⃣ Request:

The **farmer** context broker is now able to get the `location` and `heartRate` of `urn:ngsi-ld:Device:cow001`

```bash
curl -L 'http://localhost:1027/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001?attrs=location%2CheartRate' \
  -H 'Accept: application/json' \
  -H  'NGSILD-Tenant: farmer' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

```json
{
  "id": "urn:ngsi-ld:Animal:cow001",
  "type": "Animal",
  "location": {
    "type": "GeoProperty",
    "value": {
      "type": "Point",
      "coordinates": [13.404, 52.47]
    },
    "observedAt": "2024-02-02T15:00:00.000Z",
    "providedBy": {
      "type": "Relationship",
      "object": "urn:ngsi-ld:Device:cow001"
    }
  },
  "heartRate": {
    "type": "Property",
    "value": 10.4,
    "unitCode": "5K",
    "observedAt": "2024-02-02T15:00:00.000Z",
    "providedBy": {
      "type": "Relationship",
      "object": "urn:ngsi-ld:Device:cow001"
    }
  }
}
```

#### 1️⃣6️⃣ Request:

Note that an attempt by the Farmer to directly update the `location` or `heartRate` attributes will **fail** with **409 - Conflict** as an exclusive registration prohibits this:

```bash
curl -L -X PATCH 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Animal:cow001' \
  -H 'Accept: application/ld+json' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Content-Type: application/json' \
  -d '{
    "heartRate": 20
}'
```

#### Response:

```json
{
  "registrationId": "urn:ngsi-ld:ContextSourceRegistration:c92c69e4-a72d-11ef-add6-0242ac12010a",
  "title": "Operation not supported",
  "detail": "A matching exclusive registration forbids the Operation",
  "attributes": ["heartRate"]
}
```

## Auxiliary registration

`auxiliary` registrations are a weaker form of redirection, in that they only fire if the local broker does not hold the information itself. As such `auxiliary` registrations only fire on **GET** requests.

Imagine for example a system where you need to obtain temperature readings from a series
of fields. In some cases you already have a temperature gauge in a field and you want to use your own data. In other cases you will need to rely on secondary data received from elsewhere - for example forecasted data from another provider. In this case, you don't care if a general area weather forecast is more recent than your own data (since you will have to pay for access), so you would prefer to receive your older local data if you have it.

`auxiliary` registrations form a proxy for the local data within the context broker - they differ from `redirection` registrations in that there can only ever be a single source for the registered attributes, whereas in theory multiple `redirection` registrations could be in place.

| Request | Action at **Context Broker** (Primary)                                                          | Action at **Context Source** (Weather)                                      |
| ------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **GET** | Get locally held attributes and if missing, request to **Context Provider**, combine the result | Respond to context broker with the registered attributes of the GET request |

### Reading Crop Data

#### 1️⃣7️⃣ Request:

To find the **AgriParcel** `temperature` data currently available to the **farmer**, make a request to the `/entities` endpoint and supply the `type` parameter.

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=AgriParcel&attrs=temperature' \
  -H 'Accept: application/json' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

Initially only one AgriParcel is returned, since it is the only one which the **Farmer** context broker has a `temperature` attribute stored locally.

```json
[
  {
    "id": "urn:ngsi-ld:AgriParcel:001",
    "type": "AgriParcel",
    "temperature": {
      "type": "Property",
      "value": 15.4,
      "unitCode": "CEL",
      "observedAt": "2024-01-01T15:00:00.000Z"
    }
  }
]
```

#### 1️⃣8️⃣ Request:

Make the same request directly to the **Weather** context broker to obtain the information known to the Weather forecaster:

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=AgriParcel&attrs=temperature' \
  -H 'Accept: application/json' \
  -H 'NGSILD-Tenant: weather' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

The weather forecast context broker has more information and its values have a more recent `observedAt`. Obviously this information is valuable, and therefore the weather forecaster wants to charge for access.

```json
[
  {
    "id": "urn:ngsi-ld:AgriParcel:001",
    "type": "AgriParcel",
    "temperature": {
      "type": "Property",
      "value": 10.4,
      "unitCode": "CEL",
      "observedAt": "2024-02-02T15:00:00.000Z"
    }
  },
  {
    "id": "urn:ngsi-ld:AgriParcel:002",
    "type": "AgriParcel",
    "temperature": {
      "type": "Property",
      "value": 10.4,
      "unitCode": "CEL",
      "observedAt": "2024-02-02T15:00:00.000Z"
    }
  },
  {
    "id": "urn:ngsi-ld:AgriParcel:003",
    "type": "AgriParcel",
    "temperature": {
      "type": "Property",
      "value": 10.4,
      "unitCode": "CEL",
      "observedAt": "2024-02-02T15:00:00.000Z"
    }
  }
]
```

### Creating an Auxiliary registration

#### 1️⃣9️⃣ Request:

An auxiliary registration can be made on the **Farmer** context broker to only receive **live** information from the weather forecaster if it does not hold information locally. The `mode` is set to `"auxilary"`, and since the IoT Agent is only accepting **GET** requests the `"operations` attribute is set to `"retrieveOps"` only.

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/csourceRegistrations/' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Content-Type: application/json' \
  -d '{
  "type": "ContextSourceRegistration",
  "information": [
    {
      "entities": [
        {
          "type": "AgriParcel"
        }
      ],
      "propertyNames": ["temperature"]
    }
  ],
  "mode": "auxiliary",
  "operations": [
    "retrieveOps"
  ],
  "endpoint": "http://weather"
}
'
```

#### 2️⃣0️⃣ Request:

Once the registration has been created, the farmer can request for `temperature` data once again.

```bash
curl -L 'http://localhost:1026/ngsi-ld/v1/entities/?type=AgriParcel&attrs=temperature' \
  -H 'Accept: application/json' \
  -H 'NGSILD-Tenant: farmer' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
```

#### Response:

Now the response contains both local and remotely retrieved data, with a preference of returning the locally held values.

```json
[
  {
    "id": "urn:ngsi-ld:AgriParcel:001",
    "type": "AgriParcel",
    "temperature": {
      "type": "Property",
      "value": 15.4,
      "unitCode": "CEL",
      "observedAt": "2024-01-01T15:00:00.000Z"
    }
  },
  {
    "id": "urn:ngsi-ld:AgriParcel:002",
    "type": "AgriParcel",
    "temperature": {
      "type": "Property",
      "value": 10.4,
      "unitCode": "CEL",
      "observedAt": "2024-02-02T15:00:00.000Z"
    }
  },
  {
    "id": "urn:ngsi-ld:AgriParcel:003",
    "type": "AgriParcel",
    "temperature": {
      "type": "Property",
      "value": 10.4,
      "unitCode": "CEL",
      "observedAt": "2024-02-02T15:00:00.000Z"
    }
  }
]
```
