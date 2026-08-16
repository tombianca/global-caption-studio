import path from 'node:path';
import { prisma } from '../db';
import { storage } from '../storage';
import { probeVideo, extractAudio, withTempDir } from '../ffmpeg';
import { createTranscriber, TranscriptionError } from '../transcription';
import { languageName } from '../languages';
import { registerJob } from '../jobs';
import { parseTargetLanguages } from '../dto';
import { enqueueJob } from '../queue';

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Transcription failed.';
}

registerJob('transcribe', async (payload, report) => {
  const { videoId } = payload as { videoId: string };
  const project = await prisma.videoProject.findUnique({ where: { id: videoId } });
  if (!project) throw new Error('Project not found');

  try {
    await prisma.videoProject.update({
      where: { id: videoId },
      data: { status: 'TRANSCRIBING', errorMessage: null },
    });

    report(5, 'Detecting audio track...');

    await withTempDir(async (tmp) => {
      const localPath = await storage.toLocalFile(project.originalFileUrl, tmp);
      let duration = project.duration ?? null;

      // Best-effort probe: duration + confirm an audio stream exists.
      try {
        const probe = await probeVideo(localPath);
        if (probe.duration != null) duration = probe.duration;
        if (!probe.hasAudio) {
          throw new TranscriptionError(
            'AUDIO_NOT_DETECTED',
            'No audio track was detected in this video. Add audio and try again.',
          );
        }
        if (duration != null && project.duration == null) {
          await prisma.videoProject.update({ where: { id: videoId }, data: { duration } });
        }
      } catch (err) {
        if (err instanceof TranscriptionError) throw err;
        // Probe failed (no ffprobe binary / unreadable file) — continue in mock mode.
      }

      const transcriber = createTranscriber();
      let audioPath = localPath;
      if (transcriber.usesAudioFile) {
        report(15, 'Extracting audio track...');
        const wav = path.join(tmp, 'audio.wav');
        try {
          await extractAudio(localPath, wav);
        } catch {
          throw new TranscriptionError('FFMPEG_FAILED', 'Failed to extract the audio track with FFmpeg.');
        }
        audioPath = wav;
      }

      report(20, 'Transcribing audio...');
      const result = await transcriber.transcribe({
        audioPath,
        language: project.originalLanguage,
        duration: duration ?? 60,
      });

      report(70, 'Saving transcript...');
      const targetLangs = parseTargetLanguages(project.targetLanguages);
      const srcCode = result.detectedLanguage || 'en';

      await prisma.captionSegment.deleteMany({ where: { videoProjectId: videoId } });
      await prisma.captionLanguage.deleteMany({ where: { videoProjectId: videoId } });

      await prisma.captionSegment.createMany({
        data: result.segments.map((s, i) => ({
          videoProjectId: videoId,
          segmentNumber: i + 1,
          startTime: s.startTime,
          endTime: s.endTime,
          originalText: s.originalText,
          translatedTexts: {},
        })),
      });

      await prisma.captionLanguage.createMany({
        data: [
          {
            videoProjectId: videoId,
            languageCode: srcCode,
            languageName: languageName(srcCode),
            status: 'READY',
          },
          ...targetLangs.map((c) => ({
            videoProjectId: videoId,
            languageCode: c,
            languageName: languageName(c),
            status: 'PENDING',
          })),
        ],
      });

      const hasTargets = targetLangs.length > 0;
      await prisma.videoProject.update({
        where: { id: videoId },
        data: { originalLanguage: srcCode, status: hasTargets ? 'TRANSLATING' : 'READY' },
      });

      if (hasTargets) {
        await enqueueJob('translate', { videoId });
      }
    });

    report(100, 'Transcription complete');
  } catch (err) {
    await prisma.videoProject
      .update({ where: { id: videoId }, data: { status: 'FAILED', errorMessage: message(err) } })
      .catch(() => {});
    throw err;
  }
});
