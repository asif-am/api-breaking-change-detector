export function Field({ id, label, hint, className = '', ...props }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="input" {...props} />
      {hint ? <p className="mt-1.5 text-[12px] leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-lg border border-rust/30 bg-rust-soft px-3 py-2.5 text-[13px] leading-5 text-rust">
      {children}
    </div>
  );
}
