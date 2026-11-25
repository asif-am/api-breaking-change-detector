/**
 * Change decoration (FR-17, FR-19, BR-06).
 *
 * Raw comparator events are turned into complete change records: the rule table
 * supplies the classification, severity, impact and migration advice, while the
 * location and the old/new definitions are formatted here. Sorting and ids are
 * deterministic so repeated runs produce byte-identical reports (AC-12).
 */
import { getRule } from './rules.js';
import { formatValue, methodRank, stableStringify } from './util.js';

function fill(template, tokens) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    tokens[key] !== undefined && tokens[key] !== null && tokens[key] !== '' ? tokens[key] : match
  );
}

function describeValues(event) {
  const parts = [];
  if (event.oldValue !== undefined) {
    parts.push(`Baseline: ${formatValue(event.oldValue)}`);
  }
  if (event.newValue !== undefined) {
    parts.push(`Candidate: ${formatValue(event.newValue)}`);
  }
  return parts.length > 0 ? ` ${parts.join(' · ')}.` : '';
}

/**
 * @param {Array<object>} events raw comparator events
 * @returns {Array<object>} decorated, sorted and uniquely identified changes
 */
export function decorateChanges(events) {
  const changes = events.map((event) => {
    const rule = getRule(event.code);
    const location = event.location || {};
    const method = (location.method || '').toUpperCase();
    const path = location.path || '';
    const field = location.field || '';
    const tokens = {
      path,
      method,
      field,
      name: field || 'the parameter',
      old: formatValue(event.oldValue, 80),
      new: formatValue(event.newValue, 80),
      status: event.status || '',
      media: event.media || '',
    };

    const where = [path, field].filter(Boolean).join(' · ');
    const title = fill(rule.title, tokens);

    return {
      ruleId: rule.id,
      code: event.code,
      category: rule.category,
      element: rule.element,
      classification: rule.classification,
      severity: rule.severity,
      path,
      method,
      field,
      pointer: location.pointer || '',
      status: event.status || null,
      media: event.media || null,
      oldValue: event.oldValue === undefined ? null : event.oldValue,
      newValue: event.newValue === undefined ? null : event.newValue,
      title,
      explanation: `${title} at ${[method, where].filter(Boolean).join(' ')}.${describeValues(event)}`,
      impact: fill(rule.impact, tokens),
      migration: fill(rule.migration, tokens),
    };
  });

  changes.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    const methodDiff = methodRank(a.method) - methodRank(b.method);
    if (methodDiff !== 0) return methodDiff;
    if (a.pointer !== b.pointer) return a.pointer.localeCompare(b.pointer);
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    return stableStringify(a.oldValue).localeCompare(stableStringify(b.oldValue));
  });

  return changes;
}

/** Deterministic ids are assigned after filtering so reports stay stable. */
export function assignIds(changes) {
  return changes.map((change, index) => ({
    ...change,
    id: `CHG-${String(index + 1).padStart(3, '0')}`,
  }));
}
