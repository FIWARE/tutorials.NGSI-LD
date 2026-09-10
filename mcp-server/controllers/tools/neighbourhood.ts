// "Everything one hop from an entity" — backs the `neighbourhood` option on the get_entity
// tool. Deliberately kept out of the execute handler: it fans out into many broker calls
// (one per relationship target, plus a sibling query per relationship). Entities come back
// in full concise form on purpose — `pick` is not applied, because the diagnostic signal
// is usually a relationship on a *neighbour* (e.g. a newborn's `calvedBy`) that a trimmed
// projection would hide.

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

// The entity, plus for each of its relationship attributes: the target entity/ies it
// points to (forward), and every other entity of the same type that shares that
// relationship value (siblings — e.g. co-located, same owner). Full concise form.
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
