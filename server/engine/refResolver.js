/**
 * Local $ref resolution (FR-12).
 *
 * Only references inside the same document ("#/components/schemas/Pet") are
 * resolved. External documents are reported as warnings instead of being
 * fetched, which keeps the engine deterministic and side-effect free.
 */
import { isObject } from './util.js';

// Guard against stack exhaustion from deeply nested or self-expanding documents.
const MAX_TRAVERSAL_DEPTH = 120;

export class ReferenceError extends Error {
  constructor(message, ref) {
    super(message);
    this.name = 'ReferenceError';
    this.ref = ref;
  }
}

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function resolvePointer(document, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return undefined;
  const segments = ref.slice(2).split('/').map(decodePointerSegment);
  let current = document;
  for (const segment of segments) {
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    if (!(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Recursively replaces $ref nodes with their target value.
 * Circular references become { circularRef: '#/...' } markers so the
 * comparators can compare reference names without looping forever.
 */
export function dereference(value, document, stack = [], warnings = [], depth = 0) {
  if (depth > MAX_TRAVERSAL_DEPTH) return { truncated: true };
  if (Array.isArray(value)) {
    return value.map((item) => dereference(item, document, stack, warnings, depth + 1));
  }
  if (!isObject(value)) return value;

  if (typeof value.$ref === 'string') {
    const ref = value.$ref;

    if (!ref.startsWith('#/')) {
      warnings.push({
        code: 'external-ref-skipped',
        message: `External reference "${ref}" was not resolved; comparison uses the reference name only.`,
        path: ref,
      });
      return { externalRef: ref };
    }

    if (stack.includes(ref)) {
      return { circularRef: ref };
    }

    const target = resolvePointer(document, ref);
    if (target === undefined) {
      warnings.push({
        code: 'unresolved-ref',
        message: `Reference "${ref}" could not be resolved in this document.`,
        path: ref,
      });
      return { unresolvedRef: ref };
    }

    const resolved = dereference(target, document, [...stack, ref], warnings, depth + 1);

    // OpenAPI 3.1 allows siblings next to $ref; they win over the target.
    const siblings = Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$ref'));
    if (isObject(resolved) && Object.keys(siblings).length > 0) {
      return { ...resolved, ...siblings };
    }
    return resolved;
  }

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = dereference(child, document, stack, warnings, depth + 1);
  }
  return output;
}

/** Walks a document and collects every $ref string (used for validation info). */
export function collectRefs(node, refs = [], depth = 0) {
  if (depth > MAX_TRAVERSAL_DEPTH) return refs;
  if (Array.isArray(node)) {
    node.forEach((item) => collectRefs(item, refs, depth + 1));
    return refs;
  }
  if (!isObject(node)) return refs;
  if (typeof node.$ref === 'string') refs.push(node.$ref);
  Object.values(node).forEach((child) => collectRefs(child, refs, depth + 1));
  return refs;
}
