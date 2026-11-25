import { Link, useLocation } from 'react-router-dom';
import ReportView from '../components/ReportView.jsx';

const STORAGE_KEY = 'abdetector:lastReport';

/** The report is kept in sessionStorage so a refresh does not lose it. */
function readStoredReport() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ReportPage() {
  const location = useLocation();
  const report = location.state?.report || readStoredReport();

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-bold text-slate-900">No report to display</h1>
          <p className="mt-2 text-sm text-slate-600">
            A comparison report is shown right after it is generated. Run a new comparison, or open a saved
            comparison from one of your projects.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/" className="btn-primary">
              Run a comparison
            </Link>
            <Link to="/projects" className="btn-secondary">
              Open projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Comparison report</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Compatibility analysis</h1>
        </div>
        <Link to="/" className="btn-secondary">
          New comparison
        </Link>
      </div>

      <ReportView report={report} />
    </div>
  );
}
