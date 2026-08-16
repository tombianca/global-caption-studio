import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { config } from './config';

// Resolve binaries lazily so missing native modules never crash module load.
let _ffmpegBin: string | undefined;
let _ffprobeBin: string | undefined;

async function resolveFfmpeg(): Promise<string> {
  if (_ffmpegBin) return _ffmpegBin;
  try {
    const mod: any = await import('ffmpeg-static');
    if (mod?.default) {
      _ffmpegBin = mod.default;
      return mod.default;
    }
  } catch {
    /* ignore */
  }
  _ffmpegBin = config.ffmpegPath;
  return config.ffmpegPath;
}

async function resolveFfprobe(): Promise<string> {
  if (_ffprobeBin) return _ffprobeBin;
  try {
    const mod: any = await import('ffprobe-static');
    if (mod?.default?.path) {
      _ffprobeBin = mod.default.path;
      return mod.default.path;
    }
  } catch {
    /* ignore */
  }
  _ffprobeBin = config.ffprobePath;
  return config.ffprobePath;
}

function run(bin: string, args: string[], timeoutMs = 600000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d;
    });
    child.stderr?.on('data', (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `Process exited with code ${code}`));
    });
  });
}

export interface ProbeResult {
  duration: number | null;
  hasAudio: boolean;
  hasVideo: boolean;
  width: number | null;
  height: number | null;
}

export async function probeVideo(filePath: string): Promise<ProbeResult> {
  const bin = await resolveFfprobe();
  const stdout = await run(bin, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const streams: any[] = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const hasAudio = streams.some((s) => s.codec_type === 'audio');
  const hasVideo = Boolean(video);
  const rawDuration = Number(data.format?.duration) || Number(video?.duration) || NaN;
  return {
    duration: Number.isFinite(rawDuration) ? rawDuration : null,
    hasAudio,
    hasVideo,
    width: video?.width ?? null,
    height: video?.height ?? null,
  };
}

export async function extractAudio(videoPath: string, outPath: string): Promise<void> {
  const bin = await resolveFfmpeg();
  await run(bin, [
    '-y',
    '-i',
    videoPath,
    '-vn',
    '-acodec',
    'pcm_s16le',
    '-ar',
    '16000',
    '-ac',
    '1',
    outPath,
  ]);
}

export async function burnCaptions(
  videoPath: string,
  assPath: string,
  outPath: string,
): Promise<void> {
  const bin = await resolveFfmpeg();
  const esc = assPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const vf = `ass='${esc}'`;
  await run(bin, [
    '-y',
    '-i',
    videoPath,
    '-vf',
    vf,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-c:a',
    'copy',
    '-movflags',
    '+faststart',
    outPath,
  ]);
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gcs-'));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
