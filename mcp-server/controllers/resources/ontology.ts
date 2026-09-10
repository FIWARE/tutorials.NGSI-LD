import type { FastMCP } from 'fastmcp';
import type { LoadedSchema } from '../../lib/schema';
import type { Vocabulary } from '../../lib/vocabulary';

// ontology://attributes: the preferred attribute-term list (core + @context + schemas).
export function registerAttributeVocabulary(server: FastMCP, vocab: Vocabulary): void {
    server.addResource({
        uri: 'ontology://attributes',
        name: 'Attribute vocabulary',
        mimeType: 'application/json',
        description:
            'Preferred attribute term names for writing entities: the canonical spelling of each attribute, its ' +
            'attribute type, unit code, enum values, and which loaded data models use it. Consult before choosing names.',
        load: async () => ({ text: JSON.stringify(vocab, null, 2) })
    });
}

function firstLine(text?: string): string {
    if (!text) {
        return '';
    }
    return text.split(/[\n.]/)[0].trim();
}

export function registerOntology(server: FastMCP, schemas: LoadedSchema[]): void {
    server.addResource({
        uri: 'ontology://index',
        name: 'Ontology index',
        mimeType: 'text/markdown',
        description: 'One line per available data model, with the ontology:// URI to read for the full property list.',
        load: async () => ({
            text:
                '# Ontology index\n\n' +
                schemas
                    .map(
                        (s) =>
                            `- \`${s.ontologyUri}\` — **${s.typeName}**: ${firstLine(s.source.description) || s.title}`
                    )
                    .join('\n') +
                '\n'
        })
    });

    for (const s of schemas) {
        server.addResource({
            uri: s.ontologyUri,
            name: `${s.typeName} data model`,
            mimeType: 'application/json',
            description:
                `JSON Schema for ${s.typeName}, all $ref resolved and inlined (including the shared NGSI-LD/Smart ` +
                `Data Model common attributes): every property, its NGSI-LD type, enums, required fields and ` +
                `relationship targets` +
                (s.lowTrust ? ' — inferred profile, indicative only.' : '.'),
            load: async () => ({ text: JSON.stringify(s.raw, null, 2) })
        });
    }

    // Same content addressable as a template, so a client can build the URI directly.
    server.addResourceTemplate({
        uriTemplate: 'ontology://{model}/{type}',
        name: 'Data model schema',
        mimeType: 'application/json',
        description:
            'JSON Schema for a data model, all $ref resolved and inlined (common attributes included). `model` e.g. ' +
            '"agrifood" / "generated"; `type` e.g. "Animal".',
        arguments: [
            { name: 'model', description: 'Model slug, e.g. "agrifood", "device", "generated".' },
            { name: 'type', description: 'Entity type, e.g. "Animal", "SoilSensor".' }
        ],
        load: async ({ model, type }) => {
            const match = schemas.find(
                (s) => s.model === model.toLowerCase() && s.typeName.toLowerCase() === type.toLowerCase()
            );
            if (!match) {
                return { text: JSON.stringify({ error: `No data model ${model}/${type}` }, null, 2) };
            }
            return { text: JSON.stringify(match.raw, null, 2) };
        }
    });
}
