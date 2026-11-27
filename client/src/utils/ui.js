/** One place where a classification gets its label, margin mark and colour. */
export const classificationMeta = {
  breaking: { label: 'Breaking', mark: '−', tag: 'tag tag-breaking', text: 'text-rust', dot: 'bg-rust' },
  'potentially-breaking': {
    label: 'Potentially breaking',
    short: 'Potential',
    mark: '±',
    tag: 'tag tag-potential',
    text: 'text-ochre',
    dot: 'bg-ochre',
  },
  'non-breaking': {
    label: 'Non-breaking',
    short: 'Compatible',
    mark: '+',
    tag: 'tag tag-compatible',
    text: 'text-moss',
    dot: 'bg-moss',
  },
};

export const classificationFilters = [
  { value: 'all', label: 'All' },
  { value: 'breaking', label: 'Breaking' },
  { value: 'potentially-breaking', label: 'Potential' },
  { value: 'non-breaking', label: 'Compatible' },
];

export const severityText = {
  critical: 'text-rust',
  high: 'text-rust',
  medium: 'text-ochre',
  low: 'text-prussian',
  info: 'text-graphite',
};

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function prettyValue(value) {
  if (value === null || value === undefined) return '(not set)';
  if (typeof value !== 'object') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function reportFilename(report) {
  const baseline = report?.meta?.baseline?.version || 'baseline';
  const candidate = report?.meta?.candidate?.version || 'candidate';
  return `api-compatibility-report-${baseline}-to-${candidate}.json`.replace(/\s+/g, '-');
}
