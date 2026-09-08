// One FastMCP prompt per prompts/*.json spec. Static fields are stringified into
// `template`; `{{tools}}` resolves against `exposed`, per-type generic fallback.

import type { FastMCP, InputPromptArgument } from 'fastmcp';
import debug from 'debug';
import type { LoadedPrompt } from '../../lib/prompt';

const log = debug('mcp:prompt');

// {{type}} tool-pattern -> its untyped fallback, for a type with no typed tool.
const DEFAULT_TOOL: Record<string, string> = {
    'query_{{type}}': 'query_entities',
    'get_{{type}}': 'get_entity',
    'get_{{type}}_history': 'get_entity_history'
};

// String as-is; array joined with ", "; object rendered as "key: value" pairs
// joined with "; ". Covers `pick`, `phrasing`, `flagValues` and any other field.
function stringifyField(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map(stringifyField).join(', ');
    }
    if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${stringifyField(v)}`)
            .join('; ');
    }
    return String(value);
}

// Substitute {{type}} into each pattern per type, keeping the result only if
// exposed, else the generic fallback. A pattern with no {{type}} is kept if exposed.
function resolveTools(tools: string[], types: string[], exposed: ReadonlySet<string>): string[] {
    const resolved: string[] = [];
    for (const pattern of tools) {
        if (!pattern.includes('{{type}}')) {
            if (exposed.has(pattern)) {
                resolved.push(pattern);
            }
            continue;
        }
        for (const type of types) {
            const candidate = pattern.replace('{{type}}', type.toLowerCase());
            if (exposed.has(candidate)) {
                resolved.push(candidate);
                continue;
            }
            const fallback = DEFAULT_TOOL[pattern];
            if (fallback && exposed.has(fallback)) {
                resolved.push(fallback);
            }
        }
    }
    return [...new Set(resolved)];
}

function render(template: string, values: Record<string, string>): string {
    return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => {
        if (key in values) {
            return values[key];
        }
        log('unresolved placeholder %s', match);
        return '';
    });
}

export function registerPrompt(server: FastMCP, spec: LoadedPrompt, exposed: ReadonlySet<string>): void {
    const args: InputPromptArgument[] = Object.entries(spec.arguments).map(([name, description]) => ({
        name,
        description,
        required: !/^optional\b/i.test(description.trim())
    }));

    server.addPrompt({
        name: spec.name,
        description: spec.description,
        arguments: args,
        load: async (runtimeArgs) => {
            const values: Record<string, string> = {};
            for (const [key, value] of Object.entries(runtimeArgs)) {
                values[key] = value ?? '';
            }
            values.type = spec.types.length === 1 ? spec.types[0] : spec.types.join(', ');
            values.types = stringifyField(spec.types);
            values.tools = resolveTools(spec.tools, spec.types, exposed)
                .map((t) => `\`${t}\``)
                .join(', ');
            for (const [key, value] of Object.entries(spec.fields)) {
                values[key] = stringifyField(value);
            }
            return render(spec.template, values);
        }
    });
}

// Returns the number of prompts registered.
export function registerPrompts(server: FastMCP, prompts: LoadedPrompt[], exposed: ReadonlySet<string>): number {
    for (const spec of prompts) {
        registerPrompt(server, spec, exposed);
    }
    return prompts.length;
}

export { resolveTools, stringifyField, render };
