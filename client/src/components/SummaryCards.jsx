import { severityStyles } from '../utils/ui.js';

const CARDS = [
  {
    key: 'total',
    label: 'Total changes',
    accent: 'border-slate-200',
    valueClass: 'text-slate-900',
    hint: 'Everything detected between the two versions',
  },
  {
    key: 'breaking',
    label: 'Breaking',
    accent: 'border-rose-200 bg-rose-50/40',
    valueClass: 'text-rose-600',
    hint: 'Existing consumers can fail',
  },
  {
    key: 'potentiallyBreaking',
    label: 'Potentially breaking',
    accent: 'border-amber-200 bg-amber-50/40',
    valueClass: 'text-amber-600',
    hint: 'Behaviour changes worth reviewing',
  },
  {
    key: 'nonBreaking',
    label: 'Non-breaking',
    accent: 'border-emerald-200 bg-emerald-50/40',
    valueClass: 'text-emerald-600',
    hint: 'Compatible additions and relaxations',
  },
];

export default function SummaryCards({ summary }) {
  return (
    <section aria-label="Summary statistics">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => (
          <div key={card.key} className={`card border p-4 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${card.valueClass}`}>{summary[card.key]}</p>
            <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Severity</span>
        {Object.entries(summary.bySeverity || {}).map(([severity, count]) => (
          <span key={severity} className={`chip capitalize ${severityStyles[severity] || 'bg-slate-100 text-slate-600'}`}>
            {severity}: {count}
          </span>
        ))}
      </div>
    </section>
  );
}
