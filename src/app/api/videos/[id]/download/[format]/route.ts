import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { requireUser, requireOwnedProject, handleRouteError, ApiError } from '@/lib/api';
import { generateSrt, generateVtt, generateAss, generateTxt } from '@/lib/captions';
import { parseCaptionStyle } from '@/lib/dto';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; format: string }> },
) {
  try {
    const user = await requireUser();
    const { id, format } = await params;
    const project = await requireOwnedProject(id, user.id);

    const f = (format ?? '').toLowerCase();
    const lang = req.nextUrl.searchParams.get('language') ?? project.originalLanguage;

    // Burned video download.
    if (f === 'video') {
      const key = project.burnedVideoUrl;
      if (!key) throw new ApiError(404, 'Burned video has not been generated yet.', 'NOT_FOUND');
      const data = await storage.get(key);
      if (!data) throw new ApiError(404, 'Burned video not found.', 'NOT_FOUND');
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${slugify(project.title)}-captioned.mp4"`,
        },
      });
    }

    const segments = await prisma.captionSegment.findMany({
      where: { videoProjectId: id },
      orderBy: { segmentNumber: 'asc' },
    });
    const isOriginal = lang === project.originalLanguage;
    const inputs = segments.map((s) => {
      const translated = (s.translatedTexts ?? {}) as Record<string, string>;
      return {
        startTime: s.startTime,
        endTime: s.endTime,
        text: isOriginal ? s.originalText : (translated[lang] ?? s.originalText),
      };
    });

    let content: string;
    let mime: string;
    let ext: string;
    switch (f) {
      case 'srt':
        content = generateSrt(inputs);
        mime = 'application/x-subrip';
        ext = 'srt';
        break;
      case 'vtt':
        content = generateVtt(inputs);
        mime = 'text/vtt';
        ext = 'vtt';
        break;
      case 'ass':
        content = generateAss(inputs, { style: parseCaptionStyle(project.captionStyle), languageCode: lang });
        mime = 'text/x-ssa';
        ext = 'ass';
        break;
      case 'txt':
        content = generateTxt(inputs);
        mime = 'text/plain';
        ext = 'txt';
        break;
      default:
        throw new ApiError(400, `Unknown format "${format}". Supported: srt, vtt, ass, txt, video.`);
    }

    const filename = `${slugify(project.title)}.${lang}.${ext}`;
    return new Response(content, {
      headers: {
        'Content-Type': `${mime}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
