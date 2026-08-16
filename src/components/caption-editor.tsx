'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SegmentRow {
  id: string;
  segmentNumber: number;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedTexts: Record<string, string>;
}

interface Props {
  segments: SegmentRow[];
  currentLanguage: string;
  isOriginal: boolean;
  activeIndex: number;
  onSegmentsChange: (next: SegmentRow[]) => void;
  onSeek: (t: number) => void;
  onPlay: (t: number) => void;
}

function splitText(text: string): [string, string] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

function textFor(s: SegmentRow, lang: string, isOriginal: boolean): string {
  return isOriginal ? s.originalText : (s.translatedTexts[lang] ?? '');
}

function setText(s: SegmentRow, lang: string, isOriginal: boolean, value: string): SegmentRow {
  if (isOriginal) return { ...s, originalText: value };
  return { ...s, translatedTexts: { ...s.translatedTexts, [lang]: value } };
}

export function CaptionEditor({
  segments,
  currentLanguage,
  isOriginal,
  activeIndex,
  onSegmentsChange,
  onSeek,
  onPlay,
}: Props) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments.map((_, i) => i);
    return segments
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => textFor(s, currentLanguage, isOriginal).toLowerCase().includes(q))
      .map(({ i }) => i);
  }, [segments, query, currentLanguage, isOriginal]);

  function patch(i: number, p: Partial<SegmentRow>) {
    const next = segments.map((s, idx) => (idx === i ? { ...s, ...p } : s));
    onSegmentsChange(next);
  }

  function addSegment() {
    const last = segments[segments.length - 1];
    const start = last ? last.endTime : 0;
    const row: SegmentRow = {
      id: `new-${Date.now()}`,
      segmentNumber: segments.length + 1,
      startTime: start,
      endTime: start + 4,
      originalText: '',
      translatedTexts: {},
    };
    onSegmentsChange([...segments, row]);
  }

  function remove(i: number) {
    const next = segments.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, segmentNumber: idx + 1 }));
    onSegmentsChange(next);
  }

  function split(i: number) {
    const s = segments[i];
    const mid = (s.startTime + s.endTime) / 2;
    const [a, b] = splitText(textFor(s, currentLanguage, isOriginal));
    const first = setText({ ...s, endTime: mid }, currentLanguage, isOriginal, a);
    const second = setText(
      { ...s, id: `split-${Date.now()}`, startTime: mid, originalText: s.originalText, translatedTexts: { ...s.translatedTexts } },
      currentLanguage,
      isOriginal,
      b,
    );
    const next = [...segments.slice(0, i), first, second, ...segments.slice(i + 1)].map((x, idx) => ({
      ...x,
      segmentNumber: idx + 1,
    }));
    onSegmentsChange(next);
  }

  function mergeWithPrevious(i: number) {
    if (i <= 0) return;
    const prev = segments[i - 1];
    const cur = segments[i];
    const merged: SegmentRow = {
      ...cur,
      id: prev.id,
      startTime: prev.startTime,
      endTime: cur.endTime,
      originalText: `${prev.originalText} ${cur.originalText}`.trim(),
      translatedTexts: { ...prev.translatedTexts },
    };
    // Merge each translation too.
    for (const [k, v] of Object.entries(cur.translatedTexts)) {
      merged.translatedTexts[k] = `${prev.translatedTexts[k] ?? ''} ${v}`.trim();
    }
    const next = [...segments.slice(0, i - 1), merged, ...segments.slice(i + 1)].map((x, idx) => ({
      ...x,
      segmentNumber: idx + 1,
    }));
    onSegmentsChange(next);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search captions…"
          aria-label="Search captions"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={addSegment}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-auto pr-1">
        {filtered.map((i) => {
          const s = segments[i];
          const text = textFor(s, currentLanguage, isOriginal);
          const active = i === activeIndex;
          return (
            <div
              key={s.id}
              data-idx={i}
              className={`rounded-lg border p-2.5 transition-colors ${
                active
                  ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-950'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="w-6 text-xs font-semibold text-slate-400">{s.segmentNumber}</span>
                <button
                  type="button"
                  onClick={() => onPlay(s.startTime)}
                  aria-label={`Play from segment ${s.segmentNumber}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700"
                >
                  <svg className="ml-0.5 h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.5 4.5v11l9-5.5-9-5.5z" />
                  </svg>
                </button>
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    aria-label={`Segment ${s.segmentNumber} start time (seconds)`}
                    value={Number.isFinite(s.startTime) ? s.startTime : 0}
                    onChange={(e) => patch(i, { startTime: parseFloat(e.target.value) || 0 })}
                    className="w-16 rounded border border-slate-200 bg-transparent px-1.5 py-0.5 text-xs dark:border-slate-700"
                  />
                  <span>→</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    aria-label={`Segment ${s.segmentNumber} end time (seconds)`}
                    value={Number.isFinite(s.endTime) ? s.endTime : 0}
                    onChange={(e) => patch(i, { endTime: parseFloat(e.target.value) || 0 })}
                    className="w-16 rounded border border-slate-200 bg-transparent px-1.5 py-0.5 text-xs dark:border-slate-700"
                  />
                  <span className="ml-1 hidden sm:inline">s</span>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => split(i)}
                    aria-label="Split segment"
                    title="Split"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 4h12v2H4zM8 9h4v2H8zM4 14h12v2H4z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => mergeWithPrevious(i)}
                    disabled={i === 0}
                    aria-label="Merge with previous segment"
                    title="Merge with previous"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 4l5 5h-3v7H8V9H5l5-5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Delete segment"
                    title="Delete"
                    className="rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </button>
                </div>
              </div>
              <textarea
                value={text}
                onChange={(e) => patch(i, setText(s, currentLanguage, isOriginal, e.target.value) as Partial<SegmentRow>)}
                dir={text && !isOriginal ? undefined : undefined}
                rows={2}
                aria-label={`Segment ${s.segmentNumber} text`}
                className="w-full resize-y rounded border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          );
        })}
        {!filtered.length && (
          <p className="py-6 text-center text-sm text-slate-400">No captions yet. Upload a video to generate them.</p>
        )}
      </div>
    </div>
  );
}
