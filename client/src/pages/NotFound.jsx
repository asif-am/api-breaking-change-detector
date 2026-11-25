import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <div className="card p-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">404</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page you requested does not exist in this application.
        </p>
        <Link to="/" className="btn-primary mt-5">
          Back to the comparator
        </Link>
      </div>
    </div>
  );
}
