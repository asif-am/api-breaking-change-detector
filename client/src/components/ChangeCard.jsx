import { classificationDots, prettyValue } from '../utils/ui.js';
import { ClassificationBadge, MethodChip, SeverityBadge } from './Badges.jsx';

function ValueBlock({ label, value, tone }) {
  const tones = {
    baseline: 'border-rose-100 bg-rose-50/50',
    candidate: 'border-emerald-100 bg-emerald-50/50',
  };

  return (
    <div className={`rounded-xl border ${tones[tone]} p-3`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700">
        {prettyValue(value)}
      </pre>
    </div>
  );
}

export default function ChangeCard({ change }) {
  return (
    <details className="card group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${classificationDots[change.classification]}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{change.title}</span>
            <ClassificationBadge classification={change.classification} />
            <SeverityBadge severity={change.severity} />
            <span className="chip bg-slate-100 font-mono text-slate-600">{change.ruleId}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <MethodChip method={change.method} />
            <span className="break-all font-mono text-xs text-slate-500">
              {change.path}
              {change.field ? ` · ${change.field}` : ''}
            </span>
          </div>
        </div>
        <span className="mt-1 text-slate-500 transition group-open:rotate-180">▾</span>
      </summary>

      <div className="space-y-4 border-t border-slate-100 p-4">
        <p className="text-sm leading-relaxed text-slate-700">{change.explanation}</p>

        <div className="grid gap-3 md:grid-cols-2">
          <ValueBlock label="Baseline definition" value={change.oldValue} tone="baseline" />
          <ValueBlock label="Candidate definition" value={change.newValue} tone="candidate" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Potential impact</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{change.impact}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Migration guidance</p>
            <p className="mt-1 text-sm leading-relaxed text-indigo-900">{change.migration}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
          <span>Change {change.id}</span>
          <span>Element: {change.element}</span>
          <span>Category: {change.category}</span>
          <span className="break-all font-mono">{change.pointer || '(document root)'}</span>
        </div>
      </div>
    </details>
  );
}
