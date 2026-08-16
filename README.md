# Global Caption Studio

Upload a video, generate captions automatically, translate them into dozens of
languages, edit them on a timeline, and export — as **SRT / VTT / ASS / TXT**
files, or as a video with captions **burned in**.

Built with **Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS,
Prisma, FFmpeg, BullMQ (optional), and S3-compatible storage**.

---

## Features

- **Landing page** explaining the product and its capabilities
- **Upload** MP4 / MOV / AVI / MKV / WebM with live progress, type + size validation, and instant preview
- **Real speech-to-text out of the box** — runs Whisper locally in Node (no API key, ~75MB model downloaded on first use); swap to a Whisper-compatible API or mock via `TRANSCRIPTION_PROVIDER`
- **Translation** into 40+ languages (DeepL or Google Cloud Translation), preserving original timing
- **Caption editor** — timeline view, edit text/timing, add/delete/split/merge, search, and a video player that syncs with and highlights the active caption
- **Caption styling** — font, size, colors, background opacity, position, alignment, outline/shadow, with a live preview
- **Export** — SRT, WebVTT, ASS, and plain-text transcripts per language, plus FFmpeg burn-in to MP4
- **Dashboard** — status tracking (Uploading → Transcribing → Translating → Ready/Failed), reopen, download, delete
- **Auth** — email/password + optional Google OAuth, per-user project isolation
- **Dark/light theme**, responsive, accessible
- **Mock transcription & translation** so the whole app runs with zero API keys

---

## Quickstart (local, zero infrastructure)

Requires **Node 22+** (a portable Node 24 works fine).

```bash
# 1. Switch to SQLite (no Postgres/Redis needed)
npm run db:switch:sqlite

# 2. Create your env file
copy .env.example .env          # Windows
cp .env.example .env            # macOS / Linux
# Set DATABASE_URL="file:./dev.db" in .env

# 3. Install, generate the client, create the DB
npm install
npx prisma generate
npx prisma db push

# 4. Seed a demo user + project (optional)
npm run seed

# 5. Run it
npm run dev
```

Open **http://localhost:3000**. Sign in with the seeded demo account
(`demo@example.com` / `demo1234`) or register your own account.

> With no API keys set, transcription runs **locally via Whisper** (real captions)
> and translation uses a deterministic mock (prefixes text with the language name).

---

## Production (Docker + Postgres + Redis + S3)

```bash
# 1. Configure secrets in a .env file (see .env.example)
#    AUTH_SECRET is required; STORAGE_*, TRANSCRIPTION_*, TRANSLATION_* optional.

# 2. Build and run the full stack (app + worker + Postgres + Redis)
docker compose up --build
```

The `worker` service runs the BullMQ worker for background jobs. When `REDIS_URL`
is set, jobs are queued through Redis; otherwise the app uses an in-process queue
(for local/dev use).

---

## Environment variables

Copy `.env.example` to `.env`. Everything is optional except `DATABASE_URL` (and
`AUTH_SECRET` in production).

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Prisma connection string. `file:./dev.db` for SQLite, `postgresql://…` for Postgres. |
| `AUTH_SECRET` | Secret used to sign session JWTs (required in production). |
| `STORAGE_ENDPOINT` / `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` / `STORAGE_BUCKET` | S3-compatible storage. Empty → local filesystem (`./.storage`). |
| `TRANSCRIPTION_PROVIDER` | `local` (default) · `mock` · `api`. `local` runs Whisper in Node (no key). |
| `TRANSCRIPTION_LOCAL_MODEL` | Local Whisper model (default `Xenova/whisper-base.en`; use `Xenova/whisper-base` for multilingual). |
| `TRANSCRIPTION_API_KEY` / `TRANSCRIPTION_BASE_URL` / `TRANSCRIPTION_MODEL` | Whisper-compatible API (used when `TRANSCRIPTION_PROVIDER=api`). |
| `TRANSLATION_PROVIDER` | `mock` \| `deepl` \| `google`. |
| `TRANSLATION_API_KEY` | DeepL auth key. |
| `GOOGLE_TRANSLATION_API_KEY` | Google Cloud Translation API key. |
| `REDIS_URL` | Enables BullMQ queue + worker. Empty → in-process queue. |
| `MAX_UPLOAD_SIZE_MB` | Upload size limit (default 2048). |
| `FFMPEG_PATH` / `FFPROBE_PATH` | Override the bundled `ffmpeg-static`/`ffprobe-static` binaries. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth. |

API keys never leave the server and are never bundled into the client.

---

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account (email/password). |
| `POST` | `/api/auth/login` | Sign in, sets a session cookie. |
| `POST` | `/api/auth/logout` | Clear the session. |
| `GET` | `/api/auth/me` | Current user. |
| `POST` | `/api/videos/upload` | Multipart upload (file, title, originalLanguage, targetLanguages, captionFormat). |
| `GET` | `/api/videos` | List the caller's projects. |
| `GET` | `/api/videos/:id` | Fetch a project. |
| `PATCH` | `/api/videos/:id` | Update title / caption style. |
| `DELETE` | `/api/videos/:id` | Delete a project and its files. |
| `POST` | `/api/videos/:id/transcribe` | Start transcription (async job). |
| `POST` | `/api/videos/:id/translate` | Start translation (async job). |
| `POST` | `/api/videos/:id/export` | Start export / burn-in (async job). |
| `GET` | `/api/videos/:id/captions?language=xx` | Read captions for a language. |
| `PUT` | `/api/videos/:id/captions` | Replace the caption segment list (edit/add/delete). |
| `GET` | `/api/videos/:id/download/:format` | Download `srt` \| `vtt` \| `ass` \| `txt` \| `video`. |
| `GET` | `/api/videos/:id/status` | Poll processing status. |
| `GET` | `/api/videos/:id/file` | Stream the original video (Range supported). |
| `POST` | `/api/webhooks/processing` | Provider webhook (`Authorization: Bearer <WEBHOOK_SECRET>`). |

Every `/api/videos/*` endpoint requires authentication and enforces that users
can only access their own projects.

---

## Testing

```bash
npm run test          # vitest
npm run typecheck     # tsc --noEmit
npm run build         # prisma generate + next build
```

Tests cover caption timestamp formatting, SRT/VTT/ASS/TXT generation, the
translation workflow, file validation, and user authorization.

---

## Project structure

```
src/
  app/
    api/            # route handlers (auth, videos, captions, download, webhooks)
    (pages)         # landing, login, register, dashboard, upload, editor/[id]
  components/       # navbar, player, caption editor, style/export panels, toasts
  lib/
    auth.ts         # JWT sessions, password hashing, Google OAuth
    api.ts          # request helpers, rate limiting, error envelope
    authorization.ts# ownership assertion (unit-tested)
    captions.ts     # timestamps, wrapping, SRT/VTT/ASS/TXT generators
    transcription.ts# mock + Whisper-compatible transcriber
    translation.ts  # mock + DeepL + Google translators
    ffmpeg.ts       # probe, extract audio, burn captions
    storage.ts      # local filesystem + S3-compatible adapters
    queue.ts        # in-process queue + BullMQ
    jobs/           # transcribe / translate / export handlers
prisma/             # schema (postgres + sqlite) and seed
scripts/            # db switcher + BullMQ worker
```

---

## Notes & limitations

- Caption **download files are generated on demand** from your latest edits;
  burned video is generated by the export job and stored.
- The mock translator prefixes captions with the target language name so the
  flow is visible without API keys.
- Available languages depend on the configured providers; DeepL supports a
  subset of the catalog and errors clearly on unsupported codes.
- Local storage buffers files in memory for streaming; for very large
  deployments use S3-compatible storage.
