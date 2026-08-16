'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { VideoPlayer } from '@/components/video-player';
import { CaptionEditor, type SegmentRow } from '@/components/caption-editor';
import { StylePanel } from '@/components/style-panel';
import { ExportPanel } from '@/components/export-panel';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/toast';
import { DEFAULT_CAPTION_STYLE, type CaptionStyle, type VideoProjectDTO } from '@/lib/types';
import { isRtl, languageName } from '@/lib/languages';
import { formatDuration } from '@/lib/utils';

const PROCESSING = ['UPLOADING', 'TRANSCRIBING', 'TRANSLATING', 'EXPORTING'];

type Tab = 'captions' | 'style' | 'export';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    UPLOADING: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    TRANSCRIBING: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    TRANSLATING: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    EXPORTING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    READY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  };
  const cls = map[status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function EditorPage() {
  const params = useParams();
  const id = params.id as string;
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const saveTimer = useRef<number | null>(null);

  const [video, setVideo] = useState<VideoProjectDTO | null>(null);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [currentLanguage, setCurrentLanguage] = useState('');
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [currentTime, setCurrentTime] = useState(0);
  const [tab, setTab] = useState<Tab>('captions');
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Initial load -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { video } = await api.getVideo(id);
        if (cancelled) return;
        setVideo(video);
        setStyle(video.captionStyle);
        const lang = video.originalLanguage && video.originalLanguage !== 'auto' ? video.originalLanguage : 'en';
        setCurrentLanguage(lang);

        if (video.status === 'READY' || video.status === 'FAILED') {
          const c = await api.getCaptions(id, video.originalLanguage);
          if (!cancelled) {
            setSegments(
              c.segments.map((s) => ({
                id: s.id,
                segmentNumber: s.segmentNumber,
                startTime: s.startTime,
                endTime: s.endTime,
                originalText: s.originalText,
                translatedTexts: s.translatedTexts,
              })),
            );
          }
        }

        if (search.get('autostart') === '1' && video.status === 'UPLOADING') {
          await api.transcribe(id, {
            originalLanguage: video.originalLanguage,
            targetLanguages: video.targetLanguages,
          });
          if (!cancelled) setVideo((v) => (v ? { ...v, status: 'TRANSCRIBING' } : v));
        }
      } catch (err) {
        const e = err as Error & { status?: number };
        if (cancelled) return;
        if (e.status === 401) router.replace('/login');
        else if (e.status === 404) setNotFound(true);
        else setLoadError(e.message || 'Failed to load project.');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, router, search]);

  // ---- Poll while processing ----------------------------------------------
  useEffect(() => {
    if (!video || !PROCESSING.includes(video.status)) return;
    const t = window.setInterval(async () => {
      try {
        const { video: v } = await api.getVideo(id);
        setVideo(v);
        if (v.status === 'READY' || v.status === 'FAILED') {
          const c = await api.getCaptions(id, v.originalLanguage);
          setSegments(
            c.segments.map((s) => ({
              id: s.id,
              segmentNumber: s.segmentNumber,
              startTime: s.startTime,
              endTime: s.endTime,
              originalText: s.originalText,
              translatedTexts: s.translatedTexts,
            })),
          );
          if (v.status === 'READY' && video.status === 'EXPORTING') toast('Burned video is ready!', 'success');
        }
      } catch {
        /* transient */
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [id, video?.status, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOriginal = currentLanguage === video?.originalLanguage;
  const rtl = isRtl(currentLanguage);

  // ---- Caption editing -----------------------------------------------------
  const scheduleSave = useCallback(
    (next: SegmentRow[]) => {
      setSegments(next);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          await api.saveCaptions(id, next);
        } catch {
          toast('Failed to save captions.', 'error');
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [id, toast],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  // ---- Style ---------------------------------------------------------------
  const updateStyle = useCallback(
    (next: CaptionStyle) => {
      setStyle(next);
      api.patchVideo(id, { captionStyle: next }).catch(() => toast('Failed to save style.', 'error'));
    },
    [id, toast],
  );

  // ---- Playback helpers ----------------------------------------------------
  const activeIndex = useMemo(() => {
    for (let i = 0; i < segments.length; i++) {
      if (currentTime >= segments[i].startTime && currentTime < segments[i].endTime) return i;
    }
    return -1;
  }, [currentTime, segments]);

  const activeText = activeIndex >= 0 ? (isOriginal ? segments[activeIndex].originalText : segments[activeIndex].translatedTexts[currentLanguage] ?? '') : '';

  const seek = useCallback((t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }, []);

  const playFrom = useCallback(
    (t: number) => {
      seek(t);
      videoRef.current?.play();
    },
    [seek],
  );

  // ---- Actions -------------------------------------------------------------
  const retranscribe = useCallback(async () => {
    if (!video) return;
    try {
      await api.transcribe(id, {
        originalLanguage: video.originalLanguage,
        targetLanguages: video.targetLanguages,
      });
      setVideo((v) => (v ? { ...v, status: 'TRANSCRIBING', errorMessage: null } : v));
      toast('Transcription started…', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start transcription.', 'error');
    }
  }, [id, video, toast]);

  const retranslate = useCallback(async () => {
    try {
      await api.translate(id);
      setVideo((v) => (v ? { ...v, status: 'TRANSLATING', errorMessage: null } : v));
      toast('Translation started…', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start translation.', 'error');
    }
  }, [id, toast]);

  const burn = useCallback(
    async (language: string) => {
      try {
        await api.exportVideo(id, { burnIn: true, language });
        setVideo((v) => (v ? { ...v, status: 'EXPORTING', errorMessage: null } : v));
        toast('Burning captions — this can take a few minutes…', 'info');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to start export.', 'error');
      }
    },
    [id, toast],
  );

  const updateTitle = useCallback(
    (title: string) => {
      setVideo((v) => (v ? { ...v, title } : v));
      api.patchVideo(id, { title }).catch(() => toast('Failed to save title.', 'error'));
    },
    [id, toast],
  );

  if (notFound) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-xl font-bold">Project not found</h1>
          <p className="mt-2 text-sm text-slate-500">It may have been deleted.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-brand-600 hover:underline">
            Back to dashboard
          </Link>
        </main>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="h-96 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        </main>
      </div>
    );
  }

  const processing = PROCESSING.includes(video.status);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Back to dashboard">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.7 4.3a1 1 0 010 1.4L8.4 10l4.3 4.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" clipRule="evenodd" />
            </svg>
          </Link>
          <input
            value={video.title}
            onChange={(e) => updateTitle(e.target.value)}
            aria-label="Project name"
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-bold tracking-tight hover:border-slate-200 focus:border-slate-300 focus:outline-none dark:hover:border-slate-800"
          />
          <StatusBadge status={video.status} />
          <span className="text-sm text-slate-400">{formatDuration(video.duration)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={retranscribe}
              disabled={processing}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Regenerate
            </button>
            {video.targetLanguages.length > 0 && (
              <button
                type="button"
                onClick={retranslate}
                disabled={processing}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Re-translate
              </button>
            )}
          </div>
        </div>

        {loadError && (
          <p role="alert" className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {loadError}
          </p>
        )}
        {video.errorMessage && (
          <p role="alert" className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            {video.errorMessage}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left — player */}
          <div className="lg:col-span-3">
            <VideoPlayer
              videoRef={videoRef}
              src={video.originalFileUrl}
              activeText={activeText}
              rtl={rtl}
              style={style}
              onTimeUpdate={setCurrentTime}
              onPlay={() => undefined}
              onPause={() => undefined}
            />

            {/* Language chips */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Preview language:</span>
              {[video.originalLanguage, ...video.targetLanguages].filter(Boolean).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCurrentLanguage(lang)}
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    lang === currentLanguage
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {lang === video.originalLanguage ? `${languageName(lang)} (original)` : languageName(lang)}
                </button>
              ))}
            </div>

            {processing && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 animate-ping rounded-full bg-brand-500" />
                {video.status === 'TRANSCRIBING' && 'Transcribing audio…'}
                {video.status === 'TRANSLATING' && 'Translating captions…'}
                {video.status === 'EXPORTING' && 'Burning captions into video…'}
                {video.status === 'UPLOADING' && 'Processing…'}
              </div>
            )}
          </div>

          {/* Right — tabs */}
          <div className="lg:col-span-2">
            <div className="mb-3 flex gap-1 border-b border-slate-200 dark:border-slate-800">
              {(['captions', 'style', 'export'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`relative px-3 py-2 text-sm font-medium capitalize ${
                    tab === t
                      ? 'text-brand-600 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-brand-600'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t}
                  {t === 'captions' && saving && <span className="ml-1 text-xs text-slate-400">saving…</span>}
                </button>
              ))}
            </div>

            <div className="h-[560px]">
              {tab === 'captions' && (
                <CaptionEditor
                  segments={segments}
                  currentLanguage={currentLanguage}
                  isOriginal={isOriginal}
                  activeIndex={activeIndex}
                  onSegmentsChange={scheduleSave}
                  onSeek={seek}
                  onPlay={playFrom}
                />
              )}
              {tab === 'style' && <StylePanel style={style} onChange={updateStyle} />}
              {tab === 'export' && <ExportPanel video={video} onBurn={burn} burning={video.status === 'EXPORTING'} />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
