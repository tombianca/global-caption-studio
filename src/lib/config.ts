// Centralized, typed environment configuration with safe defaults.
// All API keys stay on the server; nothing here is ever bundled to the client.

function str(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type TranslationProvider = 'mock' | 'deepl' | 'google';
export type TranscriptionProvider = 'mock' | 'local' | 'api';

export const config = {
  databaseUrl: str(process.env.DATABASE_URL, 'file:./dev.db'),
  authSecret: str(process.env.AUTH_SECRET, 'dev-secret-change-me-9f8a7b6c'),
  nodeEnv: str(process.env.NODE_ENV, 'development'),
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET,
    publicUrl: process.env.STORAGE_PUBLIC_URL,
  },
  transcription: {
    provider: str(process.env.TRANSCRIPTION_PROVIDER, 'local') as TranscriptionProvider,
    apiKey: process.env.TRANSCRIPTION_API_KEY,
    baseUrl: str(process.env.TRANSCRIPTION_BASE_URL, 'https://api.openai.com/v1'),
    model: str(process.env.TRANSCRIPTION_MODEL, 'whisper-1'),
    localModel: str(process.env.TRANSCRIPTION_LOCAL_MODEL, 'Xenova/whisper-base.en'),
  },
  translation: {
    provider: str(process.env.TRANSLATION_PROVIDER, 'mock') as TranslationProvider,
    apiKey: process.env.TRANSLATION_API_KEY,
    deeplBaseUrl: str(process.env.DEEPL_BASE_URL, 'https://api-free.deepl.com/v2'),
    googleApiKey: process.env.GOOGLE_TRANSLATION_API_KEY,
  },
  redisUrl: process.env.REDIS_URL,
  maxUploadSizeMb: num(process.env.MAX_UPLOAD_SIZE_MB, 2048),
  ffmpegPath: str(process.env.FFMPEG_PATH, 'ffmpeg'),
  ffprobePath: str(process.env.FFPROBE_PATH, 'ffprobe'),
  port: num(process.env.PORT, 3000),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: str(
      process.env.GOOGLE_REDIRECT_URI,
      'http://localhost:3000/api/auth/google/callback',
    ),
  },
};

export const isS3Configured = Boolean(config.storage.endpoint && config.storage.accessKey);
export const isBlobConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const isRedisConfigured = Boolean(config.redisUrl);
export const isGoogleConfigured = Boolean(config.google.clientId && config.google.clientSecret);
export const isTranscriptionConfigured = Boolean(config.transcription.apiKey);
