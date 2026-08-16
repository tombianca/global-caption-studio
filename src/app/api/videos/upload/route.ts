import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { requireUser, json, handleRouteError, ApiError } from '@/lib/api';
import { validateVideoFile, sanitizeTitle } from '@/lib/validation';
import { toVideoDTO } from '@/lib/dto';

function parseTargetLanguages(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  const s = String(value);
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    /* fall through to comma split */
  }
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();

    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new ApiError(400, 'No video file provided.', 'NO_FILE');
    }

    const title = sanitizeTitle(String(form.get('title') ?? 'Untitled video'));
    const originalLanguage = String(form.get('originalLanguage') ?? 'auto');
    const targetLanguages = parseTargetLanguages(form.get('targetLanguages'));
    const captionFormat = String(form.get('captionFormat') ?? 'SRT');

    const validation = validateVideoFile({ name: file.name, type: file.type, size: file.size });
    if (!validation.ok) {
      throw new ApiError(400, validation.message, validation.code);
    }

    const project = await prisma.videoProject.create({
      data: {
        userId: user.id,
        title,
        originalFileUrl: '',
        originalLanguage,
        targetLanguages,
        status: 'UPLOADING',
      },
    });

    try {
      const key = `${project.id}/original.${validation.ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storage.put(key, buffer, file.type || 'application/octet-stream');
      await prisma.videoProject.update({ where: { id: project.id }, data: { originalFileUrl: stored } });
    } catch (err) {
      await prisma.videoProject.delete({ where: { id: project.id } }).catch(() => {});
      console.error('[gcs] upload storage failed:', err);
      throw new ApiError(500, 'Failed to store the uploaded file. Please try again.', 'UPLOAD_FAILED');
    }

    const fresh = await prisma.videoProject.findUniqueOrThrow({
      where: { id: project.id },
      include: { languages: true },
    });
    return json({ video: await toVideoDTO(fresh) }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
