'use client';

import type { VideoProjectDTO } from '@/lib/types';
import { languageName } from '@/lib/languages';
import { api } from '@/lib/client/api';

const FORMATS = [
  { key: 'srt', label: 'SRT' },
  { key: 'vtt', label: 'VTT' },
  { key: 'ass', label: 'ASS' },
  { key: 'txt', label: 'TXT' },
] as const;

interface Props {
  video: VideoProjectDTO;
  onBurn: (language: string) => void;
  burning: boolean;
}

export function ExportPanel({ video, onBurn, burning }: Props) {
  const langs = Array.from(new Set([video.originalLanguage, ...video.targetLanguages])).filter(Boolean);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Download caption files</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          UTF-8 files, generated from your latest edits. Pick a language, then a format.
        </p>
        <div className="space-y-2">
          {langs.map((lang) => (
            <div
              key={lang}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div className="min-w-[8rem]">
                <p className="text-sm font-medium">{languageName(lang)}</p>
                <code className="text-xs text-slate-400">{lang}</code>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map((f) => (
                  <a
                    key={f.key}
                    href={api.downloadUrl(video.id, f.key, lang)}
                    download
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {f.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
        <h3 className="mb-1 text-sm font-semibold">Burn captions into video</h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Renders the styled captions into a new MP4 using FFmpeg. This may take a few minutes for long videos.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Burn language"
            defaultValue={video.originalLanguage}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {langs.map((lang) => (
              <option key={lang} value={lang}>
                {languageName(lang)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={burning}
            onClick={() => {
              const sel = document.querySelector<HTMLSelectElement>('select[aria-label="Burn language"]');
              onBurn(sel?.value ?? video.originalLanguage);
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {burning ? 'Burning…' : 'Burn captions'}
          </button>
        </div>
        {video.burnedVideoUrl && (
          <a
            href={api.downloadUrl(video.id, 'video', video.originalLanguage)}
            download
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v8.6l2.3-2.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L9 12.6V4a1 1 0 011-1z" />
              <path d="M3 15a1 1 0 011 1v1h12v-1a1 1 0 112 0v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1z" />
            </svg>
            Download captioned video
          </a>
        )}
      </section>
    </div>
  );
}
