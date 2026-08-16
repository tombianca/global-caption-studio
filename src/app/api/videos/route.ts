import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser, json, handleRouteError } from '@/lib/api';
import { toVideoDTO } from '@/lib/dto';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser();
    const projects = await prisma.videoProject.findMany({
      where: { userId: user.id },
      include: { languages: true },
      orderBy: { createdAt: 'desc' },
    });
    const videos = await Promise.all(projects.map((p) => toVideoDTO(p)));
    return json({ videos });
  } catch (err) {
    return handleRouteError(err);
  }
}
