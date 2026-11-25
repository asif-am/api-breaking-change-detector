/**
 * Endpoint, method, parameter, request body and response comparison
 * (FR-04 → FR-11, FR-14, FR-18).
 *
 * Every difference is emitted as a semantic event; the rule table decides how
 * severe it is. Locations carry path, method and a JSON-pointer-like path so a
 * change can always be traced back to the exact place in the specification.
 */
import { compareSchema } from './schema.js';
import { deepEqual, isJsonMediaType, isObject, uniqueSorted } from '../util.js';

function location(path, method, pointer = '', field = '') {
  return { path, method, pointer, field };
}

function summarizeParameter(parameter) {
  return {
    name: parameter.name,
    in: parameter.in,
    required: parameter.required,
    schema: parameter.schema,
  };
}

function groupByCanonicalPath(operations) {
  const groups = new Map();
  for (const operation of Object.values(operations)) {
    const list = groups.get(operation.canonicalPath) || [];
    list.push(operation);
    groups.set(operation.canonicalPath, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.method.localeCompare(b.method));
  }
  return groups;
}

function methodsOf(operations) {
  return [...new Set(operations.map((operation) => operation.method))].sort();
}

function groupByRawPath(operations) {
  const byPath = new Map();
  for (const operation of operations) {
    const list = byPath.get(operation.path) || [];
    list.push(operation);
    byPath.set(operation.path, list);
  }
  return [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function placeholders(path) {
  return [...String(path).matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

function compareParameters(ctx, baselineOperation, candidateOperation, renamedPathParameters = []) {
  const baselineParameters = baselineOperation.parameters;
  const candidateParameters = candidateOperation.parameters;
  const base = { path: baselineOperation.path, method: baselineOperation.method };

  const candidateByKey = new Map(candidateParameters.map((p) => [`${p.in}:${p.name}`, p]));
  const baselineByKey = new Map(baselineParameters.map((p) => [`${p.in}:${p.name}`, p]));
  const handledCandidateKeys = new Set();

  // A renamed path placeholder is reported once as path-template-renamed; the
  // parameter is then compared under its new name instead of as remove + add.
  const renamedPathMap = new Map();
  for (const pair of renamedPathParameters) {
    const candidateParameter = candidateParameters.find(
      (parameter) => parameter.in === 'path' && parameter.name === pair.to
    );
    if (candidateParameter) renamedPathMap.set(pair.from, candidateParameter);
  }

  for (const oldParameter of baselineParameters) {
    const key = `${oldParameter.in}:${oldParameter.name}`;
    const newParameter =
      candidateByKey.get(key) ||
      (oldParameter.in === 'path' ? renamedPathMap.get(oldParameter.name) : undefined);
    const pointer = `parameters/${oldParameter.in}/${newParameter?.name || oldParameter.name}`;
    const field = `${oldParameter.in}.${newParameter?.name || oldParameter.name}`;

    if (!newParameter) {
      const movedParameter = candidateParameters.find(
        (candidate) => candidate.name === oldParameter.name && candidate.in !== oldParameter.in
      );

      if (movedParameter) {
        handledCandidateKeys.add(`${movedParameter.in}:${movedParameter.name}`);
        ctx.emit({
          code: 'parameter-location-changed',
          location: location(base.path, base.method, `parameters/${movedParameter.in}/${movedParameter.name}`, field),
          oldValue: `${oldParameter.name} in ${oldParameter.in}`,
          newValue: `${movedParameter.name} in ${movedParameter.in}`,
        });
        continue;
      }

      ctx.emit({
        code: 'parameter-removed',
        location: location(base.path, base.method, pointer, field),
        oldValue: summarizeParameter(oldParameter),
        newValue: '(removed)',
      });
      continue;
    }

    handledCandidateKeys.add(`${newParameter.in}:${newParameter.name}`);

    if (!oldParameter.required && newParameter.required) {
      ctx.emit({
        code: 'parameter-required-added',
        location: location(base.path, base.method, pointer, field),
        oldValue: 'required: false',
        newValue: 'required: true',
      });
    }
    if (oldParameter.required && !newParameter.required) {
      ctx.emit({
        code: 'parameter-required-removed',
        location: location(base.path, base.method, pointer, field),
        oldValue: 'required: true',
        newValue: 'required: false',
      });
    }
    if (
      oldParameter.hasDefault &&
      newParameter.hasDefault &&
      !deepEqual(oldParameter.defaultValue, newParameter.defaultValue)
    ) {
      ctx.emit({
        code: 'parameter-default-changed',
        location: location(base.path, base.method, `${pointer}/schema/default`, field),
        oldValue: oldParameter.defaultValue,
        newValue: newParameter.defaultValue,
      });
    }

    compareSchema(
      ctx,
      oldParameter.schema,
      newParameter.schema,
      location(base.path, base.method, `${pointer}/schema`, field),
      'request'
    );
  }

  for (const newParameter of candidateParameters) {
    const key = `${newParameter.in}:${newParameter.name}`;
    if (baselineByKey.has(key) || handledCandidateKeys.has(key)) continue;

    ctx.emit({
      code: newParameter.required ? 'parameter-added-required' : 'parameter-added-optional',
      location: location(base.path, base.method, `parameters/${newParameter.in}/${newParameter.name}`, `${newParameter.in}.${newParameter.name}`),
      oldValue: '(not present)',
      newValue: summarizeParameter(newParameter),
    });
  }
}

function compareMediaTypes(ctx, oldContent, newContent, context) {
  const { path, method, pointerBase, direction, status } = context;
  const oldTypes = Object.keys(oldContent).sort();
  const newTypes = Object.keys(newContent).sort();

  for (const mediaType of oldTypes) {
    if (newTypes.includes(mediaType)) continue;
    ctx.emit({
      code: `${direction}-content-type-removed`,
      location: location(path, method, `${pointerBase}/content/${mediaType}`, mediaType),
      status,
      media: mediaType,
      oldValue: mediaType,
      newValue: '(not accepted)',
    });
  }

  for (const mediaType of newTypes) {
    if (oldTypes.includes(mediaType)) continue;
    ctx.emit({
      code: `${direction}-content-type-added`,
      location: location(path, method, `${pointerBase}/content/${mediaType}`, mediaType),
      status,
      media: mediaType,
      oldValue: '(not accepted)',
      newValue: mediaType,
    });
  }

  for (const mediaType of newTypes) {
    if (!oldTypes.includes(mediaType)) continue;
    if (!isJsonMediaType(mediaType)) continue; // FR-14: schema comparison is JSON-oriented
    compareSchema(
      ctx,
      oldContent[mediaType]?.schema,
      newContent[mediaType]?.schema,
      location(path, method, `${pointerBase}/content/${mediaType}/schema`, `${status ? `status ${status}` : 'requestBody'} · ${mediaType}`),
      direction
    );
  }
}

function compareRequestBody(ctx, baselineOperation, candidateOperation) {
  const oldBody = baselineOperation.requestBody;
  const newBody = candidateOperation.requestBody;
  const base = {
    path: baselineOperation.path,
    method: baselineOperation.method,
    pointerBase: 'requestBody',
    direction: 'request',
  };

  if (!oldBody && !newBody) return;
  if (oldBody && !newBody) {
    ctx.emit({
      code: 'request-body-removed',
      location: location(base.path, base.method, 'requestBody'),
      oldValue: 'requestBody',
      newValue: '(removed)',
    });
    return;
  }
  if (!oldBody && newBody) {
    ctx.emit({
      code: newBody.required ? 'request-body-added-required' : 'request-body-added-optional',
      location: location(base.path, base.method, 'requestBody'),
      oldValue: '(not present)',
      newValue: { required: newBody.required, contentTypes: Object.keys(newBody.content).sort() },
    });
    return;
  }

  if (!oldBody.required && newBody.required) {
    ctx.emit({
      code: 'request-body-required-added',
      location: location(base.path, base.method, 'requestBody/required'),
      oldValue: 'required: false',
      newValue: 'required: true',
    });
  }

  compareMediaTypes(ctx, oldBody.content, newBody.content, base);
}

function compareResponses(ctx, baselineOperation, candidateOperation) {
  const oldResponses = baselineOperation.responses;
  const newResponses = candidateOperation.responses;
  const base = { path: baselineOperation.path, method: baselineOperation.method };
  const statuses = uniqueSorted([...Object.keys(oldResponses), ...Object.keys(newResponses)]);

  for (const status of statuses) {
    const oldResponse = oldResponses[status];
    const newResponse = newResponses[status];

    if (oldResponse && !newResponse) {
      ctx.emit({
        code: 'response-removed',
        location: location(base.path, base.method, `responses/${status}`, `status ${status}`),
        status,
        oldValue: { description: oldResponse.description, contentTypes: Object.keys(oldResponse.content).sort() },
        newValue: '(removed)',
      });
      continue;
    }

    if (!oldResponse && newResponse) {
      ctx.emit({
        code: 'response-added',
        location: location(base.path, base.method, `responses/${status}`, `status ${status}`),
        status,
        oldValue: '(not present)',
        newValue: { description: newResponse.description, contentTypes: Object.keys(newResponse.content).sort() },
      });
      continue;
    }

    compareMediaTypes(ctx, oldResponse.content, newResponse.content, {
      path: base.path,
      method: base.method,
      pointerBase: `responses/${status}`,
      direction: 'response',
      status,
    });
  }
}

function compareOperation(ctx, baselineOperation, candidateOperation, renamedPathParameters = []) {
  compareParameters(ctx, baselineOperation, candidateOperation, renamedPathParameters);
  compareRequestBody(ctx, baselineOperation, candidateOperation);
  compareResponses(ctx, baselineOperation, candidateOperation);
}

/**
 * Compares two normalized API models and emits semantic change events.
 */
export function compareOperations(ctx, baselineModel, candidateModel) {
  const baselineGroups = groupByCanonicalPath(baselineModel.operations);
  const candidateGroups = groupByCanonicalPath(candidateModel.operations);

  const canonicalPaths = uniqueSorted([...baselineGroups.keys(), ...candidateGroups.keys()]);

  for (const canonical of canonicalPaths) {
    const baselineOperations = baselineGroups.get(canonical) || [];
    const candidateOperations = candidateGroups.get(canonical) || [];

    if (baselineOperations.length > 0 && candidateOperations.length === 0) {
      for (const [path, operations] of groupByRawPath(baselineOperations)) {
        ctx.emit({
          code: 'endpoint-removed',
          location: location(path, methodsOf(operations).join(', '), ''),
          oldValue: {
            methods: methodsOf(operations),
            operationIds: operations.map((operation) => operation.operationId).filter(Boolean),
          },
          newValue: '(endpoint removed)',
        });
      }
      continue;
    }

    if (baselineOperations.length === 0 && candidateOperations.length > 0) {
      for (const [path, operations] of groupByRawPath(candidateOperations)) {
        ctx.emit({
          code: 'endpoint-added',
          location: location(path, methodsOf(operations).join(', '), ''),
          oldValue: '(endpoint added)',
          newValue: {
            methods: methodsOf(operations),
            operationIds: operations.map((operation) => operation.operationId).filter(Boolean),
          },
        });
      }
      continue;
    }

    // Same route shape, different placeholder name (FR-04, BR-03).
    const baselineRawPaths = uniqueSorted(baselineOperations.map((operation) => operation.path));
    const candidateRawPaths = uniqueSorted(candidateOperations.map((operation) => operation.path));
    let renamedPathParameters = [];
    for (const baselinePath of baselineRawPaths) {
      if (candidateRawPaths.includes(baselinePath)) continue;
      const candidatePath = candidateRawPaths.find((path) => path !== baselinePath) || candidateRawPaths[0];
      const from = placeholders(baselinePath);
      const to = placeholders(candidatePath);
      renamedPathParameters = from
        .map((name, index) => ({ from: name, to: to[index] }))
        .filter((pair) => pair.to && pair.from !== pair.to);
      ctx.emit({
        code: 'path-template-renamed',
        location: location(baselinePath, ''),
        oldValue: baselinePath,
        newValue: candidatePath,
      });
      break;
    }

    const baselineByMethod = new Map(baselineOperations.map((operation) => [operation.method, operation]));
    const candidateByMethod = new Map(candidateOperations.map((operation) => [operation.method, operation]));

    for (const method of uniqueSorted([...baselineByMethod.keys(), ...candidateByMethod.keys()])) {
      const oldOperation = baselineByMethod.get(method);
      const newOperation = candidateByMethod.get(method);
      const path = newOperation?.path || oldOperation?.path || canonical;

      if (oldOperation && !newOperation) {
        ctx.emit({
          code: 'method-removed',
          location: location(path, method),
          oldValue: `${method} ${path}`,
          newValue: '(method removed)',
        });
        continue;
      }
      if (!oldOperation && newOperation) {
        ctx.emit({
          code: 'method-added',
          location: location(path, method),
          oldValue: '(method added)',
          newValue: `${method} ${path}`,
        });
        continue;
      }

      if (!oldOperation.deprecated && newOperation.deprecated) {
        ctx.emit({
          code: 'operation-deprecated',
          location: location(path, method),
          oldValue: 'deprecated: false',
          newValue: 'deprecated: true',
        });
      }

      compareOperation(ctx, oldOperation, newOperation, renamedPathParameters);
    }
  }
}

export { compareOperation };
