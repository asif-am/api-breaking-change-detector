import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import api, { errorIssues, errorMessage } from '../api/client.js';
import SpecInput from '../components/SpecInput.jsx';

const FEATURES = [
  {
    title: 'Validation before analysis',
    text: 'Malformed or unsupported documents are rejected with the exact JSON path of every issue.',
  },
  {
    title: 'Semantic endpoint diff',
    text: 'Paths, methods, parameters, request and response schemas and status codes are compared structurally.',
  },
  {
    title: 'Types, enums, $ref and oneOf',
    text: 'Local references, allOf composition and JSON media types are normalised before comparison.',
  },
  {
    title: 'Deterministic rules',
    text: 'Every difference is classified by a rule that assigns severity, impact and migration advice.',
  },
  {
    title: 'Human and machine reports',
    text: 'Summary statistics, detailed changes and a CI verdict with an exit code you can gate a build on.',
  },
  {
    title: 'Projects and history',
    text: 'Save both specifications per project and revisit every report with its reproducible digest.',
  },
];

const STEPS = [
  { title: 'Validate', text: 'Both documents are checked against the supported OpenAPI 3.x structure.' },
  { title: 'Normalise', text: 'References are resolved and every operation flattened into a comparable model.' },
  { title: 'Compare', text: 'Direction-aware rules decide whether a difference breaks existing consumers.' },
  { title: 'Report', text: 'Totals, severities, old and new definitions, impact, migration steps and a verdict.' },
];

const SAMPLE_CHANGES = [
  { mark: '−', tone: 'text-rust', title: 'Endpoint removed', method: 'DELETE', path: '/v1/orders/{orderId}' },
  { mark: '±', tone: 'text-ochre', title: 'Enum value removed', method: 'PUT', path: '/v1/orders/{orderId} · status' },
  { mark: '+', tone: 'text-moss', title: 'Endpoint added', method: 'GET', path: '/v1/orders/{orderId}/history' },
];

const SAMPLE_BREAKDOWN = [
  { key: 'breaking', label: '27 breaking', width: '50.9%', bar: 'bg-rust' },
  { key: 'potential', label: '5 potential', width: '9.4%', bar: 'bg-ochre' },
  { key: 'compatible', label: '21 compatible', width: '39.7%', bar: 'bg-moss' },
];

/** The report's verdict page, shown with the numbers of the bundled sample pair. */
function VerdictPreview() {
  return (
    <div className="sheet enter overflow-hidden" style={{ animationDelay: '90ms' }}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <p className="eyebrow">Sample run</p>
        <p className="truncate font-mono text-[11px] text-muted">acme-orders 1.4.0 → 2.0.0</p>
      </div>

      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Verdict</p>
            <p className="mt-1 text-[27px] font-medium leading-none tracking-[-0.02em] text-rust">Fail</p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Changes</p>
            <p className="mt-1 text-[27px] font-medium leading-none tracking-[-0.02em] tabular-nums">53</p>
          </div>
        </div>

        <div className="mt-5 flex h-1.5 overflow-hidden rounded-sm bg-sunken">
          {SAMPLE_BREAKDOWN.map((part) => (
            <span key={part.key} className={part.bar} style={{ width: part.width }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-muted">
          {SAMPLE_BREAKDOWN.map((part) => (
            <span key={part.key}>{part.label}</span>
          ))}
        </div>
      </div>

      <ul className="mt-4 divide-y divide-line border-t border-line">
        {SAMPLE_CHANGES.map((change) => (
          <li key={change.path} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-3 px-4 py-2.5">
            <span className={`font-mono text-sm leading-5 ${change.tone}`} aria-hidden="true">
              {change.mark}
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-5 text-ink">{change.title}</p>
              <p className="mt-0.5 break-all font-mono text-[11px] leading-4 text-muted">
                {change.method} {change.path}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="border-t border-line px-4 py-2.5 font-mono text-[10px] text-muted">
        exit code 1 · digest 3f8c6f22b4fb…
      </p>
    </div>
  );
}

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

  async function loadSample() {
    try {
      const { data } = await api.get('/samples');
      const { baseline, candidate } = data.data;
      setBaselineText(JSON.stringify(baseline, null, 2));
      setCandidateText(JSON.stringify(candidate, null, 2));
      setBaselineName(`acme-orders-${baseline.info.version}.json`);
      setCandidateName(`acme-orders-${candidate.info.version}.json`);
      setError(null);
      toast.success('Sample pair loaded.');
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
      const { data } = await api.post('/compare', {
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

      const report = data.data;
      try {
        window.sessionStorage.setItem('abdetector:lastReport', JSON.stringify(report));
      } catch {
        // A full quota only costs the refresh, never the report itself.
      }
      toast.success(`${report.summary.total} change(s) detected.`);
      navigate('/report', { state: { report } });
    } catch (requestError) {
      setError({ message: errorMessage(requestError), issues: errorIssues(requestError) });
      toast.error('The comparison could not run.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap pb-8">
      <section className="grid items-center gap-10 border-b border-line py-10 lg:grid-cols-[1.02fr_minmax(0,0.98fr)] lg:gap-16 lg:py-16">
        <div className="enter">
          <p className="eyebrow">OpenAPI 3.0 and 3.1 · deterministic</p>
          <h1 className="h1 mt-4 max-w-[21ch]">Know exactly what an API version breaks.</h1>
          <p className="lead mt-5 max-w-[48ch]">
            Two specifications in, one verdict out. Every difference is classified as breaking, potentially
            breaking or compatible, with its old and new definition, the impact and the migration step.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#compare" className="btn btn-primary">
              Compare two versions
            </a>
            <button type="button" className="btn btn-secondary" onClick={loadSample}>
              Load sample pair
            </button>
          </div>

          <p className="mt-5 font-mono text-[11px] leading-5 text-muted">
            JSON · up to 5 MB · the sample pair reports 53 changes, 27 of them breaking
          </p>
        </div>

        <VerdictPreview />
      </section>

      <section id="compare" className="scroll-mt-20 border-b border-line py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="h2">Run a comparison</h2>
            <p className="mt-1.5 text-sm text-graphite">
              Paste or drop both documents. Files are read in the browser and analysed in memory.
            </p>
          </div>
          <Link to="/docs#rules" className="text-[13px] font-medium text-prussian hover:text-ink">
            Rule catalogue
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <SpecInput
              label="Baseline"
              hint="The version consumers use today."
              value={baselineText}
              onChange={setBaselineText}
              fileName={baselineName}
              onFileName={setBaselineName}
            />
            <SpecInput
              label="Candidate"
              hint="The version you are about to release."
              value={candidateText}
              onChange={setCandidateText}
              fileName={candidateName}
              onFileName={setCandidateName}
            />
          </div>

          <div className="sheet flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="ignore-paths">
                Ignored paths
              </label>
              <input
                id="ignore-paths"
                className="input"
                placeholder="/internal, /health"
                value={ignorePaths}
                onChange={(event) => setIgnorePaths(event.target.value)}
              />
              <p className="mt-1.5 text-[12px] leading-5 text-muted">
                Comma separated prefixes left out of the report.
              </p>
            </div>

            <label
              htmlFor="include-non-breaking"
              className="flex items-center gap-2.5 pt-1 text-[13px] text-graphite sm:pt-8"
            >
              <input
                id="include-non-breaking"
                type="checkbox"
                className="h-4 w-4 rounded-sm border-line accent-prussian"
                checked={includeNonBreaking}
                onChange={(event) => setIncludeNonBreaking(event.target.checked)}
              />
              Include compatible changes
            </label>

            <button type="submit" className="btn btn-primary sm:mt-7" disabled={loading}>
              {loading ? 'Comparing…' : 'Run comparison'}
            </button>
          </div>

          {loading ? (
            <p className="flex items-center gap-2.5 font-mono text-[11px] text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-prussian" aria-hidden="true" />
              validating · normalising · comparing
            </p>
          ) : null}
        </form>

        {error ? (
          <div role="alert" className="mt-4 rounded-xl border border-rust/30 bg-rust-soft p-4">
            <h2 className="text-sm font-medium text-rust">Comparison could not run</h2>
            <p className="mt-1 text-[13px] leading-5 text-rust">{error.message}</p>
            {error.issues.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {error.issues.map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className="rounded-lg border border-rust/15 bg-surface/70 px-3 py-2 text-[12px] text-graphite"
                  >
                    <span className="font-mono text-[11px] font-medium text-rust">{issue.code}</span>
                    {issue.path ? <span className="ml-2 break-all font-mono text-[11px]">{issue.path}</span> : null}
                    <p className="mt-0.5 leading-5">{issue.message}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="border-b border-line py-12">
        <div className="max-w-[56ch]">
          <h2 className="h2">What the report covers</h2>
          <p className="mt-1.5 text-sm text-graphite">
            Six kinds of difference, each traced to a rule with a stable id.
          </p>
        </div>

        <ul className="mt-8 grid gap-x-12 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <li key={feature.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-4 border-t border-line py-4">
              <span className="pt-0.5 font-mono text-[11px] text-muted">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="h3">{feature.title}</h3>
                <p className="mt-1 text-[13px] leading-6 text-graphite">{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="py-12">
        <h2 className="h2">How the analysis runs</h2>
        <p className="mt-1.5 text-sm text-graphite">Four passes, one direction, no network calls after validation.</p>

        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t-2 border-ink pt-4">
              <span className="font-mono text-[11px] text-muted">
                {index + 1} / {STEPS.length}
              </span>
              <h3 className="h3 mt-1">{step.title}</h3>
              <p className="mt-1 text-[13px] leading-6 text-graphite">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
