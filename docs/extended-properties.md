[![FIWARE Core Context Management](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/core.svg)](https://github.com/FIWARE/catalogue/blob/master/core/README.md)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf)

**Description:** This tutorial examines the keyword syntax tokens of JSON-LD and introduces custom property types which extend NGSI-LD properties to cover multilingual capabilities and preferred enumeration names whilst reusing the data from the [Smart Farm example](https://github.com/FIWARE/tutorials.Getting-Started/tree/NGSI-LD). The tutorial uses
[cUrl](https://ec.haxx.se/) commands throughout.

[<img src="https://run.pstmn.io/button.svg" alt="Run In Postman" style="width: 128px; height: 32px;">](https://god.gw.postman.com/run-collection/217860-3b538d21-0f19-4c63-a9d6-e184ef829ca7?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D217860-3b538d21-0f19-4c63-a9d6-e184ef829ca7%26entityType%3Dcollection%26workspaceId%3Db6e7fcf4-ff0c-47cb-ada4-e222ddeee5ac)
[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/FIWARE/tutorials.Extended-Properties/tree/NGSI-LD)

<hr class="core"/>

# Understanding JSON-LD `@keywords`

> "Я понять тебя хочу, Темный твой язык учу."<br/>
> _"I want to understand you, I am studying your incomprehensible language."_
>
> — Alexander Pushkin (Verses, composed during a sleepless night)

The [JSON-LD syntax](https://www.w3.org/TR/json-ld/#syntax-tokens-and-keywords) defines a series of keywords to describe the structure of the JSON displayed. Since **NGSI-LD** is just a formally structured _extended subset_ of **JSON-LD**, **NGSI-LD** should be
directly or indirectly capable of offering an equivalent for all the functions defined by JSON-LD.

As an example, JSON-LD defines `@id` to indicate the unique identifier of an Entity, and `@type` to define the type of an Entity.
The NGSI-LD core `@context` further refines this further, so that `id`/`@id` and `type`/`@type` are considered as interchangeable.

Both of the following syntaxes (with and without `@`) are acceptable in NGSI-LD:

```json
{
  "id": "urn:ngsi-ld:Building:farm001",
  "type": "Building",
  "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
}
```

```json
{
  "@id": "urn:ngsi-ld:Building:farm001",
  "@type": "Building",
  "@context": "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
}
```

Among the keywords defined in JSON-LD, the following terms are used or mapped within the NGSI-LD core `@context` to maintain their meaning when JSON-LD data is supplied.

- `@list` - Used to express an ordered set of data.
- `@json` - Used in association with unexpandable JSON objects
- `@language` - Used to specify the language for a particular string value or string array
- `@none` - Used as a default index value, when an attribute does not have the feature being indexed.
- `@value` - Used to specify the data that is associated with a particular property
- `@vocab` - Used to expand properties and values

Certain other keywords such as `@graph`, which describe statements about relationships are accepted in NGSI-LD, but are never processed directly by NGSI-LD Context brokers

For example. Looking at the core `@context`, the GeoProperty attribute
`coordinates` is fully defined as:

```json
"coordinates": {
  "@container": "@list",
  "@id": "geojson:coordinates"
}
```

This ensure that the ordering of the values in its array (longitude, latitude) is always maintained.

All ordinary NGSI-LD **Properties** (and **GeoProperties**) have a `value`, which is the equivalent of a JSON-LD `@value` - this mean that the `value` of a Property is just the data that is associated with a particular property.

However, there are recent updates to the NGSI-LD specification which have introduced various extensions or subclasses to this principle, allowing the creation of NGSI-LD properties which directly conform to
JSON-LD keywords other than `@value`.

- An NGSI-LD **LanguageProperty** holds a set of internationalized strings and is defined using the JSON-LD `@language` keyword.
- An NGSI-LD **VocabularyProperty** holds is a mapping of a URI to a value within the user'`@context` and is defined using the JSON-LD `@vocab` keyword.

In each case, the meaning of the resultant payload will be altered according to the standard JSON-LD definitions, so the output NGSI-LD remains fully valid JSON-LD.

<h3>Entities within a Farm Management Information System (FMIS)</h3>

To illustrate some extended NGSI-LD properties within an FMIS system based on NGSI-LD, we will alter the previously defined **Building** Entity type. As a reminder this has been defined as follows

- A building, such as a barn, is a real world bricks and mortar construct. **Building** entities would have properties
  such as:
  - A name of the building e.g. "The Big Red Barn"
  - The category of the building (e.g. "barn")
  - An address "Friedrichstraße 44, 10969 Kreuzberg, Berlin"
  - A physical location e.g. _52.5075 N, 13.3903 E_
  - A filling level - the degree to which the building is full.
  - A temperature - e.g. _21 °C_
  - An association to the owner of the building (a real person)
  - ...etc.

Taking the first attribute, the Property `name` could be localized into multiple languages, for example:

- **Big Red Barn** in English
- **Große Rote Scheune** in German
- **大きな赤い納屋** in Japanese

Similarly, even if all participants in a data space can agree for a common URI for the definition of the enumerations of all the different building types within `category`, internally within their own systems, they may be requied to display these enumerations with their own localised values.

For example if the FMIS follows the URIs defined by openstreetmap.org. A building designated as A _"barn"_ would actually be defined by the URI: `https://wiki.openstreetmap.org/wiki/Tag:building%3Dbarn`. A JSON-LD `@context` could be used to shorten this as required.

If a user wanted the `category` defined as `"barn"` internally within their system, the following JSON-LD `@context` could be used:

```json
{
  "@context": {
    "barn": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dbarn"
  }
}
```

If a user wanted the `category` defined as `"scheune"` internally within their system, the following JSON-LD `@context` could be used:

```json
{
  "@context": {
    "scheune": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dbarn"
  }
}
```

The definition and redefinition of enumerations is not necessarily just a language localisation issue. It is possible that an FMIS may wish to use a separate code
list of values for
regulatory reasons. For example, the names of ingredients within a pesticide,
could be regulated by law and the required name could differ based on the market in which the product is sold (e.g. `Water`, `H₂O`, `Hydrogen Hydroxide`, `Oxygen Dihydride`,
`Hydric Acid`)

## Architecture

The demo application will send and receive NGSI-LD calls to a compliant context broker. Although the standardised NGSI-LD
interface is available across multiple context brokers, we only need to pick one - for example the
[Scorpio Broker](https://fiware-orion.readthedocs.io/en/latest/). The application will therefore only make use of
one FIWARE component.

Currently, the Orion Context Broker relies on open source [MongoDB](https://www.mongodb.com/) technology to hold the
current state of the context data it contains and persistent information relevant to subscriptions and registrations.
Other Context Brokers such as Scorpio or Stellio are using [PostgreSQL](https://www.postgresql.org/) for state
information.

To promote interoperability of data exchange, NGSI-LD context brokers explicitly expose a
[JSON-LD `@context` file](https://json-ld.org/spec/latest/json-ld/#the-context) to define the data held within the
context entities. This defines a unique URI for every entity type and every attribute so that other services outside of
the NGSI domain are able to pick and choose the names of their data structures. Every `@context` file must be available
on the network. In our case the tutorial application will be used to host a series of static files.

Therefore, the architecture will consist of three elements:

- The [Scorpio Context Broker](https://scorpio.readthedocs.io/) which will receive requests using
  [NGSI-LD](https://forge.etsi.org/swagger/ui/?url=https://forge.etsi.org/rep/NGSI-LD/NGSI-LD/raw/master/spec/updated/generated/full_api.json)
- The underlying [Postgres](https://www.postgresql.org/) database:
  - Used by the Scorpio Context Broker to hold context data information such as data entities, subscriptions and
    registrations.
- An HTTP **Web-Server** which offers static `@context` files defining the context entities within the system.

Since all interactions between the three elements are initiated by HTTP requests, the elements can be containerized and
run from exposed ports.

The necessary configuration information can be seen in the services section of the associated `scorpio.yml` file:


<h3>Tutorial Configuration</h3>

```yaml
scorpio:
  labels:
    org.fiware: "tutorial"
  image: quay.io/fiware/scorpio:java-${SCORPIO_VERSION}
  hostname: scorpio
  container_name: fiware-scorpio
  networks:
    - default
  ports:
    - "1026:9090"
  depends_on:
    - postgres
```

```yaml
postgres:
  labels:
    org.fiware: "tutorial"
  image: postgis/postgis
  hostname: postgres
  container_name: db-postgres
  networks:
    - default
  ports:
    - "5432"
  environment:
    POSTGRES_USER: ngb
    POSTGRES_PASSWORD: ngb
    POSTGRES_DB: ngb
  logging:
    driver: none
  volumes:
    - postgres-db:/var/lib/postgresql/data
```

```yaml
ld-context:
  labels:
    org.fiware: "tutorial"
  image: httpd:alpine
  hostname: context
  container_name: fiware-ld-context
  ports:
    - "3004:80"
  volumes:
    - data-models:/usr/local/apache2/htdocs/
  healthcheck:
    test: (wget --server-response --spider --quiet  http://ld-context/ngsi-context.jsonld 2>&1 | awk 'NR==1{print $$2}'|  grep -q -e "200") || exit 1
```

All containers reside on the same network - the Scorpop Context Broker is listening on Port `9090` internally and `1026` externally and PostGres is
listening on the default port `5432` and the httpd web server is offering `@context` files on port `80`. All containers
are also exposing ports externally - this is purely for the tutorial access - so that cUrl or Postman can access them
without being part of the same network. The command-line initialization should be self-explanatory.

---

## Start Up

All services can be initialised from the command-line by running the [services](/services) Bash script provided within
the repository. Please clone the repository and create the necessary images by running the commands as shown:

```bash
git clone http://github.com/fiware/tutorials.Extended-Properties.git
cd tutorials.Extended-Properties

./services [start]
```

> **Note**
>
> If you want to clean up and start over again you can do so with the following command:
>
> ```
> ./services stop
> ```


### Reading `@context` files

Two `@context` files have been generated and hosted on the tutorial application. They would be used by different organizations within the data space, and internally they define the names of attributes and enumerations in different ways.

- [`ngsi-context.jsonld`](http://localhost:3000/data-models/ngsi-context.jsonld) -The **NGSI-LD** `@context` serves to
  define all attributes when sending data to the context broker or retrieving data. This
  `@context` must be used for all **NGSI-LD** to **NGSI-LD** interactions.

- [`alternate-context.jsonld`](http://localhost:3000/data-models/alternate-context.jsonld) is an alternative
  **JSON-LD** definition of the attributes of the data models used by a third-party. In this case we have a German speaking customer who wishes to have all attribute names and enumerations to be defined using terminology common in the German language. Effectively, internally within their billing application a different set of short names for attributes is used. Their `@context` file reflects
  the agreed mapping between attribute names.

The full data model description for a **Building** entity as used in this tutorial is based on the standard
[Smart Data Models definition](https://github.com/smart-data-models/dataModel.Building/tree/master/Building).
A [Swagger Specification](https://petstore.swagger.io/?url=https://smart-data-models.github.io/dataModel.Building/Building/swagger.yaml)
of the same model is also available, and would be used to generate code stubs in a full application.


## Working with multilanguage properties

Sometimes, it is required to localize strings to offer variations for different languages in the creation and consumption of Entity data. In order to
proceed, we need to create initially a new entity data that defines the new data type `LanguageProperty` and use the
sub-attribute `LanguageMap` (and not `value`) to keep the representation of the values of this attribute in different
languages.

This `LanguageMap` corresponds to a JSON object consisting of a series of simplified pairs where the keys shall be JSON
strings representing [IETF RFC 5646](https://www.rfc-editor.org/info/rfc5646) language codes.

### Creating a new data entity

This example creates an entity with a **LanguageProperty** and a **VocabularyProperty**.
Let's create a farm **Building** entity in which we want to make the `name` available in three different languages, _English_, _German_, and _Japanese_. The process will be to
send a **POST** request to the Broker with the following information:

#### 1️⃣ Request:

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entities/' \
-H 'Content-Type: application/ld+json' \
--data-raw '{
    "id": "urn:ngsi-ld:Building:farm001",
    "type": "Building",
    "category": {
        "type": "VocabularyProperty",
        "vocab": ["farm"]
    },
    "address": {
        "type": "Property",
        "value": {
            "streetAddress": "Großer Stern 1",
            "addressRegion": "Berlin",
            "addressLocality": "Tiergarten",
            "postalCode": "10557"
        },
        "verified": {
            "type": "Property",
            "value": true
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
        "type": "LanguageProperty",
        "languageMap": {
          "en": "Victory Farm",
          "de": "Bauernhof von Sieg",
          "ja": "ビクトリーファーム"
        }
    },
    "@context": "http://context/ngsi-context.jsonld"
}'
```

#### Response:

The response that we obtain will be something similar (except the `Date` value) to the following content:

```bash
HTTP/1.1 201 Created
Date: Sat, 16 Dec 2023 08:39:32 GMT
Location: /ngsi-ld/v1/entities/urn:ngsi-ld:Building:farm001
Content-Length: 0
```

#### 2️⃣ Request:

This example creates a second entity with a **LanguageProperty** and a **VocabularyProperty**.
Each subsequent entity must have a unique `id` for the given `type`. Note that within a `languageMap`, the `@none` simplified pair indicates the default fallback value to be displayed for unknown languages.

```bash
curl -iX POST 'http://localhost:1026/ngsi-ld/v1/entities/' \
  -H 'Content-Type: application/json' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d '{
    "id": "urn:ngsi-ld:Building:barn002",
    "type": "Building",
    "category": {
        "type": "VocabProperty",
        "vocab": ["barn"]
    },
    "address": {
        "type": "Property",
        "value": {
            "streetAddress": "Straße des 17. Juni",
            "addressRegion": "Berlin",
            "addressLocality": "Tiergarten",
            "postalCode": "10557"
        },
        "verified": {
            "type": "Property",
            "value": true
        }
    },
     "location": {
        "type": "GeoProperty",
        "value": {
             "type": "Point",
              "coordinates": [13.3698, 52.5163]
        }
    },
    "name": {
        "type": "LanguageProperty",
        "languageMap": {
          "@none": "The Big Red Barn",
          "en": "Big Red Barn",
          "de": "Große Rote Scheune",
          "ja": "大きな赤い納屋"
        }
    }
}'
```

### Reading multilingual data in normalised format

This example retrieves a **LanguageProperty** in normalized format. If we want to get `name` of a specific entity (`urn:ngsi-ld:Building:farm001`) in normalised
format and without any reference to the language that we want to obtain the data. We should execute the following
command:

#### 3️⃣ Request:

```bash
curl -G -X  GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:farm001' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'attrs=name'
```

And the response that we obtain the whole `languageMap` including all the string values defined for the different languages:

#### Response:

```json
{
  "id": "urn:ngsi-ld:Building:farm001",
  "type": "Building",
  "name": {
    "type": "LanguageProperty",
    "languageMap": {
      "en": "Victory Farm",
      "de": "Bauernhof von Sieg",
      "ja": "ビクトリーファーム"
    }
  }
}
```

On the other hand, if we decided to specify that we wanted to receive the value (or values) but only in _German_
language, we should specify the corresponding query parameter `lang` equal to `de`.

#### 4️⃣ Request:

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:farm001' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'  \
  -d 'attrs=name' \
  -d 'lang=de'
```

In this case, the response provides a new sub-attribute `lang` with the details of the language that was selected (`"lang": "de"`)
together with the sub-attribute `value` with the content of the string in the corresponding _German_ language. It is
important to notice that in this response the value of `type` is now _Property_ and there is no `LanguageMap` but `value`
sub-attribute.

#### Response:

```json
{
  "id": "urn:ngsi-ld:Building:farm001",
  "type": "Building",
  "name": {
    "type": "Property",
    "lang": "de",
    "value": "Bauernhof von Sieg"
  }
}
```

### Reading multilingual data in simplified format

This example retrieves a **LanguageProperty** in key-values format.
If we wanted to get the response in simplified format, we need to send the corresponding request parameter `format`
equal to `simplified`:

#### 5️⃣ Request:

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:farm001' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'attrs=name' \
  -d 'format=simplified'
```

Note that `format=simplified` could also be specified as `option=simplified` or using the alias `keyValues`.

#### Response:

The **Language Property** is returned within the `languageMap` attribute.

```json
{
  "id": "urn:ngsi-ld:Building:farm001",
  "type": "Building",
  "name": {
    "languageMap": {
      "en": "Victory Farm",
      "de": "Bauernhof von Sieg",
      "ja": "ビクトリーファーム"
    }
  }
}
```

and if we wanted to get only the corresponding value of the `name` in **English** language,
the `lang=en` parameter must be present in the request.

#### 6️⃣ Request:

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:farm001' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'attrs=name' \
  -d 'format=simplified' \
  -d 'lang=en'
```

#### Response:

In this case, the **Language Property** is returned as an ordinary **Property** and only
the value of the _English_ string is returned. Sub attributes are not returned in the simplified format.

```json
{
  "id": "urn:ngsi-ld:Building:farm001",
  "type": "Building",
  "name": "Victory Farm"
}
```

### Fallbacks when requesting data for an unsupported Language

Not all languages will necessarily be present within a `languageMap`. If an unsupported language (like _French_ `lang=fr`) is requested, the context broker will try its best to return
some data in an alternate language instead. The preferred default is the `@none` language, but if this is not present, any other language can be returned.

#### 7️⃣ Request:

For `urn:ngsi-ld:Building:barn002` return the name of the enity in _French_ by adding the `lang=fr` parameter

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:barn002' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'Accept: application/ld+json'  \
  -d 'type=Building' \
  -d 'attrs=name' \
  -d 'lang=fr'
```

#### Response:

Since **French** is not a supported language for this Entity, but a default alternative is present (as
indicated by the `@none` attribute), the default `@none` value is returned.
The **Language Property** is returned as an ordinary **Property** and only
the value of the default string is returned.

```json
{
  "id": "urn:ngsi-ld:Building:barn002",
  "type": "Building",
  "name": {
    "type": "Property",
    "lang": "@none",
    "value": "The Big Red Barn"
  },
  "@context": [
    "http://context/ngsi-context.jsonld",
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
  ]
}
```

#### 8️⃣ Request:

For `urn:ngsi-ld:Building:farm001` return the name of the entity in _French_ by adding the `lang=fr` parameter

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:farm001' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'Accept: application/ld+json'  \
  -d 'type=Building' \
  -d 'attrs=name' \
  -d 'lang=fr'
```

#### Response:

Since _French_ is not a supported language, and not default alternative is present (as
indicated by the `@none` attribute), another value in the set is returned, in this
case the string in **English** as shown by the `"@lang": "en"` sub-property.
Once again the **Language Property** is returned as an ordinary **Property** and only
the value of the _English_ string is returned.

```json
{
  "id": "urn:ngsi-ld:Building:farm001",
  "type": "Building",
  "name": {
    "type": "Property",
    "lang": "en",
    "value": "Victory Farm"
  },
  "@context": [
    "http://context/ngsi-context.jsonld",
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
  ]
}
```

### Querying for Multilingual Data

Use the standard Object attribute bracket `[ ]` notation when querying individual languages within `LanguageProperties`. For example, if we want to
obtain the Building whose name is equal to `Big Red Barn` in _English_.

#### 9️⃣ Request:

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'Accept: application/ld+json'  \
  -d 'type=Building' \
  -d 'attrs=name' \
  -d 'q=name[en]==%22Big%20Red%20Barn%22'
```

#### Response:

```json
[
  {
    "id": "urn:ngsi-ld:Building:barn002",
    "type": "Building",
    "name": {
      "type": "LanguageProperty",
      "languageMap": {
        "@none": "The Big Red Barn",
        "en": "Big Red Barn",
        "de": "Große Rote Scheune",
        "ja": "大きな赤い納屋"
      }
    },
    "@context": [
      "http://context/ngsi-context.jsonld",
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  }
]
```

Now, I wanted to receive the response but corresponding to `Big Red Barn` in _Any_ language:
Using the Asterisk Syntax `*` to check for data in all available languages.

#### 1️⃣0️⃣ Request:

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -H 'Accept: application/ld+json'  \
  -d 'type=Building' \
  -d 'attrs=name' \
  -d 'q=name[*]==%22Big%20Red%20Barn%22'
```

#### Response:

```json
[
  {
    "id": "urn:ngsi-ld:Building:barn002",
    "type": "Building",
    "name": {
      "type": "LanguageProperty",
      "languageMap": {
        "@none": "The Big Red Barn",
        "en": "Big Red Barn",
        "de": "Große Rote Scheune",
        "ja": "大きな赤い納屋"
      }
    },
    "@context": [
      "http://context/ngsi-context.jsonld",
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  }
]
```

## Enumerations and using an alternative `@context`

The User's `@context` is a mechanism for mapping URNs and defining the Entities held within
the system It is therefore possible to retrieve _the same
data_ using a different set of short names for the attributes, and in the case of a **VocabularyProperty**, different short names for the values of the attributes themselves. This is particularly useful when dealing with distributed data, federations and data spaces as the end user many not have full control of data held within another participant's context broker.

When the **Building** entities were created, we used an `@context` file called `ngsi-context.jsonld`.
Within the `ngsi-context.jsonld` file, we have already mapped many terms as shown:

```json
{
  "@context": {
    "type": "@type",
    "id": "@id",
    "ngsi-ld": "https://uri.etsi.org/ngsi-ld/",
    "fiware": "https://uri.fiware.org/ns/dataModels#",
    "Building": "fiware:Building",
    "barn": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dbarn",
    "category": "fiware:category",
    "farm": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dfarm"
  }
}
```

This means that internally the long URIs for the `category` are being used, as can be proven by making a request without adding a User `@context`.

#### 1️⃣1️⃣ Request:

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
  -H 'Accept: application/ld+json'  \
  -d 'type=https://uri.fiware.org/ns/dataModels%23Building' \
  -d 'attrs=https://uri.fiware.org/ns/dataModels%23category'
```

#### Response:

As can be seen, two Building entities are returned with the long names for all the attributes, and in the case of a `vocab` for the attribute value as well.
Terms defined in the core context (such as `id`, `type`, `vocab` and `VocabularyProperty`) are not
expanded, as the core context is implied as a default.

```json
[
  {
    "id": "urn:ngsi-ld:Building:farm001",
    "type": "https://uri.fiware.org/ns/dataModels#Building",
    "https://uri.fiware.org/ns/dataModels#category": {
      "type": "VocabularyProperty",
      "vocab": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dfarm"
    },
    "@context": [
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  },
  {
    "id": "urn:ngsi-ld:Building:barn002",
    "type": "https://uri.fiware.org/ns/dataModels#Building",
    "https://uri.fiware.org/ns/dataModels#category": {
      "type": "VocabularyProperty",
      "vocab": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dbarn"
    },
    "@context": [
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  }
]
```

#### 1️⃣2️⃣ Request:

If the `ngsi-context.jsonld` `@context` is included as a `Link` header in the request, the response will convert all the attribute names to short names, and in the case of a **VocabularyProperty**, use the short names for the value as well.

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
  -H 'Accept: application/ld+json'  \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Building' \
  -d 'attrs=category'
```

#### Response:

In the response the categories `farm` and `barn` are used.

```json
[
  {
    "id": "urn:ngsi-ld:Building:farm001",
    "type": "Building",
    "category": {
      "type": "VocabularyProperty",
      "vocab": "farm"
    },
    "@context": [
      "http://context/ngsi-context.jsonld",
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  },
  {
    "id": "urn:ngsi-ld:Building:barn002",
    "type": "Building",
    "category": {
      "type": "VocabularyProperty",
      "vocab": "barn"
    },
    "@context": [
      "http://context/ngsi-context.jsonld",
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  }
]
```

The `alternate-context.jsonld` `@context` file maps all the terms and enumerations to the names in German as shown:

```json
{
  "@context": {
    "type": "@type",
    "id": "@id",
    "ngsi-ld": "https://uri.etsi.org/ngsi-ld/",
    "fiware": "https://uri.fiware.org/ns/dataModels#",
    "Gebäude": "fiware:Building",
    "scheune": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dbarn",
    "kategorie": "fiware:category",
    "bauernhof": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dfarm"
  }
}
```

#### 1️⃣3️⃣ Request:

When `alternate-context.jsonld` included as a `Link` header in the request, the response will convert all the attribute names to short names used in `alternate-context.jsonld`, and in the case of a **VocabularyProperty**, return the short names for the value as well.

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
  -H 'Accept: application/ld+json'  \
  -H 'Link: <http://context/alternate-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'type=Geb%C3%A4ude' \
  -d 'attrs=kategorie'
```

#### Response:

In the response the category attribute is renamed `kategorie` and the values `bauernhof` and `scheune` are used. The shortname of the Entity `type` has also been amended.

```json
[
  {
    "id": "urn:ngsi-ld:Building:farm001",
    "type": "Gebäude",
    "kategorie": {
      "type": "VocabularyProperty",
      "vocab": "bauernhof"
    },
    "@context": [
      "http://context/alternate-context.jsonld",
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  },
  {
    "id": "urn:ngsi-ld:Building:barn002",
    "type": "Gebäude",
    "kategorie": {
      "type": "VocabularyProperty",
      "vocab": "scheune"
    },
    "@context": [
      "http://context/alternate-context.jsonld",
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  }
]
```

#### 1️⃣4️⃣ Request:

To make a key-values or simplified request, include the `format=simplified'` parameter

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:Building:barn002' \
  -H 'Accept: application/ld+json'  \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"' \
  -d 'attrs=category' \
  -d 'format=simplified'
```

#### Response:

The simplified response retains the `vocab` attribute (which implies that the right-hand side of the `category` attribute can be re-expanded using JSON-LD `@vocab`)

```json
{
  "id": "urn:ngsi-ld:Building:barn002",
  "type": "Building",
  "category": {
    "vocab": "barn"
  },
  "@context": [
    "http://context/nsgi-context.jsonld",
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
  ]
}
```

#### 1️⃣5️⃣ Request:

When querying using the `q` parameter, also include the `expandValues` parameter to indicate which attributes in the query are **VocabularyProperties**

```bash
curl -G -X GET 'http://localhost:1026/ngsi-ld/v1/entities/' \
  -H 'Accept: application/ld+json'  \
  -H 'Link: <http://context/ngsi-context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/json"' \
  -d 'type=Building' \
  -d 'attrs=category' \
  -d 'q=category==%22barn%22' \
  -d 'expandValues=category'
```

#### Response:

```json
[
  {
    "id": "urn:ngsi-ld:Building:barn002",
    "type": "Building",
    "category": {
      "type": "VocabularyProperty",
      "vocab": "barn"
    },
    "@context": [
      "http://context/ngsi-context.jsonld",
      "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context-v1.7.jsonld"
    ]
  }
]
```
