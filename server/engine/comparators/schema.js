/**
 * Recursive schema comparator (FR-06 → FR-13).
 *
 * The same routine is used for request bodies, parameters (direction
 * "request") and responses (direction "response"). Direction changes what a
 * difference means: narrowing request input or widening response output breaks
 * consumers, the reverse is compatible. Classification is delegated to the
 * rule table via semantic event codes.
 */
import { isObject, pointerJoin, stableStringify } from '../util.js';

const MAX_DEPTH = 14;

function typeSet(schema) {
  if (!isObject(schema)) return [];
  if (Array.isArray(schema.type)) {
    return schema.type.filter((value) => typeof value === 'string' && value !== 'null');
  }
  if (typeof schema.type === 'string') {
    return schema.type === 'null' ? [] : [schema.type];
  }
  if (isObject(schema.properties) || schema.additionalProperties !== undefined) return ['object'];
  if (schema.items !== undefined) return ['array'];
  return [];
}

/** allOf is the intersection of its members, so merging is enough for comparison. */
function flatten(schema) {
  if (!isObject(schema)) return {};
  if (!Array.isArray(schema.allOf)) return schema;

  const base = { ...schema };
  delete base.allOf;

  const merged = { ...base };
  const properties = { ...(isObject(base.properties) ? base.properties : {}) };
  const required = new Set(Array.isArray(base.required) ? base.required : []);

  for (const subSchema of schema.allOf) {
    const sub = flatten(subSchema);
    if (isObject(sub.properties)) Object.assign(properties, sub.properties);
    if (Array.isArray(sub.required)) sub.required.forEach((name) => required.add(name));
    for (const key of [
      'type', 'items', 'enum', 'format', 'minimum', 'maximum', 'exclusiveMinimum',
      'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems',
      'minProperties', 'maxProperties', 'pattern', 'multipleOf', 'uniqueItems',
      'additionalProperties', 'nullable', 'oneOf', 'anyOf', 'discriminator',
    ]) {
      if (merged[key] === undefined && sub[key] !== undefined) merged[key] = sub[key];
    }
  }

  if (Object.keys(properties).length > 0) merged.properties = properties;
  if (required.size > 0) merged.required = [...required].sort();
  return merged;
}

function typesEqual(a, b) {
  if (a.length !== b.length) return false;
  const setA = [...a].sort();
  const setB = [...b].sort();
  return setA.every((value, index) => value === setB[index]);
}

/** `integer` is a specialisation of `number`; everything else is exact. */
function accepts(newType, oldType) {
  return newType === oldType || (oldType === 'integer' && newType === 'number');
}

function isNullable(schema) {
  if (schema.nullable === true) return true;
  if (schema.type === 'null') return true;
  return Array.isArray(schema.type) && schema.type.includes('null');
}

function emitTypeChange(ctx, oldTypes, newTypes, location, direction) {
  const widened = oldTypes.every((oldType) => newTypes.some((newType) => accepts(newType, oldType)));
  const narrowed = newTypes.every((newType) => oldTypes.some((oldType) => accepts(oldType, newType)));

  let code;
  if (widened) code = `${direction}-type-widened`;
  else if (narrowed) code = `${direction}-type-narrowed`;
  else code = `${direction}-type-changed`;

  ctx.emit({
    code,
    location,
    oldValue: oldTypes.join(' | '),
    newValue: newTypes.join(' | '),
  });
}

function compareTypes(ctx, oldSchema, newSchema, location, direction) {
  const oldTypes = typeSet(oldSchema);
  const newTypes = typeSet(newSchema);
  if (oldTypes.length === 0 || newTypes.length === 0) return;
  if (typesEqual(oldTypes, newTypes)) return;
  emitTypeChange(ctx, oldTypes, newTypes, location, direction);
}

function compareNullable(ctx, oldSchema, newSchema, location, direction) {
  const wasNullable = isNullable(oldSchema);
  const isNowNullable = isNullable(newSchema);
  if (wasNullable === isNowNullable) return;

  const code = `${direction}-nullable-${isNowNullable ? 'added' : 'removed'}`;
  ctx.emit({ code, location, oldValue: `nullable: ${wasNullable}`, newValue: `nullable: ${isNowNullable}` });
}

function compareEnums(ctx, oldSchema, newSchema, location, direction) {
  const oldEnum = Array.isArray(oldSchema.enum) ? oldSchema.enum : null;
  const newEnum = Array.isArray(newSchema.enum) ? newSchema.enum : null;
  if (!oldEnum && !newEnum) return;

  const enumLocation = { ...location, pointer: pointerJoin(location.pointer, 'enum') };

  if (oldEnum && !newEnum) {
    ctx.emit({ code: `${direction}-enum-removed`, location: enumLocation, oldValue: oldEnum, newValue: '(any value)' });
    return;
  }
  if (!oldEnum && newEnum) {
    ctx.emit({ code: `${direction}-enum-added`, location: enumLocation, oldValue: '(any value)', newValue: newEnum });
    return;
  }

  const oldKeys = new Map(oldEnum.map((value) => [stableStringify(value), value]));
  const newKeys = new Map(newEnum.map((value) => [stableStringify(value), value]));

  for (const [key, value] of oldKeys) {
    if (!newKeys.has(key)) {
      ctx.emit({
        code: `${direction}-enum-value-removed`,
        location: enumLocation,
        oldValue: value,
        newValue: '(not accepted)',
      });
    }
  }
  for (const [key, value] of newKeys) {
    if (!oldKeys.has(key)) {
      ctx.emit({
        code: `${direction}-enum-value-added`,
        location: enumLocation,
        oldValue: '(not accepted)',
        newValue: value,
      });
    }
  }
}

const BOUNDS = {
  minimum: 'min',
  exclusiveMinimum: 'min',
  maximum: 'max',
  exclusiveMaximum: 'max',
  minLength: 'min',
  maxLength: 'max',
  minItems: 'min',
  maxItems: 'max',
  minProperties: 'min',
  maxProperties: 'max',
};

function boundEffect(bound, oldValue, newValue) {
  const oldNumber = typeof oldValue === 'number' ? oldValue : bound === 'min' ? -Infinity : Infinity;
  const newNumber = typeof newValue === 'number' ? newValue : bound === 'min' ? -Infinity : Infinity;
  if (newNumber === oldNumber) return null;
  if (bound === 'min') return newNumber > oldNumber ? 'narrowed' : 'widened';
  return newNumber < oldNumber ? 'narrowed' : 'widened';
}

function compareConstraints(ctx, oldSchema, newSchema, location, direction) {
  const handleEffect = (effect, key, oldValue, newValue) => {
    if (!effect) return;
    const code = `${direction}-constraint-${effect}`;
    ctx.emit({
      code,
      location: { ...location, pointer: pointerJoin(location.pointer, key) },
      oldValue: oldValue === undefined ? `${key}: (unset)` : `${key}: ${String(oldValue)}`,
      newValue: newValue === undefined ? `${key}: (unset)` : `${key}: ${String(newValue)}`,
    });
  };

  for (const [key, bound] of Object.entries(BOUNDS)) {
    const oldValue = oldSchema[key];
    const newValue = newSchema[key];

    if (typeof oldValue === 'boolean' || typeof newValue === 'boolean') {
      if (oldValue === newValue) continue;
      handleEffect(newValue === true ? 'narrowed' : 'widened', key, oldValue, newValue);
      continue;
    }
    if (oldValue === newValue) continue;
    handleEffect(boundEffect(bound, oldValue, newValue), key, oldValue, newValue);
  }

  // A keyword that appears restricts the value; a dropped one relaxes it.
  const keywordEffect = (oldValue, newValue) => {
    if (oldValue === undefined) return 'narrowed';
    if (newValue === undefined) return 'widened';
    return direction === 'request' ? 'narrowed' : 'widened';
  };

  for (const key of ['pattern', 'multipleOf']) {
    if (oldSchema[key] !== newSchema[key]) {
      handleEffect(keywordEffect(oldSchema[key], newSchema[key]), key, oldSchema[key], newSchema[key]);
    }
  }

  if (oldSchema.uniqueItems !== newSchema.uniqueItems) {
    handleEffect(
      newSchema.uniqueItems === true ? 'narrowed' : 'widened',
      'uniqueItems',
      oldSchema.uniqueItems,
      newSchema.uniqueItems
    );
  }

  if (direction === 'request') {
    const wasClosed = oldSchema.additionalProperties === false;
    const isClosed = newSchema.additionalProperties === false;
    if (!wasClosed && isClosed) {
      ctx.emit({
        code: 'request-additional-properties-removed',
        location: { ...location, pointer: pointerJoin(location.pointer, 'additionalProperties') },
        oldValue: oldSchema.additionalProperties === undefined ? '(allowed)' : oldSchema.additionalProperties,
        newValue: false,
      });
    }
  }
}

function compareFormat(ctx, oldSchema, newSchema, location) {
  if (oldSchema.format === newSchema.format) return;
  if (oldSchema.format === undefined && newSchema.format === undefined) return;
  ctx.emit({
    code: 'format-changed',
    location: { ...location, pointer: pointerJoin(location.pointer, 'format') },
    oldValue: oldSchema.format || '(none)',
    newValue: newSchema.format || '(none)',
  });
}

function compareProperties(ctx, oldSchema, newSchema, location, direction, depth) {
  const oldProperties = isObject(oldSchema.properties) ? oldSchema.properties : {};
  const newProperties = isObject(newSchema.properties) ? newSchema.properties : {};
  const oldRequired = new Set(Array.isArray(oldSchema.required) ? oldSchema.required : []);
  const newRequired = new Set(Array.isArray(newSchema.required) ? newSchema.required : []);
  const rejectsUnknown = newSchema.additionalProperties === false;

  const propertyLocation = (name) => ({
    ...location,
    field: location.field ? `${location.field}.${name}` : name,
    pointer: pointerJoin(pointerJoin(location.pointer, 'properties'), name),
  });

  for (const [name, oldProperty] of Object.entries(oldProperties)) {
    const childLocation = propertyLocation(name);

    if (!(name in newProperties)) {
      if (direction === 'request') {
        ctx.emit({
          code: rejectsUnknown ? 'request-property-removed-strict' : 'request-property-removed',
          location: childLocation,
          oldValue: oldProperty,
          newValue: '(removed)',
        });
      } else {
        ctx.emit({
          code: 'response-property-removed',
          location: childLocation,
          oldValue: oldProperty,
          newValue: '(removed)',
        });
      }
      continue;
    }

    if (oldRequired.has(name) && !newRequired.has(name)) {
      ctx.emit({
        code: `${direction}-required-removed`,
        location: childLocation,
        oldValue: 'required: true',
        newValue: 'required: false',
      });
    }

    compareSchema(ctx, oldProperty, newProperties[name], childLocation, direction, depth + 1);
  }

  for (const [name, newProperty] of Object.entries(newProperties)) {
    if (name in oldProperties) continue;
    const childLocation = propertyLocation(name);
    const isRequired = newRequired.has(name);

    if (direction === 'request') {
      ctx.emit({
        code: isRequired ? 'request-property-added-required' : 'request-property-added',
        location: childLocation,
        oldValue: '(not present)',
        newValue: newProperty,
      });
    } else {
      ctx.emit({
        code: 'response-property-added',
        location: childLocation,
        oldValue: '(not present)',
        newValue: newProperty,
      });
    }
  }

  for (const name of newRequired) {
    if (oldRequired.has(name) || !(name in oldProperties)) continue;
    ctx.emit({
      code: `${direction}-required-added`,
      location: propertyLocation(name),
      oldValue: 'required: false',
      newValue: 'required: true',
    });
  }
}

function extractVariants(schema) {
  if (Array.isArray(schema.oneOf)) return { keyword: 'oneOf', variants: schema.oneOf.filter(isObject) };
  if (Array.isArray(schema.anyOf)) return { keyword: 'anyOf', variants: schema.anyOf.filter(isObject) };
  return null;
}

function compareVariants(ctx, oldComposite, newComposite, location, direction, depth) {
  if (oldComposite && newComposite && oldComposite.keyword !== newComposite.keyword) {
    ctx.emit({
      code: 'schema-composition-changed',
      location: { ...location, pointer: pointerJoin(location.pointer, 'oneOf') },
      oldValue: oldComposite.keyword,
      newValue: newComposite.keyword,
    });
  }

  const sortKey = (variant) => stableStringify(variant);
  const oldVariants = [...(oldComposite?.variants || [])].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const newVariants = [...(newComposite?.variants || [])].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const keyword = newComposite?.keyword || oldComposite?.keyword || 'oneOf';

  const paired = Math.min(oldVariants.length, newVariants.length);
  for (let index = 0; index < paired; index += 1) {
    compareSchema(
      ctx,
      oldVariants[index],
      newVariants[index],
      { ...location, pointer: `${pointerJoin(location.pointer, keyword)}/${index}` },
      direction,
      depth + 1
    );
  }

  for (let index = paired; index < oldVariants.length; index += 1) {
    ctx.emit({
      code: `${direction}-oneof-variant-removed`,
      location: { ...location, pointer: `${pointerJoin(location.pointer, keyword)}/${index}` },
      oldValue: oldVariants[index],
      newValue: '(variant removed)',
    });
  }

  for (let index = paired; index < newVariants.length; index += 1) {
    ctx.emit({
      code: `${direction}-oneof-variant-added`,
      location: { ...location, pointer: `${pointerJoin(location.pointer, keyword)}/${index}` },
      oldValue: '(variant added)',
      newValue: newVariants[index],
    });
  }
}

/**
 * @param {object} ctx comparison context with emit(event)
 * @param {object} oldRaw baseline schema
 * @param {object} newRaw candidate schema
 * @param {{path:string, method:string, pointer:string, field?:string}} location
 * @param {'request'|'response'} direction
 * @param {number} depth recursion guard
 */
export function compareSchema(ctx, oldRaw, newRaw, location, direction, depth = 0) {
  if (depth > MAX_DEPTH) return;

  const oldSchema = flatten(oldRaw);
  const newSchema = flatten(newRaw);
  if (!isObject(oldSchema) || !isObject(newSchema)) return;

  const oldRef = oldSchema.circularRef || oldSchema.externalRef || oldSchema.unresolvedRef;
  const newRef = newSchema.circularRef || newSchema.externalRef || newSchema.unresolvedRef;

  if (oldRef || newRef) {
    if (oldRef !== newRef) {
      ctx.emit({
        code: 'schema-reference-changed',
        location: { ...location, pointer: pointerJoin(location.pointer, '$ref') },
        oldValue: oldRef || '(inline schema)',
        newValue: newRef || '(inline schema)',
      });
    }
    return;
  }

  compareTypes(ctx, oldSchema, newSchema, { ...location, pointer: pointerJoin(location.pointer, 'type') }, direction);
  compareNullable(ctx, oldSchema, newSchema, location, direction);
  compareEnums(ctx, oldSchema, newSchema, location, direction);
  compareFormat(ctx, oldSchema, newSchema, location);
  compareConstraints(ctx, oldSchema, newSchema, location, direction);

  const oldComposite = extractVariants(oldSchema);
  const newComposite = extractVariants(newSchema);

  if (oldComposite || newComposite) {
    compareVariants(ctx, oldComposite, newComposite, location, direction, depth);
    return;
  }

  compareProperties(ctx, oldSchema, newSchema, location, direction, depth);

  if (isObject(oldSchema.items) && isObject(newSchema.items)) {
    compareSchema(
      ctx,
      oldSchema.items,
      newSchema.items,
      { ...location, pointer: pointerJoin(location.pointer, 'items'), field: location.field ? `${location.field}[]` : '[]' },
      direction,
      depth + 1
    );
  }
}
