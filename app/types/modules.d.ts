declare module 'express-healthcheck' {
    import type { RequestHandler } from 'express';
    function healthcheck(options?: Record<string, unknown>): RequestHandler;
    export = healthcheck;
}

declare module 'jsonld' {
    type JsonLdDocument = Record<string, unknown> | Record<string, unknown>[];
    type ContextDefinition = Record<string, unknown> | string | (Record<string, unknown> | string)[];

    function expand(input: JsonLdDocument, options?: Record<string, unknown>): Promise<JsonLdDocument[]>;
    function compact(
        input: JsonLdDocument,
        ctx: ContextDefinition,
        options?: Record<string, unknown>
    ): Promise<Record<string, unknown>>;
    function flatten(input: JsonLdDocument, options?: Record<string, unknown>): Promise<JsonLdDocument>;

    export { expand, compact, flatten, ContextDefinition, JsonLdDocument };
    export default { expand, compact, flatten };
}

declare module 'parse-links' {
    function parseLinks(header: string): Record<string, string>;
    export = parseLinks;
}

declare module 'connect-flash' {
    import type { RequestHandler } from 'express';
    function flash(): RequestHandler;
    export = flash;
}
