/**
 * Specification parsing and validation (FR-01, FR-02, FR-14, AC-01, AC-02).
 *
 * Supported input: OpenAPI 3.0.x / 3.1.x documents encoded as JSON.
 * Swagger 2.0 and YAML are rejected with an explicit validation issue, which is
 * the behaviour required by BR-01 (only supported formats are analysed).
 */
import { isObject } from './util.js';
import { collectRefs } from './refResolver.js';

const SUPPORTED_VERSION = /^3\.(0|1)(\.\d+)?$/;
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export class SpecificationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'SpecificationError';
    this.issues = issues;
    this.statusCode = 422;
  }
}

function issue(code, message, path = '') {
  return { code, message, path };
}

function validateOperation(operation, path, method, issues) {
  const base = `${method.toUpperCase()} ${path}`;

  if (!isObject(operation)) {
    issues.push(issue('invalid-operation', `${base}: operation must be an object.`, base));
    return;
  }

  if (operation.parameters !== undefined && !Array.isArray(operation.parameters)) {
    issues.push(issue('invalid-parameters', `${base}: "parameters" must be an array.`, base));
  }

  if (operation.requestBody !== undefined && !isObject(operation.requestBody)) {
    issues.push(issue('invalid-request-body', `${base}: "requestBody" must be an object.`, base));
  }

  if (!isObject(operation.responses)) {
    issues.push(
      issue('missing-responses', `${base}: "responses" is required and must be an object.`, base)
    );
    return;
  }

  const statuses = Object.keys(operation.responses);
  if (statuses.length === 0) {
    issues.push(issue('empty-responses', `${base}: at least one response is required.`, base));
  }

  for (const [status, response] of Object.entries(operation.responses)) {
    if (!/^[1-5]\d{2}$|^default$/.test(status)) {
      issues.push(
        issue(
          'invalid-status-code',
          `${base}: "${status}" is not a valid HTTP status code key.`,
          `${base} responses.${status}`
        )
      );
    }
    if (response !== null && !isObject(response)) {
      issues.push(
        issue(
          'invalid-response',
          `${base}: response "${status}" must be an object.`,
          `${base} responses.${status}`
        )
      );
    }
  }
}

/**
 * Validates the document structure. Returns the parsed document or throws a
 * SpecificationError carrying a list of user-presentable issues.
 */
export function parseSpecification(input, label = 'specification') {
  if (input === undefined || input === null || (typeof input === 'string' && input.trim() === '')) {
    throw new SpecificationError(`${label}: no specification was provided.`, [
      issue('empty-input', `${label}: a specification document is required.`),
    ]);
  }

  let document = input;

  if (typeof input === 'string') {
    const text = input.trim();
    if (!text.startsWith('{')) {
      throw new SpecificationError(`${label}: the specification must be a JSON object.`, [
        issue(
          'unsupported-encoding',
          /^openapi\s*:|^swagger\s*:/i.test(text)
            ? `${label}: YAML documents are not supported in this release; please upload the JSON form of the specification.`
            : `${label}: the uploaded content is not a JSON document.`,
          ''
        ),
      ]);
    }
    try {
      document = JSON.parse(text);
    } catch (error) {
      throw new SpecificationError(`${label}: the specification is not valid JSON.`, [
        issue('invalid-json', `${label}: JSON parsing failed — ${error.message}`, ''),
      ]);
    }
  }

  if (!isObject(document)) {
    throw new SpecificationError(`${label}: the specification must be a JSON object.`, [
      issue('invalid-document', `${label}: expected a JSON object at the document root.`),
    ]);
  }

  const issues = [];
  const warnings = [];

  if (document.swagger !== undefined) {
    issues.push(
      issue(
        'unsupported-swagger-2',
        `${label}: Swagger 2.0 is not a supported format. Convert the document to OpenAPI 3.0 or 3.1.`,
        'swagger'
      )
    );
  }

  if (document.openapi === undefined) {
    issues.push(
      issue(
        'missing-openapi-version',
        `${label}: "openapi" version field is missing; only OpenAPI 3.0.x and 3.1.x are supported.`,
        'openapi'
      )
    );
  } else if (!SUPPORTED_VERSION.test(String(document.openapi))) {
    issues.push(
      issue(
        'unsupported-openapi-version',
        `${label}: OpenAPI version "${document.openapi}" is not supported (expected 3.0.x or 3.1.x).`,
        'openapi'
      )
    );
  }

  if (!isObject(document.info)) {
    warnings.push(issue('missing-info', `${label}: "info" block is missing; title and version default to "Untitled".`, 'info'));
  } else {
    if (!document.info.title) {
      warnings.push(issue('missing-info-title', `${label}: "info.title" is missing.`, 'info.title'));
    }
    if (!document.info.version) {
      warnings.push(issue('missing-info-version', `${label}: "info.version" is missing.`, 'info.version'));
    }
  }

  if (!isObject(document.paths)) {
    issues.push(issue('missing-paths', `${label}: "paths" is required and must be an object.`, 'paths'));
  } else {
    for (const [path, pathItem] of Object.entries(document.paths)) {
      if (typeof path !== 'string' || !path.startsWith('/')) {
        issues.push(
          issue('invalid-path', `${label}: path "${path}" must begin with "/".`, `paths.${path}`)
        );
      }
      if (!isObject(pathItem)) {
        issues.push(
          issue('invalid-path-item', `${label}: path item "${path}" must be an object.`, `paths.${path}`)
        );
        continue;
      }
      for (const method of HTTP_METHODS) {
        if (pathItem[method] === undefined) continue;
        validateOperation(pathItem[method], path, method, issues);
      }
    }
  }

  const refs = collectRefs(document);
  const externalRefs = refs.filter((ref) => !ref.startsWith('#/'));
  if (externalRefs.length > 0) {
    warnings.push(
      issue(
        'external-refs-present',
        `${label}: ${externalRefs.length} external reference(s) cannot be resolved and are compared by name only.`,
        ''
      )
    );
  }

  if (issues.length > 0) {
    throw new SpecificationError(
      `${label} failed validation with ${issues.length} issue${issues.length === 1 ? '' : 's'}.`,
      issues
    );
  }

  const title = document.info?.title || 'Untitled API';
  const version = document.info?.version || '0.0.0';

  return {
    document,
    label,
    warnings,
    meta: {
      title,
      version,
      openapi: String(document.openapi),
      description: document.info?.description || '',
      servers: Array.isArray(document.servers) ? document.servers.map((s) => s?.url).filter(Boolean) : [],
      tags: Array.isArray(document.tags) ? document.tags.map((t) => t?.name).filter(Boolean) : [],
    },
  };
}

export { HTTP_METHODS };
