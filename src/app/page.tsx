import Link from 'next/link';
import { Navbar } from '@/components/navbar';

const features = [
  { icon: '🎙️', title: 'Automatic speech recognition', desc: 'Whisper-compatible transcription turns speech into timed captions.' },
  { icon: '🌐', title: 'Automatic language detection', desc: 'The spoken language is detected for you — or pick it yourself.' },
  { icon: '🔤', title: 'Translation into many languages', desc: '40+ languages, including right-to-left and CJK scripts.' },
  { icon: '📥', title: 'Download SRT, VTT, ASS & TXT', desc: 'Standard subtitle formats plus a plain-text transcript.' },
  { icon: '🔥', title: 'Burn captions into the video', desc: 'Render styled captions directly into a new video file.' },
  { icon: '✏️', title: 'Caption editing & preview', desc: 'A timeline editor with a synced player and live styling.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 via-transparent to-transparent dark:from-brand-950/40" />
          <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300">
              Automatic · Multilingual · Editable
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              Captions for every audience, in every language.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
              Upload a video, generate captions automatically, translate them into dozens of
              languages, and export — as subtitle files or burned straight into the video.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/upload"
                className="w-full rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 sm:w-auto"
              >
                Upload Video
              </Link>
              <Link
                href="/login"
                className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-2 text-2xl">{f.icon}</div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-slate-400 dark:text-slate-500">
            Available caption languages depend on your transcription and translation providers.
          </p>
        </section>
      </main>
    </div>
  );
}
