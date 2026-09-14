// The set of known entity types, and everything derived from it — held behind a getter so a
// later discovery pass is visible to tools already registered, instead of frozen at start-up.

import debug from 'debug';
import { DISCOVERY, DISCOVERY_TTL } from './constants';
import { discoverTypes } from './discover';
import { buildEnums, type EnumMap } from './enums';
import { buildProperties, buildRelationships, type AttrDescMap } from './relationships';
import { loadSchemas, type LoadedSchema } from './schema';

const log = debug('mcp:registry');

export interface RegistrySnapshot {
    schemas: LoadedSchema[];
    enums: EnumMap;
    relationships: AttrDescMap;
    properties: AttrDescMap;
    typeNames: string[];
    ontologyLinks: Record<string, string>;
}

function derive(schemas: LoadedSchema[]): RegistrySnapshot {
    return {
        schemas,
        enums: buildEnums(schemas),
        relationships: buildRelationships(schemas),
        properties: buildProperties(schemas),
        typeNames: schemas.map((s) => s.typeName),
        ontologyLinks: Object.fromEntries(schemas.map((s) => [s.typeName, s.ontologyUri]))
    };
}

export class SchemaRegistry {
    private snapshot: RegistrySnapshot = derive([]);
    private fromDisk: LoadedSchema[] = [];
    private refreshedAt = 0;
    private listeners: ((snapshot: RegistrySnapshot) => void)[] = [];

    get(): RegistrySnapshot {
        return this.snapshot;
    }

    // Registered after start-up, so a later refresh can add resources for types that
    // did not exist when the server was built.
    notifyOn(listener: (snapshot: RegistrySnapshot) => void): void {
        this.listeners.push(listener);
    }

    async load(): Promise<void> {
        this.fromDisk = await loadSchemas();
        this.apply(this.fromDisk);
        if (DISCOVERY !== 'off') {
            await this.refresh();
        }
    }

    // Curated schemas are the baseline and are never displaced — they cover types with no
    // entities yet (Pen, AnimalDisease); discovery only adds types disk doesn't know about.
    async refresh(): Promise<number> {
        if (DISCOVERY === 'off') {
            return 0;
        }
        const curated = new Set(this.fromDisk.map((s) => s.typeName.toLowerCase()));
        const discovered = await discoverTypes(curated);
        const merged = [...this.fromDisk, ...discovered];
        this.refreshedAt = Date.now();
        this.apply(merged);
        log('%d schemas (%d on disk, %d discovered)', merged.length, this.fromDisk.length, discovered.length);
        for (const listener of this.listeners) {
            listener(this.snapshot);
        }
        return discovered.length;
    }

    // Re-runs discovery when the last pass has aged out. DISCOVERY_TTL 0 means never.
    async refreshIfStale(): Promise<void> {
        if (DISCOVERY === 'off' || DISCOVERY_TTL <= 0) {
            return;
        }
        if (Date.now() - this.refreshedAt >= DISCOVERY_TTL * 1000) {
            await this.refresh();
        }
    }

    private apply(schemas: LoadedSchema[]): void {
        this.snapshot = derive(schemas);
    }
}
