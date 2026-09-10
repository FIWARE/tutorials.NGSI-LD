// Load prompts/*.json: MCP prompt specs whose `template` is filled in at call time.
// Tolerant per-file loader like lib/schema.ts; substitution in controllers/prompts/dynamic.ts.

import fs from 'fs';
import path from 'path';
import debug from 'debug';
import { PROMPTS_DIR } from './constants';

const log = debug('mcp:prompt');

export interface LoadedPrompt {
    name: string;
    description: string;
    arguments: Record<string, string>; // argument name -> description shown to the caller
    types: string[]; // NGSI-LD type names {{tools}} / {{type}} resolve against
    tools: string[]; // tool-name patterns, e.g. "get_{{type}}", "query_entities_geo"
    template: string;
    fields: Record<string, unknown>; // every other JSON key, available for {{placeholder}} substitution
}

export function loadOne(file: string): LoadedPrompt {
    const full = path.join(PROMPTS_DIR, file);
    const source = JSON.parse(fs.readFileSync(full, 'utf-8')) as Record<string, unknown>;

    const { name, description, arguments: args, types, tools, template, ...fields } = source;
    if (typeof name !== 'string' || !name) {
        throw new Error('"name" is required');
    }
    if (typeof template !== 'string' || !template) {
        throw new Error('"template" is required');
    }

    return {
        name,
        description: typeof description === 'string' && description ? description : name,
        arguments: (args && typeof args === 'object' ? (args as Record<string, string>) : {}) || {},
        types: Array.isArray(types) ? (types as string[]) : [],
        tools: Array.isArray(tools) ? (tools as string[]) : [],
        template,
        fields
    };
}

export function loadPrompts(): LoadedPrompt[] {
    let files: string[] = [];
    try {
        files = fs
            .readdirSync(PROMPTS_DIR)
            .filter(
                (f) => !f.startsWith('.') && f.endsWith('.json') && fs.statSync(path.join(PROMPTS_DIR, f)).isFile()
            );
    } catch (err) {
        log('cannot read PROMPTS_DIR %s: %s', PROMPTS_DIR, (err as Error).message);
        return [];
    }

    const loaded: LoadedPrompt[] = [];
    for (const file of files.sort()) {
        try {
            loaded.push(loadOne(file));
            log('loaded %s', file);
        } catch (err) {
            log('skipping %s: %s', file, (err as Error).message);
        }
    }
    if (loaded.length === 0) {
        log('no prompts loaded');
    }
    return loaded;
}
