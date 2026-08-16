import type { NextRequest } from 'next/server';
import { requireUser, requireOwnedProject, handleRouteError, ApiError } from '@/lib/api';
import { storage } from '@/lib/storage';
import { guessContentType } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await requireOwnedProject(id, user.id);

    const data = await storage.get(project.originalFileUrl);
    if (!data) throw new ApiError(404, 'File not found.', 'NOT_FOUND');

    const contentType = guessContentType(project.originalFileUrl);
    const range = req.headers.get('range');

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? Math.min(parseInt(m[2], 10), data.length - 1) : data.length - 1;
        const chunk = data.subarray(start, end + 1);
        return new Response(new Uint8Array(chunk), {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${data.length}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunk.length),
            'Content-Type': contentType,
          },
        });
      }
    }

    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(data.length),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
