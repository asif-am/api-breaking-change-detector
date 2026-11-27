import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { ClassificationTag, SeverityTag } from '../components/Badges.jsx';
import Spinner from '../components/Spinner.jsx';

const SECTIONS = [
  ['how', 'How it works'],
  ['classification', 'Classification'],
  ['rules', 'Rule catalogue'],
  ['api', 'HTTP API'],
  ['limits', 'Limits'],
];

const STEPS = [
  ['Validate', 'Both documents are checked against the supported OpenAPI 3.x structure before anything is compared.'],
  ['Normalise', 'Local references are resolved and composition merged into one canonical operation model.'],
  ['Compare', 'Direction-aware rules decide whether each difference breaks existing consumers.'],
  ['Report', 'Totals, severities, old and new definitions, impact, migration steps and a CI verdict.'],
];

const CLASSIFICATIONS = [
  ['breaking', 'A consumer that worked against the baseline will fail or receive data it cannot handle.'],
  ['potentially-breaking', 'A behaviour change worth reviewing before release, such as a changed default or format.'],
  ['non-breaking', 'Additive or compatible. Existing calls stay valid and existing responses remain readable.'],
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
  ['Endpoints and methods', 'Endpoint or method added', 'Endpoint or method removed'],
];

const ENDPOINTS = [
  ['GET', '/api/health', 'public', 'Service status, engine version and persistence mode'],
  ['GET', '/api/rules', 'public', 'Full rule catalogue used by this page'],
  ['GET', '/api/samples', 'public', 'Sample baseline and candidate pair'],
  ['POST', '/api/validate', 'public', 'Validate a single OpenAPI document'],
  ['POST', '/api/compare', 'public', 'Compare two documents and return the report'],
  ['POST', '/api/compare/files', 'public', 'Compare two uploaded .json files'],
  ['POST', '/api/auth/register', 'public', 'Create an account'],
  ['POST', '/api/auth/login', 'public', 'Start a session'],
  ['POST', '/api/auth/logout', 'public', 'End the session'],
  ['POST', '/api/auth/forgot-password', 'public', 'Generate a single-use reset token'],
  ['POST', '/api/auth/reset-password', 'public', 'Set a new password with that token'],
  ['GET', '/api/auth/me', 'public', 'Current user, or null when signed out'],
  ['GET', '/api/projects', 'session', 'List projects'],
  ['POST', '/api/projects', 'session', 'Create a project'],
  ['GET', '/api/projects/:id', 'session', 'Project with specifications and history'],
  ['DELETE', '/api/projects/:id', 'session', 'Delete a project and its reports'],
  ['POST', '/api/projects/:id/specs', 'session', 'Upload or replace a specification'],
  ['GET', '/api/projects/:id/comparisons', 'session', 'List saved comparisons'],
  ['POST', '/api/projects/:id/comparisons', 'session', 'Run and save a comparison'],
  ['GET', '/api/comparisons/:id', 'session', 'Retrieve a saved report'],
  ['DELETE', '/api/comparisons/:id', 'session', 'Delete a saved comparison'],
];

const LIMITATIONS = [
  [
    'JSON documents only',
    'Send the JSON form of the specification. YAML is rejected with a message asking for JSON, and Swagger 2.0 is reported as an unsupported format.',
  ],
  [
    'Local references',
    'References such as #/components/schemas/Pet are resolved. External documents are not fetched; they are compared by reference name and reported as an analysis note.',
  ],
  [
    'Variant matching',
    'Composition variants are paired by a stable structural ordering rather than discriminator semantics, so repeated runs stay deterministic.',
  ],
  [
    'Impact is per change',
    'Impact and migration guidance come from the rule that fired. The analysis does not assume an inventory of consumers.',
  ],
  [
    'Document size',
    'Uploads are limited to 5 MB and schema recursion is depth-guarded. Very large specifications may need to be split.',
  ],
];

function Section({ id, title, description, children }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="h2">{title}</h2>
      {description ? <p className="mt-2 max-w-[68ch] text-sm leading-6 text-graphite">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Table({ head, rows }) {
  return (
    <div className="sheet overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((cell) => (
              <th key={cell} className="table-head">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top transition-colors hover:bg-sunken/50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 leading-6 text-graphite">
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
      .then(({ data }) => setCatalog(data.data))
      .catch(() => setError('The rule catalogue could not be loaded. Check that the API is running and refresh.'));
  }, []);

  const categories = useMemo(
    () => (catalog ? [...new Set(catalog.rules.map((rule) => rule.category))].sort() : []),
    [catalog]
  );

  const groups = useMemo(() => {
    if (!catalog) return [];
    const needle = query.trim().toLowerCase();
    const matching = catalog.rules.filter(
      (rule) =>
        (category === 'all' || rule.category === category) &&
        (!needle ||
          [rule.id, rule.code, rule.title, rule.category].some((value) =>
            String(value).toLowerCase().includes(needle)
          ))
    );

    const byCategory = new Map();
    for (const rule of matching) {
      const list = byCategory.get(rule.category) || [];
      list.push(rule);
      byCategory.set(rule.category, list);
    }
    return { matching, byCategory: [...byCategory] };
  }, [catalog, category, query]);

  return (
    <div className="wrap py-10">
      <header className="border-b border-line pb-6">
        <div className="max-w-[70ch]">
          <p className="eyebrow">OpenAPI 3.0 · 3.1</p>
          <h1 className="h1 mt-3 text-[34px] sm:text-[38px]">Documentation</h1>
          <p className="lead mt-4">
            What the detector compares, how a change is classified, the complete rule catalogue and the HTTP API
            for automating compatibility checks in a pipeline.
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav className="lg:sticky lg:top-20 lg:self-start" aria-label="On this page">
          <p className="eyebrow">On this page</p>
          <ul className="mt-2 border-l border-line">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block border-l border-transparent py-1.5 pl-3 text-[13px] text-graphite transition-colors hover:border-ink hover:text-ink"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          {catalog ? <p className="mt-4 font-mono text-[11px] text-muted">{catalog.ruleCount} rules loaded</p> : null}
        </nav>

        <div className="min-w-0 space-y-12">
          <Section
            id="how"
            title="How the analysis works"
            description="One pass per stage, from raw documents to a report you can act on."
          >
            <ol className="grid gap-x-8 sm:grid-cols-2">
              {STEPS.map(([title, text], index) => (
                <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-line py-4">
                  <span className="pt-0.5 font-mono text-[11px] text-muted">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="h3">{title}</h3>
                    <p className="mt-1 text-[13px] leading-6 text-graphite">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            id="classification"
            title="Classification model"
            description="Every change falls into one of three classes. The contract is directional: accepting more input is safe, returning more data can break a consumer."
          >
            <dl className="grid gap-x-8 sm:grid-cols-3">
              {CLASSIFICATIONS.map(([key, text]) => (
                <div key={key} className="border-t border-line py-4">
                  <dt>
                    <ClassificationTag classification={key} />
                  </dt>
                  <dd className="mt-2 text-[13px] leading-6 text-graphite">{text}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5">
              <Table
                head={['Contract', 'Compatible', 'Breaking']}
                rows={DIRECTION_RULES.map(([contract, safe, breaking]) => [
                  <span className="font-medium text-ink">{contract}</span>,
                  <span className="text-moss">{safe}</span>,
                  <span className="text-rust">{breaking}</span>,
                ])}
              />
            </div>
          </Section>

          <Section
            id="rules"
            title="Rule catalogue"
            description="Each rule has a stable id, a severity and a fixed classification. Reports reference the rule that produced every change."
          >
            {error ? (
              <p className="rounded-lg border border-rust/30 bg-rust-soft px-3 py-2.5 text-[13px] text-rust">{error}</p>
            ) : null}
            {!catalog && !error ? <Spinner label="loading rule catalogue" /> : null}

            {catalog ? (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[12rem] flex-[2]">
                    <label className="label" htmlFor="rule-search">
                      Search
                    </label>
                    <input
                      id="rule-search"
                      className="input"
                      placeholder="code, title or category"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </div>
                  <div className="min-w-[9rem] flex-1">
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
                  <p className="pb-2 font-mono text-[11px] text-muted">
                    {groups.matching?.length ?? 0} of {catalog.ruleCount}
                  </p>
                </div>

                {groups.matching?.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-graphite">
                    No rules match this search. Try another code or clear the category filter.
                  </p>
                ) : (
                  <div className="mt-5 space-y-7">
                    {groups.byCategory?.map(([groupName, rules]) => (
                      <div key={groupName}>
                        <div className="flex items-baseline justify-between border-b border-line pb-2">
                          <h3 className="h3">{groupName}</h3>
                          <span className="font-mono text-[11px] text-muted">{rules.length}</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[40rem] text-left text-[13px]">
                            <thead>
                              <tr className="border-b border-line">
                                <th className="table-head">Rule</th>
                                <th className="table-head">Code</th>
                                <th className="table-head">Classification</th>
                                <th className="table-head">Severity</th>
                                <th className="table-head">Title</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {rules.map((rule) => (
                                <tr key={rule.id} className="transition-colors hover:bg-sunken/50">
                                  <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-ink">
                                    {rule.id}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[11px] text-muted">
                                    {rule.code}
                                  </td>
                                  <td className="px-4 py-1.5">
                                    <ClassificationTag classification={rule.classification} />
                                  </td>
                                  <td className="px-4 py-1.5">
                                    <SeverityTag severity={rule.severity} />
                                  </td>
                                  <td className="px-4 py-1.5 text-graphite">{rule.title}</td>
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
            <Table
              head={['Method', 'Path', 'Auth', 'Purpose']}
              rows={ENDPOINTS.map(([method, path, auth, purpose]) => [
                <span className="whitespace-nowrap font-mono text-[11px] text-ink">{method}</span>,
                <span className="break-all font-mono text-[11px] text-prussian">{path}</span>,
                <span className="font-mono text-[11px] text-muted">{auth}</span>,
                purpose,
              ])}
            />

            <div className="mt-4 rounded-xl border border-line bg-ink p-4">
              <h3 className="font-mono text-[11px] text-paper/60">pipeline usage</h3>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-5 text-paper">{`curl -s -X POST http://localhost:5000/api/compare \\
  -H "Content-Type: application/json" \\
  -d '{ "baseline": { ... }, "candidate": { ... } }'

# data.summary  { total, breaking, potentiallyBreaking, nonBreaking }
# verdict       { status: "PASS" | "FAIL", exitCode: 0 | 1 }
# ci            { hasBreaking, exitCode, summary, resultDigest }`}</pre>
            </div>
            <p className="note mt-3">
              Fail the build when <code>verdict.exitCode</code> is 1. The report also carries a digest of the
              inputs, options and changes, so two runs over the same inputs produce the same value.
            </p>
          </Section>

          <Section
            id="limits"
            title="Supported inputs and limits"
            description="Deliberate boundaries that keep results deterministic and the service safe."
          >
            <dl className="grid gap-x-8 md:grid-cols-2">
              {LIMITATIONS.map(([title, text]) => (
                <div key={title} className="border-t border-line py-4">
                  <dt className="h3">{title}</dt>
                  <dd className="mt-1 text-[13px] leading-6 text-graphite">{text}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 border-t border-line pt-4">
              <h3 className="h3">Data handling</h3>
              <p className="mt-1 max-w-[68ch] text-[13px] leading-6 text-graphite">
                Specifications and reports belong to the signed-in account and are only returned to that account.
                Files are processed in memory and never written to disk. Projects are stored in MongoDB; if the
                database is unavailable the service reports a session-only mode through <code>/api/health</code>{' '}
                rather than pretending data was saved.
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
