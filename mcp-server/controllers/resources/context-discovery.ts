import type { FastMCP } from 'fastmcp';
import { listTypes, listAttributes } from '../../lib/ngsi-ld';
import { stripContext } from '../tools/util';

async function liveJson(fn: () => Promise<unknown>): Promise<{ text: string }> {
    try {
        return { text: JSON.stringify(stripContext(await fn()), null, 2) };
    } catch (err) {
        return { text: JSON.stringify({ error: (err as Error).message }, null, 2) };
    }
}

export function registerContextDiscoveryResources(server: FastMCP): void {
    server.addResource({
        uri: 'ngsi://types',
        name: 'Live entity types',
        mimeType: 'application/json',
        description: 'EntityType list (with attribute names) that exists on the broker right now — GET /types?details=true.',
        load: () => liveJson(() => listTypes(true))
    });

    server.addResource({
        uri: 'ngsi://attributes',
        name: 'Live attributes',
        mimeType: 'application/json',
        description: 'Attribute list (name, types, owning entity types) in use on the broker right now — GET /attributes?details=true.',
        load: () => liveJson(() => listAttributes(true))
    });
}
