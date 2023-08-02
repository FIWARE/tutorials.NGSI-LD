# Smart Farm Tutorials[<img src="https://img.shields.io/badge/NGSI-LD-d6604d.svg" width="90"  align="left" />](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf) [<img src="docs/img/logo.png" align="left" width="162">](https://www.fiware.org/) <br/>

[![Documentation](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/documentation.svg)](https://ngsi-ld-tutorials.rtfd.io)
[![License: MIT](https://img.shields.io/github/license/fiware/tutorials.Step-by-Step.svg)](https://opensource.org/licenses/MIT)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)
[![Docker badge](https://img.shields.io/badge/quay.io-fiware%2Ftutorials.ngsi--ld-grey?logo=red%20hat&labelColor=EE0000)](https://quay.io/repository/fiware/tutorials.ngsi-ld)
<br> [![Documentation](https://img.shields.io/readthedocs/ngsi-ld-tutorials.svg)](https://ngsi-ld-tutorials.rtfd.io)
[![CI](https://github.com/FIWARE/tutorials.NGSI-LD/workflows/CI/badge.svg)](https://github.com/FIWARE/tutorials.NGSI-LD/actions?query=workflow%3ACI)

This is a collection of tutorials for the FIWARE ecosystem designed for **NGSI-LD** developers. Each tutorial consists
of a series of exercises to demonstrate the correct use of individual FIWARE components and shows the flow of context
data within a simple Smart Solution either by connecting to a series of dummy IoT devices or manipulating the context
directly or programmatically.

| :books: <br>[NGSI-LD<br>Documentation](https://ngsi-ld-tutorials.rtfd.io/) | <img src="https://assets.getpostman.com/common-share/postman-logo-stacked.svg" align="center" height="25"> <br/>[Postman<br>Collections](https://explore.postman.com/team/3mM5EY6ChBYp9D) | [![Docker Hub](https://nexus.lab.fiware.org/repository/raw/public/badges/docker/fiware.svg)](https://hub.docker.com/u/fiware) <br> [![Quay.io](https://img.shields.io/badge/quay.io-fiware-grey?logo=red%20hat&labelColor=EE0000)](https://quay.io/organization/fiware) <br> [![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/fiware)](https://artifacthub.io/packages/search?repo=fiware) | <img src="https://fiware.github.io/catalogue/img/fiware-emoji.png" height="30px" width="30px"/> <br/> [**developer.&ZeroWidthSpace;fiware.org**](https://www.fiware.org/developers/) |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |

<h3>Data models</h3>

The tutorials define a series of data-models to be used within the `@context`. More information about the classes and
attributes used can be found in the following:

-   <img src="https://json-ld.org/favicon.ico" align="center" height="25" alt="NGSI-LD"/>
    <a href="https://ngsi-ld-tutorials.readthedocs.io/en/latest/datamodels.html">Tutorial-specific Data Models</a>.
-   <img src="https://json-ld.org/favicon.ico" align="center" height="25" alt="NGSI-LD"/>
    <a href="https://smartdatamodels.org">Smart Data Models</a>.

## Install

To download the full set of tutorials, simply clone this repository:

```console
git clone https://github.com/FIWARE/tutorials.NGSI-LD.git
cd tutorials.NGSI-LD/
git submodule update --init --recursive
```

### Swagger <img src="https://static1.smartbear.co/swagger/media/assets/swagger_fav.png" align="left"  height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

The OpenAPI Specification (commonly known as Swagger) is an API description format for REST APIs. A Swagger spec allows
you to describe an entire API (such as NGSI-LD itself) however in this tutorial we shall be concentrating on using
Swagger to define data models.

API specifications can be written in YAML or JSON. The format is easy to learn and readable to both humans and machines.
The complete OpenAPI Specification can be found on GitHub:
[OpenAPI 3.0 Specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md). This is
important since we will need a well-defined structure to be able to generate `@context` files.

### Docker and Docker Compose <img src="https://www.docker.com/favicon.ico" align="left"  height="36" width="36">

Each tutorial runs all components using [Docker](https://www.docker.com). **Docker** is a container technology which
allows to different components isolated into their respective environments.

-   To install Docker on Windows follow the instructions [here](https://docs.docker.com/docker-for-windows/).
-   To install Docker on Mac follow the instructions [here](https://docs.docker.com/docker-for-mac/).
-   To install Docker on Linux follow the instructions [here](https://docs.docker.com/install/).

**Docker Compose** is a tool for defining and running multi-container Docker applications. A series of `*.yaml` files
are used configure the required services for the application. This means all container services can be brought up in a
single command. Docker Compose is installed by default as part of Docker for Windows and Docker for Mac, however Linux
users will need to follow the instructions found [here](https://docs.docker.com/compose/install/).

You can check your current **Docker** and **Docker Compose** versions using the following commands:

```console
docker-compose -v
docker version
```

Please ensure that you are using Docker version 20.10 or higher and Docker Compose 1.29 or higher and upgrade if
necessary.

Although not officially supported, older versions of docker without an integrated docker-compose can be run by adding
`legacy` to all bash script commands:

```console
./services start legacy
```

### Postman <img src="docs/img/postman.png" align="left"  height="32" width="32">

The tutorials which use HTTP requests supply a collection for use with the Postman utility. Postman is a testing
framework for REST APIs. The tool can be downloaded from [www.postman.com](https://www.postman.com/downloads/). All the
FIWARE Postman collections can be downloaded directly from the
[Postman API network](https://explore.postman.com/team/3mM5EY6ChBYp9D).

### GitPod <img src="https://gitpod.io/favicon.ico" align="left"  height="30" width="30">

[Gitpod](https://github.com/gitpod-io/gitpod) is an open-source Kubernetes application for ready-to-code cloud
development environments that spins up an automated dev environment for each task, in the cloud. It enables you to run
the tutorials in a cloud development environment directly from your browser or your Desktop IDE.

### Cygwin for Windows <img src="https://www.cygwin.com/favicon.ico" align="left"  height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

The tutorials start up their services using a simple Bash script. When working locally, Windows users should download
[cygwin](http://www.cygwin.com/) to provide a command-line functionality similar to a Linux distribution on Windows.

## Tutorials List[<img src="https://img.shields.io/badge/NGSI-LD-d6604d.svg" width="90"  align="left" />](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.07.01_60/gs_cim009v010701p.pdf)

### Core Context Management: NGSI-LD Fundamentals

&nbsp; 101. [Understanding `@context`](https://github.com/FIWARE/tutorials.Understanding-At-Context) <br/> &nbsp; 102.
[Working with `@context`](https://github.com/FIWARE/tutorials.Getting-Started/tree/NGSI-LD) <br/> &nbsp; 103.
[CRUD Operations](https://github.com/FIWARE/tutorials.CRUD-Operations/tree/NGSI-LD) <br/> &nbsp; 104.
[Concise Payloads](https://github.com/FIWARE/tutorials.Concise/tree/NGSI-LD) <br/> &nbsp; 105.
[Merge-Patch and Put](https://github.com/FIWARE/tutorials.Merge-Patch-Put/tree/NGSI-LD) <br/> &nbsp; 106.
[Entity Relationships](https://github.com/FIWARE/tutorials.Entity-Relationships/tree/NGSI-LD) <br/> &nbsp; 107.
[Subscriptions](https://github.com/FIWARE/tutorials.Subscriptions/tree/NGSI-LD) <br/> &nbsp; 108.
[Temporal Operations](https://github.com/FIWARE/tutorials.Short-Term-History/tree/NGSI-LD) <br/>

### Internet of Things, Robots and third-party systems

&nbsp; 201. [Introduction to IoT Sensors](https://github.com/FIWARE/tutorials.IoT-Sensors/tree/NGSI-LD) <br/>
&nbsp; 202. [Provisioning the Ultralight IoT Agent](https://github.com/FIWARE/tutorials.IoT-Agent/tree/NGSI-LD) <br/>
&nbsp; 203. [Provisioning the JSON IoT Agent](https://github.com/FIWARE/tutorials.IoT-Agent-JSON/tree/NGSI-LD) <br/>

### Core Context Management: Manipulating Context Data and Persisting Historic Data

&nbsp; 304. [Querying Time Series Data (QuantumLeap)](https://github.com/FIWARE/tutorials.Time-Series-Data/tree/NGSI-LD)
<br/> &nbsp; 305. [Big Data Analysis (Flink)](https://github.com/FIWARE/tutorials.Big-Data-Flink/tree/NGSI-LD) <br/>
&nbsp; 306. [Big Data Analysis (Spark)](https://github.com/FIWARE/tutorials.Big-Data-Spark/tree/NGSI-LD)

### Security: Identity Management

&nbsp; 401. [Managing Users and Organizations](https://github.com/FIWARE/tutorials.Identity-Management/tree/NGSI-v2)
<br/> &nbsp; 402. [Roles and Permissions](https://github.com/FIWARE/tutorials.Roles-Permissions/tree/NGSI-v2)

### Processing, Analysis and Visualization

&nbsp; 507. [Cloud-Edge Computing](https://github.com/FIWARE/tutorials.Edge-Computing/tree/NGSI-LD)

## Usage

Most tutorials supply a `services` script to start the containers:

```console
cd <tutorial-name>
git checkout NGSI-LD
./services start
```

### Following the tutorial exercises via Postman

Each tutorial submodule contains one or more `docker-compose.yml` files, along with a Postman collection containing the
necessary HTTP requests: import the collection into Postman and follow the instructions.

### Following the tutorial exercises from the command-line

Each submodule contains full instructions in README which details the appropriate bash commands (cUrl and Docker
Compose) to run.

Full instructions can be found within the [documentation](https://ngsi-ld-tutorials.rtfd.io/)

---

## License

[MIT](LICENSE) © 2020-2023 FIWARE Foundation e.V.
