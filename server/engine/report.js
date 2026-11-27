/**
 * Report assembly (FR-20, FR-21, FR-22, AC-08 → AC-10).
 *
 * The report has three audiences: a human reading the web view, a CI pipeline
 * reading `verdict`/`ci`, and the persistence layer storing the whole document.
 * Everything except `meta.run` is derived purely from the inputs, and
 * `meta.deterministic.resultDigest` proves it (AC-12).
 */
import { SEVERITIES } from './rules.js';
import { sha256, stableStringify, uniqueSorted } from './util.js';

export const TOOL_NAME = 'API Breaking Change Detector';
export const TOOL_VERSION = '1.0.0';

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function buildCategoryBreakdown(changes) {
  const map = new Map();

  for (const change of changes) {
    const entry = map.get(change.category) || {
      category: change.category,
      total: 0,
      breaking: 0,
      potentiallyBreaking: 0,
      nonBreaking: 0,
    };
    entry.total += 1;
    if (change.classification === 'breaking') entry.breaking += 1;
    else if (change.classification === 'potentially-breaking') entry.potentiallyBreaking += 1;
    else entry.nonBreaking += 1;
    map.set(change.category, entry);
  }

  return [...map.values()].sort(
    (a, b) => b.breaking - a.breaking || b.total - a.total || a.category.localeCompare(b.category)
  );
}

function buildMigrationGuide(changes) {
  const groups = new Map();

  for (const change of changes) {
    if (change.classification !== 'breaking') continue;
    const key = `${change.method} ${change.path}`.trim();
    const group = groups.get(key) || {
      endpoint: key,
      method: change.method,
      path: change.path,
      breakingCount: 0,
      steps: [],
    };
    group.breakingCount += 1;
    group.steps.push({
      changeId: change.id,
      ruleId: change.ruleId,
      title: change.title,
      field: change.field,
      migration: change.migration,
    });
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function buildEndpointSummary(changes, baselineModel, candidateModel) {
  const added = uniqueSorted(changes.filter((c) => c.code === 'endpoint-added').map((c) => c.path));
  const removed = uniqueSorted(changes.filter((c) => c.code === 'endpoint-removed').map((c) => c.path));
  const modified = uniqueSorted(
    changes
      .filter((c) => !['endpoint-added', 'endpoint-removed'].includes(c.code))
      .map((c) => c.path)
  );

  const methodChanges = changes
    .filter((c) => c.code === 'method-added' || c.code === 'method-removed')
    .map((c) => ({
      path: c.path,
      method: c.method,
      change: c.code === 'method-added' ? 'added' : 'removed',
    }));

  return {
    baselineOperations: baselineModel.operationCount,
    candidateOperations: candidateModel.operationCount,
    addedPaths: added,
    removedPaths: removed,
    modifiedPaths: modified,
    methodChanges,
  };
}

/** The four totals persisted alongside a saved comparison. */
export const storedSummary = (report) => ({
  total: report.summary.total,
  breaking: report.summary.breaking,
  potentiallyBreaking: report.summary.potentiallyBreaking,
  nonBreaking: report.summary.nonBreaking,
});

/**
 * @param {object} input
 * @param {object} input.baselineModel normalized baseline
 * @param {object} input.candidateModel normalized candidate
 * @param {Array<object>} input.changes decorated changes (ids assigned)
 * @param {object} input.options normalized comparison options
 * @param {number} input.startedAt epoch ms
 * @param {object} input.inputDigests digests of both normalized inputs
 */
export function buildReport({ baselineModel, candidateModel, changes, options, startedAt, inputDigests }) {
  const counts = countBy(changes, (change) => change.classification);
  const severityCounts = countBy(changes, (change) => change.severity);
  const summary = {
    total: changes.length,
    breaking: counts.breaking || 0,
    potentiallyBreaking: counts['potentially-breaking'] || 0,
    nonBreaking: counts['non-breaking'] || 0,
    bySeverity: Object.fromEntries(SEVERITIES.map((severity) => [severity, severityCounts[severity] || 0])),
    byElement: countBy(changes, (change) => change.element),
    byCategory: buildCategoryBreakdown(changes),
  };

  const warnings = [...(baselineModel.meta.warnings || []), ...(candidateModel.meta.warnings || [])];
  const uniqueWarnings = [...new Map(warnings.map((item) => [`${item.code}:${item.path}`, item])).values()];

  const resultDigest = sha256({
    inputs: inputDigests,
    options,
    changes: changes.map((change) => [
      change.ruleId,
      change.path,
      change.method,
      change.pointer,
      change.classification,
      stableStringify(change.oldValue),
      stableStringify(change.newValue),
    ]),
  });

  const hasBreaking = summary.breaking > 0;

  return {
    tool: {
      name: TOOL_NAME,
      version: TOOL_VERSION,
      description: 'Semantic compatibility analysis for OpenAPI 3.x specifications.',
    },
    meta: {
      baseline: {
        title: baselineModel.meta.title,
        version: baselineModel.meta.version,
        openapi: baselineModel.meta.openapi,
        servers: baselineModel.meta.servers,
        operationCount: baselineModel.operationCount,
        schemaCount: baselineModel.schemaNames.length,
      },
      candidate: {
        title: candidateModel.meta.title,
        version: candidateModel.meta.version,
        openapi: candidateModel.meta.openapi,
        servers: candidateModel.meta.servers,
        operationCount: candidateModel.operationCount,
        schemaCount: candidateModel.schemaNames.length,
      },
      options,
      deterministic: {
        resultDigest,
        baselineDigest: inputDigests.baseline,
        candidateDigest: inputDigests.candidate,
      },
      run: {
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    },
    verdict: {
      status: hasBreaking ? 'FAIL' : 'PASS',
      label: hasBreaking
        ? 'Breaking changes detected'
        : 'No breaking changes detected',
      hasBreaking,
      exitCode: hasBreaking ? 1 : 0,
      recommendedAction: hasBreaking
        ? 'Block the release, or document the migration path for every breaking change before shipping.'
        : 'Compatible: safe to release for the analysed scope.',
    },
    ci: {
      hasBreaking,
      exitCode: hasBreaking ? 1 : 0,
      summary: `${summary.total} change(s): ${summary.breaking} breaking, ${summary.potentiallyBreaking} potentially breaking, ${summary.nonBreaking} non-breaking`,
      resultDigest,
    },
    summary,
    endpoints: buildEndpointSummary(changes, baselineModel, candidateModel),
    changes,
    migrationGuide: buildMigrationGuide(changes),
    warnings: uniqueWarnings,
  };
}
