import { classificationMeta, prettyValue } from '../utils/ui.js';
import { ClassificationTag, MethodTag, SeverityTag } from './Badges.jsx';

function Definition({ label, value, tone }) {
  const surface = tone === 'baseline' ? 'border-rust/20 bg-rust-soft/60' : 'border-moss/20 bg-moss-soft/60';

  return (
    <div className={`rounded-lg border p-3 ${surface}`}>
      <p className="eyebrow">{label}</p>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-graphite">
        {prettyValue(value)}
      </pre>
    </div>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className="h-3.5 w-3.5 shrink-0 text-muted transition-transform group-open:rotate-180"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
    </svg>
  );
}

export default function ChangeCard({ change }) {
  const meta = classificationMeta[change.classification] || {};

  return (
    <details className="group">
      <summary className="grid cursor-pointer list-none grid-cols-[1rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken/60">
        <span className={`pt-0.5 font-mono text-sm leading-5 ${meta.text || 'text-graphite'}`} aria-hidden="true">
          {meta.mark || '·'}
        </span>

        <div className="min-w-0">
          <p className="text-sm leading-5 text-ink">{change.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] leading-4 text-muted">
            {change.method ? <span className="text-graphite">{change.method}</span> : null}
            <span className="break-all">
              {change.path}
              {change.field ? ` · ${change.field}` : ''}
            </span>
            <span className="text-muted" aria-hidden="true">
              ·
            </span>
            <span>{change.ruleId}</span>
          </p>
        </div>

        <div className="flex items-start gap-2 pt-0.5">
          <span className="hidden sm:block">
            <ClassificationTag classification={change.classification} />
          </span>
          <span className="hidden md:block">
            <SeverityTag severity={change.severity} />
          </span>
          <Chevron />
        </div>
      </summary>

      <div className="border-t border-line bg-surface px-4 py-4 sm:pl-[3.25rem]">
        <p className="max-w-[80ch] text-[13px] leading-6 text-graphite">{change.explanation}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Definition label="Baseline" value={change.oldValue} tone="baseline" />
          <Definition label="Candidate" value={change.newValue} tone="candidate" />
        </div>

        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="border-t border-line pt-3">
            <dt className="eyebrow">Impact</dt>
            <dd className="mt-1 text-[13px] leading-6 text-graphite">{change.impact}</dd>
          </div>
          <div className="border-t border-line pt-3">
            <dt className="eyebrow">Migration</dt>
            <dd className="mt-1 text-[13px] leading-6 text-graphite">{change.migration}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 font-mono text-[11px] text-muted">
          <span>change {change.id}</span>
          <span>element {change.element}</span>
          <span>category {change.category}</span>
          <span className="break-all">{change.pointer || '(document root)'}</span>
        </div>
      </div>
    </details>
  );
}
