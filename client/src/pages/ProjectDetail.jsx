import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorIssues, errorMessage } from '../api/client.js';
import { VerdictBadge } from '../components/Badges.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDate } from '../utils/ui.js';

function SpecSlot({ role, title, specification, onUpload, busy }) {
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
    <section className="sheet p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="h3">{title}</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-muted">
            {role === 'baseline' ? 'Reference version used as the comparison base.' : 'Proposed version to evaluate before release.'}
          </p>
        </div>
        <span className={`tag ${specification ? 'tag-compatible' : ''}`}>
          {specification ? 'uploaded' : 'missing'}
        </span>
      </header>

      {specification ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3">
          <div className="col-span-2">
            <dt className="eyebrow">File</dt>
            <dd className="mt-0.5 truncate font-mono text-[11px] text-graphite">{specification.name}</dd>
          </div>
          <div>
            <dt className="eyebrow">Version</dt>
            <dd className="mt-0.5 text-[13px] text-ink">v{specification.version}</dd>
          </div>
          <div>
            <dt className="eyebrow">OpenAPI</dt>
            <dd className="mt-0.5 text-[13px] text-ink">{specification.openapi}</dd>
          </div>
          <div>
            <dt className="eyebrow">Operations</dt>
            <dd className="mt-0.5 text-[13px] tabular-nums text-ink">{specification.operationCount}</dd>
          </div>
          <div>
            <dt className="eyebrow">Size</dt>
            <dd className="mt-0.5 text-[13px] text-ink">{formatBytes(specification.sizeBytes)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-[12px] leading-5 text-muted">
          No specification uploaded for this role yet.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <input
          type="file"
          accept=".json,application/json"
          aria-label={`${title} file`}
          className="block w-full min-w-0 max-w-full text-[12px] text-graphite file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-surface file:px-2.5 file:py-1.5 file:font-mono file:text-[11px] file:text-graphite hover:file:bg-sunken"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <button type="button" className="btn btn-secondary" onClick={submit} disabled={busy || !file}>
          {busy ? 'Uploading…' : specification ? 'Replace' : 'Upload'}
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
      const { data: response } = await api.get(`/projects/${id}`);
      setData(response.data);
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
      toast.error(errorMessage(error));
      const issues = errorIssues(error);
      if (issues.length > 0) toast(issues.map((issue) => issue.message).join(' · '), { duration: 6000 });
    } finally {
      setBusyRole('');
    }
  }

  async function runComparison() {
    setRunning(true);
    try {
      const { data: response } = await api.post(`/projects/${id}/comparisons`, {
        options: { includeNonBreaking: true },
      });
      toast.success('Comparison stored in history.');
      navigate(`/comparisons/${response.data.comparison.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }

  if (loading) return <Spinner label="loading project" />;

  if (!data) {
    return (
      <div className="wrap py-16">
        <div className="sheet mx-auto max-w-[30rem] p-8 text-center">
          <h1 className="h3">Project not available</h1>
          <p className="mt-1.5 text-[13px] leading-6 text-graphite">
            It may have been deleted, or it belongs to another account.
          </p>
          <Link to="/projects" className="btn btn-primary mt-4">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const { project, comparisons } = data;
  const ready = Boolean(baseline && candidate);

  return (
    <div className="wrap py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0">
          <Link to="/projects" className="font-mono text-[11px] text-muted hover:text-ink">
            ← projects
          </Link>
          <h1 className="page-title mt-2 break-words">{project.name}</h1>
          <p className="mt-1.5 max-w-[62ch] text-[13px] leading-6 text-graphite">
            {project.description || 'No description'}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted">created {formatDate(project.createdAt)}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={runComparison} disabled={!ready || running}>
          {running ? 'Running…' : 'Run comparison'}
        </button>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SpecSlot role="baseline" title="Baseline" specification={baseline} onUpload={uploadSpecification} busy={busyRole === 'baseline'} />
        <SpecSlot role="candidate" title="Candidate" specification={candidate} onUpload={uploadSpecification} busy={busyRole === 'candidate'} />
      </div>

      {!ready ? (
        <p className="mt-3 rounded-lg border border-ochre/30 bg-ochre-soft px-3 py-2.5 text-[12px] leading-5 text-ochre">
          Upload both specifications to enable the comparison. Files must be OpenAPI 3.0.x or 3.1.x JSON documents.
        </p>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="h2">Comparison history</h2>
            <p className="mt-1 text-[13px] text-graphite">Saved reports with a reproducible digest for every run.</p>
          </div>
          <span className="tag">{comparisons.length} saved</span>
        </div>

        {comparisons.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-[13px] text-muted">
            No comparisons stored yet. Upload both specifications and run a comparison.
          </p>
        ) : (
          <div className="sheet mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="table-head">Run</th>
                  <th className="table-head">Versions</th>
                  <th className="table-head">Changes</th>
                  <th className="table-head">Verdict</th>
                  <th className="table-head">Digest</th>
                  <th className="table-head text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {comparisons.map((comparison) => (
                  <tr key={comparison.id} className="transition-colors hover:bg-sunken/50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-muted">
                      {formatDate(comparison.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-graphite">
                      v{comparison.baselineSpec.version} → v{comparison.candidateSpec.version}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                      {comparison.summary.total}
                      <span className="text-muted"> · </span>
                      <span className="text-rust">{comparison.summary.breaking} breaking</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <VerdictBadge status={comparison.summary.breaking > 0 ? 'FAIL' : 'PASS'} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                      {comparison.resultDigest.slice(0, 10)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        to={`/comparisons/${comparison.id}`}
                        className="text-[13px] font-medium text-prussian hover:text-ink"
                      >
                        View
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
