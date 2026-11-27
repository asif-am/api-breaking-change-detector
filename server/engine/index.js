/**
 * Engine entry point (NFR-05, NFR-08).
 *
 * compareSpecifications() is the only function the HTTP layer needs:
 *   parse → validate → normalize → compare → classify → report
 * Each stage lives in its own module so it can be replaced (new formats,
 * custom rule packs) without touching the others.
 */
import { parseSpecification, SpecificationError } from './parser.js';
import { normalizeSpecification } from './normalizer.js';
import { compareOperations } from './comparators/operations.js';
import { decorateChanges, assignIds } from './explain.js';
import { buildReport, TOOL_VERSION } from './report.js';
import { CLASSIFICATIONS, RULES, SEVERITIES, ruleSummary } from './rules.js';
import { sha256 } from './util.js';

export const ENGINE_VERSION = TOOL_VERSION;

function normalizeOptions(options = {}) {
  const list = (value) =>
    (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
      .map((item) => String(item).trim())
      .filter(Boolean);

  return {
    includeNonBreaking: options.includeNonBreaking !== false,
    ignorePaths: list(options.ignorePaths),
    ignoreMethods: list(options.ignoreMethods).map((method) => method.toUpperCase()),
    ignoreCategories: list(options.ignoreCategories),
  };
}

function isIgnored(change, options) {
  if (!options.includeNonBreaking && change.classification === 'non-breaking') return true;
  if (options.ignorePaths.some((path) => change.path === path || change.path.startsWith(`${path}/`))) return true;
  if (options.ignoreMethods.includes(String(change.method).toUpperCase())) return true;
  if (options.ignoreCategories.includes(change.category)) return true;
  return false;
}

/**
 * Compares two specifications and returns the full report.
 *
 * @param {{baseline: object|string, candidate: object|string, options?: object}} input
 * @returns {object} report
 * @throws {SpecificationError} when either input is not a valid supported OpenAPI document
 */
export function compareSpecifications({ baseline, candidate, options = {} }) {
  const startedAt = Date.now();
  const settings = normalizeOptions(options);

  const parsedBaseline = parseSpecification(baseline, 'Baseline specification');
  const parsedCandidate = parseSpecification(candidate, 'Candidate specification');

  const baselineModel = normalizeSpecification(parsedBaseline);
  const candidateModel = normalizeSpecification(parsedCandidate);

  const events = [];
  compareOperations({ emit: (event) => events.push(event) }, baselineModel, candidateModel);

  const filtered = decorateChanges(events).filter((change) => !isIgnored(change, settings));
  const changes = assignIds(filtered);

  const report = buildReport({
    baselineModel,
    candidateModel,
    changes,
    options: settings,
    startedAt,
    inputDigests: {
      baseline: sha256({ operations: baselineModel.operations, meta: baselineModel.meta.title }),
      candidate: sha256({ operations: candidateModel.operations, meta: candidateModel.meta.title }),
    },
  });

  return report;
}

/**
 * Validates one specification without comparing it (FR-02, AC-02).
 */
export function validateSpecification(input, label = 'Specification') {
  try {
    const parsed = parseSpecification(input, label);
    const model = normalizeSpecification(parsed);
    return {
      valid: true,
      message: `${model.meta.title} ${model.meta.version} is a valid OpenAPI ${model.meta.openapi} document.`,
      meta: model.meta,
      operationCount: model.operationCount,
      schemaCount: model.schemaNames.length,
      warnings: model.meta.warnings,
    };
  } catch (error) {
    if (error instanceof SpecificationError) {
      return { valid: false, message: error.message, issues: error.issues, warnings: [] };
    }
    throw error;
  }
}

/** Rule catalogue exposed to the UI so the demo can show BR-02 in action. */
export function ruleCatalog() {
  return {
    engineVersion: ENGINE_VERSION,
    classifications: CLASSIFICATIONS,
    severities: SEVERITIES,
    ruleCount: RULES.length,
    rules: ruleSummary(),
  };
}

export { SpecificationError };
