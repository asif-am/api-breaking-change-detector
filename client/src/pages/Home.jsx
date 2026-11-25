import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorIssues, errorMessage } from '../api/client.js';
import SpecInput from '../components/SpecInput.jsx';

const FEATURES = [
  {
    tag: 'Validation',
    title: 'Validation before analysis',
    text: 'Malformed or unsupported documents are rejected with the exact JSON path of every issue.',
  },
  {
    tag: 'Endpoints',
    title: 'Semantic endpoint diff',
    text: 'Paths, HTTP methods, parameters, request/response schemas and status codes are compared structurally.',
  },
  {
    tag: 'Schemas',
    title: 'Types, enums, $ref and oneOf',
    text: 'Local references, allOf composition and JSON media types are normalised before comparison.',
  },
  {
    tag: 'Rules',
    title: 'Deterministic rules and guidance',
    text: 'Every difference is classified by a rule that assigns severity, impact and migration advice.',
  },
  {
    tag: 'Reporting',
    title: 'Human and machine reports',
    text: 'Summary statistics, detailed changes and a CI verdict with an exit code you can gate a build on.',
  },
  {
    tag: 'History',
    title: 'Projects and comparison history',
    text: 'Save both specifications per project and revisit every report with its reproducible digest.',
  },
];

const STEPS = [
  { title: 'Validate', text: 'Both documents are checked against the supported OpenAPI 3.x structure.' },
  { title: 'Normalise', text: 'References are resolved and every operation is flattened into a comparable model.' },
  { title: 'Compare', text: 'Direction-aware rules decide whether a difference breaks existing consumers.' },
  { title: 'Report', text: 'Totals, severities, old/new definitions, impact, migration steps and a CI result.' },
];

export default function Home() {
  const navigate = useNavigate();
  const [baselineText, setBaselineText] = useState('');
  const [candidateText, setCandidateText] = useState('');
  const [baselineName, setBaselineName] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [includeNonBreaking, setIncludeNonBreaking] = useState(true);
  const [ignorePaths, setIgnorePaths] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSpec, setActiveSpec] = useState('baseline');

  async function loadSample() {
    try {
      const response = await api.get('/samples');
      const { baseline, candidate } = response.data.data;
      setBaselineText(JSON.stringify(baseline, null, 2));
      setCandidateText(JSON.stringify(candidate, null, 2));
      setBaselineName(`acme-orders-${baseline.info.version}.json`);
      setCandidateName(`acme-orders-${candidate.info.version}.json`);
      setError(null);
      toast.success('Sample specification pair loaded.');
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!baselineText.trim() || !candidateText.trim()) {
      toast.error('Provide both the baseline and the candidate specification.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/compare', {
        baseline: baselineText,
        candidate: candidateText,
        options: {
          includeNonBreaking,
          ignorePaths: ignorePaths
            .split(',')
            .map((path) => path.trim())
            .filter(Boolean),
        },
      });

      const report = response.data.data;
      // Keep the latest report for a page refresh; storage may be full for very large reports.
      try {
        window.sessionStorage.setItem('abdetector:lastReport', JSON.stringify(report));
      } catch {
        // Ignore quota errors — the report still renders from navigation state.
      }
      toast.success(`${report.summary.total} change(s) detected.`);
      navigate('/report', { state: { report } });
    } catch (requestError) {
      setError({ message: errorMessage(requestError), issues: errorIssues(requestError) });
      toast.error('The comparison could not run. Review the validation details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="mb-8">
        <span className="chip bg-indigo-50 text-indigo-700">Deterministic OpenAPI compatibility analysis</span>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Compare two API versions and know exactly what breaks.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          The detector validates two OpenAPI specifications, compares them semantically, and classifies every
          difference as breaking, potentially breaking or non-breaking — with old/new definitions, impact and
          migration guidance for each change.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={loadSample}>
            Load sample pair
          </button>
          <Link to="/docs" className="btn-ghost">
            Read the rule catalogue →
          </Link>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 lg:hidden" aria-label="Choose the specification to edit">
          {[
            { key: 'baseline', label: 'Baseline', ready: baselineText.trim() !== '' },
            { key: 'candidate', label: 'Candidate', ready: candidateText.trim() !== '' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={activeSpec === tab.key}
              onClick={() => setActiveSpec(tab.key)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeSpec === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${tab.ready ? 'bg-emerald-500' : 'bg-slate-400'}`}
                aria-hidden="true"
              />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={activeSpec === 'baseline' ? 'block' : 'hidden lg:block'}>
            <SpecInput
              title="Baseline specification"
              description="The version consumers are using today."
              tone="indigo"
              value={baselineText}
              onChange={setBaselineText}
              fileName={baselineName}
              onFileName={setBaselineName}
            />
          </div>
          <div className={activeSpec === 'candidate' ? 'block' : 'hidden lg:block'}>
            <SpecInput
              title="Candidate specification"
              description="The version you are about to release."
              tone="emerald"
              value={candidateText}
              onChange={setCandidateText}
              fileName={candidateName}
              onFileName={setCandidateName}
            />
          </div>
        </div>

        <div className="card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[14rem] flex-1">
              <label className="label" htmlFor="ignore-paths">
                Ignore paths (optional)
              </label>
              <input
                id="ignore-paths"
                className="input"
                placeholder="/internal, /health"
                value={ignorePaths}
                onChange={(event) => setIgnorePaths(event.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Comma separated prefixes are excluded from the report (comparison configuration).
              </p>
            </div>

            <label className="flex items-center gap-2 pb-6 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={includeNonBreaking}
                onChange={(event) => setIncludeNonBreaking(event.target.checked)}
              />
              Include non-breaking changes
            </label>

            <button type="submit" className="btn-primary mb-6" disabled={loading}>
              {loading ? 'Comparing…' : 'Run comparison'}
            </button>
          </div>

          {loading ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              Validating, normalising and comparing both specifications…
            </div>
          ) : null}
        </div>
      </form>

      {error ? (
        <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <h2 className="text-sm font-semibold text-rose-800">Comparison could not run</h2>
          <p className="mt-1 text-sm text-rose-700">{error.message}</p>
          {error.issues.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {error.issues.map((issue, index) => (
                <li key={`${issue.code}-${index}`} className="rounded-lg bg-white/70 p-2 text-xs text-rose-800">
                  <span className="font-mono text-[11px] font-semibold">{issue.code}</span>
                  {issue.path ? <span className="ml-2 font-mono text-rose-500">{issue.path}</span> : null}
                  <p className="mt-0.5">{issue.message}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">What the report covers</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.tag} className="card p-4">
              <span className="chip bg-slate-100 font-mono text-slate-600">{feature.tag}</span>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 card p-5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">How the engine works</h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-slate-200 p-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                {index + 1}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
