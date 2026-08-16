'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/toast';
import { formatDuration } from '@/lib/utils';
import type { VideoProjectDTO } from '@/lib/types';

const PROCESSING = ['UPLOADING', 'TRANSCRIBING', 'TRANSLATING', 'EXPORTING'];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    UPLOADING: { label: 'Uploading', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
    TRANSCRIBING: { label: 'Transcribing', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
    TRANSLATING: { label: 'Translating', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
    EXPORTING: { label: 'Exporting', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    READY: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    FAILED: { label: 'Failed', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  };
  const m = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [videos, setVideos] = useState<VideoProjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { videos } = await api.listVideos();
      setVideos(videos);
      setLoading(false);
      const busy = videos.some((v) => PROCESSING.includes(v.status));
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (busy) timerRef.current = window.setTimeout(load, 2500);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) router.replace('/login');
      else {
        toast(e.message || 'Failed to load projects.', 'error');
        setLoading(false);
      }
    }
  }, [router, toast]);

  useEffect(() => {
    load();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [load]);

  async function remove(video: VideoProjectDTO) {
    if (!window.confirm(`Delete "${video.title}" and its captions? This cannot be undone.`)) return;
    try {
      await api.deleteVideo(video.id);
      setVideos((v) => v.filter((x) => x.id !== video.id));
      toast('Project deleted.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your projects</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Upload a video to generate captions.</p>
          </div>
          <Link
            href="/upload"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Upload video
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
            <p className="text-lg font-medium">No videos yet</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Upload your first video to start generating captions.
            </p>
            <Link
              href="/upload"
              className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Upload a video
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <div
                key={v.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="truncate font-semibold" title={v.title}>
                    {v.title}
                  </h2>
                  <StatusBadge status={v.status} />
                </div>
                <dl className="mb-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <dt>Duration</dt>
                    <dd>{formatDuration(v.duration)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Languages</dt>
                    <dd className="truncate pl-4">
                      {v.targetLanguages.length ? v.targetLanguages.join(', ') : v.originalLanguage}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Uploaded</dt>
                    <dd>{new Date(v.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
                {v.errorMessage && (
                  <p className="mb-3 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    {v.errorMessage}
                  </p>
                )}
                <div className="mt-auto flex items-center gap-2">
                  <Link
                    href={`/editor/${v.id}`}
                    className="flex-1 rounded-lg bg-brand-600 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-brand-700"
                  >
                    {v.status === 'READY' ? 'Open & edit' : 'View'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(v)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
