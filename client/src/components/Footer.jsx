import { Link } from 'react-router-dom';

const LINKS = [
  ['/docs', 'Documentation'],
  ['/docs#rules', 'Rule catalogue'],
  ['/docs#api', 'HTTP API'],
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="wrap flex flex-col gap-6 py-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-medium">API Breaking Change Detector</p>
          <p className="mt-1 max-w-[42ch] text-[12px] leading-5 text-muted">
            Deterministic compatibility analysis for OpenAPI 3.0 and 3.1. Every report carries a digest of its
            inputs, options and changes.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-graphite" aria-label="Documentation">
          {LINKS.map(([to, label]) => (
            <Link key={to} to={to} className="hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>

        <p className="font-mono text-[11px] leading-5 text-muted">exit codes 0 · 1</p>
      </div>
    </footer>
  );
}
