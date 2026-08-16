'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { LanguageSelector } from '@/components/language-selector';
import { ProgressBar } from '@/components/progress-bar';
import { uploadVideo } from '@/lib/client/api';
import { useToast } from '@/components/toast';
import { LANGUAGES } from '@/lib/languages';

const ALLOWED_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const MAX_MB = 2048;

export default function UploadPage() {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [originalLanguage, setOriginalLanguage] = useState('auto');
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [captionFormat, setCaptionFormat] = useState('SRT');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(f: File) {
    setError(null);
    const ext = (f.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`Unsupported file type ".${ext}". Allowed: MP4, MOV, AVI, MKV, WebM.`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`);
      return;
    }
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Please choose a video file first.');
      return;
    }
    if (!targetLanguages.length && originalLanguage === 'auto') {
      // fine — original language auto-detect still produces captions
    }
    setUploading(true);
    setError(null);
    try {
      const { video } = await uploadVideo({
        file,
        title: title || 'Untitled video',
        originalLanguage,
        targetLanguages,
        captionFormat,
        onProgress: setProgress,
      });
      toast('Upload complete — starting transcription…', 'success');
      router.push(`/editor/${video.id}?autostart=1`);
    } catch (err) {
      setUploading(false);
      setProgress(null);
      setError(err instanceof Error ? err.message : 'Upload failed.');
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Upload a video</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          MP4, MOV, AVI, MKV, or WebM — up to {MAX_MB} MB.
        </p>

        <form onSubmit={submit} className="space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) accept(f);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                : 'border-slate-300 hover:border-brand-400 dark:border-slate-700'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.mov,.avi,.mkv,.webm,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) accept(f);
              }}
            />
            {previewUrl ? (
              <video src={previewUrl} controls className="max-h-64 w-full rounded-lg" />
            ) : (
              <>
                <svg className="mb-2 h-10 w-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 16.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18" />
                </svg>
                <p className="text-sm font-medium">Drag &amp; drop your video here</p>
                <p className="mt-1 text-xs text-slate-400">or click to browse</p>
              </>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Project name
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="lang" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Original audio language
              </label>
              <select
                id="lang"
                value={originalLanguage}
                onChange={(e) => setOriginalLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="auto">Auto Detect</option>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="format" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Caption format
              </label>
              <select
                id="format"
                value={captionFormat}
                onChange={(e) => setCaptionFormat(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="SRT">SRT</option>
                <option value="VTT">VTT</option>
                <option value="ASS">ASS</option>
              </select>
            </div>
          </div>

          <LanguageSelector
            label="Target caption languages (optional)"
            selected={targetLanguages}
            onChange={setTargetLanguages}
            placeholder="None — keep original language only"
          />

          {uploading && progress != null && (
            <ProgressBar value={progress} label="Uploading" />
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={uploading || !file}
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Generate Captions'}
            </button>
            <Link href="/dashboard" className="text-sm text-slate-500 hover:underline dark:text-slate-400">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
