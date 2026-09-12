// The `enums` kind of discover_context_meta_data: every enumerated attribute value,
// per loaded schema type. Built once at start-up from each schema's writeAttrs.

import type { LoadedSchema } from './schema';

export type EnumMap = Record<string, Record<string, string[]>>;

export function buildEnums(schemas: LoadedSchema[]): EnumMap {
    const enums: EnumMap = {};
    for (const s of schemas) {
        const attrs: Record<string, string[]> = {};
        for (const [name, wa] of Object.entries(s.writeAttrs)) {
            if (wa.enumValues?.length) {
                attrs[name] = wa.enumValues;
            }
        }
        enums[s.typeName] = attrs;
    }
    return enums;
}
