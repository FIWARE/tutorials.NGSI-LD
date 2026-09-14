Firefox about:blank
NGSI-LD FastMCP Integration Architecture
https://gemini.google.com/app/2667e2fbfe3c8ec3
User prompt: Look at https://forge.etsi.org/rep/cim/ngsi-ld-openapi/-/raw/v1.8.1/openapi-3.0.3/ngsi-ld-api.yaml - This is the API definition for NGSI-LD, how would I go about wrapping it with https://github.com/PrefectHQ/fastmcp-ts to generate an MCP tool. Would/should the access points be entity
based or could context from JSON-LD be injected - is that likely to be tool or agent? Consider the alternatives. There is a well-known dataset available at: https://ngsi-ld-tutorials.readthedocs.io/en/latest/ for an agricultural setup - should the MCP refer to get_Cow get_Building etc. or should an agent
infer it by retreiving context and then passing on to a tool. Effectively define responsibilites across the components.
Response: Wrapping an NGSI-LD API with FastMCP to create a Model Context Protocol (MCP) server requires mapping the robust, generic nature of the NGSI-LD specification (which handles temporal, spatial, and semantic graph data) to the discrete tool-calling paradigms of Large Language Models
(LLMs).
Here is a breakdown of how to build this with fastmcp-ts, alongside an architectural assessment of how to handle entities (get_Cow vs. get_Entity) and JSON-LD context injection.
1. Wrapping the API with FastMCP-ts
To wrap the OpenAPI spec, you will use fastmcp-ts to define tools that interact with your NGSI-LD Context Broker (e.g., Orion-LD, Scorpio, Stellio).
The most robust way to start is by defining generic tools that map to the core NGSI-LD REST endpoints, while the tool itself handles the JSON-LD context boilerplate.
import { FastMCP } from "fastmcp";
import { z } from "zod";
import fetch from "node-fetch"; // or native fetch
// Define the core configuration
const BROKER_URL = "http://localhost:1026/ngsi-ld/v1";
const DEFAULT_CONTEXT = "https://fiware.github.io/tutorials.Step-by-Step/tutorials-context.jsonld";
const server = new FastMCP({ name: "Agriculture-NGSI-LD-MCP" });
// Tool 1: Generic Entity Query
server.addTool({
name: "query_entities",
description: "Search for NGSI-LD entities by type, query string (q), or geo-location.",
parameters: z.object({
type: z.string().describe("The entity type, e.g., 'Cow', 'Building', 'Tractor'"),
q: z.string().optional().describe("NGSI-LD query string, e.g., 'heartRate>60'"),
limit: z.number().optional().default(10)
}),
execute: async (args) => {
const url = new URL(`${BROKER_URL}/entities`);
url.searchParams.append("type", args.type);
if (args.q) url.searchParams.append("q", args.q);
url.searchParams.append("limit", args.limit.toString());
// The TOOL handles Context Injection via the Link header
const response = await fetch(url.toString(), {
headers: {
"Accept": "application/ld+json",
"Link": `<${DEFAULT_CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`
}
});
return await response.json();
}
});
server.start();
2. Access Points: Entity-Based (get_Cow) vs. Generic (get_Entity)
For the agricultural dataset (Cows, Buildings, Tractors, Devices), you have three architectural paths.
Option A: Hardcoded Entity Tools (get_Cow, get_Building)
• How it works: You define specific tools in FastMCP for every type in your FIWARE agricultural tutorial.
• Pros: LLMs struggle with "blank canvas" APIs. If the agent sees a tool called get_Cow(id), it instantly knows exactly what it can do without having to guess types.
• Cons: It breaks the open-world assumption of JSON-LD. If you add a Drone entity to your farm, you have to rewrite and redeploy your MCP server.
Option B: Generic Tools with Agent Inference (Recommended)
• How it works: You provide generic tools (query_entities, get_entity_by_id) and expose the NGSI-LD /types endpoint as an MCP Resource or a discovery tool.
• Pros: Highly scalable. The MCP server is a pure reflection of the NGSI-LD standard and never needs to be updated when the data model changes.
• The Workflow:
1. The agent asks: "What entities are available?"
2. Uses a list_entity_types tool.
3. Sees ["Cow", "Building", "Device"].
4. Uses query_entities({ type: "Cow" }).
Option C: Dynamic Tool Generation (The Hybrid Best-Practice)
Because FastMCP allows programmatic tool definition, you can have the MCP server query the Context Broker on startup to fetch available types, and dynamically generate specific tools on the fly.
// On server startup:
const types = await fetch(`${BROKER_URL}/types`).then(r => r.json());
types.typeList.forEach(type => {
server.addTool({
name: `get_${type.toLowerCase()}`, // e.g., get_cow
description: `Retrieve details for entities of type ${type}`,
// ... schema definition
});
});
3. Handling the JSON-LD Context Injection
Who handles the JSON-LD @context? The MCP Tool, not the Agent.
If you force the Agent (the LLM) to manage JSON-LD contexts, it will frequently hallucinate URIs, forget to pass the Link header, or get confused by the expanded URNs (e.g., urn:ngsi-ld:Cow:001).
The Agent operates best in the realm of semantics and intent. The MCP server operates best in the realm of protocol specifics.
• The Tool should inject the default context (e.g., the Smart Data Models agricultural context) implicitly into every outgoing HTTP request to the broker.
• The Tool should request application/ld+json with options=keyValues (if possible) to strip out NGSI-LD metadata (like type: Property, value: 65) and serve a flattened, simple JSON object to the Agent.
• The Agent just says: "Give me cows where heart rate > 60", and the tool translates that into the NGSI-LD q=heartRate>60 syntax.
4. Defining Responsibilities Across Components
To build a robust system, delineate responsibilities strictly:
1. The Agent (LLM + Prompt)
• Responsibility: Intent translation, semantic reasoning, and orchestration.
• Action: Decides what data is needed (e.g., "The user is asking about farm health, I need to check the Cows").
• Boundary: Should never construct raw HTTP requests, worry about pagination links, or deal with JSON-LD expansion/compaction.
2. The MCP Server (FastMCP-ts wrapper)
• Responsibility: Protocol translation, schema validation, and domain restriction.
• Action: Translates standard LLM function arguments {"type": "Cow"} into NGSI-LD specific syntax (/v1/entities?type=Cow).
• Context Management: Appends the FIWARE agricultural @context via HTTP Link headers. Maps NGSI-LD specific errors to friendly tool error messages.
• Simplification: Optionally flattens the verbose NGSI-LD normalized format into simplified key-value pairs before returning it to the agent to save context window tokens.
3. The NGSI-LD Context Broker (Orion-LD / Scorpio)
• Responsibility: Data storage, spatial-temporal queries, and JSON-LD validity.
• Action: Resolves the actual state of the farm. Executes complex geographical queries (e.g., "cows inside polygon X") requested by the MCP tool.
User prompt: consider a JSON-LD context with a well annotated @graph - e.g. { "@context": { "type": "@type", "id": "@id", "ngsi-ld": "https://uri.etsi.org/ngsi-ld/", "fiware": "https://uri.fiware.org/ns/dataModels#", "schema": "https://schema.org/", "rdfs": "http://
www.w3.org/2000/01/rdf-schema#", "xsd": "http://www.w3.org/2001/XMLSchema#", "tutorial": "https://ngsi-ld-tutorials.readthedocs.io/en/latest/datamodels.html#", "Building": "fiware:Building", "Device": "fiware:Device", "Animal": "fiware:Animal", "Female":
"schema:Female", "FillingLevelSensor": "tutorial:FillingLevelSensor", "Herbicide": "tutorial:Product", "HVAC": "https://w3id.org/saref#HVAC", "Male": "schema:Male", "PartField": "tutorial:PartField", "Person": "fiware:Person", "SoilSensor": "tutorial:SoilSensor",
"TemperatureSensor": "tutorial:TemperatureSensor", "Task": "fiware:Activity", "Tractor": "tutorial:Tractor", "Water": "tutorial:Water", "actuator": "https://w3id.org/saref#actuator", "additionalName": { "@id": "schema:additionalName", "@type": "xsd:string" },
"address": "schema:address", "airPollution": "https://w3id.org/saref#airPollution", "atmosphericPressure": "https://w3id.org/saref#atmosphericPressure", "barn": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dbarn", "batteryLevel": { "@id": "fiware:batteryLevel",
"@type": "xsd:number" }, "category": { "@id": "fiware:category", "@type": "@vocab" }, "configuration": { "@id": "fiware:configuration", "@type": "xsd:string" }, "conservatory": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dconservatory",
"containedInPlace": { "@id": "fiware:containedInPlace", "@type": "@id" }, "controlledAsset": { "@id": "fiware:controlledAsset", "@type": "@id" }, "controlledProperty": { "@id": "fiware:controlledProperty", "@type": "@vocab" },
"cowshed": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dcowshed", "dataProvider": { "@id": "fiware:dataProvider", "@type": "xsd:string" }, "dateCreated": { "@id": "fiware:dateCreated", "@type": "xs:dateTime" }, "dateFirstUsed": {
"@id": "fiware:dateFirstUsed", "@type": "xs:dateTime" }, "dateInstalled": { "@id": "fiware:dateInstalled", "@type": "xs:dateTime" }, "dateLastCalibration": { "@id": "fiware:dateLastCalibration", "@type": "xs:dateTime" },
"dateLastValueReported": { "@id": "fiware:dateLastValueReported", "@type": "xs:dateTime" }, "dateManufactured": { "@id": "fiware:dateManufactured", "@type": "xs:dateTime" }, "dateModified": { "@id": "fiware:dateModified", "@type":
"xs:dateTime" }, "depth": "https://w3id.org/saref#depth", "description": { "@id": "ngsi-ld:description", "@type": "xsd:string" }, "deviceState": { "@id": "fiware:deviceState", "@type": "xsd:string" }, "digester": "https://wiki.openstreetmap.org/
1 of 9 02.09.26, 17:28
Firefox about:blank
wiki/Tag:building%3Ddigester", "eatingActivity": "https://w3id.org/saref#eatingActivity", "email": { "@id": "schema:email", "@type": "xsd:string" }, "endgun": "https://w3id.org/saref#endgun", "familyName": { "@id": "schema:familyName", "@type":
"xsd:string" }, "farm": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dfarm", "farm_auxiliary": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dfarm_auxiliary", "faxNumber": { "@id": "schema:faxNumber", "@type": "xsd:string" }, "filling": "https://
w3id.org/saref#fillingLevel", "firmwareVersion": { "@id": "fiware:firmwareVersion", "@type": "xsd:string" }, "floorsAboveGround": { "@id": "fiware:floorsAboveGround", "@type": "xsd:integer" }, "floorsBelowGround": { "@id":
"fiware:floorsBelowGround", "@type": "xsd:integer" }, "gender": { "@id": "schema:gender", "@type": "@vocab" }, "givenName": { "@id": "schema:givenName", "@type": "xsd:string" }, "greenhouse": "https://wiki.openstreetmap.org/wiki/
Tag:building%3Dgreenhouse", "hangar": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dhangar", "hardwareVersion": { "@id": "fiware:hardwareVersion", "@type": "xsd:string" }, "honorificPrefix": { "@id": "schema:honorificPrefix", "@type":
"xsd:string" }, "honorificSuffix": { "@id": "schema:honorificSuffix", "@type": "xsd:string" }, "humidity": "https://w3id.org/saref#humidity", "hut": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dhut", "implement": "https://w3id.org/saref#implement",
"ipAddress": { "@id": "fiware:ipAddress", "@type": "xsd:string" }, "irrSection": "https://w3id.org/saref#irrSection", "irrSystem": "https://w3id.org/saref#irrSystem", "isicV4": { "@id": "schema:isicV4", "@type": "xsd:string" }, "jobTitle": {
"@id": "schema:jobTitle", "@type": "xsd:string" }, "location": "https://w3id.org/saref#location", "macAddress": { "@id": "fiware:macAddress", "@type": "xsd:string" }, "mcc": { "@id": "fiware:mcc", "@type": "xsd:string" }, "meter":
"https://w3id.org/saref#meter", "milking": "https://w3id.org/saref#milking", "mnc": { "@id": "fiware:mnc", "@type": "xsd:string" }, "motion": "https://w3id.org/saref#motion", "movementActivity": "https://w3id.org/saref#movementActivity", "multimedia": "https://
w3id.org/saref#multimedia", "name": { "@id": "schema:name", "@type": "xsd:string" }, "network": "https://w3id.org/saref#network", "occupancy": "https://w3id.org/saref#occupancy", "occupier": { "@id": "fiware:occupier", "@type": "@id" },
"openingHours": { "@id": "fiware:openingHours", "@type": "xsd:array" }, "osVersion": { "@id": "fiware:osVersion", "@type": "xsd:string" }, "owner": { "@id": "fiware:owner", "@type": "@id" }, "precipitation": "https://w3id.org/
saref#precipitation", "pressure": "https://w3id.org/saref#pressure", "provider": { "@id": "fiware:provider", "@type": "xsd:string" }, "refDeviceModel": { "@id": "fiware:refDeviceModel", "@type": "@id" }, "refMap": { "@id": "fiware:refMap",
"@type": "xs:anyURI" }, "rssi": { "@id": "fiware:rssi", "@type": "xsd:string" }, "sensor": "https://w3id.org/saref#sensor", "serialNumber": { "@id": "fiware:serialNumber", "@type": "xsd:string" }, "service": "https://wiki.openstreetmap.org/
wiki/Tag:building%3Dservice", "shed": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dshed", "softwareVersion": { "@id": "fiware:softwareVersion", "@type": "xsd:string" }, "soilMoisture": "https://w3id.org/saref#soilMoisture", "solarRadiation": "https://w3id.org/
saref#solarRadiation", "source": { "@id": "fiware:source", "@type": "xsd:string" }, "stable": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dstable", "sty": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dsty", "supportedProtocol": { "@id":
"fiware:supportedProtocol", "@type": "@vocab" }, "taxID": { "@id": "schema:taxID", "@type": "xsd:string" }, "telephone": { "@id": "schema:telephone", "@type": "xsd:string" }, "temperature": "https://w3id.org/saref#temperature",
"transformer_tower": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dtransformer_tower", "value": { "@id": "fiware:value", "@type": "xsd:string" }, "vatID": { "@id": "schema:vatID", "@type": "xsd:string" }, "waterConsumption": "https://w3id.org/
saref#waterConsumption", "water_tower": "https://wiki.openstreetmap.org/wiki/Tag:building%3Dwater_tower", "weatherConditions": "https://w3id.org/saref#weatherConditions", "weight": "https://w3id.org/saref#weight", "windDirection": "https://w3id.org/saref#windDirection",
"windSpeed": "https://w3id.org/saref#windSpeed", "state": "https://saref.etsi.org/core/hasState", "heartRate": "https://purl.bioontology.org/ontology/MESH/D006339", "status": "https://saref.etsi.org/core/status", "product": { "@id": "fiware:refObject", "@type": "@id"
}, "worker": { "@id": "fiware:refAgent", "@type": "@id" }, "field": { "@id": "fiware:refTarget", "@type": "@id" }, "on": "https://w3id.org/saref#on", "off": "https://w3id.org/saref#off", "verified": "fiware:verified", "species": "fiware:species",
"sex": "fiware:sex", "legalID": "fiware:legalID" }, "@graph": [ { "@id": "fiware:Building", "@type": "rdfs:Class", "rdfs:comment": [ { "@language": "en", "@value": "" } ], "rdfs:label": [ {
"@language": "en", "@value": "Building" } ], "rdfs:subClassOf": { "@id": "schema:Thing" } }, { "@id": "fiware:TemperatureSensor", "@type": "rdfs:Class", "rdfs:comment": [ { "@language": "en",
"@value": "A device that consists of a sensor, has category `saref:Sensor` and is used for the purpose of sensing temperature`." } ], "rdfs:label": [ { "@language": "en", "@value": "TemperatureSensor" } ],
"rdfs:subClassOf": { "@id": "schema:Thing" } }, { "@id": "fiware:FillingLevelSensor", "@type": "rdfs:Class", "rdfs:comment": [ { "@language": "en", "@value": "A device that consists of a sensor, has category
`saref:Sensor` and is used for the purpose of sensing filling Level." } ], "rdfs:label": [ { "@language": "en", "@value": "FillingLevelSensor" } ], "rdfs:subClassOf": { "@id": "schema:Thing" } }, {
"@id": "fiware:Person", "@type": "rdfs:Class", "rdfs:comment": [ { "@language": "en", "@value": "" } ], "rdfs:label": [ { "@language": "en", "@value": "Person" } ],
"rdfs:subClassOf": { "@id": "schema:Thing" } }, { "@id": "fiware:temperature", "@type": "ngsi-ld:Property", "rdfs:comment": [ { "@language": "en", "@value": "Property related to some measurements that are
characterized by a certain value that is measured in a temperature unit (degree_Celsius, degree_Fahrenheit, or degree_kelvin)" } ], "rdfs:label": [ { "@language": "en", "@value": "temperature" } ] }, { "@id":
"fiware:fillingLevel", "@type": "ngsi-ld:Property", "rdfs:comment": [ { "@language": "en", "@value": "Property related to some measurements that are characterized by a certain value that is a filling level." } ], "rdfs:label": [
{ "@language": "en", "@value": "fillingLevel" } ] }, { "@id": "fiware:temperature", "@type": "ngsi-ld:Property", "rdfs:comment": [ { "@language": "en", "@value": "Property related to some
measurements that are characterized by a certain value that is measured in a temperature unit (degree_Celsius, degree_Fahrenheit, or degree_kelvin)" } ], "rdfs:label": [ { "@language": "en", "@value": "temperature" } ]
}, { "@id": "fiware:fillingLevel", "@type": "ngsi-ld:Property", "rdfs:comment": [ { "@language": "en", "@value": "Property related to some measurements that are characterized by a certain value that is a filling level." } ],
"rdfs:label": [ { "@language": "en", "@value": "fillingLevel" } ] } ] } Could the description fields help define the MCP endpoint descriptions to improve understanding of the agent? e,g how to retreive a cow
Response: Yes, absolutely. In fact, this is the most powerful way to bridge Semantic Web technologies (NGSI-LD) with Large Language Models.
LLM agents rely almost entirely on the description fields of their tools to understand when and how to use them. By extracting the rdfs:comment from your JSON-LD @graph and injecting it directly into your FastMCP tool descriptions, you create a self-documenting agent where the ontology
acts as the single source of truth.
Here is how you can practically implement this to improve the agent's understanding.
The Strategy: Ontology-Driven Tool Generation
Instead of hardcoding the descriptions in your MCP server, you parse the @graph array on startup. For every class defined in the graph, you generate a specific tool (or populate the documentation of a generic tool) using the rdfs:label for the name and rdfs:comment for the description.
Here is how that looks in practice using fastmcp-ts:
import { FastMCP } from "fastmcp";
import { z } from "zod";
import * as fs from "fs";
// 1. Load and parse your JSON-LD context file
const rawContext = fs.readFileSync("context.jsonld", "utf-8");
const contextData = JSON.parse(rawContext);
const graph = contextData["@graph"];
const server = new FastMCP({ name: "Ontology-Driven-NGSI-LD-MCP" });
// 2. Iterate through the @graph to find Classes
graph.forEach((node: any) => {
// We only want to generate entity-fetching tools for rdfs:Classes (like Building, TemperatureSensor)
if (node["@type"] === "rdfs:Class") {
const label = node["rdfs:label"][0]["@value"]; // e.g., "TemperatureSensor"
let comment = node["rdfs:comment"][0]["@value"]; // e.g., "A device that consists of..."
// Fallback if the ontology has an empty comment (like "Building" in your example)
if (!comment || comment.trim() === "") {
comment = `Retrieve an entity of type ${label}.`;
}
// 3. Dynamically register the tool with the LLM
server.addTool({
name: `get_${label}`,
description: comment, // <-- The LLM reads the ontology directly here!
parameters: z.object({
id: z.string().optional().describe(`Specific URN ID of the ${label}`),
limit: z.number().optional().default(10)
}),
execute: async (args) => {
// Build the NGSI-LD query
const url = new URL(`http://localhost:1026/ngsi-ld/v1/entities`);
url.searchParams.append("type", label);
if (args.id) url.searchParams.append("id", args.id);
const response = await fetch(url.toString(), {
headers: { "Accept": "application/ld+json" }
});
return await response.json();
}
});
}
});
server.start();
How this improves Agent behavior (The "Cow" Example)
Let's say you added an Animal or Cow node to your @graph:
{
"@id": "fiware:Cow",
"@type": "rdfs:Class",
"rdfs:comment": [
{
"@language": "en",
"@value": "Livestock bovine animal kept on a farm for milk or meat. Use this to check livestock health metrics like heartRate or activity."
}
],
"rdfs:label": [{"@language": "en", "@value": "Cow"}]
}
When the MCP server starts, the agent is presented with a tool named get_Cow.
Because the rdfs:comment specifically mentions "Use this to check livestock health metrics like heartRate," if a user asks the agent: "Are any of my animals sick?"
1. The agent doesn't need to guess which tool to use.
2. It reads the description of get_Cow generated from the @graph.
3. It recognizes that get_Cow is linked to "health metrics".
4. It calls get_Cow autonomously.
Handling Properties in the @graph
Your @graph also includes ngsi-ld:Property definitions (like temperature and fillingLevel). You can use these to enhance the parameters of your tools.
If you use a Generic Query Tool (Option B from the previous response), you can aggregate these properties to teach the LLM exactly what query strings (q=...) are valid:
// Extract all property descriptions
const properties = graph.filter((n: any) => n["@type"] === "ngsi-ld:Property");
const propertyDocs = properties.map((p: any) =>
`- ${p["rdfs:label"][0]["@value"]}: ${p["rdfs:comment"][0]["@value"]}`
).join("\n");
server.addTool({
name: "query_entities",
description: "Query NGSI-LD entities using specific attributes.",
parameters: z.object({
type: z.string().describe("The entity type (e.g., TemperatureSensor, Building)"),
q: z.string().optional().describe(`NGSI-LD query string. Available properties:\n${propertyDocs}`)
}),
// ... execute
});
Summary of Benefits
1. Zero-Maintenance MCP: When you update your FIWARE data models and JSON-LD context, your AI Agent instantly learns about the new data types, sensors, and animals upon restart. No code changes required.
2. Reduced Hallucinations: The LLM isn't guessing what a FillingLevelSensor is; it is strictly bound by the exact rdfs:comment defined by the domain experts.
3. Seamless Alignment: This fulfills the ultimate promise of the semantic web: data that is self-describing for machines. You are just passing that description up the chain to the neural network.
2 of 9 02.09.26, 17:28
Firefox about:blank
User prompt: There is no "cow" model - all Animals follow a well defined schema - https://raw.githubusercontent.com/smart-data-models/dataModel.Agrifood/refs/heads/master/Animal/schema.json - how to extract the data structure from the schema for zod? How to offer or define endpoints such that a
query for the cow named "Beany" would be returned efficiently?
Response: Since all animals are modeled under the single Animal class in the Smart Data Models (SDM) architecture, you need to shift the LLM’s paradigm. Instead of calling a get_Cow tool, the agent needs to call a query_animals tool, passing species and name as filters.
Here is how you dynamically translate the SDM JSON Schema into Zod parameters for the LLM, and how to format the resulting tool so that querying for a specific animal like "Beany" is executed efficiently.
1. Translating the JSON Schema into Zod Query Parameters
To create a search tool, you don't need a strict Zod schema for validation (like you would for a POST request); you need an all-optional Zod schema that exposes the JSON Schema's properties and descriptions to the LLM so it knows what it can search by.
You can do this dynamically at server startup by fetching the schema.json and mapping its properties to z.string().optional().
2. Efficiently Querying NGSI-LD for "Beany"
NGSI-LD is designed for this exact scenario. You should not fetch all animals and filter them in the MCP server. Instead, the MCP tool must translate the LLM's arguments into the NGSI-LD q (query) parameter syntax.
If the LLM calls: query_animals({ name: "Beany", species: "dairy cattle" })
The MCP tool translates this to the highly efficient NGSI-LD HTTP query: GET /ngsi-ld/v1/entities?type=Animal&q=name=="Beany";species=="dairy cattle"
Implementation Example
Here is how you combine dynamic Zod generation and efficient NGSI-LD querying using fastmcp-ts.
import { FastMCP } from "fastmcp";
import { z } from "zod";
const BROKER_URL = "http://localhost:1026/ngsi-ld/v1";
const ANIMAL_SCHEMA_URL = "https://raw.githubusercontent.com/smart-data-models/dataModel.Agrifood/refs/heads/master/Animal/schema.json";
async function buildAnimalTool(server: FastMCP) {
// 1. Fetch the JSON Schema
const schema = await fetch(ANIMAL_SCHEMA_URL).then(r => r.json());
// 2. Dynamically build a Zod object from the JSON Schema properties
const zodShape: Record<string, z.ZodTypeAny> = {};
for (const [key, propInfo] of Object.entries(schema.properties as any)) {
// Skip complex nested objects for search parameters to keep the LLM focused
if (propInfo.type === "object" || propInfo.type === "array") continue;
// Create an optional string parameter and attach the SDM description
zodShape[key] = z.string().optional().describe(propInfo.description || `Search by ${key}`);
}
// Add pagination
zodShape["limit"] = z.number().optional().default(10).describe("Max results to return");
// 3. Register the Tool
server.addTool({
name: "query_animals",
description: "Search for animals in the agricultural system by name, species, legalId, health status, etc.",
parameters: z.object(zodShape),
execute: async (args) => {
const url = new URL(`${BROKER_URL}/entities`);
url.searchParams.append("type", "Animal");
// 4. Translate Zod arguments into the NGSI-LD 'q' parameter
const qFilters: string[] = [];
// Iterate over args, ignoring non-schema properties like 'limit'
for (const [key, value] of Object.entries(args)) {
if (key !== "limit" && value !== undefined) {
// NGSI-LD exact match syntax: attribute=="value"
qFilters.push(`${key}=="${value}"`);
}
}
// Join filters with ';' (NGSI-LD logical AND)
if (qFilters.length > 0) {
url.searchParams.append("q", qFilters.join(";"));
}
url.searchParams.append("limit", (args.limit as number).toString());
// Execute the efficient search against the Context Broker
const response = await fetch(url.toString(), {
headers: { "Accept": "application/ld+json" }
});
if (!response.ok) {
throw new Error(`NGSI-LD Error: ${response.statusText}`);
}
return await response.json();
}
});
}
const server = new FastMCP({ name: "Agrifood-NGSI-LD-MCP" });
buildAnimalTool(server).then(() => server.start());
How the Agent interprets this
Because the tool pulls descriptions directly from the Smart Data Models schema, when the user asks: "Find the cow named Beany"
1. The LLM sees the query_animals tool.
2. It looks at the generated Zod parameters and sees name and species (with descriptions explaining what they mean in the Agrifood context).
3. It maps "cow" to the species argument (e.g., species: "dairy cattle" or species: "cow" depending on your exact ontology) and maps "Beany" to the name argument.
4. The MCP tool seamlessly formats q=name=="Beany";species=="cow", offloading the search index burden to the Context Broker where it belongs.
User prompt: "Search for animals in the agricultural system by name, species, legalId, health status, etc." is a hard coded string - the schema is the baseline for the JSON-LD context and could be annotated further if that helps - could that be extracted from the schema.json?
Response: Yes, absolutely. Hardcoding descriptions is an anti-pattern when you have a rich semantic model. Standard JSON Schema natively supports root-level title and description fields, which Smart Data Models (SDM) heavily utilize.
You can extract the tool's core description directly from the root of the schema.json. Furthermore, because you own or extend the schema/context, you can annotate it specifically to give the LLM better instructions.
Here is how you extract the top-level description dynamically, and how you can strategically annotate your schema to guide the agent.
1. Extracting the Tool Description Dynamically
In standard SDM schemas, the root object contains title (e.g., "Animal") and description (e.g., "The description of an animal..."). You simply map these to the MCP tool definition.
import { FastMCP } from "fastmcp";
import { z } from "zod";
const ANIMAL_SCHEMA_URL = "https://raw.githubusercontent.com/smart-data-models/dataModel.Agrifood/refs/heads/master/Animal/schema.json";
async function buildDynamicTool(server: FastMCP, schemaUrl: string) {
// 1. Fetch the JSON Schema
const schema = await fetch(schemaUrl).then(r => r.json());
// 2. Extract top-level metadata for the Tool definition
const entityName = schema.title || "Entity"; // e.g., "Animal"
// Use the root description, with a fallback
const toolDescription = schema.description
|| `Query and retrieve ${entityName} entities from the Context Broker.`;
const zodShape: Record<string, z.ZodTypeAny> = {};
// 3. Extract parameter descriptions from properties
for (const [key, propInfo] of Object.entries(schema.properties as any)) {
if (propInfo.type === "object" || propInfo.type === "array") continue;
zodShape[key] = z.string().optional().describe(propInfo.description || key);
}
// 4. Register the tool purely from Schema metadata
server.addTool({
name: `query_${entityName.toLowerCase()}s`, // e.g., query_animals
description: toolDescription, // Injected directly from schema.json
parameters: z.object(zodShape),
execute: async (args) => {
// ... NGSI-LD query execution ...
}
3 of 9 02.09.26, 17:28
Firefox about:blank
});
}
2. How to "Annotate Further" for LLMs
If you want to optimize the schema.json specifically for AI Agents, you can enhance standard JSON Schema fields. LLMs rely on description fields to understand intent, so writing them with the agent in mind yields massive improvements.
Here are the best ways to annotate your schema:
A. Enhance the Root description
Update the root "description" in your schema.json so it tells the agent when to use the tool and what it can filter by.
{
"$schema": "http://json-schema.org/schema#",
"title": "Animal",
"type": "object",
"properties": { ... }
"description": "Use this tool to search for farm livestock (cows, pigs, sheep). You can filter by exact name (e.g., 'Beany'), species, health status, or legal ID. Do not use this for wild animals or farm machinery.",
}
B. Enhance Property description fields
LLMs frequently struggle with mapping natural language to strict controlled vocabularies. You can use the property description to give the LLM valid enums or examples.
"species": {
"type": "string",
"description": "The species of the animal. Must be one of: 'dairy cattle', 'beef cattle', 'sheep', 'pig'."
},
"name": {
"type": "string",
"description": "The colloquial given name of the animal, e.g., 'Beany' or 'Bessie'."
}
C. Use Custom AI Annotations (Optional)
If you do not want to pollute your public-facing API documentation with prompt instructions, standard JSON Schema allows for custom keys (often prefixed with x-). You can add an x-ai-instruction field to your schema and have your MCP server append it to the tool description.
{
"title": "Animal",
"description": "Data model for an animal on a farm.",
"x-ai-instruction": "Agent: Translate user requests for 'cows' into species=='dairy cattle'. Always search by 'name' if the user provides a capitalized word."
}
Your MCP code would just concatenate them:
const toolDescription = `${schema.description}\n\nInstructions for AI: ${schema["x-ai-instruction"] || ""}`;
By extracting the entire tool profile (Name, Tool Description, Parameter Names, Parameter Descriptions) from the schema.json, your FastMCP server becomes completely generic. You could feed it an array of 50 Smart Data Model schema URLs, and it would dynamically generate a fully
documented, highly competent 50-tool LLM Agent on startup.
User prompt: So NGSI is generic and its entities may not be complete - could schema.json and zod be used to ensure data returned is a valid profile?
Response: Yes, absolutely. This is one of the most powerful architectural patterns you can implement with MCP.
Because NGSI-LD is intrinsically schema-less (it allows partial updates and sparse entities), the Context Broker might return a "Cow" that is missing a species, weight, or healthStatus. If you feed incomplete data to an LLM, it may hallucinate missing values or fail to answer the user's question
accurately.
By using the Smart Data Models schema.json to generate a strict output Zod schema, you act as a protective layer between the messy reality of the Context Broker and the LLM.
Here is how you implement output validation and profiling.
1. Two Schemas: Input vs. Output
You actually need two Zod schemas derived from the schema.json:
1. The Input Schema (Agent Query): As discussed earlier, this is an all-optional Zod object that tells the LLM what parameters it can use to search.
2. The Output Schema (Data Validation): This enforces the required array and strict types defined in the schema.json. It validates the payload returning from the Context Broker before handing it to the agent.
2. The Golden Rule: options=keyValues
To validate NGSI-LD data against a standard JSON Schema (like the ones from Smart Data Models), you must request the data from the Context Broker in simplified format.
• Normalized NGSI-LD: {"temperature": {"type": "Property", "value": 39.5}} -> Will fail standard JSON Schema validation.
• Simplified NGSI-LD (?options=keyValues): {"temperature": 39.5} -> Matches JSON Schema perfectly.
3. Implementation: Validating the Profile
Here is how you generate the strict output schema and use Zod's safeParse to guarantee the profile of the data.
import { FastMCP } from "fastmcp";
import { z } from "zod";
const BROKER_URL = "http://localhost:1026/ngsi-ld/v1";
async function buildStrictAnimalTool(server: FastMCP, schemaUrl: string) {
const schema = await fetch(schemaUrl).then(r => r.json());
// 1. Build the Input Zod Schema (All optional, for searching)
const inputShape: Record<string, z.ZodTypeAny> = {};
// 2. Build the Output Zod Schema (Strict, for validation)
const outputShape: Record<string, z.ZodTypeAny> = {};
const requiredFields: string[] = schema.required || [];
for (const [key, propInfo] of Object.entries(schema.properties as any)) {
// --- Input Schema Generation ---
if (propInfo.type !== "object" && propInfo.type !== "array") {
inputShape[key] = z.string().optional().describe(propInfo.description || key);
}
// --- Output Schema Generation ---
let zType = z.any();
if (propInfo.type === "string") zType = z.string();
if (propInfo.type === "number") zType = z.number();
if (propInfo.type === "boolean") zType = z.boolean();
// Enforce required fields based on the schema.json
if (!requiredFields.includes(key)) {
zType = zType.optional();
}
outputShape[key] = zType;
}
// We expect an array of valid entities
const outputValidator = z.array(z.object(outputShape).passthrough());
server.addTool({
name: "query_animals",
description: schema.description,
parameters: z.object(inputShape),
execute: async (args) => {
// 1. Query the broker
const url = new URL(`${BROKER_URL}/entities`);
url.searchParams.append("type", schema.title);
// CRITICAL: Request KeyValues so the payload matches the standard JSON Schema
url.searchParams.append("options", "keyValues");
// ... (append q filters based on args here) ...
const response = await fetch(url.toString(), {
headers: { "Accept": "application/ld+json" }
});
const rawData = await response.json();
// 2. Validate the Output Profile using Zod
const validation = outputValidator.safeParse(rawData);
if (!validation.success) {
// Option A: Tell the LLM the data is corrupted
return {
error: "The Context Broker returned entities that do not match the required Animal profile.",
details: validation.error.issues
};
}
4 of 9 02.09.26, 17:28
Firefox about:blank
// 3. Return the guaranteed valid data to the LLM
return validation.data;
}
});
}
4. Strategies for Handling Invalid Data
When Zod catches an incomplete NGSI-LD entity (e.g., validation.success === false), you have three architectural choices for how the MCP server should behave:
1. Strict Mode (Throw Error): As shown above, return an error to the LLM. This is best for strict agricultural compliance (e.g., if an animal lacks a legalId, the system refuses to process it).
2. Filter Mode (Silent Drop): Instead of failing the whole request, filter out the bad entities and only return the valid ones. This is often the best choice for AI agents so they aren't derailed by one bad record in a list of 50.
// Filter mode: only return entities that successfully parse
const validEntities = rawData.filter(entity =>
z.object(outputShape).safeParse(entity).success
);
return validEntities;
3. Coercion Mode (Default Values): If the schema says healthStatus is required but the broker is missing it, you can configure your Zod output schema to inject safe defaults before passing it to the LLM.
outputShape["healthStatus"] = z.string().default("unknown");
By wrapping the outbound data in Zod, you guarantee that the LLM only ever sees complete, semantically valid profiles, regardless of what state the NGSI-LD broker is in.
User prompt: Simplified format is *lossy* - what if I needed a property of a property? or metadata like unitCode:CEL
Response: You have hit on the exact tension between standard JSON schema validation and Semantic Web graphs. You are entirely correct: options=keyValues is lossy. It strips away temporal data (observedAt), metadata (unitCode: CEL), and properties of properties (e.g., the accuracy of
a temperature sensor).
If you need that metadata for the LLM (e.g., to answer "When was Beany last weighed?" or "Is the temperature in Celsius?"), you must query the Context Broker in its default Normalized format.
To maintain strict data profiling while using the Normalized format, you have to adapt your dynamic Zod schema builder. Instead of mapping a schema property directly to a base type (like z.number()), you map it to an NGSI-LD Property object where the value field is validated against the base
type.
Here is how you implement an NGSI-LD aware validator.
1. Building an NGSI-LD Aware Zod Schema
You will read the Smart Data Models schema.json to determine what the data should be, but wrap it in NGSI-LD protocol compliance so Zod validates the normalized structure.
import { z } from "zod";
// Helper function to create an NGSI-LD Property/Relationship validator
function createNgsiLdWrapper(baseValidator: z.ZodTypeAny) {
return z.object({
type: z.enum(["Property", "Relationship", "GeoProperty"]),
// The actual value is validated against the schema.json definition!
value: baseValidator,
// We explicitly allow standard NGSI-LD metadata
unitCode: z.string().optional(),
observedAt: z.string().optional(),
datasetId: z.string().optional()
}).passthrough(); // passthrough() allows custom properties-of-properties to survive
}
async function buildNormalizedOutputSchema(schemaUrl: string) {
const schema = await fetch(schemaUrl).then(r => r.json());
const outputShape: Record<string, z.ZodTypeAny> = {};
const requiredFields: string[] = schema.required || [];
for (const [key, propInfo] of Object.entries(schema.properties as any)) {
// 1. Determine the expected base type from schema.json
let baseType = z.any();
if (propInfo.type === "string") baseType = z.string();
if (propInfo.type === "number") baseType = z.number();
if (propInfo.type === "boolean") baseType = z.boolean();
// 2. Wrap it in the NGSI-LD structural expectation
// Note: We skip wrapping basic NGSI-LD keywords like 'id' and 'type'
let ngsiValidator: z.ZodTypeAny = (key === "id" || key === "type")
? baseType
: createNgsiLdWrapper(baseType);
// 3. Apply requirement rules
if (!requiredFields.includes(key)) {
ngsiValidator = ngsiValidator.optional();
}
outputShape[key] = ngsiValidator;
}
return z.array(z.object(outputShape).passthrough());
}
2. Token Optimization for the LLM
While the code above successfully validates the data without losing metadata, passing raw Normalized NGSI-LD directly to an LLM agent consumes a massive amount of context window tokens.
"weight": {
"type": "Property",
"value": 450,
"unitCode": "KGM",
"accuracy": {
"type": "Property",
"value": 0.95
}
}
All those "type": "Property" keys are useless boilerplate for the LLM.
The architectural best practice is a 3-step pipeline inside your MCP execute function:
1. Fetch: Get Normalized NGSI-LD from the broker.
2. Validate: Use the buildNormalizedOutputSchema (above) to ensure the payload matches the SDM profile.
3. Flatten (Transform): Condense the validated payload into a flat, token-efficient object for the LLM.
Here is how you flatten the validated data before returning it:
// Inside your FastMCP execute() function:
const rawData = await fetch(url.toString(), {
headers: { "Accept": "application/ld+json" }
}).then(r => r.json());
// 1. Validate the strict Normalized profile
const validation = normalizedOutputValidator.safeParse(rawData);
if (!validation.success) throw new Error("Invalid entity profile");
// 2. Flatten for the LLM
const llmFriendlyData = validation.data.map(entity => {
const flatEntity: Record<string, any> = {};
for (const [key, attribute] of Object.entries(entity)) {
if (key === "id" || key === "type") {
flatEntity[key] = attribute;
continue;
}
// Extract the core value
flatEntity[key] = attribute.value;
// Extract highly relevant metadata, appending it as a flattened key
if (attribute.unitCode) {
flatEntity[`${key}_unit`] = attribute.unitCode;
}
if (attribute.observedAt) {
flatEntity[`${key}_observedAt`] = attribute.observedAt;
}
// Extract a property-of-a-property (e.g., accuracy)
if (attribute.accuracy) {
flatEntity[`${key}_accuracy`] = attribute.accuracy.value;
}
}
return flatEntity;
});
// 3. Return to the Agent
5 of 9 02.09.26, 17:28
Firefox about:blank
return llmFriendlyData;
Why this approach wins:
By doing this, you satisfy the Context Broker's semantic graph requirements, guarantee data integrity using the schema.json profile, and return a clean {"weight": 450, "weight_unit": "KGM"} payload to the LLM. The agent gets the exact metadata it needs without paying the token tax for
NGSI-LD protocol boilerplate.
User prompt: All those "type": "Property" keys are useless boilerplate for the LLM. Would using concise format rather than normalized be sufficient?
Response: Yes, using the Concise format (?options=concise) is an excellent, built-in solution for exactly this problem.
Introduced in later iterations of the NGSI-LD specification, the concise representation was designed precisely to reduce payload bloat while preserving the graph's richness. It acts as a perfect middle ground between the token-heavy Normalized format and the lossy keyValues format.
Here is why it works perfectly for LLMs, and the one structural catch you must handle in your FastMCP Zod validation.
How options=concise works
The concise format dynamically changes the shape of the property based on whether metadata exists.
• If there is NO metadata: It drops the object entirely and returns a flat key-value pair (just like keyValues).
• If there IS metadata (or properties-of-properties): It keeps the object to hold the metadata, but drops the redundant "type": "Property" or "type": "Relationship" boilerplate.
Example Payload in Concise Format:
{
"id": "urn:ngsi-ld:Animal:Beany",
"type": "Animal",
"name": "Beany",
"species": "dairy cattle",
"weight": {
"value": 450,
"unitCode": "KGM",
"observedAt": "2026-09-02T12:00:00Z"
}
}
Notice how name and species are beautifully flat, while weight expands to include the unitCode—and no "type": "Property" in sight. This is extremely token-efficient and highly readable for an LLM.
The implication for your Zod Schema
Because the Concise format is dynamic, your FastMCP output validation schema can no longer expect just a primitive (like keyValues) or just an object (like Normalized). It must expect a Union Type (z.union).
Here is how you adapt your dynamic schema builder to seamlessly validate concise NGSI-LD data:
import { z } from "zod";
// Helper to validate the dynamic concise structure
function createConciseValidator(baseValidator: z.ZodTypeAny) {
// The broker might return a flat primitive OR an object containing 'value' and metadata
return z.union([
baseValidator,
z.object({
value: baseValidator,
unitCode: z.string().optional(),
observedAt: z.string().optional(),
datasetId: z.string().optional()
}).passthrough() // allows properties-of-properties
]);
}
async function buildConciseOutputSchema(schemaUrl: string) {
const schema = await fetch(schemaUrl).then(r => r.json());
const outputShape: Record<string, z.ZodTypeAny> = {};
const requiredFields: string[] = schema.required || [];
for (const [key, propInfo] of Object.entries(schema.properties as any)) {
let baseType = z.any();
if (propInfo.type === "string") baseType = z.string();
if (propInfo.type === "number") baseType = z.number();
if (propInfo.type === "boolean") baseType = z.boolean();
// Standard NGSI-LD keywords remain flat
let validator = (key === "id" || key === "type")
? baseType
: createConciseValidator(baseType);
if (!requiredFields.includes(key)) {
validator = validator.optional();
}
outputShape[key] = validator;
}
return z.array(z.object(outputShape).passthrough());
}
Is it sufficient?
Yes. By passing ?options=concise to the Context Broker and using the union validator above, you can confidently pass the resulting JSON directly to the LLM.
You no longer need to write a custom flattening function in your execute block. The LLM gets the rich semantic metadata when it exists, enjoys flat primitive values when it doesn't, and you save hundreds of context tokens per entity.
User prompt: Looking at the temporal API, which NGSI data retrieval format would be most useful for an MCP tool to return -
Response: For the NGSI-LD Temporal API (/temporal/entities), the most useful format for an LLM agent is heavily dictated by token efficiency. Historical data grows massive very quickly—a single sensor could return hundreds of readings.
For temporal queries, options=temporalValues is objectively the best format to return from your MCP tool.
Here is a breakdown of why this format wins, the trade-offs, and how to define it for your agent.
The Clear Winner: options=temporalValues
When you pass options=temporalValues to the temporal endpoint, the Context Broker drops all object representations and returns a highly condensed array of tuples: [value, timestamp].
What the LLM sees:
{
"id": "urn:ngsi-ld:Animal:Beany",
"type": "Animal",
"weight": {
"values": [
[440, "2026-08-01T12:00:00Z"],
[445, "2026-08-15T12:00:00Z"],
[450, "2026-09-02T12:00:00Z"]
]
}
}
Why this is perfect for AI:
1. Maximum Token Efficiency: It strips out thousands of repeated "type": "Property", "value":, and "observedAt": keys. This prevents context window exhaustion when fetching long time-series data.
2. Mathematical Reasoning: LLMs excel at parsing simple 2D arrays (tuples). If the user asks, "Is Beany gaining weight?", the LLM can easily read [440, 445, 450], recognize the upward trend, and answer accurately.
3. Visualization: If your agent uses a UI capable of rendering charts (like drawing a line graph), this tuple structure maps almost exactly to the expected input for charting libraries (like Chart.js or Recharts).
The Alternative: options=concise
Just like standard entity queries, temporalValues is lossy. It strips out metadata specific to individual historical readings (e.g., if one specific weight measurement had an accuracy of 0.85 while others had 0.95).
If your use case strictly requires the agent to analyze historical metadata or properties-of-properties over time, you should fall back to options=concise.
What the LLM sees (options=concise):
{
"id": "urn:ngsi-ld:Animal:Beany",
"type": "Animal",
"weight": [
{
"value": 440,
"observedAt": "2026-08-01T12:00:00Z",
"unitCode": "KGM"
},
{
"value": 450,
"observedAt": "2026-09-02T12:00:00Z",
"unitCode": "KGM"
}
6 of 9 02.09.26, 17:28
Firefox about:blank
]
}
Note: In the temporal API, properties are returned as Arrays of objects, rather than a single object.
How to implement temporalValues in FastMCP
To safely parse the temporalValues response, your Zod output schema needs to expect the { values: [ [value, string] ] } structure.
import { z } from "zod";
// Helper for temporalValues validation
function createTemporalValidator(baseValidator: z.ZodTypeAny) {
return z.object({
// Validates an array of tuples: [ValueType, TimestampString]
values: z.array(z.tuple([baseValidator, z.string()]))
});
}
// Example usage inside your schema builder
function buildTemporalOutputSchema(schema: any) {
const outputShape: Record<string, z.ZodTypeAny> = {};
for (const [key, propInfo] of Object.entries(schema.properties as any)) {
let baseType = z.any();
if (propInfo.type === "string") baseType = z.string();
if (propInfo.type === "number") baseType = z.number();
if (key === "id" || key === "type") {
outputShape[key] = baseType;
} else {
outputShape[key] = createTemporalValidator(baseType).optional();
}
}
return z.array(z.object(outputShape).passthrough());
}
Recommendation
For an MCP server, I highly recommend creating two distinct tools for entities that change over time:
1. query_animals (Uses /entities?options=concise): Used to get the current state and rich metadata of the entity.
2. get_animal_history (Uses /temporal/entities?options=temporalValues): Used strictly when the user asks about trends, history, or past states. Limit this tool's input parameters to id, timerel (before/after/between), and timeAt to keep the LLM focused.
User prompt: Two distinct tools, on one MCP server
Response: This is the exact pattern you should aim for. By giving the LLM two distinct tools on the same MCP server, you separate the cognitive load. The LLM doesn't have to guess whether to pass temporal parameters to a monolithic tool; it simply chooses between a "current state" tool and a
"historical trend" tool based on the user's phrasing.
Here is how you implement both tools side-by-side on a single FastMCP instance, dynamically driven by your Smart Data Models schema.
The Implementation
import { FastMCP } from "fastmcp";
import { z } from "zod";
const BROKER_URL = "http://localhost:1026/ngsi-ld/v1";
const ANIMAL_SCHEMA_URL = "https://raw.githubusercontent.com/smart-data-models/dataModel.Agrifood/refs/heads/master/Animal/schema.json";
async function startMcpServer() {
const server = new FastMCP({ name: "Agrifood-NGSI-LD-MCP" });
// 1. Fetch the JSON schema once on startup to configure both tools
const schema = await fetch(ANIMAL_SCHEMA_URL).then(r => r.json());
// Build dynamic Zod shapes from the schema
const searchShape: Record<string, z.ZodTypeAny> = {};
for (const [key, prop] of Object.entries(schema.properties as any)) {
if (prop.type !== "object" && prop.type !== "array") {
searchShape[key] = z.string().optional().describe(prop.description || key);
}
}
// ==========================================
// TOOL 1: Current State (Concise Format)
// ==========================================
server.addTool({
name: "query_animals_current",
description: `Get the CURRENT state of animals. ${schema.description}`,
parameters: z.object({
...searchShape,
limit: z.number().optional().default(10)
}),
execute: async (args) => {
const url = new URL(`${BROKER_URL}/entities`);
url.searchParams.append("type", schema.title || "Animal");
url.searchParams.append("options", "concise"); // Token-efficient current state
const qFilters = [];
for (const [key, value] of Object.entries(args)) {
if (key !== "limit" && value !== undefined) {
qFilters.push(`${key}=="${value}"`);
}
}
if (qFilters.length > 0) url.searchParams.append("q", qFilters.join(";"));
url.searchParams.append("limit", (args.limit as number).toString());
const res = await fetch(url.toString(), { headers: { "Accept": "application/ld+json" }});
return await res.json();
}
});
// ==========================================
// TOOL 2: Historical State (Temporal Format)
// ==========================================
server.addTool({
name: "get_animal_history",
description: "Get HISTORICAL data or trends for a specific animal over time (e.g., past weight, health changes, location history).",
parameters: z.object({
id: z.string().describe("The exact URN ID of the animal (e.g., urn:ngsi-ld:Animal:Beany)"),
attrs: z.string().optional().describe("Comma-separated list of properties to track (e.g., 'weight,healthStatus'). If omitted, returns all history."),
timerel: z.enum(["before", "after", "between"]).default("after").describe("Temporal relationship"),
timeAt: z.string().describe("ISO8601 timestamp (e.g., '2026-08-01T00:00:00Z')"),
endTimeAt: z.string().optional().describe("ISO8601 timestamp, REQUIRED if timerel is 'between'")
}),
execute: async (args) => {
// Use the specific temporal endpoint for a known entity ID
const url = new URL(`${BROKER_URL}/temporal/entities/${args.id}`);
url.searchParams.append("options", "temporalValues"); // Token-efficient tuple format
if (args.attrs) url.searchParams.append("attrs", args.attrs);
url.searchParams.append("timerel", args.timerel);
url.searchParams.append("timeAt", args.timeAt);
if (args.timerel === "between" && args.endTimeAt) {
url.searchParams.append("endTimeAt", args.endTimeAt);
}
const res = await fetch(url.toString(), { headers: { "Accept": "application/ld+json" }});
return await res.json();
}
});
await server.start();
}
startMcpServer();
How the Agent Navigates This
By splitting the tools, you give the LLM clear boundaries.
• User asks: "Find the cow named Beany."
◦ LLM Logic: Needs current identification. Calls query_animals_current({ name: "Beany", species: "dairy cattle" }).
◦ Result: Retrieves Beany's URN ID and current concise state.
7 of 9 02.09.26, 17:28
Firefox about:blank
• User asks: "Has she been losing weight this past month?"
◦ LLM Logic: Recognizes a time-series question. It already knows Beany's ID from the previous turn. It calculates the timestamp for one month ago (approx. August 2026).
◦ Tool Call: get_animal_history({ id: "urn:ngsi-ld:Animal:Beany", attrs: "weight", timerel: "after", timeAt: "2026-08-02T00:00:00Z" }).
◦ Result: Retrieves the temporalValues tuple array [ [455, "2026-08-10..."], [450, "2026-08-25..."] ]. The LLM observes the downward trend and answers the user.
This dual-tool strategy perfectly aligns the semantic depth of NGSI-LD with the deterministic tool-calling behavior of modern LLMs.
User prompt: The URIs of entity types resolve to URLs - Animal maps to https://smartdatamodels.org/dataModel.Agrifood/Animal - this in turn has a link to schema - can this information be used to make the definitions more dynamic? Does adding a resource for an Animal definition help the agent's
efficiency?
Response: 1. Making Tool Definitions Fully Dynamic via URI Resolution
Yes, using the Semantic Web URI resolution path is the ultimate way to make your MCP server completely autonomous and zero-configuration.
Instead of hardcoding ANIMAL_SCHEMA_URL, your MCP server can act as a true semantic crawler on startup:
1. Discover Types: Query the Context Broker (GET /ngsi-ld/v1/types) to see what data actually exists in the system (e.g., it returns Animal, Building).
2. Resolve URIs: Look up those terms in your @context file to get their URIs (e.g., Animal -> [https://smartdatamodels.org/dataModel.Agrifood/Animal](https://smartdatamodels.org/dataModel.Agrifood/Animal)).
3. Fetch Schema: Smart Data Models (SDM) have predictable patterns. You can programmatically map the SDM URI to its raw GitHub schema.json equivalent, or use HTTP content negotiation if the URI supports returning JSON Schema directly.
4. Generate Tools: Pass that dynamically fetched schema into the dynamic tool builder we discussed previously.
The result: If you add a Tractor to your farm and restart the MCP server, it will automatically discover the Tractor type, follow its URI, download the tractor schema, and expose a query_tractors tool to the agent. No code changes required.
2. Does adding a Resource help Agent Efficiency?
In the Model Context Protocol, Tools are actions the agent takes, while Resources are reference data the agent can read.
Exposing the SDM schema.json as an MCP Resource drastically improves token efficiency and complex reasoning, but it changes how the agent works.
The Problem with Tool-Only Definitions
If an entity schema has 50 properties (like Animal does), putting all 50 property descriptions into the FastMCP Tool description bloats the LLM's system prompt. Every single turn of the conversation, the LLM pays a heavy token tax to keep that massive tool definition in memory, even if the user is just
asking a simple question.
The Resource-Driven Architecture
By exposing the schema as a Resource, you keep your Tool definition lean, and allow the agent to "read the manual" only when it needs to.
Here is how you define it in FastMCP:
// 1. Expose the definition as a Resource
server.addResource({
uri: "ontology://agrifood/Animal",
name: "Animal Data Model Schema",
mimeType: "application/json",
description: "Read this resource to understand all available properties, types, and metadata for Animal entities.",
read: async () => {
// Fetch the actual schema.json
const schema = await fetch("https://raw.githubusercontent.com/.../schema.json");
return await schema.text();
}
});
// 2. Keep the Tool lean
server.addTool({
name: "query_animals",
description: "Search for animals. If you do not know which properties to filter by, read the 'ontology://agrifood/Animal' resource first.",
parameters: z.object({
q: z.string().describe("NGSI-LD query string (e.g., species=='dairy cattle')"),
// Notice we DON'T list all 50 parameters here anymore
}),
execute: async (args) => { ... }
});
How this affects efficiency:
1. Token Efficiency (High): The LLM's default context window remains small. It only loads the massive JSON Schema when explicitly investigating how to query an Animal.
2. Speed (Slightly Slower initially): For a completely novel query, the agent requires a two-step process: First, it calls read_resource to study the schema. Second, it calls query_animals using the knowledge it just gained.
3. Accuracy (High): Because the agent reads the raw, complete schema (including enums, required fields, and precise definitions), it is much less likely to hallucinate query parameters or misunderstand the data returned.
Best Practice: Use Resources to hold the rich ontological definitions (schema.json). Instruct the agent in the Tool description to read the Resource if it needs to construct complex queries or understand the exact shape of the data.
User prompt: Could this efficiency be improved further using {entity-id}/attrs or the pick parameter from NSGI
Response: Yes, absolutely. Attribute projection—specifically using the standard NGSI-LD attrs parameter (or targeting the /entities/{entityId}/attrs/{attrId} endpoint)—is the final piece of the token-optimization puzzle.
When dealing with complex Smart Data Models like Animal or Building that can have 50+ properties, returning the entire object just to answer "How much does Beany weigh?" wastes hundreds of tokens and dilutes the LLM's attention.
By exposing attribute projection to the agent, you create a highly efficient, surgical querying loop.
How Attribute Projection Supercharges the Agent
When you combine the Resource pattern (for schema discovery) with the attrs parameter (for data retrieval), you give the LLM the ability to "pick" exactly what it needs.
Here is the exact code to implement this in FastMCP:
import { FastMCP } from "fastmcp";
import { z } from "zod";
const BROKER_URL = "http://localhost:1026/ngsi-ld/v1";
server.addTool({
name: "get_animal_details",
description: "Retrieve data for a specific animal. ALWAYS use the 'attrs' parameter to request only the fields needed to answer the user's question.",
parameters: z.object({
id: z.string().describe("The specific URN of the animal"),
attrs: z.string().optional().describe("Comma-separated list of properties to retrieve (e.g., 'weight,healthStatus,species'). Check the Animal schema Resource if you are unsure of the property names.")
}),
execute: async (args) => {
const url = new URL(`${BROKER_URL}/entities/${args.id}`);
// Use concise format to drop NGSI-LD boilerplate
url.searchParams.append("options", "concise");
// Apply the attribute projection!
if (args.attrs) {
url.searchParams.append("attrs", args.attrs);
}
const response = await fetch(url.toString(), {
headers: { "Accept": "application/ld+json" }
});
return await response.json();
}
});
The Ultimate Efficiency Loop
With this architecture in place, here is exactly how an agent handles a query like "What is the health status and current weight of the cow named Beany?" with absolute minimal token usage:
1 Discovery (Optional)
Only happens if the agent doesn't already know the schema
The agent calls the read_resource tool for ontology://agrifood/Animal to learn what properties represent "health status" and "weight" (learning they are healthStatus and weight).
2 Search
The agent calls query_animals({ q: "name==\"Beany\"", attrs: "id" }). Payload returned: [{ "id": "urn:ngsi-ld:Animal:123" }]. (Tiny payload).
3 Targeted Retrieval
The agent calls get_animal_details({ id: "urn:ngsi-ld:Animal:123", attrs: "healthStatus,weight" }). Payload returned: {"id": "urn:ngsi-ld:Animal:123", "healthStatus": "healthy", "weight": 450}. (Tiny payload).
When to use {entityId}/attrs/{attrId}
If the agent only needs a single attribute, you could theoretically map a tool to GET /entities/{entityId}/attrs/{attrId}.
However, it is generally better to stick to the attrs=... query parameter on the main entity endpoint.
1. The attrs parameter accepts multiple comma-separated values, giving the LLM more flexibility in a single tool call.
8 of 9 02.09.26, 17:28
Firefox about:blank
2. The /attrs/{attrId} endpoint returns the raw NGSI-LD attribute object, meaning you lose the benefit of options=concise flattening the root entity.
Summary of the Optimal Architecture
If you combine everything discussed, you achieve the gold standard for Semantic Web + LLM integration:
1. Dynamic Tools: Read the Context Broker's /types endpoint to dynamically generate tools for whatever is actually on the farm.
2. Schema as Resources: Keep tool prompts lean by mapping SDM URLs to MCP Resources, letting the agent read the documentation only when needed.
3. Concise Format: Use ?options=concise to drop the "type": "Property" boilerplate while retaining essential metadata like unitCode.
4. Attribute Projection: Force the LLM to use the attrs parameter so it only downloads the specific JSON keys necessary to answer the prompt.
User prompt: attrs parameter is deprecated, it should use pick
Response: You are absolutely right to call that out. As the NGSI-LD specification has matured (especially heading into v1.8+), pick is the correct, standardized parameter for explicit attribute projection, replacing the older/ambiguous attrs usage for this purpose.
Using pick is actually even better for an LLM agent because the semantic meaning of the word "pick" perfectly aligns with the instruction you want to give the agent: "pick exactly what you need."
Here is how you update the FastMCP tool definition to use the modern pick parameter to enforce that surgical token efficiency.
The Updated pick Implementation
import { FastMCP } from "fastmcp";
import { z } from "zod";
const BROKER_URL = "http://localhost:1026/ngsi-ld/v1";
server.addTool({
name: "get_animal_details",
parameters: z.object({
id: z.string().describe("The specific URN of the animal"),
description: "Retrieve data for a specific animal. ALWAYS use the 'pick' parameter to select ONLY the fields needed to answer the user's question.",
// Updated to use the modern 'pick' parameter
pick: z.string().optional().describe("Comma-separated list of properties to retrieve (e.g., 'weight,healthStatus'). Check the Animal schema Resource if unsure.")
}),
execute: async (args) => {
const url = new URL(`${BROKER_URL}/entities/${args.id}`);
// Still use concise format to drop the "type": "Property" boilerplate
url.searchParams.append("options", "concise");
// Apply the modern attribute projection
if (args.pick) {
url.searchParams.append("pick", args.pick);
}
const response = await fetch(url.toString(), {
headers: { "Accept": "application/ld+json" }
});
if (!response.ok) {
throw new Error(`NGSI-LD Error: ${response.statusText}`);
}
return await response.json();
}
});
Why this is the definitive pattern
By combining options=concise with the pick parameter, you have reached the absolute floor of token consumption for an NGSI-LD payload.
When the agent executes: get_animal_details({ id: "urn:ngsi-ld:Animal:Beany", pick: "weight" })
The Context Broker returns exactly this:
{
"id": "urn:ngsi-ld:Animal:Beany",
"type": "Animal",
"weight": {
"value": 450,
"unitCode": "KGM",
"observedAt": "2026-09-02T12:00:00Z"
}
}
The LLM gets the core value (450), the necessary metadata (KGM), and the timestamp of the reading (2026-09-02), with zero wasted tokens. The agent handles the semantics, while the FastMCP server handles the HTTP protocol and NGSI-LD standard compliance.
9 of 9 02.09.26, 17:28