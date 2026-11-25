/**
 * Small shared helpers used across the comparison engine.
 * Keeping them here avoids duplicated logic in the comparators (NFR-05).
 */

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isPlainObject(value) {
  return isObject(value) && !Array.isArray(value);
}

/**
 * Deterministic JSON stringify: object keys are sorted so that two equal
 * documents always produce the same string. The report digest depends on it.
 */
const MAX_STRINGIFY_DEPTH = 200;

export function stableStringify(value, depth = 0) {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (depth > MAX_STRINGIFY_DEPTH) return '"[truncated]"';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item, depth + 1)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key], depth + 1)}`).join(',')}}`;
}

export function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

/** Human readable, length capped representation used in reports. */
export function formatValue(value, maxLength = 320) {
  if (value === undefined) return '(not present)';
  if (value === null) return 'null';
  if (typeof value === 'string') {
    const text = value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
    return text;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text;
  try {
    text = stableStringify(value);
  } catch {
    text = String(value);
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function pointerJoin(base, key) {
  if (key === undefined || key === null || key === '') return base || '';
  return base ? `${base}/${key}` : `/${key}`;
}

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

export function methodRank(method = '') {
  const index = METHOD_ORDER.indexOf(String(method).toLowerCase());
  return index === -1 ? METHOD_ORDER.length : index;
}

/** Replaces templated path segments so /pets/{id} and /pets/{petId} match. */
export function canonicalPath(path = '') {
  const withoutTrailing = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  return withoutTrailing.replace(/\{[^/{}]+\}/g, '{}');
}

export function isJsonMediaType(mediaType = '') {
  const value = String(mediaType).toLowerCase();
  return value.includes('json') || value === '*/*' || value === 'application/*';
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

export function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
