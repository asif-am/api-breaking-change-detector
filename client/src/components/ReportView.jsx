import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { classificationLabels, classificationStyles, downloadJson, formatDate, reportFilename } from '../utils/ui.js';
import { VerdictBadge } from './Badges.jsx';
import ChangeCard from './ChangeCard.jsx';
import SummaryCards from './SummaryCards.jsx';

const CLASSIFICATION_FILTERS = [
  { value: 'all', label: 'All changes' },
  { value: 'breaking', label: 'Breaking' },
  { value: 'potentially-breaking', label: 'Potentially breaking' },
  { value: 'non-breaking', label: 'Non-breaking' },
];

function EndpointList({ title, paths, tone }) {
  if (!paths || paths.length === 0) return null;
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${tone}`}>{title}</p>
      <ul className="mt-1 space-y-1">
        {paths.map((path) => (
          <li key={path} className="break-all font-mono text-xs text-slate-600">
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

  const isBreaking = report.verdict.status === 'FAIL';
  const digest = report.meta.deterministic.resultDigest.slice(0, 12);

  async function copyCiSummary() {
    const text = `API compatibility: ${report.verdict.status} — ${report.ci.summary} (exit code ${report.ci.exitCode}, digest ${digest})`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('CI summary copied to clipboard.');
    } catch {
      toast.error('Clipboard access was blocked by the browser.');
    }
  }

  return (
    <div className="space-y-6">
      <section
        className={`card overflow-hidden border-l-4 p-5 ${
          isBreaking ? 'border-l-rose-500' : 'border-l-emerald-500'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge status={report.verdict.status} />
              <span className="text-xs text-slate-500">
                exit code {report.ci.exitCode} · digest {digest}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-bold text-slate-900">{report.verdict.label}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{report.verdict.recommendedAction}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={copyCiSummary}>
              Copy CI summary
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => downloadJson(report, reportFilename(report))}
            >
              Download JSON
            </button>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Baseline</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {report.meta.baseline.title} · v{report.meta.baseline.version}
            </dd>
            <dd className="text-xs text-slate-500">
              OpenAPI {report.meta.baseline.openapi} · {report.meta.baseline.operationCount} operations
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Candidate</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {report.meta.candidate.title} · v{report.meta.candidate.version}
            </dd>
            <dd className="text-xs text-slate-500">
              OpenAPI {report.meta.candidate.openapi} · {report.meta.candidate.operationCount} operations
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Generated</dt>
            <dd className="mt-0.5 text-slate-800">{formatDate(report.meta.run.generatedAt)}</dd>
            <dd className="text-xs text-slate-500">Engine {report.tool.version} · {report.meta.run.durationMs} ms</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Options</dt>
            <dd className="mt-0.5 text-slate-800">
              {report.meta.options.includeNonBreaking ? 'All changes' : 'Breaking only'}
            </dd>
            <dd className="text-xs text-slate-500">
              {report.meta.options.ignorePaths.length} ignored path(s)
            </dd>
          </div>
        </dl>
      </section>

      <SummaryCards summary={report.summary} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[9rem] flex-1">
                <label className="label" htmlFor="classification-filter">
                  Classification
                </label>
                <select
                  id="classification-filter"
                  className="input"
                  value={classification}
                  onChange={(event) => setClassification(event.target.value)}
                >
                  {CLASSIFICATION_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[8rem] flex-1">
                <label className="label" htmlFor="element-filter">
                  Element
                </label>
                <select
                  id="element-filter"
                  className="input"
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

              <div className="min-w-[12rem] flex-[2]">
                <label className="label" htmlFor="search">
                  Search
                </label>
                <input
                  id="search"
                  className="input"
                  placeholder="path, field, rule…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Showing {filtered.length} of {report.changes.length} changes
              {report.changes.length === 0 ? ' — the two specifications are compatible for the analysed scope.' : ''}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No changes match the current filters.</p>
              <p className="mt-1 text-xs text-slate-500">Clear the search or choose “All changes”.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((change) => (
                <ChangeCard key={change.id} change={change} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card p-4">
            <h2 className="section-title text-base">Endpoint summary</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Baseline operations</dt>
                <dd className="font-semibold text-slate-800">{report.endpoints.baselineOperations}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Candidate operations</dt>
                <dd className="font-semibold text-slate-800">{report.endpoints.candidateOperations}</dd>
              </div>
            </dl>

            <div className="mt-4 space-y-3">
              <EndpointList title="Added paths" paths={report.endpoints.addedPaths} tone="text-emerald-600" />
              <EndpointList title="Removed paths" paths={report.endpoints.removedPaths} tone="text-rose-600" />
              <EndpointList title="Modified paths" paths={report.endpoints.modifiedPaths} tone="text-slate-500" />
              {report.endpoints.methodChanges.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Method changes</p>
                  <ul className="mt-1 space-y-1">
                    {report.endpoints.methodChanges.map((item) => (
                      <li key={`${item.method}-${item.path}`} className="font-mono text-xs text-slate-600">
                        <span className={item.change === 'added' ? 'text-emerald-600' : 'text-rose-600'}>
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

          <div className="card p-4">
            <h2 className="section-title text-base">Change categories</h2>
            <div className="mt-3 space-y-2.5">
              {report.summary.byCategory.map((category) => (
                <div key={category.category}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{category.category}</span>
                    <span className="tabular-nums text-slate-500">{category.total}</span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="bg-rose-500"
                      style={{ width: `${(category.breaking / category.total) * 100}%` }}
                    />
                    <span
                      className="bg-amber-400"
                      style={{ width: `${(category.potentiallyBreaking / category.total) * 100}%` }}
                    />
                    <span
                      className="bg-emerald-400"
                      style={{ width: `${(category.nonBreaking / category.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-3 rounded-full bg-rose-500" /> breaking
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-3 rounded-full bg-amber-400" /> potential
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-3 rounded-full bg-emerald-400" /> compatible
              </span>
            </div>
          </div>

          {report.warnings?.length > 0 ? (
            <div className="card border-amber-200 bg-amber-50/60 p-4">
              <h2 className="text-sm font-semibold text-amber-800">Analysis notes</h2>
              <ul className="mt-2 space-y-2">
                {report.warnings.map((warning) => (
                  <li key={`${warning.code}-${warning.path}`} className="text-xs leading-relaxed text-amber-900">
                    {warning.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">Migration guide</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Every breaking change, grouped by endpoint with its migration step.
            </p>
          </div>
          <span className="chip bg-rose-100 text-rose-700">
            {report.summary.breaking} breaking change{report.summary.breaking === 1 ? '' : 's'}
          </span>
        </div>

        {report.migrationGuide.length === 0 ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            No migration steps are required: no breaking changes were detected.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {report.migrationGuide.map((group) => (
              <article key={group.endpoint} className="rounded-xl border border-slate-200 p-4">
                <h3 className="break-all font-mono text-xs font-semibold text-slate-800">{group.endpoint}</h3>
                <ol className="mt-2 space-y-2">
                  {group.steps.map((step, index) => (
                    <li key={step.changeId} className="text-sm text-slate-600">
                      <span className="mr-1 font-semibold text-slate-800">{index + 1}.</span>
                      <span className="font-medium text-slate-800">{step.title}</span>
                      {step.field ? <span className="text-slate-500"> ({step.field})</span> : null}
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.migration}</p>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="section-title">Rule coverage</h2>
        <p className="mt-1 text-sm text-slate-600">
          Each change was produced by a deterministic rule from the catalogue. Rules applied in this report:{' '}
          {[...new Set(report.changes.map((change) => `${change.ruleId} (${classificationLabels[change.classification]})`))]
            .slice(0, 12)
            .join(', ')}
          {report.changes.length > 12 ? '…' : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(report.summary.byElement).map(([key, count]) => (
            <span key={key} className="chip bg-slate-100 text-slate-600">
              {key}: {count}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
