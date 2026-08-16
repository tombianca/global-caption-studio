import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, requireOwnedProject, json, handleRouteError, ApiError, parseJson } from '@/lib/api';
import { sanitizeText } from '@/lib/validation';

function sanitizeTranslations(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = sanitizeText(v);
    }
  }
  return out;
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id);

    const lang = req.nextUrl.searchParams.get('language') ?? project.originalLanguage;
    const isOriginal = lang === 'original' || lang === project.originalLanguage;

    const segments = await prisma.captionSegment.findMany({
      where: { videoProjectId: id },
      orderBy: { segmentNumber: 'asc' },
    });

    const items = segments.map((s) => {
      const translated = (s.translatedTexts ?? {}) as Record<string, string>;
      return {
        id: s.id,
        segmentNumber: s.segmentNumber,
        startTime: s.startTime,
        endTime: s.endTime,
        originalText: s.originalText,
        translatedTexts: translated,
        text: isOriginal ? s.originalText : (translated[lang] ?? ''),
      };
    });

    return json({
      language: isOriginal ? project.originalLanguage : lang,
      isOriginal,
      segments: items,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id);

    const body = await parseJson<{ segments: unknown[] }>(req);
    if (!Array.isArray(body.segments)) throw new ApiError(400, '"segments" array is required.', 'BAD_REQUEST');

    const segments = body.segments.map((raw, i) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      const start = Number(s.startTime);
      const end = Number(s.endTime);
      return {
        segmentNumber: Number.isFinite(Number(s.segmentNumber))
          ? Math.round(Number(s.segmentNumber))
          : i + 1,
        startTime: Number.isFinite(start) ? Math.max(0, start) : 0,
        endTime: Number.isFinite(end) ? Math.max(0, end) : 0,
        originalText: sanitizeText(String(s.originalText ?? s.text ?? '')),
        translatedTexts: sanitizeTranslations(s.translatedTexts),
      };
    });

    await prisma.$transaction([
      prisma.captionSegment.deleteMany({ where: { videoProjectId: id } }),
      prisma.captionSegment.createMany({
        data: segments.map((s) => ({ videoProjectId: id, ...s })),
      }),
    ]);

    return json({ ok: true, count: segments.length });
  } catch (err) {
    return handleRouteError(err);
  }
}
