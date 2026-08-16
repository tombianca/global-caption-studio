import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, requireOwnedProject, json, handleRouteError, ApiError, rateLimit } from '@/lib/api';
import { enqueueJob } from '@/lib/queue';
import '@/lib/jobs/index';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireOwnedProject(id, user.id);

    if (!rateLimit(`translate:${user.id}`, 20, 60_000)) {
      throw new ApiError(429, 'Too many translation requests. Please wait a minute and try again.', 'RATE_LIMIT');
    }

    await prisma.videoProject.update({
      where: { id },
      data: { status: 'TRANSLATING', errorMessage: null },
    });

    const jobId = await enqueueJob('translate', { videoId: id });
    return json({ jobId, status: 'TRANSLATING' });
  } catch (err) {
    return handleRouteError(err);
  }
}
