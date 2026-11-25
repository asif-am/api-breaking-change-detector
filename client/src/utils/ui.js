export const classificationStyles = {
  breaking: 'bg-rose-100 text-rose-700',
  'potentially-breaking': 'bg-amber-100 text-amber-800',
  'non-breaking': 'bg-emerald-100 text-emerald-700',
};

export const classificationDots = {
  breaking: 'bg-rose-500',
  'potentially-breaking': 'bg-amber-500',
  'non-breaking': 'bg-emerald-500',
};

export const classificationLabels = {
  breaking: 'Breaking',
  'potentially-breaking': 'Potentially breaking',
  'non-breaking': 'Non-breaking',
};

export const severityStyles = {
  critical: 'bg-rose-600 text-white',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-sky-100 text-sky-700',
  info: 'bg-slate-100 text-slate-600',
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
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function reportFilename(report, prefix = 'api-compatibility-report') {
  const baseline = report?.meta?.baseline?.version || 'baseline';
  const candidate = report?.meta?.candidate?.version || 'candidate';
  return `${prefix}-${baseline}-to-${candidate}.json`.replace(/\s+/g, '-');
}
