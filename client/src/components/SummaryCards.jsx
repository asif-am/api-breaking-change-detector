const FIGURES = [
  { key: 'total', label: 'Changes', tone: 'text-ink' },
  { key: 'breaking', label: 'Breaking', tone: 'text-rust' },
  { key: 'potentiallyBreaking', label: 'Potentially breaking', tone: 'text-ochre' },
  { key: 'nonBreaking', label: 'Non-breaking', tone: 'text-moss' },
];

const BAR = [
  { key: 'breaking', className: 'bg-rust' },
  { key: 'potentiallyBreaking', className: 'bg-ochre' },
  { key: 'nonBreaking', className: 'bg-moss' },
];

export default function SummaryCards({ summary }) {
  const total = summary.total || 0;
  const severities = Object.entries(summary.bySeverity || {});

  return (
    <section className="sheet" aria-label="Summary of changes">
      <dl className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-line">
        {FIGURES.map((figure) => (
          <div key={figure.key} className="px-4 py-4 sm:px-5">
            <dt className="eyebrow">{figure.label}</dt>
            <dd className={`mt-1.5 text-[28px] font-medium leading-none tabular-nums ${figure.tone}`}>
              {summary[figure.key]}
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-line px-4 py-3.5 sm:px-5">
        <div className="flex h-1.5 overflow-hidden rounded-sm bg-sunken">
          {BAR.map((segment) => (
            <span
              key={segment.key}
              className={segment.className}
              style={{ width: `${total ? (summary[segment.key] / total) * 100 : 0}%` }}
            />
          ))}
        </div>
        {severities.length > 0 ? (
          <p className="mt-2.5 font-mono text-[11px] text-muted">
            severity · {severities.map(([name, count]) => `${name} ${count}`).join(' · ')}
          </p>
        ) : null}
      </div>
    </section>
  );
}
