import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import { classificationStyles, severityStyles } from '../utils/ui.js';

const STEPS = [
  {
    title: 'Validate',
    text: 'Both documents are checked against the supported OpenAPI 3.x structure before anything is compared.',
  },
  {
    title: 'Normalise',
    text: 'Local references are resolved and composition is merged into one canonical operation model.',
  },
  {
    title: 'Compare',
    text: 'Direction-aware rules decide whether each difference breaks existing consumers.',
  },
  {
    title: 'Report',
    text: 'Totals, severities, old and new definitions, impact, migration steps and a CI verdict.',
  },
];

const CLASSIFICATIONS = [
  {
    key: 'breaking',
    title: 'Breaking',
    text: 'A consumer that worked against the baseline will fail or receive data it cannot handle.',
  },
  {
    key: 'potentially-breaking',
    title: 'Potentially breaking',
    text: 'A behaviour change worth reviewing before release, such as a changed default or format.',
  },
  {
    key: 'non-breaking',
    title: 'Non-breaking',
    text: 'Additive or compatible. Existing calls stay valid and existing responses remain readable.',
  },
];

const DIRECTION_RULES = [
  [
    'Request — what the API accepts',
    'Optional field added, enum value added, constraint relaxed, integer widened to number',
    'Required field or parameter added, enum value removed, constraint tightened, number narrowed to integer, null disallowed, additional properties rejected',
  ],
  [
    'Response — what the API returns',
    'Type narrowed, enum value removed, constraint tightened, null no longer returned',
    'Property removed, status code removed, enum value added, type widened, null newly returned, new variant possible',
  ],
  [
    'Endpoints and methods',
    'Endpoint or method added',
    'Endpoint or method removed',
  ],
];

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/health', auth: 'public', purpose: 'Service status, engine version and persistence mode' },
  { method: 'GET', path: '/api/rules', auth: 'public', purpose: 'Full rule catalogue used by this page' },
  { method: 'GET', path: '/api/samples', auth: 'public', purpose: 'Sample baseline and candidate pair' },
  { method: 'POST', path: '/api/validate', auth: 'public', purpose: 'Validate a single OpenAPI document' },
  { method: 'POST', path: '/api/compare', auth: 'public', purpose: 'Compare two documents and return the report' },
  { method: 'POST', path: '/api/compare/files', auth: 'public', purpose: 'Compare two uploaded .json files' },
  { method: 'POST', path: '/api/auth/register', auth: 'public', purpose: 'Create an account' },
  { method: 'POST', path: '/api/auth/login', auth: 'public', purpose: 'Start a session' },
  { method: 'POST', path: '/api/auth/logout', auth: 'public', purpose: 'End the session' },
  { method: 'GET', path: '/api/auth/me', auth: 'public/session', purpose: 'Current user, or null when signed out' },
  { method: 'GET', path: '/api/projects', auth: 'session', purpose: 'List projects' },
  { method: 'POST', path: '/api/projects', auth: 'session', purpose: 'Create a project' },
  { method: 'GET', path: '/api/projects/:id', auth: 'session', purpose: 'Project with specifications and history' },
  { method: 'DELETE', path: '/api/projects/:id', auth: 'session', purpose: 'Delete a project and its reports' },
  { method: 'POST', path: '/api/projects/:id/specs', auth: 'session', purpose: 'Upload or replace a specification' },
  { method: 'GET', path: '/api/projects/:id/comparisons', auth: 'session', purpose: 'List saved comparisons' },
  { method: 'POST', path: '/api/projects/:id/comparisons', auth: 'session', purpose: 'Run and save a comparison' },
  { method: 'GET', path: '/api/comparisons/:id', auth: 'session', purpose: 'Retrieve a saved report' },
  { method: 'DELETE', path: '/api/comparisons/:id', auth: 'session', purpose: 'Delete a saved comparison' },
];

const LIMITATIONS = [
  {
    title: 'JSON documents only',
    text: 'Send the JSON form of the specification. YAML is rejected with a message asking for JSON, and Swagger 2.0 is reported as an unsupported format.',
  },
  {
    title: 'Local references',
    text: 'References such as #/components/schemas/Pet are resolved. External documents are not fetched; they are compared by reference name and reported as an analysis note.',
  },
  {
    title: 'Variant matching',
    text: 'Composition variants are paired by a stable structural ordering rather than discriminator semantics, so repeated runs remain deterministic.',
  },
  {
    title: 'Impact is per change',
    text: 'Impact and migration guidance come from the rule that fired. The analysis does not assume an inventory of consumers.',
  },
  {
    title: 'Document size',
    text: 'Uploads are limited to 5 MB and schema recursion is depth-guarded. Very large specifications may need to be split.',
  },
];

function Section({ id, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DataTable({ head, rows }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="align-top hover:bg-slate-50/70">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-xs leading-relaxed text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Docs() {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    api
      .get('/rules')
      .then((response) => setCatalog(response.data.data))
      .catch(() => setError('The rule catalogue could not be loaded. Check that the API is running and refresh.'));
  }, []);

  const categories = useMemo(() => {
    if (!catalog) return [];
    return [...new Set(catalog.rules.map((rule) => rule.category))].sort();
  }, [catalog]);

  const filteredRules = useMemo(() => {
    if (!catalog) return [];
    const needle = query.trim().toLowerCase();

    return catalog.rules.filter((rule) => {
      if (category !== 'all' && rule.category !== category) return false;
      if (!needle) return true;
      return [rule.id, rule.code, rule.title, rule.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [catalog, category, query]);

  const ruleGroups = useMemo(() => {
    const groups = new Map();
    for (const rule of filteredRules) {
      const list = groups.get(rule.category) || [];
      list.push(rule);
      groups.set(rule.category, list);
    }
    return [...groups.entries()];
  }, [filteredRules]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <span className="chip bg-indigo-50 text-indigo-700">OpenAPI 3.0 · 3.1</span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Documentation</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          What the detector compares, how a change is classified, the complete rule catalogue and the HTTP API
          for automating compatibility checks in a pipeline.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2 text-xs">
          {[
            ['#how', 'How it works'],
            ['#classification', 'Classification'],
            ['#rules', 'Rule catalogue'],
            ['#api', 'API reference'],
            ['#limits', 'Limits'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="chip bg-white text-slate-600 ring-1 ring-slate-200 hover:text-indigo-700">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="space-y-10">
        <Section
          id="how"
          title="How the analysis works"
          description="One pass per stage, from raw documents to a report you can act on."
        >
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card p-4">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                  {index + 1}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          id="classification"
          title="Classification model"
          description="Every change falls into one of three classes. The contract is directional: accepting more input is safe, returning more data can break a consumer."
        >
          <div className="grid gap-3 md:grid-cols-3">
            {CLASSIFICATIONS.map((item) => (
              <article key={item.key} className="card p-4">
                <span className={`chip ${classificationStyles[item.key]}`}>{item.title}</span>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-3">
            <DataTable
              head={['Contract', 'Compatible', 'Breaking']}
              rows={DIRECTION_RULES.map(([contract, safe, breaking]) => [
                <span className="font-medium text-slate-800">{contract}</span>,
                <span className="text-emerald-700">{safe}</span>,
                <span className="text-rose-700">{breaking}</span>,
              ])}
            />
          </div>
        </Section>

        <Section
          id="rules"
          title="Rule catalogue"
          description="Each rule has a stable id, a severity and a fixed classification. Reports reference the rule that produced every change."
        >
          {error ? <p className="card p-4 text-sm text-rose-700">{error}</p> : null}
          {!catalog && !error ? <Spinner label="Loading rule catalogue…" /> : null}

          {catalog ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="chip bg-slate-900 text-white">{catalog.ruleCount} rules</span>
                {catalog.severities.map((severity) => (
                  <span key={severity} className={`chip capitalize ${severityStyles[severity]}`}>
                    {severity}
                  </span>
                ))}
              </div>

              <div className="card mb-3 flex flex-wrap items-end gap-3 p-4">
                <div className="min-w-[12rem] flex-[2]">
                  <label className="label" htmlFor="rule-search">
                    Search rules
                  </label>
                  <input
                    id="rule-search"
                    className="input"
                    placeholder="code, title or category…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="min-w-[10rem] flex-1">
                  <label className="label" htmlFor="rule-category">
                    Category
                  </label>
                  <select
                    id="rule-category"
                    className="input"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="all">All categories</option>
                    {categories.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="chip mb-1 bg-slate-100 text-slate-600">{filteredRules.length} shown</span>
              </div>

              {filteredRules.length === 0 ? (
                <p className="card p-6 text-center text-sm text-slate-600">
                  No rules match this search. Try a different code or clear the category filter.
                </p>
              ) : (
                <div className="space-y-4">
                  {ruleGroups.map(([groupName, rules]) => (
                    <div key={groupName} className="card overflow-hidden">
                      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                        <h3 className="text-sm font-semibold text-slate-900">{groupName}</h3>
                        <span className="chip bg-slate-100 text-slate-600">{rules.length}</span>
                      </header>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-2 font-medium">Rule</th>
                              <th className="px-4 py-2 font-medium">Code</th>
                              <th className="px-4 py-2 font-medium">Classification</th>
                              <th className="px-4 py-2 font-medium">Severity</th>
                              <th className="px-4 py-2 font-medium">Title</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rules.map((rule) => (
                              <tr key={rule.id}>
                                <td className="px-4 py-1.5 font-mono font-semibold text-indigo-700">{rule.id}</td>
                                <td className="px-4 py-1.5 font-mono text-slate-600">{rule.code}</td>
                                <td className="px-4 py-1.5">
                                  <span className={`chip ${classificationStyles[rule.classification]}`}>
                                    {rule.classification}
                                  </span>
                                </td>
                                <td className="px-4 py-1.5">
                                  <span className={`chip capitalize ${severityStyles[rule.severity]}`}>
                                    {rule.severity}
                                  </span>
                                </td>
                                <td className="px-4 py-1.5 text-slate-700">{rule.title}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </Section>

        <Section
          id="api"
          title="HTTP API"
          description="The comparison endpoints are public so a pipeline can call them directly; project and history routes use the session cookie."
        >
          <DataTable
            head={['Method', 'Path', 'Auth', 'Purpose']}
            rows={API_ENDPOINTS.map((endpoint) => [
              <span className="font-mono font-semibold text-slate-800">{endpoint.method}</span>,
              <span className="break-all font-mono text-[11px] text-indigo-700">{endpoint.path}</span>,
              <span
                className={`chip ${
                  endpoint.auth === 'public' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {endpoint.auth}
              </span>,
              <span>{endpoint.purpose}</span>,
            ])}
          />
          <div className="card mt-3 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Pipeline usage</h3>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{`curl -s -X POST http://localhost:5000/api/compare \\
  -H "Content-Type: application/json" \\
  -d '{ "baseline": { ... }, "candidate": { ... } }'

# response
#   data.summary  { total, breaking, potentiallyBreaking, nonBreaking }
#   verdict       { status: "PASS" | "FAIL", exitCode: 0 | 1 }
#   ci            { hasBreaking, exitCode, summary, resultDigest }`}</pre>
            <p className="mt-2 text-xs text-slate-500">
              Fail the build when <code className="font-mono">verdict.exitCode</code> is 1. The report also
              carries a digest of the inputs, options and changes, so two runs over the same inputs produce the
              same value.
            </p>
          </div>
        </Section>

        <Section
          id="limits"
          title="Supported inputs and limits"
          description="Deliberate boundaries that keep results deterministic and the service safe."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {LIMITATIONS.map((item) => (
              <article key={item.title} className="card p-4">
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>

          <div className="card mt-3 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Data handling</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Specifications and reports belong to the signed-in account and are only returned to that account.
              Files are processed in memory and never written to disk. Projects are stored in MongoDB; if the
              database is unavailable the service reports a session-only mode through{' '}
              <code className="font-mono">/api/health</code> rather than pretending data was saved.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
