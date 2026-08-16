import { prisma } from '../db';
import { createTranslator } from '../translation';
import { languageName } from '../languages';
import { registerJob } from '../jobs';
import { parseTargetLanguages } from '../dto';

registerJob('translate', async (payload, report) => {
  const { videoId } = payload as { videoId: string };
  const project = await prisma.videoProject.findUnique({
    where: { id: videoId },
    include: { segments: true },
  });
  if (!project) throw new Error('Project not found');

  try {
    const targets = parseTargetLanguages(project.targetLanguages);
    await prisma.videoProject.update({
      where: { id: videoId },
      data: { status: 'TRANSLATING', errorMessage: null },
    });

    if (targets.length === 0) {
      await prisma.videoProject.update({ where: { id: videoId }, data: { status: 'READY' } });
      return;
    }

    const translator = createTranslator();
    const segments = [...project.segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
    const originals = segments.map((s) => s.originalText);

    for (let i = 0; i < targets.length; i++) {
      const lang = targets[i];
      report(Math.round((i / targets.length) * 100), `Translating to ${languageName(lang)}...`);
      try {
        const translated = await translator.translateTexts(originals, lang);
        for (let j = 0; j < segments.length; j++) {
          const current = (segments[j].translatedTexts ?? {}) as Record<string, string>;
          current[lang] = translated[j] ?? segments[j].originalText;
          (segments[j] as unknown as { translatedTexts: Record<string, string> }).translatedTexts = current;
          await prisma.captionSegment.update({
            where: { id: segments[j].id },
            data: { translatedTexts: current as Record<string, string> },
          });
        }
        await prisma.captionLanguage.updateMany({
          where: { videoProjectId: videoId, languageCode: lang },
          data: { status: 'READY' },
        });
      } catch {
        // One language failed — keep the work done for the others.
        await prisma.captionLanguage.updateMany({
          where: { videoProjectId: videoId, languageCode: lang },
          data: { status: 'FAILED' },
        });
      }
    }

    await prisma.videoProject.update({ where: { id: videoId }, data: { status: 'READY' } });
    report(100, 'Translation complete');
  } catch (err) {
    await prisma.videoProject
      .update({
        where: { id: videoId },
        data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Translation failed.' },
      })
      .catch(() => {});
    throw err;
  }
});
