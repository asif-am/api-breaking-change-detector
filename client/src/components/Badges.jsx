import { classificationMeta, severityText } from '../utils/ui.js';

export function ClassificationTag({ classification }) {
  const meta = classificationMeta[classification];
  return <span className={meta ? meta.tag : 'tag'}>{meta ? meta.label : classification}</span>;
}

export function SeverityTag({ severity }) {
  return <span className={`tag ${severityText[severity] || 'text-graphite'}`}>{severity}</span>;
}

export function MethodTag({ method }) {
  if (!method) return null;
  return <span className="tag w-14 justify-center">{method.toUpperCase()}</span>;
}

export function VerdictBadge({ status }) {
  const failed = status === 'FAIL';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded border px-2 py-1 font-mono text-xs ${
        failed ? 'border-rust/30 bg-rust-soft text-rust' : 'border-moss/30 bg-moss-soft text-moss'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${failed ? 'bg-rust' : 'bg-moss'}`} aria-hidden="true" />
      {status}
    </span>
  );
}
