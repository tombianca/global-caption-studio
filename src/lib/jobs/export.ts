import path from 'node:path';
import { promises as fs } from 'node:fs';
import { prisma } from '../db';
import { storage } from '../storage';
import { probeVideo, burnCaptions, withTempDir } from '../ffmpeg';
import { generateAss } from '../captions';
import { registerJob } from '../jobs';
import { parseCaptionStyle } from '../dto';
import { slugify } from '../utils';

registerJob('export', async (payload, report) => {
  const { videoId, burnIn, language } = payload as {
    videoId: string;
    burnIn?: boolean;
    language?: string;
  };
  const project = await prisma.videoProject.findUnique({
    where: { id: videoId },
    include: { segments: true },
  });
  if (!project) throw new Error('Project not found');

  // Caption files (SRT/VTT/ASS/TXT) are generated on demand by the download
  // route, so a non-burn export has nothing expensive to do.
  if (!burnIn) return;

  try {
    await prisma.videoProject.update({
      where: { id: videoId },
      data: { status: 'EXPORTING', errorMessage: null },
    });

    const lang = language ?? project.originalLanguage;
    const segments = [...project.segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
    const isOriginal = lang === project.originalLanguage;
    const inputs = segments.map((s) => {
      const translations = (s.translatedTexts ?? {}) as Record<string, string>;
      return {
        startTime: s.startTime,
        endTime: s.endTime,
        text: isOriginal ? s.originalText : (translations[lang] ?? s.originalText),
      };
    });
    const style = parseCaptionStyle(project.captionStyle);

    report(10, 'Preparing subtitles...');

    await withTempDir(async (tmp) => {
      const localVideo = await storage.toLocalFile(project.originalFileUrl, tmp);
      const probe = await probeVideo(localVideo).catch(() => null);

      const ass = generateAss(inputs, {
        style,
        languageCode: lang,
        width: probe?.width ?? 1920,
        height: probe?.height ?? 1080,
      });
      const assPath = path.join(tmp, 'subs.ass');
      await fs.writeFile(assPath, ass, 'utf8');

      const outPath = path.join(tmp, 'burned.mp4');
      report(40, 'Burning captions into video...');
      await burnCaptions(localVideo, assPath, outPath);

      report(90, 'Saving...');
      const outBuffer = await fs.readFile(outPath);
      const key = `exports/${videoId}/burned-${slugify(lang)}.mp4`;
      const stored = await storage.put(key, outBuffer, 'video/mp4');
      await prisma.videoProject.update({ where: { id: videoId }, data: { burnedVideoUrl: stored } });
    });

    await prisma.videoProject.update({ where: { id: videoId }, data: { status: 'READY' } });
    report(100, 'Export complete');
  } catch (err) {
    await prisma.videoProject
      .update({
        where: { id: videoId },
        data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Export failed.' },
      })
      .catch(() => {});
    throw err;
  }
});
