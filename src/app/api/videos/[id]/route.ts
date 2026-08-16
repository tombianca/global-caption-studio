import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import {
  requireUser,
  requireOwnedProject,
  json,
  handleRouteError,
  parseJson,
} from '@/lib/api';
import { sanitizeTitle } from '@/lib/validation';
import { DEFAULT_CAPTION_STYLE, type CaptionStyle } from '@/lib/types';
import { toVideoDTO } from '@/lib/dto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id);
    const full = await prisma.videoProject.findUniqueOrThrow({
      where: { id },
      include: { languages: true },
    });
    return json({ video: await toVideoDTO(full) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id);

    const body = await parseJson<{ title?: string; captionStyle?: Partial<CaptionStyle> }>(req);
    const data: Record<string, unknown> = {};
    if (typeof body.title === 'string') data.title = sanitizeTitle(body.title);
    if (body.captionStyle && typeof body.captionStyle === 'object') {
      data.captionStyle = { ...DEFAULT_CAPTION_STYLE, ...body.captionStyle };
    }

    const updated = await prisma.videoProject.update({
      where: { id },
      data,
      include: { languages: true },
    });
    return json({ video: await toVideoDTO(updated) });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id);

    await storage.delete(project.originalFileUrl);
    if (project.burnedVideoUrl) await storage.delete(project.burnedVideoUrl);
    await prisma.videoProject.delete({ where: { id } });

    return json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
