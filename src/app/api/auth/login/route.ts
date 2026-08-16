import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {
  verifyPassword,
  signSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '@/lib/auth';
import { json, handleRouteError, ApiError, parseJson } from '@/lib/api';

export async function POST(req: NextRequest) {
  try {
    const body = await parseJson<{ email?: string; password?: string }>(req);
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const token = await signSession({ sub: user.id, email: user.email, name: user.name });
    const res = json({ user: { id: user.id, name: user.name, email: user.email } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
