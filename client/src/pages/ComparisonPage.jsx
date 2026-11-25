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
      .then((response) => {
        if (active) setData(response.data.data);
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

  if (loading) return <Spinner label="Loading saved report…" />;

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="card p-8 text-center">
          <h1 className="text-lg font-bold text-slate-900">Report not available</h1>
          <p className="mt-2 text-sm text-slate-600">
            The comparison may have been deleted, or it belongs to another account.
          </p>
          <Link to="/projects" className="btn-primary mt-4">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const { report, comparison } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link
            to={`/projects/${comparison.project}`}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            ← Back to project
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Saved comparison</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {comparison.baselineSpec.name} (v{comparison.baselineSpec.version}) →{' '}
            {comparison.candidateSpec.name} (v{comparison.candidateSpec.version}) · saved{' '}
            {formatDate(comparison.createdAt)}
          </p>
        </div>
        <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete comparison'}
        </button>
      </div>

      <ReportView report={report} />
    </div>
  );
}
