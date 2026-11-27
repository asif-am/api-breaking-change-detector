/** The four account screens differ only in their heading, fields and footer link. */
export default function AuthShell({ title, intro, children, footer }) {
  return (
    <div className="wrap flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-[27rem]">
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 text-[25px] font-medium leading-tight tracking-[-0.015em]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-graphite">{intro}</p>
        <div className="sheet mt-7 p-5 sm:p-6">{children}</div>
        {footer ? <div className="mt-5 text-[13px] text-graphite">{footer}</div> : null}
      </div>
    </div>
  );
}
