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
      <div className="wrap py-16">
        <div className="sheet mx-auto max-w-[34rem] p-8">
          <p className="eyebrow">Comparison report</p>
          <h1 className="mt-2 text-[24px] font-medium tracking-[-0.015em]">No report to display</h1>
          <p className="mt-2 text-[13px] leading-6 text-graphite">
            A report is shown right after it is generated. Run a new comparison, or open a saved one from a
            project.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/" className="btn btn-primary">
              Run a comparison
            </Link>
            <Link to="/projects" className="btn btn-secondary">
              Open projects
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap py-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <p className="eyebrow">Comparison report</p>
          <h1 className="page-title mt-1.5">Compatibility analysis</h1>
        </div>
        <Link to="/" className="btn btn-secondary">
          New comparison
        </Link>
      </header>

      <ReportView report={report} />
    </div>
  );
}
