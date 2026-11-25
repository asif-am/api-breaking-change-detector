import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorIssues, errorMessage } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import { VerdictBadge } from '../components/Badges.jsx';
import { formatBytes, formatDate } from '../utils/ui.js';

function SpecSlot({ role, title, description, specification, onUpload, busy }) {
  const [file, setFile] = useState(null);

  async function submit() {
    if (!file) {
      toast.error('Choose a .json specification file first.');
      return;
    }
    await onUpload(role, file);
    setFile(null);
  }

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <span
          className={`chip ${specification ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
        >
          {specification ? 'uploaded' : 'missing'}
        </span>
      </div>

      {specification ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
          <div className="col-span-2">
            <dt className="text-slate-500">File</dt>
            <dd className="truncate font-mono text-slate-800">{specification.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Version</dt>
            <dd className="text-slate-800">v{specification.version}</dd>
          </div>
          <div>
            <dt className="text-slate-500">OpenAPI</dt>
            <dd className="text-slate-800">{specification.openapi}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Operations</dt>
            <dd className="text-slate-800">{specification.operationCount}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Size</dt>
            <dd className="text-slate-800">{formatBytes(specification.sizeBytes)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          No specification uploaded for this role yet.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".json,application/json"
          className="block w-full max-w-full text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <button type="button" className="btn-secondary" onClick={submit} disabled={busy}>
          {busy ? 'Uploading…' : specification ? 'Replace file' : 'Upload file'}
        </button>
      </div>
    </section>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyRole, setBusyRole] = useState('');
  const [running, setRunning] = useState(false);

  async function load() {
    try {
      const response = await api.get(`/projects/${id}`);
      setData(response.data.data);
    } catch (error) {
      toast.error(errorMessage(error));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const baseline = data?.specifications?.find((specification) => specification.role === 'baseline');
  const candidate = data?.specifications?.find((specification) => specification.role === 'candidate');

  async function uploadSpecification(role, file) {
    setBusyRole(role);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('role', role);

      await api.post(`/projects/${id}/specs`, formData);
      toast.success(`${role === 'baseline' ? 'Baseline' : 'Candidate'} specification stored.`);
      await load();
    } catch (error) {
      const issues = errorIssues(error);
      toast.error(errorMessage(error));
      if (issues.length > 0) {
        toast(issues.map((issue) => issue.message).join(' · '), { duration: 6000 });
      }
    } finally {
      setBusyRole('');
    }
  }

  async function runComparison() {
    setRunning(true);
    try {
      const response = await api.post(`/projects/${id}/comparisons`, {
        options: { includeNonBreaking: true },
      });
      const comparisonId = response.data.data.comparison.id;
      toast.success('Comparison completed and stored in history.');
      navigate(`/comparisons/${comparisonId}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <Spinner label="Loading project…" />;

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="card p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">Project not available</h1>
          <p className="mt-2 text-sm text-slate-600">It may have been deleted, or it belongs to another account.</p>
          <Link to="/projects" className="btn-primary mt-4">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const { project, comparisons } = data;
  const ready = Boolean(baseline && candidate);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/projects" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            ← All projects
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {project.description || 'No description provided.'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Created {formatDate(project.createdAt)}</p>
        </div>
        <button type="button" className="btn-primary" onClick={runComparison} disabled={!ready || running}>
          {running ? 'Running…' : 'Run comparison'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SpecSlot
          role="baseline"
          title="Baseline specification"
          description="Reference version used as the comparison base."
          specification={baseline}
          onUpload={uploadSpecification}
          busy={busyRole === 'baseline'}
        />
        <SpecSlot
          role="candidate"
          title="Candidate specification"
          description="Proposed version to evaluate before release."
          specification={candidate}
          onUpload={uploadSpecification}
          busy={busyRole === 'candidate'}
        />
      </div>

      {!ready ? (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          Upload both specifications to enable the comparison. Files must be OpenAPI 3.0.x or 3.1.x JSON documents.
        </p>
      ) : null}

      <section className="card mt-6 overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="section-title text-base">Comparison history</h2>
            <p className="text-xs text-slate-500">Saved reports with a reproducible digest for every run.</p>
          </div>
          <span className="chip bg-slate-100 text-slate-600">{comparisons.length} saved</span>
        </header>

        {comparisons.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No comparisons stored yet. Upload both specifications and run a comparison.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Run</th>
                  <th className="px-4 py-2 font-medium">Versions</th>
                  <th className="px-4 py-2 font-medium">Changes</th>
                  <th className="px-4 py-2 font-medium">Verdict</th>
                  <th className="px-4 py-2 font-medium">Digest</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisons.map((comparison) => (
                  <tr key={comparison.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs text-slate-500">{formatDate(comparison.createdAt)}</td>
                    <td className="px-4 py-2 text-xs text-slate-700">
                      v{comparison.baselineSpec.version} → v{comparison.candidateSpec.version}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-700">
                      {comparison.summary.total} total ·{' '}
                      <span className="text-rose-600">{comparison.summary.breaking} breaking</span>
                    </td>
                    <td className="px-4 py-2">
                      <VerdictBadge status={comparison.summary.breaking > 0 ? 'FAIL' : 'PASS'} />
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-500">
                      {comparison.resultDigest.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/comparisons/${comparison.id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        View report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
