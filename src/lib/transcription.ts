import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { config, isTranscriptionConfigured } from './config';
import type { CaptionSegmentDTO, TranscriptionResult } from './types';

export class TranscriptionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export interface Transcriber {
  /** Whether the handler must extract a WAV track before calling transcribe(). */
  readonly usesAudioFile: boolean;
  transcribe(params: {
    audioPath: string;
    language: string; // 'auto' or an ISO code
    duration: number; // seconds (used by the mock + as a fallback)
  }): Promise<TranscriptionResult>;
}

const SAMPLE_LINES = [
  'Welcome to Global Caption Studio. This is a demonstration of automatic caption generation.',
  'The transcript was generated from your video and can be edited right here in the timeline.',
  'You can translate these captions into dozens of languages with a single click.',
  'Adjust the timing, style, and layout to match your brand or platform.',
  'When you are ready, export your captions or burn them directly into the video.',
];

function mockSegments(duration: number): CaptionSegmentDTO[] {
  const n = Math.min(40, Math.max(1, Math.round(duration / 5)));
  const step = duration / n;
  const segments: CaptionSegmentDTO[] = [];
  for (let i = 0; i < n; i++) {
    const start = i * step;
    const end = Math.max(start + 0.2, Math.min(start + step - 0.05, duration));
    segments.push({
      id: `mock-${i}`,
      segmentNumber: i + 1,
      startTime: round3(start),
      endTime: round3(end),
      originalText: SAMPLE_LINES[i % SAMPLE_LINES.length],
      translatedTexts: {},
    });
  }
  return segments;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

class MockTranscriber implements Transcriber {
  readonly usesAudioFile = false;
  async transcribe(params: {
    audioPath: string;
    language: string;
    duration: number;
  }): Promise<TranscriptionResult> {
    const { language, duration } = params;
    const detected = language && language !== 'auto' ? language : 'en';
    return { detectedLanguage: detected, segments: mockSegments(Math.max(duration, 10)) };
  }
}

class WhisperTranscriber implements Transcriber {
  readonly usesAudioFile = true;
  async transcribe(params: {
    audioPath: string;
    language: string;
    duration: number;
  }): Promise<TranscriptionResult> {
    const { audioPath, language, duration } = params;
    const audio = await readFile(audioPath);
    const form = new FormData();
    form.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', config.transcription.model);
    if (language && language !== 'auto') form.append('language', language);
    form.append('response_format', 'verbose_json');

    const res = await fetch(`${config.transcription.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.transcription.apiKey}` },
      body: form,
    });

    if (res.status === 429) {
      throw new TranscriptionError('RATE_LIMIT', 'Transcription provider rate limit reached. Please retry shortly.');
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 400);
      throw new TranscriptionError('TRANSCRIPTION_FAILED', `Transcription failed: ${detail}`);
    }

    const data = await res.json();
    const detectedLanguage = (typeof data.language === 'string' ? data.language : '') || (language !== 'auto' ? language : 'en');

    let segments: CaptionSegmentDTO[] = [];
    const rawSegments: any[] = Array.isArray(data.segments) ? data.segments : [];
    if (rawSegments.length) {
      segments = rawSegments.map((s, i) => ({
        id: `whisper-${i}`,
        segmentNumber: i + 1,
        startTime: round3(Number(s.start) || 0),
        endTime: round3(Number(s.end) || 0),
        originalText: String(s.text ?? '').trim(),
        translatedTexts: {},
      }));
    } else if (typeof data.text === 'string' && data.text.trim()) {
      segments = splitPlainText(data.text.trim(), duration);
    }

    if (!segments.length) {
      throw new TranscriptionError('NO_SPEECH', 'No speech was detected in the audio.');
    }
    return { detectedLanguage, segments };
  }
}

/**
 * Local Whisper via transformers.js (ONNX runtime) — real speech-to-text with
 * no external API and no API keys. The model (~75MB) is downloaded once, on
 * first use, into the package cache.
 */
class LocalWhisperTranscriber implements Transcriber {
  readonly usesAudioFile = true;
  private pipelinePromise: Promise<any> | null = null;

  private loadPipeline(): Promise<any> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const { pipeline } = await import('@xenova/transformers');
        return pipeline('automatic-speech-recognition', config.transcription.localModel);
      })();
    }
    return this.pipelinePromise;
  }

  async transcribe(params: {
    audioPath: string;
    language: string;
    duration: number;
  }): Promise<TranscriptionResult> {
    const { audioPath, language, duration } = params;

    let transcriber: any;
    try {
      transcriber = await this.loadPipeline();
    } catch (err) {
      throw new TranscriptionError(
        'TRANSCRIPTION_FAILED',
        `Local Whisper model could not be loaded: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const audio = readWavToFloat32(audioPath);
    const output = await transcriber(audio, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const rawChunks: any[] = Array.isArray(output?.chunks)
      ? output.chunks
      : output?.chunks
        ? [output.chunks]
        : [];

    // With `return_timestamps: 'word'`, each chunk IS a word (text + timestamp).
    // Some providers return segment-level chunks with a nested words[] array —
    // handle both shapes.
    const words = rawChunks.flatMap((c) => {
      if (Array.isArray(c?.words) && c.words.length) {
        return c.words.map((w: any) => ({
          text: String(w?.word ?? w?.text ?? '').trim(),
          start: Number(w?.start ?? w?.timestamp?.[0]) || 0,
          end: Number(w?.end ?? w?.timestamp?.[1]) || 0,
        }));
      }
      const t = String(c?.text ?? '').trim();
      if (t && Array.isArray(c?.timestamp)) {
        return [{ text: t, start: Number(c.timestamp[0]) || 0, end: Number(c.timestamp[1]) || 0 }];
      }
      return [];
    });

    let segments: CaptionSegmentDTO[] = [];
    if (words.length) {
      segments = groupWordsIntoSegments(words, duration);
    } else {
      segments = rawChunks
        .map((c, i) => ({
          id: `local-${i}`,
          segmentNumber: i + 1,
          startTime: round3(Number(c?.timestamp?.[0]) || 0),
          endTime: round3(Number(c?.timestamp?.[1]) || duration),
          originalText: String(c?.text ?? '').trim(),
          translatedTexts: {},
        }))
        .filter((s) => s.originalText.length > 0);
    }

    if (!segments.length && typeof output?.text === 'string' && output.text.trim()) {
      segments = splitPlainText(output.text.trim(), duration);
    }
    if (!segments.length) {
      throw new TranscriptionError('NO_SPEECH', 'No speech was detected in the audio.');
    }

    const detected = language && language !== 'auto' ? language : 'en';
    return { detectedLanguage: detected, segments };
  }
}

/** Parse a 16-bit PCM WAV into float samples (whisper expects -1..1). */
function readWavToFloat32(path: string): Float32Array {
  const buf = readFileSync(path);
  let offset = 12; // skip RIFF header
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataOffset < 0) throw new TranscriptionError('TRANSCRIPTION_FAILED', 'Could not read audio (no data chunk).');
  const n = Math.floor(dataSize / 2);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
  return samples;
}

/** Split a plain-text transcript into evenly-timed segments (fallback). */
function splitPlainText(text: string, duration: number): CaptionSegmentDTO[] {
  const sentences = text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const n = Math.max(sentences.length, 1);
  const step = duration / n;
  return sentences.map((s, i) => ({
    id: `split-${i}`,
    segmentNumber: i + 1,
    startTime: round3(i * step),
    endTime: round3(Math.min(duration, (i + 1) * step - 0.05)),
    originalText: s,
    translatedTexts: {},
  }));
}

interface WordToken {
  text: string;
  start: number;
  end: number;
}

/**
 * Group word-level timestamps into caption segments that match how a person
 * actually speaks: split at natural pauses (>= 0.5s) and cap each caption at
 * ~2 lines (~84 chars). Each segment is bounded by the exact first/last word
 * timestamps (no leading/trailing silence).
 */
function groupWordsIntoSegments(words: WordToken[], duration: number): CaptionSegmentDTO[] {
  const cleaned = words.filter((w) => w.text && w.end > w.start);
  if (!cleaned.length) return [];

  const segments: CaptionSegmentDTO[] = [];
  let cur: WordToken[] = [];
  let curText = '';
  const flush = (isLast: boolean) => {
    if (!cur.length) return;
    const start = cur[0].start;
    const end = isLast ? Math.min(duration, cur[cur.length - 1].end) : cur[cur.length - 1].end;
    segments.push({
      id: `local-${segments.length}`,
      segmentNumber: segments.length + 1,
      startTime: round3(Math.max(0, start)),
      endTime: round3(Math.max(start + 0.1, end)),
      originalText: curText.trim(),
      translatedTexts: {},
    });
    cur = [];
    curText = '';
  };

  for (let i = 0; i < cleaned.length; i++) {
    const w = cleaned[i];
    const prev = cur[cur.length - 1];
    const gap = prev ? w.start - prev.end : 0;
    const wouldBeLong = curText.length + w.text.length > 84;

    // Start a NEW segment at a real pause (>= 0.4s) OR when the line would get
    // too long. This matches natural speech breaks (e.g. after "park,").
    if (cur.length && (gap >= 0.4 || wouldBeLong)) {
      flush(false);
    }
    cur.push(w);
    curText += (curText ? ' ' : '') + w.text;
  }
  flush(true);

  return segments.filter((s) => s.originalText.length > 0);
}

export function resolveTranscriptionProvider(): 'api' | 'local' | 'mock' {
  if (isTranscriptionConfigured) return 'api';
  return config.transcription.provider;
}

export function createTranscriber(): Transcriber {
  const provider = resolveTranscriptionProvider();
  if (provider === 'api') return new WhisperTranscriber();
  if (provider === 'mock') return new MockTranscriber();
  return new LocalWhisperTranscriber();
}
