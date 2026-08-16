import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'demo1234';

const SEGMENTS: [number, number, string][] = [
  [0, 4, 'Welcome to Global Caption Studio.'],
  [4, 9, 'This demo project shows how captions, translations, and exports work.'],
  [9, 15, 'Open the Captions tab to edit the text and timing of every segment.'],
  [15, 21, 'Switch the preview language to see translated captions appear.'],
  [21, 27, 'Head to Export to download SRT, VTT, ASS, or TXT — or burn captions into the video.'],
  [27, 32, 'Thanks for trying it out!'],
];

async function main() {
  let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: DEMO_EMAIL, name: 'Demo User', passwordHash: await hashPassword(DEMO_PASSWORD) },
    });
    console.log(`Created demo user ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
  }

  const existing = await prisma.videoProject.findFirst({ where: { userId: user.id } });
  if (existing) {
    console.log('Demo project already exists — skipping.');
    return;
  }

  const project = await prisma.videoProject.create({
    data: {
      userId: user.id,
      title: 'Welcome to Global Caption Studio',
      originalFileUrl: 'demo/welcome.mp4',
      duration: 32,
      originalLanguage: 'en',
      targetLanguages: ['es', 'fr', 'de'],
      status: 'READY',
    },
  });

  await prisma.captionSegment.createMany({
    data: SEGMENTS.map(([start, end, text], i) => ({
      videoProjectId: project.id,
      segmentNumber: i + 1,
      startTime: start,
      endTime: end,
      originalText: text,
      translatedTexts: {},
    })),
  });

  await prisma.captionLanguage.createMany({
    data: [
      { videoProjectId: project.id, languageCode: 'en', languageName: 'English', status: 'READY' },
      { videoProjectId: project.id, languageCode: 'es', languageName: 'Spanish', status: 'READY' },
      { videoProjectId: project.id, languageCode: 'fr', languageName: 'French', status: 'READY' },
      { videoProjectId: project.id, languageCode: 'de', languageName: 'German', status: 'READY' },
    ],
  });

  // Populate mock-style translations for the demo languages.
  const names: Record<string, string> = { es: 'Español', fr: 'Français', de: 'Deutsch' };
  const segments = await prisma.captionSegment.findMany({
    where: { videoProjectId: project.id },
    orderBy: { segmentNumber: 'asc' },
  });
  for (const seg of segments) {
    const translatedTexts: Record<string, string> = {};
    for (const lang of ['es', 'fr', 'de']) {
      translatedTexts[lang] = `[${names[lang]}] ${seg.originalText}`;
    }
    await prisma.captionSegment.update({ where: { id: seg.id }, data: { translatedTexts } });
  }

  console.log(`Created demo project "${project.title}" (id: ${project.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
