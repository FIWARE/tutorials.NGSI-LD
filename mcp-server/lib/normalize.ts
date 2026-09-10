// Turn a caller's simplified `attr: value` into a normalised NGSI-LD attribute
// node, using the schema loader's encoding hints (WriteAttr). The write tools call this.

import { NGSI_ATTR_TYPES } from './schema';
import type { NgsiAttrType, WriteAttr } from './schema';

// The value-bearing member for each NGSI-LD attribute type.
const VALUE_KEY: Record<NgsiAttrType, string> = {
    Property: 'value',
    GeoProperty: 'value',
    Relationship: 'object',
    VocabProperty: 'vocab',
    LanguageProperty: 'languageMap',
    ListProperty: 'valueList',
    ListRelationship: 'objectList',
    JsonProperty: 'json'
};

// unitCode is only a member of Property / ListProperty.
const UNIT_BEARING: ReadonlySet<NgsiAttrType> = new Set(['Property', 'ListProperty']);

export interface NormalizeOptions {
    mobile?: boolean; // schema x-mobile: `location` is a moving measurement
    unitCode?: string; // caller override of the schema unit
    observedAt?: string; // caller override with an explicit ISO8601 timestamp
    providedBy?: string; // provenance URN, attached to asserted measurements
}

// An attribute carries `observedAt` (and `providedBy`) when the schema marks it
// x-observedAt, or it is the moving `location` of an x-mobile entity.
function isMeasurement(name: string, spec: WriteAttr | undefined, mobile: boolean): boolean {
    if (spec?.observedAt) return true;
    return mobile && (name === 'location' || spec?.ngsiType === 'GeoProperty');
}

// The caller handed us an already-normalised node ({ type, <value-member> }). The
// generic write tools have no schema to encode from, so pass it straight through.
function isNormalisedNode(v: unknown): v is Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const t = (v as Record<string, unknown>).type;
    return typeof t === 'string' && NGSI_ATTR_TYPES.has(t as NgsiAttrType) && VALUE_KEY[t as NgsiAttrType] in v;
}

const META_KEYS = ['unitCode', 'observedAt', 'datasetId'];

// Unpack a value copied back from a concise read so it is not wrapped again into
// `{ type, value: { value: 118 } }`. A plain `value` needs a metadata sibling to qualify.
function fromConcise(v: unknown, key: string): { payload: unknown; unitCode?: string; observedAt?: string } | null {
    if (!v || typeof v !== 'object' || Array.isArray(v) || 'type' in v) return null;
    const o = v as Record<string, unknown>;
    if (!(key in o)) return null;
    const others = Object.keys(o).filter((k) => k !== key);
    if (!others.every((k) => META_KEYS.includes(k))) return null;
    if (key === 'value' && others.length === 0) return null;
    return {
        payload: o[key],
        unitCode: typeof o.unitCode === 'string' ? o.unitCode : undefined,
        observedAt: typeof o.observedAt === 'string' ? o.observedAt : undefined
    };
}

// No schema: best-effort. A URN string is a Relationship; a GeoJSON geometry is a
// GeoProperty; everything else is a Property.
function inferKind(value: unknown): NgsiAttrType {
    if (typeof value === 'string' && /^urn:ngsi-ld:/i.test(value)) return 'Relationship';
    if (value && typeof value === 'object' && !Array.isArray(value) && 'type' in value && 'coordinates' in value) {
        return 'GeoProperty';
    }
    return 'Property';
}

export function normalizeAttribute(
    name: string,
    value: unknown,
    spec: WriteAttr | undefined,
    opts: NormalizeOptions = {}
): Record<string, unknown> {
    if (!spec && isNormalisedNode(value)) {
        return value;
    }
    const kind: NgsiAttrType = spec?.ngsiType ?? inferKind(value);

    // A concise-read value's unitCode / observedAt become overrides unless the
    // caller passed their own.
    const concise = fromConcise(value, VALUE_KEY[kind]);
    const source = concise ? concise.payload : value;
    const unitCodeIn = opts.unitCode ?? concise?.unitCode;
    const observedAtIn = opts.observedAt ?? concise?.observedAt;

    // A bare [lng, lat(, alt)] array is GeoProperty shorthand for a GeoJSON Point.
    // Any other value goes into its slot verbatim.
    let payload = source;
    if (
        kind === 'GeoProperty' &&
        Array.isArray(source) &&
        source.length >= 2 &&
        source.length <= 3 &&
        source.every((n) => typeof n === 'number')
    ) {
        payload = { type: 'Point', coordinates: source };
    }

    const node: Record<string, unknown> = { type: kind, [VALUE_KEY[kind]]: payload };

    const unit = unitCodeIn ?? spec?.unitCode;
    if (unit && UNIT_BEARING.has(kind)) {
        node.unitCode = unit;
    }

    const measurement = isMeasurement(name, spec, opts.mobile === true);
    if (observedAtIn) {
        node.observedAt = observedAtIn;
    } else if (measurement) {
        node.observedAt = new Date().toISOString();
    }

    if (opts.providedBy && measurement) {
        node.providedBy = { type: 'Relationship', object: opts.providedBy };
    }

    return node;
}
