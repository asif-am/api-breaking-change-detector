/**
 * Specification normalization (FR-03, FR-12, FR-13).
 *
 * Produces a canonical, comparable model of the API:
 *   {
 *     meta, operationCount, schemaNames,
 *     operations: { 'POST /pets': {...} }
 *   }
 *
 * The normalizer flattens path-level parameters into every operation, resolves
 * local $refs, and keeps a single schema representation so that comparators
 * never need to know about OpenAPI layout details.
 */
import { HTTP_METHODS } from './parser.js';
import { dereference } from './refResolver.js';
import { canonicalPath, isObject } from './util.js';

function normalizeSchema(schema) {
  if (!isObject(schema)) return {};
  return schema;
}

function normalizeMediaContent(content) {
  if (!isObject(content)) return {};
  const normalized = {};
  for (const [mediaType, media] of Object.entries(content)) {
    normalized[String(mediaType).toLowerCase()] = {
      schema: normalizeSchema(media?.schema),
      example: media?.example,
    };
  }
  return normalized;
}

function normalizeParameter(parameter) {
  if (!isObject(parameter) || !parameter.name || !parameter.in) return null;

  let schema = parameter.schema;
  if (!isObject(schema) && isObject(parameter.content)) {
    const first = Object.values(parameter.content)[0];
    schema = first?.schema;
  }
  if (!isObject(schema)) {
    // Swagger-2 style inline typing, kept for resilience.
    schema = isObject(parameter.items)
      ? { type: parameter.type, items: parameter.items }
      : { type: parameter.type };
    if (schema.type === undefined) delete schema.type;
    if (parameter.enum) schema.enum = parameter.enum;
  }

  return {
    name: String(parameter.name),
    in: String(parameter.in),
    required: parameter.required === true || parameter.in === 'path',
    deprecated: parameter.deprecated === true,
    description: parameter.description || '',
    hasDefault: schema?.default !== undefined,
    defaultValue: schema?.default,
    schema: normalizeSchema(schema),
  };
}

function mergeParameters(pathLevel = [], operationLevel = []) {
  const merged = new Map();

  for (const parameter of pathLevel) {
    const normalized = normalizeParameter(parameter);
    if (normalized) merged.set(`${normalized.in}:${normalized.name}`, normalized);
  }
  for (const parameter of operationLevel) {
    const normalized = normalizeParameter(parameter);
    if (normalized) merged.set(`${normalized.in}:${normalized.name}`, normalized);
  }

  return [...merged.values()].sort((a, b) => {
    if (a.in !== b.in) return a.in.localeCompare(b.in);
    return a.name.localeCompare(b.name);
  });
}

function normalizeResponses(responses) {
  const normalized = {};
  if (!isObject(responses)) return normalized;

  for (const [status, response] of Object.entries(responses)) {
    if (!isObject(response)) continue;
    normalized[String(status)] = {
      description: response.description || '',
      content: normalizeMediaContent(response.content),
      headers: isObject(response.headers) ? Object.keys(response.headers).sort() : [],
    };
  }
  return normalized;
}

/**
 * @param {object} parsed result of parseSpecification()
 * @returns normalized model
 */
export function normalizeSpecification(parsed) {
  const warnings = [...(parsed.warnings || [])];
  const resolved = dereference(parsed.document, parsed.document, [], warnings);

  const operations = {};
  const paths = isObject(resolved.paths) ? resolved.paths : {};

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!isObject(pathItem)) continue;

    const sharedParameters = mergeParameters(
      Array.isArray(pathItem.parameters) ? pathItem.parameters : [],
      []
    );

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!isObject(operation)) continue;

      const key = `${method.toUpperCase()} ${path}`;
      const parameters = mergeParameters(sharedParameters, operation.parameters);
      const requestBody = isObject(operation.requestBody)
        ? {
            required: operation.requestBody.required === true,
            description: operation.requestBody.description || '',
            content: normalizeMediaContent(operation.requestBody.content),
          }
        : null;

      operations[key] = {
        key,
        method: method.toUpperCase(),
        path,
        canonicalPath: canonicalPath(path),
        operationId: operation.operationId || '',
        summary: operation.summary || '',
        deprecated: operation.deprecated === true,
        parameters,
        requestBody,
        responses: normalizeResponses(operation.responses),
      };
    }
  }

  const schemaNames = isObject(resolved.components?.schemas)
    ? Object.keys(resolved.components.schemas).sort()
    : [];

  return {
    meta: {
      ...parsed.meta,
      warnings,
      schemaNames,
    },
    operations,
    operationCount: Object.keys(operations).length,
    schemaNames,
  };
}

export { normalizeSchema, normalizeMediaContent };
