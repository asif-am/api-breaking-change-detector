import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  classificationFilters,
  classificationMeta,
  downloadJson,
  formatDate,
  reportFilename,
} from '../utils/ui.js';
import { VerdictBadge } from './Badges.jsx';
import ChangeCard from './ChangeCard.jsx';
import SummaryCards from './SummaryCards.jsx';

const CATEGORY_BARS = [
  { key: 'breaking', className: 'bg-rust' },
  { key: 'potentiallyBreaking', className: 'bg-ochre' },
  { key: 'nonBreaking', className: 'bg-moss' },
];

function Meta({ term, children }) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <dt className="eyebrow">{term}</dt>
      <dd className="mt-1 text-[13px] leading-5 text-ink">{children}</dd>
    </div>
  );
}

function PathList({ title, paths, tone }) {
  if (!paths?.length) return null;
  return (
    <div>
      <p className={`eyebrow ${tone}`}>{title}</p>
      <ul className="mt-1 space-y-1">
        {paths.map((path) => (
          <li key={path} className="break-all font-mono text-[11px] leading-5 text-graphite">
            {path}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReportView({ report }) {
  const [classification, setClassification] = useState('all');
  const [element, setElement] = useState('all');
  const [query, setQuery] = useState('');

  const elements = useMemo(
    () => [...new Set(report.changes.map((change) => change.element))].sort(),
    [report.changes]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return report.changes.filter((change) => {
      if (classification !== 'all' && change.classification !== classification) return false;
      if (element !== 'all' && change.element !== element) return false;
      if (!needle) return true;
      return [change.title, change.path, change.field, change.code, change.explanation]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [report.changes, classification, element, query]);

  const failed = report.verdict.status === 'FAIL';
  const digest = report.meta.deterministic.resultDigest.slice(0, 12);
  const ruleCount = new Set(report.changes.map((change) => change.ruleId)).size;

  async function copyCiSummary() {
    const text = `API compatibility: ${report.verdict.status} — ${report.ci.summary} (exit code ${report.ci.exitCode}, digest ${digest})`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('CI summary copied.');
    } catch {
      toast.error('Clipboard access was blocked by the browser.');
    }
  }

  return (
    <div className="space-y-5">
      <section className={`sheet overflow-hidden border-l-2 ${failed ? 'border-l-rust' : 'border-l-moss'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <VerdictBadge status={report.verdict.status} />
              <span className="font-mono text-[11px] text-muted">
                exit code {report.ci.exitCode} · digest {digest}
              </span>
            </div>
            <h1 className="mt-3 text-[24px] font-medium leading-tight tracking-[-0.015em]">{report.verdict.label}</h1>
            <p className="mt-1.5 max-w-[62ch] text-[13px] leading-6 text-graphite">{report.verdict.recommendedAction}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={copyCiSummary}>
              Copy CI summary
            </button>
            <button type="button" className="btn btn-primary" onClick={() => downloadJson(report, reportFilename(report))}>
              Download JSON
            </button>
          </div>
        </div>

        <dl className="grid gap-y-4 border-t border-line py-2 sm:grid-cols-2 sm:divide-x sm:divide-line lg:grid-cols-4">
          <Meta term="Baseline">
            {report.meta.baseline.title} · v{report.meta.baseline.version}
            <span className="mt-0.5 block font-mono text-[11px] text-muted">
              OpenAPI {report.meta.baseline.openapi} · {report.meta.baseline.operationCount} operations
            </span>
          </Meta>
          <Meta term="Candidate">
            {report.meta.candidate.title} · v{report.meta.candidate.version}
            <span className="mt-0.5 block font-mono text-[11px] text-muted">
              OpenAPI {report.meta.candidate.openapi} · {report.meta.candidate.operationCount} operations
            </span>
          </Meta>
          <Meta term="Generated">
            {formatDate(report.meta.run.generatedAt)}
            <span className="mt-0.5 block font-mono text-[11px] text-muted">
              engine {report.tool.version} · {report.meta.run.durationMs} ms
            </span>
          </Meta>
          <Meta term="Options">
            {report.meta.options.includeNonBreaking ? 'All changes' : 'Breaking only'}
            <span className="mt-0.5 block font-mono text-[11px] text-muted">
              {report.meta.options.ignorePaths.length} ignored path(s)
            </span>
          </Meta>
        </dl>
      </section>

      <SummaryCards summary={report.summary} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section>
          <div className="sheet flex flex-wrap items-end gap-3 p-4">
            <div>
              <span className="label">Classification</span>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by classification">
                {classificationFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={classification === filter.value}
                    onClick={() => setClassification(filter.value)}
                    className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                      classification === filter.value ? 'bg-ink text-paper' : 'text-graphite hover:bg-sunken'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-36">
              <label className="label" htmlFor="element-filter">
                Element
              </label>
              <select
                id="element-filter"
                className="input py-1.5 text-[13px]"
                value={element}
                onChange={(event) => setElement(event.target.value)}
              >
                <option value="all">All elements</option>
                {elements.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[10rem] flex-1">
              <label className="label" htmlFor="change-search">
                Search
              </label>
              <input
                id="change-search"
                className="input py-1.5 text-[13px]"
                placeholder="path, field, rule…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <p className="mt-3 font-mono text-[11px] text-muted">
            {filtered.length} of {report.changes.length} changes
            {report.changes.length === 0 ? ' · the specifications are compatible in the analysed scope' : ''}
          </p>

          {filtered.length === 0 ? (
            <div className="sheet mt-3 px-4 py-10 text-center">
              <p className="text-[13px] text-graphite">No changes match these filters.</p>
              <button
                type="button"
                className="mt-1 text-[13px] text-prussian hover:text-ink"
                onClick={() => {
                  setClassification('all');
                  setElement('all');
                  setQuery('');
                }}
              >
                Clear the filters
              </button>
            </div>
          ) : (
            <div className="sheet mt-3 divide-y divide-line overflow-hidden">
              {filtered.map((change) => (
                <ChangeCard key={change.id} change={change} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <div className="sheet p-4">
            <h2 className="h3">Endpoints</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="eyebrow">Baseline</dt>
                <dd className="mt-0.5 text-lg font-medium tabular-nums">{report.endpoints.baselineOperations}</dd>
              </div>
              <div>
                <dt className="eyebrow">Candidate</dt>
                <dd className="mt-0.5 text-lg font-medium tabular-nums">{report.endpoints.candidateOperations}</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-3 border-t border-line pt-3">
              <PathList title="Added" paths={report.endpoints.addedPaths} tone="text-moss" />
              <PathList title="Removed" paths={report.endpoints.removedPaths} tone="text-rust" />
              <PathList title="Modified" paths={report.endpoints.modifiedPaths} tone="text-muted" />

              {report.endpoints.methodChanges.length > 0 ? (
                <div>
                  <p className="eyebrow">Method changes</p>
                  <ul className="mt-1 space-y-1">
                    {report.endpoints.methodChanges.map((item) => (
                      <li key={`${item.method}-${item.path}`} className="break-all font-mono text-[11px] leading-5 text-graphite">
                        <span className={item.change === 'added' ? 'text-moss' : 'text-rust'} aria-hidden="true">
                          {item.change === 'added' ? '+' : '−'}
                        </span>{' '}
                        {item.method} {item.path}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="sheet p-4">
            <h2 className="h3">Categories</h2>
            <div className="mt-3 space-y-3">
              {report.summary.byCategory.map((category) => (
                <div key={category.category}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] text-graphite">{category.category}</span>
                    <span className="font-mono text-[11px] tabular-nums text-muted">{category.total}</span>
                  </div>
                  <div className="mt-1.5 flex h-1 overflow-hidden rounded-sm bg-sunken">
                    {CATEGORY_BARS.map((bar) => (
                      <span
                        key={bar.key}
                        className={bar.className}
                        style={{ width: `${(category[bar.key] / category.total) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10px] leading-4 text-muted">breaking · potential · compatible</p>
          </div>

          {report.warnings?.length > 0 ? (
            <div className="rounded-xl border border-ochre/30 bg-ochre-soft p-4">
              <h2 className="text-[13px] font-medium text-ochre">Analysis notes</h2>
              <ul className="mt-2 space-y-2">
                {report.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.path}`} className="text-[12px] leading-5 text-graphite">
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <section className="sheet p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="h2">Migration guide</h2>
            <p className="mt-1 text-sm text-graphite">Every breaking change, grouped by endpoint with its step.</p>
          </div>
          <span className="tag tag-breaking">{report.summary.breaking} breaking</span>
        </div>

        {report.migrationGuide.length === 0 ? (
          <p className="mt-4 rounded-lg border border-moss/25 bg-moss-soft px-3 py-2.5 text-[13px] text-moss">
            No migration steps are required: no breaking changes were detected.
          </p>
        ) : (
          <div className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-2">
            {report.migrationGuide.map((group) => (
              <article key={group.endpoint} className="border-t border-line pt-3">
                <h3 className="break-all font-mono text-[12px] font-medium text-ink">{group.endpoint}</h3>
                <ol className="mt-2 space-y-2.5">
                  {group.steps.map((step, index) => (
                    <li key={step.changeId} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2">
                      <span className="font-mono text-[11px] leading-5 text-muted">{index + 1}</span>
                      <div>
                        <p className="text-[13px] leading-5 text-ink">
                          {step.title}
                          {step.field ? <span className="text-muted"> · {step.field}</span> : null}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-5 text-graphite">{step.migration}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="sheet p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="h2">Rule coverage</h2>
          <span className="font-mono text-[11px] text-muted">
            {ruleCount} rule{ruleCount === 1 ? '' : 's'} applied
          </span>
        </div>
        <p className="mt-1.5 max-w-[80ch] text-[13px] leading-6 text-graphite">
          Each change comes from a deterministic rule in the catalogue:{' '}
          {[...new Set(report.changes.map((change) => `${change.ruleId} (${classificationMeta[change.classification]?.short || change.classification})`))]
            .slice(0, 12)
            .join(', ')}
          {ruleCount > 12 ? ' …' : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(report.summary.byElement).map(([key, count]) => (
            <span key={key} className="tag">
              {key} {count}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
