'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { LANGUAGES } from '@/lib/languages';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  placeholder?: string;
  label?: string;
}

export function LanguageSelector({ selected, onChange, multi = true, placeholder, label }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  const selectedNames = LANGUAGES.filter((l) => selected.includes(l.code)).map((l) => l.name);

  function toggle(code: string) {
    if (!multi) {
      onChange([code]);
      setOpen(false);
      return;
    }
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  return (
    <div className="relative" ref={rootRef}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[2.6rem] w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <span className="truncate">
          {selectedNames.length
            ? selectedNames.slice(0, 3).join(', ') + (selectedNames.length > 3 ? ` +${selectedNames.length - 3}` : '')
            : (placeholder ?? 'Select languages…')}
        </span>
        <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-2 dark:border-slate-700">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search languages…"
              aria-label="Search languages"
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <ul role="listbox" aria-multiselectable={multi} className="max-h-56 overflow-auto py-1">
            {filtered.map((l) => {
              const checked = selected.includes(l.code);
              return (
                <li key={l.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(l.code)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      {multi && (
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {checked && (
                            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      )}
                      <span dir={l.rtl ? 'rtl' : 'ltr'}>{l.nativeName}</span>
                      <span className="text-xs text-slate-400">{l.name}</span>
                    </span>
                    <code className="text-xs text-slate-400">{l.code}</code>
                  </button>
                </li>
              );
            })}
            {!filtered.length && <li className="px-3 py-2 text-sm text-slate-400">No languages found.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
