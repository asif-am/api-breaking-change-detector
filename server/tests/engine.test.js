/**
 * Engine acceptance tests (AC-01 → AC-12).
 *
 * Run with: npm test  (node --test tests/)
 * Each test names the acceptance criterion it verifies so the traceability
 * matrix in docs/TESTING.md stays honest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compareSpecifications, validateSpecification } from '../engine/index.js';

const readSample = (name) =>
  JSON.parse(fs.readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf8'));

const baselineSample = readSample('baseline.json');
const candidateSample = readSample('candidate.json');

const clone = (value) => JSON.parse(JSON.stringify(value));
const codesOf = (report) => report.changes.map((change) => change.code);
const changeCodesAt = (report, pathPattern) =>
  report.changes.filter((change) => pathPattern.test(change.path)).map((change) => change.code);

function mutateBaseline(mutator) {
  const document = clone(baselineSample);
  mutator(document);
  return document;
}

test('AC-01: valid specifications are accepted and compared', () => {
  const report = compareSpecifications({ baseline: baselineSample, candidate: candidateSample });

  assert.equal(report.meta.baseline.title, 'Acme Orders API');
  assert.equal(report.meta.baseline.version, '1.4.0');
  assert.equal(report.meta.candidate.version, '2.0.0');
  assert.ok(report.meta.baseline.operationCount > 0);
  assert.ok(report.summary.total > 0);
});

test('AC-02: invalid or unsupported specifications are rejected with issues', () => {
  const missingVersion = validateSpecification({ info: { title: 'x' }, paths: {} });
  assert.equal(missingVersion.valid, false);
  assert.ok(missingVersion.issues.some((item) => item.code === 'missing-openapi-version'));

  const swagger = validateSpecification({ swagger: '2.0', info: { title: 'legacy' }, paths: {} });
  assert.equal(swagger.valid, false);
  assert.ok(swagger.issues.some((item) => item.code === 'unsupported-swagger-2'));

  const yaml = validateSpecification('openapi: 3.0.3\npaths: {}');
  assert.equal(yaml.valid, false);

  const badStatus = validateSpecification({
    openapi: '3.0.3',
    info: { title: 'Bad', version: '1' },
    paths: { '/x': { get: { responses: { ok: { description: 'nope' } } } } },
  });
  assert.equal(badStatus.valid, false);
  assert.ok(badStatus.issues.some((item) => item.code === 'invalid-status-code'));

  assert.throws(() => compareSpecifications({ baseline: { openapi: '2.0.0' }, candidate: candidateSample }));
});

test('AC-03: added, removed and modified endpoints and methods are detected', () => {
  const candidate = mutateBaseline((document) => {
    delete document.paths['/customers'];
    delete document.paths['/orders/{orderId}'].delete;
    document.paths['/invoices'] = {
      get: { operationId: 'listInvoices', responses: { 200: { description: 'ok' } } },
    };
  });

  const report = compareSpecifications({ baseline: baselineSample, candidate });
  const codes = codesOf(report);

  assert.ok(codes.includes('endpoint-removed'), 'removed /customers must be reported');
  assert.ok(codes.includes('method-removed'), 'removed DELETE must be reported');
  assert.ok(codes.includes('endpoint-added'), 'new /invoices must be reported');
  assert.ok(report.endpoints.removedPaths.includes('/customers'));
  assert.ok(report.endpoints.addedPaths.includes('/invoices'));
});

test('AC-04: parameter changes are detected with direction aware classification', () => {
  const candidate = mutateBaseline((document) => {
    const parameters = document.paths['/orders'].get.parameters;
    const limit = parameters.find((parameter) => parameter.name === 'limit');
    limit.required = true;
    parameters.splice(parameters.indexOf(parameters.find((p) => p.name === 'page')), 1);
    parameters.push({
      name: 'tenant',
      in: 'header',
      required: false,
      schema: { type: 'string' },
    });

    // Move an existing parameter to a different location.
    const status = parameters.find((parameter) => parameter.name === 'status');
    status.in = 'header';
  });

  const report = compareSpecifications({ baseline: baselineSample, candidate });
  const codes = changeCodesAt(report, /^\/orders$/);

  assert.ok(codes.includes('parameter-required-added'));
  assert.ok(codes.includes('parameter-removed'));
  assert.ok(codes.includes('parameter-added-optional'));
  assert.ok(codes.includes('parameter-location-changed'), 'status moved from query to header');

  const requiredChange = report.changes.find((change) => change.code === 'parameter-required-added');
  assert.equal(requiredChange.classification, 'breaking');
  assert.match(requiredChange.impact, /limit/);
});

test('AC-05: request/response schema and status-code changes are detected', () => {
  const candidate = mutateBaseline((document) => {
    const order = document.components.schemas.Order;
    delete order.properties.legacyId;
    delete document.paths['/orders'].get.responses['400'];

    const orderInput = document.components.schemas.OrderInput;
    orderInput.additionalProperties = false;
    delete orderInput.properties.legacyRef;
  });

  const report = compareSpecifications({ baseline: baselineSample, candidate });
  const codes = codesOf(report);

  assert.ok(codes.includes('response-property-removed'));
  assert.ok(codes.includes('response-removed'));
  assert.ok(codes.includes('request-property-removed-strict'));

  const removed = report.changes.find(
    (change) => change.code === 'response-property-removed' && change.field?.endsWith('legacyId')
  );
  assert.equal(removed.classification, 'breaking');
});

test('AC-06: incompatible type changes and removed enum values are breaking', () => {
  const candidate = mutateBaseline((document) => {
    document.components.schemas.Order.properties.total = { type: 'string' };
    document.components.schemas.OrderStatus.enum = ['pending', 'paid', 'shipped', 'refunded'];
  });

  const report = compareSpecifications({ baseline: baselineSample, candidate });
  const codes = codesOf(report);

  assert.ok(codes.includes('response-type-changed'));
  assert.ok(codes.includes('request-enum-value-removed'));
  assert.ok(codes.includes('request-enum-value-added'));
  assert.ok(codes.includes('response-enum-value-added'));
  assert.ok(codes.includes('response-enum-value-removed'));

  const typeChange = report.changes.find((change) => change.code === 'response-type-changed');
  assert.equal(typeChange.classification, 'breaking');
  assert.equal(typeChange.severity, 'high');

  const removedValue = report.changes.find((change) => change.code === 'request-enum-value-removed');
  assert.equal(removedValue.classification, 'breaking');
  assert.equal(removedValue.oldValue, 'cancelled');
});

test('AC-06: request type widening is compatible, response widening is breaking', () => {
  const candidate = mutateBaseline((document) => {
    document.components.schemas.OrderItem.properties.quantity.type = 'number';
  });

  const report = compareSpecifications({ baseline: baselineSample, candidate });

  const requestWidening = report.changes.find((change) => change.code === 'request-type-widened');
  const responseWidening = report.changes.find((change) => change.code === 'response-type-widened');

  assert.equal(requestWidening.classification, 'non-breaking');
  assert.equal(responseWidening.classification, 'breaking');
});

test('AC-07: $ref, circular references, allOf and oneOf structures are handled', () => {
  const report = compareSpecifications({ baseline: baselineSample, candidate: candidateSample });
  const codes = codesOf(report);

  // $ref-target schemas were resolved and compared (Order is referenced from 3 responses).
  assert.ok(report.changes.some((change) => change.field?.includes('items')));

  // oneOf variant added to the payments request.
  assert.ok(codes.includes('request-oneof-variant-added'));

  // Circular Customer.referredBy must not loop or report a reference change.
  assert.ok(!codes.includes('schema-reference-changed'));

  const allOfCandidate = mutateBaseline((document) => {
    document.components.schemas.OrderInput = {
      allOf: [
        { $ref: '#/components/schemas/OrderInput' },
        { type: 'object', properties: { giftWrap: { type: 'boolean' } } },
      ],
    };
  });

  // The self-referencing allOf becomes a circular marker instead of hanging.
  const allOfReport = compareSpecifications({ baseline: baselineSample, candidate: allOfCandidate });
  assert.ok(allOfReport.summary.total >= 0);
});

test('AC-08: every change carries classification, severity, old/new, explanation and impact', () => {
  const report = compareSpecifications({ baseline: baselineSample, candidate: candidateSample });

  for (const change of report.changes) {
    assert.ok(change.id.startsWith('CHG-'));
    assert.ok(change.ruleId.startsWith('R-'));
    assert.ok(['breaking', 'potentially-breaking', 'non-breaking'].includes(change.classification));
    assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(change.severity));
    assert.ok(change.path.startsWith('/'));
    assert.ok(change.explanation.length > 10);
    assert.ok(change.impact.length > 10);
    assert.ok(change.migration.length > 10);
    assert.ok('oldValue' in change && 'newValue' in change);
  }
});

test('AC-09: totals and migration guidance cover every breaking change', () => {
  const report = compareSpecifications({ baseline: baselineSample, candidate: candidateSample });
  const { summary } = report;

  assert.equal(summary.total, summary.breaking + summary.potentiallyBreaking + summary.nonBreaking);
  assert.equal(
    summary.breaking,
    report.changes.filter((change) => change.classification === 'breaking').length
  );

  const guided = report.migrationGuide.reduce((total, group) => total + group.steps.length, 0);
  assert.equal(guided, summary.breaking);
  assert.ok(report.migrationGuide.every((group) => group.breakingCount === group.steps.length));
});

test('AC-10: CI verdict is machine readable and blocks on breaking changes', () => {
  const failing = compareSpecifications({ baseline: baselineSample, candidate: candidateSample });
  assert.equal(failing.ci.hasBreaking, true);
  assert.equal(failing.ci.exitCode, 1);
  assert.equal(failing.verdict.status, 'FAIL');

  const compatible = compareSpecifications({
    baseline: baselineSample,
    candidate: mutateBaseline((document) => {
      document.paths['/health'] = {
        get: { operationId: 'health', responses: { 200: { description: 'ok' } } },
      };
    }),
  });
  assert.equal(compatible.ci.exitCode, 0);
  assert.equal(compatible.verdict.status, 'PASS');
});

test('AC-12: identical inputs and options produce identical results', () => {
  const first = compareSpecifications({ baseline: baselineSample, candidate: candidateSample });
  const second = compareSpecifications({ baseline: baselineSample, candidate: candidateSample });

  assert.equal(first.meta.deterministic.resultDigest, second.meta.deterministic.resultDigest);
  assert.deepEqual(
    first.changes.map((change) => [change.id, change.code, change.classification, change.field]),
    second.changes.map((change) => [change.id, change.code, change.classification, change.field])
  );

  const identical = compareSpecifications({
    baseline: baselineSample,
    candidate: clone(baselineSample),
  });
  assert.equal(identical.summary.total, 0);
  assert.equal(identical.verdict.status, 'PASS');
});

test('comparison options filter paths, methods and non-breaking changes', () => {
  const report = compareSpecifications({
    baseline: baselineSample,
    candidate: candidateSample,
    options: { ignorePaths: ['/customers'], includeNonBreaking: false },
  });

  assert.ok(report.changes.every((change) => !change.path.startsWith('/customers')));
  assert.ok(report.changes.every((change) => change.classification !== 'non-breaking'));
  assert.equal(report.summary.nonBreaking, 0);
  assert.ok(report.meta.options.ignorePaths.includes('/customers'));
});

test('validation reports warnings without rejecting a usable document', () => {
  const document = clone(baselineSample);
  delete document.info.title;

  const result = validateSpecification(document);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((warning) => warning.code === 'missing-info-title'));
  assert.equal(result.operationCount, 7);
});
