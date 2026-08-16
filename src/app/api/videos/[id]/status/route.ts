import type { NextRequest } from 'next/server';
import { requireUser, requireOwnedProject, json, handleRouteError } from '@/lib/api';
import { getJob } from '@/lib/queue';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id);

    const jobId = req.nextUrl.searchParams.get('jobId');
    const job = jobId ? getJob(jobId) : undefined;

    return json({
      status: project.status,
      errorMessage: project.errorMessage,
      job: job ?? null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
