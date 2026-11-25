import { useRef } from 'react';
import toast from 'react-hot-toast';

/**
 * File picker + paste area for one specification.
 */
export default function SpecInput({ title, description, tone = 'indigo', value, onChange, fileName, onFileName }) {
  const inputRef = useRef(null);

  const toneClasses = {
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  async function loadFile(file) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('The file is larger than the 5 MB limit.');
      return;
    }

    try {
      const text = await file.text();
      onChange(text);
      onFileName?.(file.name);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error('Could not read that file.');
    }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await loadFile(file);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <section className="card flex flex-col p-4">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <span className={`chip ${toneClasses[tone] || toneClasses.indigo}`}>{value ? 'ready' : 'empty'}</span>
      </header>

      <label
        className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 peer-focus-visible:border-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-200"
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) loadFile(file);
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="peer sr-only"
          onChange={handleFile}
        />
        <span className="text-sm font-medium text-slate-700">Choose a .json file</span>
        <span className="text-xs text-slate-500">or drag and drop it here</span>
      </label>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="truncate">{fileName || 'No file selected'}</span>
        {value ? (
          <button
            type="button"
            className="font-medium text-indigo-600 hover:text-indigo-700"
            onClick={() => {
              onChange('');
              onFileName?.('');
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor={`${title}-paste`}>
        …or paste the OpenAPI JSON
      </label>
      <textarea
        id={`${title}-paste`}
        className="input mt-1 h-40 resize-y font-mono text-[11px] leading-relaxed sm:h-52"
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
