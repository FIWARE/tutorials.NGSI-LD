// Backs get_entity's `neighbourhood` option: an entity plus its one-hop graph, in its own
// function (many broker calls). No `pick` — it would hide the neighbour edge that holds the answer.

import { readEntity, listEntities } from '../../lib/ngsi-ld';
import { UNKNOWN_ATTRIBUTES, ADDITIONAL_PROPERTY } from '../../lib/constants';
import { stripContext, spreadAdditionalProperty } from './util';

const AP_MODE = UNKNOWN_ATTRIBUTES === 'additionalProperty';

const shape = (e: unknown): unknown => {
    const s = stripContext(e);
    return AP_MODE ? spreadAdditionalProperty(s, ADDITIONAL_PROPERTY) : s;
};

// Concise relationship: the value is (or is an array containing) `{ object: <URN | URN[]> }`.
// Returns the flat, de-duplicated set of target URNs, or null when `v` is not a relationship.
function relationshipTargets(v: unknown): string[] | null {
    const nodes = Array.isArray(v) ? v : [v];
    const urns: string[] = [];
    let isRelationship = false;
    for (const n of nodes) {
        if (n && typeof n === 'object' && 'object' in (n as Record<string, unknown>)) {
            isRelationship = true;
            const o = (n as Record<string, unknown>).object;
            for (const u of Array.isArray(o) ? o : [o]) {
                if (typeof u === 'string' && u) {
                    urns.push(u);
                }
            }
        }
    }
    return isRelationship ? [...new Set(urns)] : null;
}

// Per relationship attribute: the entities it points to (forward) and every same-type
// entity sharing that value (siblings — co-located, same owner). Full concise form.
export async function getNeighbourhood(id: string, limit?: number): Promise<Record<string, unknown>> {
    const cap = Math.min(limit && limit > 0 ? limit : 20, 100);

    const self = shape(await readEntity(id, { options: 'concise' })) as Record<string, unknown>;
    const type = typeof self.type === 'string' ? self.type : undefined;

    const adjacency: Record<string, unknown> = {};
    for (const [attr, val] of Object.entries(self)) {
        if (attr === 'id' || attr === 'type') {
            continue;
        }
        const targets = relationshipTargets(val);
        if (!targets || !targets.length) {
            continue;
        }

        const targetEntities = await Promise.all(
            targets.map((u) =>
                readEntity(u, { options: 'concise' })
                    .then(shape)
                    .catch(() => ({ id: u, unreadable: true }))
            )
        );

        let siblings: unknown[] = [];
        if (type) {
            const q = targets.map((u) => `${attr}=="${u}"`).join('|');
            const page = await listEntities({ type, q, limit: cap, options: 'concise' });
            siblings = page.entities.map(shape).filter((e) => (e as Record<string, unknown>).id !== id);
        }

        adjacency[attr] = {
            via: targets.length === 1 ? targets[0] : targets,
            targets: targetEntities,
            siblings
        };
    }

    return { id, entity: self, adjacency };
}
