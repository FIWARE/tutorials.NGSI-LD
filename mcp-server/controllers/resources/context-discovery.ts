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
        description:
            'The entity types on the broker right now, each with its attribute names. Same data as the `types` ' +
            'part of `discover_context_meta_data` with `pick=live_data`.',
        load: () => liveJson(() => listTypes(true))
    });

    server.addResource({
        uri: 'ngsi://attributes',
        name: 'Live attributes',
        mimeType: 'application/json',
        description:
            'The attribute names in use on the broker right now, each with its value types and owning entity types. ' +
            'Same data as the `attributes` part of `discover_context_meta_data` with `pick=live_data`.',
        load: () => liveJson(() => listAttributes(true))
    });
}
