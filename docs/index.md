# <span style='color:#d6604d'>NGSI-LD</span> Step-by-Step

[![Documentation](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/documentation.svg)](https://fiware-tutorials.rtfd.io)
[![NGSI LD](https://img.shields.io/badge/NGSI-LD-d6604d.svg)](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_cim009v010801p.pdf)
[![JSON LD](https://img.shields.io/badge/JSON--LD-1.1-f06f38.svg)](https://w3c.github.io/json-ld-syntax/)
[![Support badge](https://img.shields.io/badge/tag-fiware-orange.svg?logo=stackoverflow)](https://stackoverflow.com/questions/tagged/fiware)

<div id="social-meta">
<meta property="og:title" content="A collection of NGSI-LD tutorials for the FIWARE system">
<meta property="og:description" content="Each tutorial consists of a series of exercises to demonstrate the correct use of individual FIWARE components.">
<meta property="og:type" content="documentation">
<meta property="og:url" content="https://ngsi-ld-tutorials.readthedocs.io/en/latest/">
<meta property="og:image" content="https://www.fiware.org/wp-content/uploads/FF_Banner_General.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@FIWARE">
<meta name="twitter:title" content="About
The process for commercial software to apply as powered by FIWARE or FIWARE-Ready">
<meta name="twitter:description" content="A series of exercises to demonstrate the correct use of individual FIWARE component.">
<meta name="twitter:image" content="https://www.fiware.org/wp-content/uploads/FF_Banner_General.png">
</div>

This is a collection of **NGSI-LD** tutorials for the FIWARE system. Each tutorial consists of a series of exercises to
demonstrate the correct use of individual FIWARE components and shows the flow of context data within a simple Smart
Solution either by connecting to a series of dummy IoT devices or manipulating the context directly or programmatically.

<!-- Global Summit
<a href="https://www.fiware.org/global-summit/"><img src="https://fiware.github.io//catalogue/img/Summit25.png" width="240" height="70" /></a> &nbsp; <a href="https://www.eventbrite.co.uk/e/fiware-global-summit-2025-rabat-smart-city-morocco-tickets-1249129843989"><img src="https://fiware.github.io//catalogue/img/Training25.png" width="240" height="70" /></a> 
-->

<blockquote>
<h3>Should I use NGSI-LD or NGSI-v2?</h3>
<p>
    FIWARE offers two flavours of the NGSI interfaces:
</p>
<ul>
    <li><b style="color:#777;">NGSI-v2</b> offers JSON based interoperability used in individual Smart Systems</li>
    <li><b style="color:#777;">NGSI-LD</b> offers JSON-LD based interoperability used for Federations and Data Spaces</li>
</ul>
<p>
    Of the two, NGSI-LD is more complex and relies on the introduction of a JSON-LD <code style="color:#777;">@context</code>. A full understanding of JSON-LD (Linked Data) is required to obtain the benefits of NGSI-LD , which allows for interoperability across apps and
    organisations.
</p>
<p>
    In general, you should use NGSI-LD when creating a data space or introducing a system of systems aproach.
</p>
<p>
    Use NGSI-v2 for simpler isolated systems. More information about NGSI-v2 can be found <a href="https://fiware-tutorials.readthedocs.io/">here</a>
</p>
</blockquote>

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

The NGSI-LD tutorials are designed to run under any Unix environment, the tested configuration and
[GitPod](https://github.com/gitpod-io/gitpod) environment is currently based on Ubuntu 22.04.2 LTS. However, there may
be some minor issues when running the tutorials directly on Windows machines or Apple M1 Silicon `amd64` systems, and
the following [Virtual Box set-up](virtual-box.md) or [WSL set-up](wsl.md) can be used when facing issues.

### Docker and Docker Compose <img src="https://www.docker.com/favicon.ico" align="left"  height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

To keep things simple all components will be run using [Docker](https://www.docker.com). **Docker** is a container
technology which allows to different components isolated into their respective environments.

-   To install Docker on Windows follow the instructions [here](https://docs.docker.com/docker-for-windows/).
-   To install Docker on Mac/OS follow the instructions [here](https://docs.docker.com/docker-for-mac/).
-   To install Docker on Unix follow the instructions [here](./docker-ubuntu.md).

### Postman <img src="./img/postman.png" align="left"  height="25" width="35" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

The tutorials which use HTTP requests supply a collection for use with the Postman utility. Postman is a testing
framework for REST APIs. The tool can be downloaded from [www.getpostman.com](https://www.getpostman.com). All the
FIWARE Postman collections can be downloaded directly from the
[Postman API network](https://explore.postman.com/team/3mM5EY6ChBYp9D).

### GitPod <img src="https://gitpod.io/favicon.ico" align="left"  height="30" width="30">

[Gitpod](https://github.com/gitpod-io/gitpod) is an open-source Kubernetes application for ready-to-code cloud
development environments that spins up an automated dev environment for each task, in the cloud. It enables you to run
the tutorials in a cloud development environment directly from your browser or your Desktop IDE. The default environment
is based on Ubuntu and includes Java `11.0.16` and Maven `3.8.6`.

### Apache Maven <img src="https://maven.apache.org/favicon.ico" align="left"  height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

[Apache Maven](https://maven.apache.org/download.cgi) is a software project management and comprehension tool. Based on
the concept of a project object model (POM), Maven can manage a project's build, reporting and documentation from a
central piece of information. Maven can be used to define and download our dependencies and to build and package Java or
Scala code into a JAR file. Apache Maven `3.8.6` or higher is recommended.

### JQ <img src="https://jqlang.github.io/jq/jq.png" align="left"  height="30" width="30" style="border-right-style:solid; border-right-width:10px; border-color:transparent; background: transparent">

[jq](https://jqlang.github.io/jq/) is a lightweight and flexible command-line JSON processor which can be used to format
the JSON responses received from the context broker and other FIWARE components. More information about how to use jq
can be found [here](https://www.digitalocean.com/community/tutorials/how-to-transform-json-data-with-jq). `jq-1.6` is
recommended.

### Windows Subsystem for Linux

We will start up our services using a simple bash script. Windows users should download the
[Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/install) to provide a command-line
functionality similar to a Linux distribution on Windows.

## Context Brokers

The NGSI-LD tutorials can be run using any context broker offering the NGSI-LD API, currently the
[FIWARE Catalogue](https://www.fiware.org/catalogue) offers three compliant context brokers:

-   [Orion-LD](https://github.com/FIWARE/context.Orion-LD/tree/develop/doc/manuals-ld) - A compact NGSI-LD Context
    Broker requiring fewer resources
-   [Scorpio](https://scorpio.rtfd.io/) - An NGSI-LD Context Broker, which can also be used in federated environments
-   [Stellio](https://stellio.rtfd.io/) - An NGSI-LD Context Broker with Keycloak integration

> ### Which NGSI-LD Context Broker should I use?
>
> The mission of the **FIWARE Foundation** is to develop an open sustainable ecosystem around public, royalty-free and
> implementation-driven software platform standards that will ease the creation of Smart Applications in multiple
> sectors.
>
> As such, the **FIWARE Foundation** would recommend any compliant context broker that is following the ESTI NSGI-LD
> specifications. The precise context broker you pick will depend upon your chosen use case. Different scenarios may
> call for a faster context broker, one with a smaller footprint, one which is more secure, etc. etc.

NGSI-LD (Next Generation Service Interface with Linked Data), is the API exported by FIWARE Context Brokers, and used
for the integration of platform components within a _“Powered by FIWARE”_ platform and by applications to update or
consume context information. The concept of Linked Data based upon JSON-LD payloads is fundamental to effectively
passing data between participating organisations.

The NGSI-LD Specification is regularly updated published by ETSI. The latest specification is
[version 1.7.1](https://www.etsi.org/deliver/etsi_gs/CIM/001_099/009/01.08.01_60/gs_cim009v010801p.pdf) which was
published in June 2023.

An Excel file detailing the current compatibility of the bleeding edge development version of each context broker
(Orion-LD, Scorpio, Stellio) against the features of the 1.6.1 specification can be found
[here](https://docs.google.com/spreadsheets/d/e/2PACX-1vRxOjsDf3lqhwuypJ---pZN2OlqFRl0jyoTV0ewQ1WFnpe7xQary3uxRjunbgJkwQ/pub)

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

&nbsp; 101. [Understanding `@context`](understanding-@context.md) <br/>
&nbsp; 102. [Working with `@context`](working-with-@context.md) <br/>
&nbsp; 103. [CRUD Operations](ngsi-ld-operations.md) <br/>
&nbsp; 104. [Concise Payloads](concise.md) <br/>
&nbsp; 105. [Merge-Patch and Put](merge-patch.md) <br/>
&nbsp; 106. [Entity Relationships](entity-relationships.md) <br/>
&nbsp; 107. [Subscriptions](subscriptions.md) <br/>
&nbsp; 108. [Registrations](context-providers.md) <br/>
&nbsp; 109. [Temporal Operations](short-term-history.md) <br/>
&nbsp; 110. [Extended Properties](extended-properties.md) <br/>

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

<h3 style="box-shadow: 0px 4px 0px 0px #233c68;">Integrating NGSI-v2 Systems</h3>

These tutorials show how to create data spaces using NGSI-LD and access NGSI-v2 sources

&nbsp; 601. [Federative Data Spaces](linked-data.md)<br/>

