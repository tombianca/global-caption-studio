import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, requireOwnedProject, json, handleRouteError } from '@/lib/api';
import { enqueueJob } from '@/lib/queue';
import '@/lib/jobs/index';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id);

    let body: { burnIn?: boolean; language?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const burnIn = Boolean(body.burnIn);

    await prisma.videoProject.update({
      where: { id },
      data: { status: burnIn ? 'EXPORTING' : 'EXPORTING', errorMessage: null },
    });

    const jobId = await enqueueJob('export', { videoId: id, burnIn, language: body.language });
    return json({ jobId, status: 'EXPORTING' });
  } catch (err) {
    return handleRouteError(err);
  }
}
