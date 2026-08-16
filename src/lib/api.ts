import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from './auth';
import { prisma } from './db';
import type { SafeUser } from './types';

import { ApiError, assertOwned } from './authorization';

export { ApiError, assertOwned };

export function json(data: unknown, init?: number | { status?: number; headers?: HeadersInit }) {
  if (typeof init === 'number') return NextResponse.json(data, { status: init });
  return NextResponse.json(data, init);
}

export function apiError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function getSessionUser(): Promise<SafeUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, 'You must be signed in.', 'UNAUTHORIZED');
  return user;
}

export async function requireOwnedProject(id: string, userId: string) {
  const project = await prisma.videoProject.findUnique({ where: { id } });
  assertOwned(project, userId);
  return project;
}

export async function parseJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, 'Invalid JSON body.', 'BAD_REQUEST');
  }
}

// ---- Simple in-memory sliding-window rate limiter -------------------------
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

export function handleRouteError(err: unknown) {
  if (err instanceof ApiError) return apiError(err.status, err.message, err.code);
  console.error('[gcs] unhandled error:', err);
  return apiError(500, 'An unexpected error occurred. Please try again.', 'INTERNAL_ERROR');
}
