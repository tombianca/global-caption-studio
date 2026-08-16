import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage';
import { requireUser, json, handleRouteError, ApiError } from '@/lib/api';
import { validateVideoFile, sanitizeTitle } from '@/lib/validation';
import { toVideoDTO } from '@/lib/dto';

function parseTargetLanguages(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    /* fall through to comma split */
  }
  return value.split(',').map((x) => x.trim()).filter(Boolean);
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
    const targetLanguages = parseTargetLanguages(String(form.get('targetLanguages') ?? ''));
    const captionFormat = String(form.get('captionFormat') ?? 'SRT');

    const validation = validateVideoFile({ name: file.name, type: file.type, size: file.size });
    if (!validation.ok) {
      throw new ApiError(400, validation.message, validation.code);
    }

    // Store the file FIRST (streamed, no full in-memory copy), then create the
    // project pointing at it — so a mid-upload failure can never leave an
    // orphaned "UPLOADING" project with no file.
    const id = randomUUID();
    const key = `${id}/original.${validation.ext}`;
    let stored: string;
    try {
      stored = await storage.put(key, file.stream(), file.type || 'application/octet-stream');
    } catch (err) {
      console.error('[gcs] upload storage failed:', err);
      throw new ApiError(500, 'Failed to store the uploaded file. Please try again.', 'UPLOAD_FAILED');
    }

    let project;
    try {
      project = await prisma.videoProject.create({
        data: {
          id,
          userId: user.id,
          title,
          originalFileUrl: stored,
          originalLanguage,
          targetLanguages,
          status: 'UPLOADING',
        },
      });
    } catch (err) {
      await storage.delete(stored).catch(() => {});
      console.error('[gcs] project create failed:', err);
      throw new ApiError(500, 'Failed to create the project. Please try again.', 'UPLOAD_FAILED');
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
