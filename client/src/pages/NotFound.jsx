import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="wrap py-20">
      <div className="mx-auto max-w-[30rem] border-t-2 border-ink pt-5">
        <p className="font-mono text-[11px] text-muted">404</p>
        <h1 className="mt-2 text-[24px] font-medium tracking-[-0.015em]">Page not found</h1>
        <p className="mt-2 text-[13px] leading-6 text-graphite">
          The page you requested does not exist in this application.
        </p>
        <Link to="/" className="btn btn-primary mt-5">
          Back to the comparator
        </Link>
      </div>
    </div>
  );
}
