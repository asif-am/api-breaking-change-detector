import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import ReportView from '../components/ReportView.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatDate } from '../utils/ui.js';

export default function ComparisonPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .get(`/comparisons/${id}`)
      .then(({ data: response }) => {
        if (active) setData(response.data);
      })
      .catch((error) => {
        toast.error(errorMessage(error));
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleDelete() {
    if (!window.confirm('Delete this saved comparison?')) return;
    setDeleting(true);
    try {
      await api.delete(`/comparisons/${id}`);
      toast.success('Comparison deleted.');
      navigate(`/projects/${data.comparison.project}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <Spinner label="loading saved report" />;

  if (!data) {
    return (
      <div className="wrap py-16">
        <div className="sheet mx-auto max-w-[30rem] p-8 text-center">
          <h1 className="h3">Report not available</h1>
          <p className="mt-1.5 text-[13px] leading-6 text-graphite">
            The comparison may have been deleted, or it belongs to another account.
          </p>
          <Link to="/projects" className="btn btn-primary mt-4">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const { report, comparison } = data;

  return (
    <div className="wrap py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <Link
            to={`/projects/${comparison.project}`}
            className="font-mono text-[11px] text-muted hover:text-ink"
          >
            ← project
          </Link>
          <h1 className="page-title mt-2">Saved comparison</h1>
          <p className="mt-1 font-mono text-[11px] leading-5 text-muted">
            {comparison.baselineSpec.name} v{comparison.baselineSpec.version} → {comparison.candidateSpec.name} v
            {comparison.candidateSpec.version} · saved {formatDate(comparison.createdAt)}
          </p>
        </div>
        <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete comparison'}
        </button>
      </header>

      <div className="mt-5">
        <ReportView report={report} />
      </div>
    </div>
  );
}
