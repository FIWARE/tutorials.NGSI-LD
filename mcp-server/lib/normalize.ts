// Turn a caller's simplified `attr: value` into a normalised NGSI-LD attribute
// node, using the encoding hints the schema loader derived (WriteAttr). The agent
// never writes normalised form; the write tools call this.

import { NGSI_ATTR_TYPES } from './schema';
import type { NgsiAttrType, WriteAttr } from './schema';

// The value-bearing member for each NGSI-LD attribute type (ETSI GS CIM 009 §4.5.2).
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

// The caller already handed us a normalised attribute node ({ type: <NGSI type>,
// <value-member>: … }) — used by the generic write tools where there is no schema
// to encode from. Pass it straight through.
function isNormalisedNode(v: unknown): v is Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const t = (v as Record<string, unknown>).type;
    return typeof t === 'string' && NGSI_ATTR_TYPES.has(t as NgsiAttrType) && VALUE_KEY[t as NgsiAttrType] in v;
}

// No schema: best-effort. A URN string is a Relationship; a GeoJSON geometry is a
// GeoProperty; everything else is a Property.
function inferKind(value: unknown): NgsiAttrType {
    if (typeof value === 'string' && /^urn:ngsi-ld:/i.test(value)) return 'Relationship';
    if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'type' in value &&
        'coordinates' in value
    ) {
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

    // A bare [lng, lat(, alt)] array for a GeoProperty is shorthand for a GeoJSON Point.
    // Otherwise the value — primitive, array or object — goes into its slot verbatim.
    let payload = value;
    if (
        kind === 'GeoProperty' &&
        Array.isArray(value) &&
        value.length >= 2 &&
        value.length <= 3 &&
        value.every((n) => typeof n === 'number')
    ) {
        payload = { type: 'Point', coordinates: value };
    }

    const node: Record<string, unknown> = { type: kind, [VALUE_KEY[kind]]: payload };

    const unit = opts.unitCode ?? spec?.unitCode;
    if (unit && UNIT_BEARING.has(kind)) {
        node.unitCode = unit;
    }

    const measurement = isMeasurement(name, spec, opts.mobile === true);
    if (opts.observedAt) {
        node.observedAt = opts.observedAt;
    } else if (measurement) {
        node.observedAt = new Date().toISOString();
    }

    if (opts.providedBy && measurement) {
        node.providedBy = { type: 'Relationship', object: opts.providedBy };
    }

    return node;
}
