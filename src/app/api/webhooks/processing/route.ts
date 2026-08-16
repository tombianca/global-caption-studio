import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { json, apiError, parseJson } from '@/lib/api';

const ALLOWED = ['UPLOADING', 'TRANSCRIBING', 'TRANSLATING', 'EXPORTING', 'READY', 'FAILED'] as const;

/**
 * Generic inbound webhook for async processing providers.
 * Expects: Authorization: Bearer <WEBHOOK_SECRET>
 * Body: { videoId, status?, errorMessage? }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return apiError(503, 'Webhooks are not configured.', 'NOT_CONFIGURED');

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) return apiError(401, 'Invalid webhook secret.', 'UNAUTHORIZED');

  const body = await parseJson<{ videoId?: string; status?: string; errorMessage?: string }>(req);
  if (!body.videoId) return apiError(400, '"videoId" is required.', 'BAD_REQUEST');

  if (body.status && (ALLOWED as readonly string[]).includes(body.status)) {
    await prisma.videoProject.update({
      where: { id: body.videoId },
      data: { status: body.status as (typeof ALLOWED)[number], errorMessage: body.errorMessage ?? null },
    });
  }

  return json({ ok: true });
}
