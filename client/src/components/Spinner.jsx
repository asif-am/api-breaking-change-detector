export default function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-12 font-mono text-[11px] text-muted ${className}`}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-graphite" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
