import { useRef } from 'react';
import toast from 'react-hot-toast';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * One specification: drop or choose a .json file, or paste the document.
 */
export default function SpecInput({ label, hint, value, onChange, fileName, onFileName }) {
  const inputRef = useRef(null);
  const ready = Boolean(value.trim());

  async function loadFile(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('The file is larger than the 5 MB limit.');
      return;
    }
    try {
      onChange(await file.text());
      onFileName?.(file.name);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error('Could not read that file.');
    }
  }

  function clear() {
    onChange('');
    onFileName?.('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <section
      className="sheet flex flex-col p-4"
      onDrop={(event) => {
        event.preventDefault();
        loadFile(event.dataTransfer.files?.[0]);
      }}
      onDragOver={(event) => event.preventDefault()}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="h3">{label}</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-muted">{hint}</p>
        </div>
        <span className={`tag ${ready ? 'tag-compatible' : ''}`}>{ready ? 'loaded' : 'empty'}</span>
      </header>

      <div className="mt-3 flex items-center gap-2">
        <label className="btn btn-secondary cursor-pointer">
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(event) => {
              loadFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          Choose .json
        </label>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted" title={fileName}>
          {fileName || 'no file selected'}
        </span>
        {ready ? (
          <button type="button" className="text-[13px] text-graphite hover:text-ink" onClick={clear}>
            Clear
          </button>
        ) : null}
      </div>

      <label className="mt-3 block text-[12px] font-medium text-graphite" htmlFor={`spec-${label}`}>
        Paste the JSON
      </label>
      <textarea
        id={`spec-${label}`}
        className="input mt-1.5 h-44 resize-y font-mono text-[11px] leading-5"
        spellCheck={false}
        placeholder={'{\n  "openapi": "3.0.3",\n  "info": { "title": "My API", "version": "1.0.0" },\n  "paths": {}\n}'}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          onFileName?.(event.target.value ? 'pasted.json' : '');
        }}
      />
    </section>
  );
}
