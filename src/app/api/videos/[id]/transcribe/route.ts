import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, requireOwnedProject, json, handleRouteError, ApiError, rateLimit } from '@/lib/api';
import { parseTargetLanguages } from '@/lib/dto';
import { enqueueJob } from '@/lib/queue';
import '@/lib/jobs/index';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id);

    if (!rateLimit(`transcribe:${user.id}`, 10, 60_000)) {
      throw new ApiError(429, 'Too many transcription requests. Please wait a minute and try again.', 'RATE_LIMIT');
    }

    let body: { originalLanguage?: string; targetLanguages?: string[] } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const originalLanguage = body.originalLanguage ?? project.originalLanguage;
    const targetLanguages = body.targetLanguages ?? parseTargetLanguages(project.targetLanguages);

    await prisma.videoProject.update({
      where: { id },
      data: { originalLanguage, targetLanguages, status: 'TRANSCRIBING', errorMessage: null },
    });

    const jobId = await enqueueJob('transcribe', { videoId: id });
    return json({ jobId, status: 'TRANSCRIBING' });
  } catch (err) {
    return handleRouteError(err);
  }
}
