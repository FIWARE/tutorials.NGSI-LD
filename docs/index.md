# <span style='color:#d6604d'>NGSI-LD</span> Step-by-Step

[![Documentation](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/documentation.svg)](https://fiware-tutorials.rtfd.io)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.04.01_60/gs_cim009v010401p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)

This is a collection of **NGSI-LD** tutorials for the FIWARE system. Each tutorial consists of a series of exercises to
demonstrate the correct use of individual FIWARE components and shows the flow of context data within a simple Smart
Solution either by connecting to a series of dummy IoT devices or manipulating the context directly or programmatically.

<h3>How to Use</h3>

Each tutorial is a self-contained learning exercise designed to teach the developer about a single aspect of FIWARE. A
summary of the goal of the tutorial can be found in the description at the head of each page. Every tutorial is
associated with a GitHub repository holding the configuration files needed to run the examples. Most of the tutorials
build upon concepts or enablers described in previous exercises the to create a complex smart solution which is
_"powered by FIWARE"_.

The tutorials are split according to the chapters defined within the
[FIWARE catalog](https://www.fiware.org/developers/catalogue/) and are numbered in order of difficulty within each
chapter hence an introduction to a given enabler will occur before the full capabilities of that element are explored in
more depth.

It is recommended to start with reading the full **Core Context Management: The NGSI-LD Interface** Chapter before
moving on to other subjects, as this will give you a fuller understanding of the role of context data in general.
However, it is not necessary to follow all the subsequent tutorials sequentially - as FIWARE is a modular system, you
can choose which enablers are of interest to you.

## Prerequisites

### Swagger <img src="https://static1.smartbear.co/swagger/media/assets/swagger_fav.png" align="left"  height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

The OpenAPI Specification (commonly known as Swagger) is an API description format for REST APIs. A Swagger spec allows
you to describe an entire API (such as NGSI-LD itself) however in this tutorial we shall be concentrating on using
Swagger to define data models.

API specifications can be written in YAML or JSON. The format is easy to learn and readable to both humans and machines.
The complete OpenAPI Specification can be found on GitHub:
[OpenAPI 3.0 Specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md). This is
important since we will need a well-defined structure to be able to generate `@context` files.

### Docker and Docker Compose <img src="./img/docker.ico" align="left"  height="36" width="36" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

To keep things simple, all components will be run using [Docker](https://www.docker.com). **Docker** is a container
technology which allows to different components isolated into their respective environments.

-   To install Docker on Windows follow the instructions [here](https://docs.docker.com/docker-for-windows/).
-   To install Docker on Mac follow the instructions [here](https://docs.docker.com/docker-for-mac/).
-   To install Docker on Linux follow the instructions [here](https://docs.docker.com/install/).

**Docker Compose** is a tool for defining and running multi-container Docker applications. A series of `*.yaml` files
are used to configure the required services for the application. This means all container services can be brought up in
a single command. Docker Compose is installed by default as part of Docker for Windows and Docker for Mac, however Linux
users will need to follow the instructions found [here](https://docs.docker.com/compose/install/).

You can check your current **Docker** and **Docker Compose** versions using the following commands:

```bash
docker-compose -v
docker version
```

> **Important** In recent versions, `docker-compose` is already included as part of the main `docker` client, Please
> ensure that you are using Docker version 20.10 or higher and Docker Compose 1.29 or higher and upgrade if necessary.
> If you are unable to upgrade and stuck using an older version you can still run the tutorials by adding a `legacy`
> parameter at the end the `./services` script commands e.g. `services start legacy`

If using a linux distro with an outdated docker-compose, the files can be installed directly as shown:

```bash
sudo curl -L "https://github.com/docker/compose/releases/download/1.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

If you are using docker-compose in Ubuntu with VMware and faced the following error: _ERROR: Couldn't connect to Docker
daemon at `http+docker://localunixsocket` - is it running?_

It can be solved by owning the `/var/run/docker.sock` Unix socket as shown:

```bash
sudo chown $USER /var/run/docker.sock
```

### Postman <img src="./img/postman.png" align="left"  height="25" width="35" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

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

### Apache Maven <img src="./img/maven.png" align="left"  height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

[Apache Maven](https://maven.apache.org/download.cgi) is a software project management and comprehension tool. Based on
the concept of a project object model (POM), Maven can manage a project's build, reporting and documentation from a
central piece of information. Maven can be used to define and download our dependencies and to build and package Java or
Scala code into a JAR file.

## Data models

The tutorials define a series of data-models to be used within the `@context`. More information about the classes and
attributes used can be found in the following:

-   <img src="./img/json-ld.ico" align="center" height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent" alt="NGSI-LD" />
    <a href="https://ngsi-ld-tutorials.readthedocs.io/en/latest/datamodels.html">Tutorial-specific Data Models</a>.
-   <img src="./img/json-ld.ico" align="center" height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent" alt="NGSI-LD" />
    <a href="https://smartdatamodels.org">Smart Data Models</a>.

## List of Tutorials

<h3 style="box-shadow: 0px 4px 0px 0px #233c68;">Core Context Management: The NGSI-LD Interface</h3>

These first tutorials are an introduction to the NGSI-LD Context Brokers, and are an essential first step when learning
to use NGSI-LD.

&nbsp; 101. [Understanding `@context`](understanding-@context.md)<br/> &nbsp; 102.
[Working with `@context`](working-with-@context.md)<br/> &nbsp; 103. [CRUD Operations](ngsi-ld-operations.md)<br/>
&nbsp; 104. [Entity Relationships](entity-relationships.md)<br/> &nbsp; 106. [Subscriptions](subscriptions.md)<br/>
&nbsp; 107. [Temporal Operations](short-term-history.md)<br/>

<h3 style="box-shadow: 0px 4px 0px 0px #5dc0cf;">Internet of Things, Robots and third-party systems</h3>

In order to make a context-based system aware of the state of the real world, it will need to access information from
Robots, IoT Sensors or other suppliers of context data such as social media. It is also possible to generate commands
from the context broker to alter the state of real-world objects themselves.

&nbsp; 201. [Introduction to IoT Sensors](iot-sensors.md)<br/> &nbsp; 202.
[Provisioning the Ultralight IoT Agent](iot-agent.md)<br/> &nbsp; 203.
[Provisioning the JSON IoT Agent](iot-agent-json.md)<br/>

<h3 style="box-shadow: 0px 4px 0px 0px #233c68;">Core Context Management: History Management</h3>

These tutorials show how to manipulate and store context data, so it can be used for further processing.

&nbsp; 304. [Querying Time Series Data (Crate-DB)](time-series-data.md)<br/> &nbsp; 305.
[Big Data Analysis (Flink)](big-data-flink.md)<br/> &nbsp; 306. [Big Data Analysis (Spark)](big-data-spark.md)<br/>

<h3 style="box-shadow: 0px 4px 0px 0px #ff7059;">Security: Identity Management</h3>

These tutorials show how to create and administer users within an application, and how to restrict access to assets, by
assigning roles and permissions.

&nbsp; 401. [Administrating Users and Organizations](identity-management.md)<br/> &nbsp; 402.
[Managing Roles and Permissions](roles-permissions.md)<br/>

<h3 style="box-shadow: 0px 4px 0px 0px #88a1ce;">Processing, Analysis and Visualization</h3>

These tutorials show how to create, process, analyze or visualize context information.

&nbsp; 507. [Cloud-Edge Computing](edge-computing.md)<br/>
