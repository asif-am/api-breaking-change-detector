import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">API Breaking Change Detector</p>
          <p className="mt-0.5">Semantic compatibility analysis for OpenAPI 3.0 and 3.1 specifications.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/docs" className="hover:text-indigo-600">
            Documentation
          </Link>
          <Link to="/docs#rules" className="hover:text-indigo-600">
            Rule catalogue
          </Link>
          <Link to="/docs#api" className="hover:text-indigo-600">
            API reference
          </Link>
        </div>
      </div>
    </footer>
  );
}
