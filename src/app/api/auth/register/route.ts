import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import {
  hashPassword,
  signSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '@/lib/auth';
import { json, handleRouteError, ApiError, parseJson } from '@/lib/api';

export async function POST(req: NextRequest) {
  try {
    const body = await parseJson<{ name?: string; email?: string; password?: string }>(req);
    const email = (body.email ?? '').trim().toLowerCase();
    const name = (body.name ?? '').trim() || email.split('@')[0];
    const password = body.password ?? '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'A valid email address is required.', 'INVALID_EMAIL');
    }
    if (password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters.', 'WEAK_PASSWORD');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
    }

    const user = await prisma.user.create({
      data: { email, name, passwordHash: await hashPassword(password) },
    });

    const token = await signSession({ sub: user.id, email: user.email, name: user.name });
    const res = json({ user: { id: user.id, name: user.name, email: user.email } }, 201);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
