// Custom NGSI-LD/JSON-Schema keywords carried by schemas/*.json.
export interface DerivedFrom {
    method?: string;
    parent?: string;
    instances?: number;
}

export interface JsonSchemaNode {
    $id?: string;
    title?: string;
    description?: string;
    type?: string | string[];
    modelTags?: string;
    required?: string[];
    enum?: unknown[];
    format?: string;
    properties?: Record<string, JsonSchemaNode>;
    items?: JsonSchemaNode;
    allOf?: JsonSchemaNode[];
    anyOf?: JsonSchemaNode[];
    oneOf?: JsonSchemaNode[];
    'x-ai-instruction'?: string;
    'x-ngsi-type'?: string;
    'x-unitCode'?: string;
    'x-observedAt'?: boolean;
    'x-mobile'?: boolean;
    'x-derivedFrom'?: DerivedFrom;
    [key: string]: unknown;
}
