import {
  classificationLabels,
  classificationStyles,
  severityStyles,
} from '../utils/ui.js';

export function ClassificationBadge({ classification }) {
  return (
    <span className={`chip ${classificationStyles[classification] || 'bg-slate-100 text-slate-600'}`}>
      {classificationLabels[classification] || classification}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  return (
    <span className={`chip uppercase tracking-wide ${severityStyles[severity] || 'bg-slate-100 text-slate-600'}`}>
      {severity}
    </span>
  );
}

export function MethodChip({ method }) {
  if (!method) return null;
  const key = method.toUpperCase();
  const palette = {
    GET: 'bg-sky-100 text-sky-700',
    POST: 'bg-emerald-100 text-emerald-700',
    PUT: 'bg-amber-100 text-amber-800',
    PATCH: 'bg-violet-100 text-violet-700',
    DELETE: 'bg-rose-100 text-rose-700',
  };
  return <span className={`chip font-mono ${palette[key] || 'bg-slate-100 text-slate-600'}`}>{key}</span>;
}

export function VerdictBadge({ status }) {
  const isFail = status === 'FAIL';
  return (
    <span
      className={`chip gap-1.5 px-3 py-1 text-sm font-semibold ${
        isFail ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isFail ? 'bg-rose-500' : 'bg-emerald-500'}`} />
      {status}
    </span>
  );
}
