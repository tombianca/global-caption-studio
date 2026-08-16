import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { config } from '@/lib/config';
import {
  verifyGoogleIdToken,
  signSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = (await cookies()).get('gcs_oauth_state')?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL('/login?google=error', req.url));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId!,
        client_secret: config.google.clientSecret!,
        redirect_uri: config.google.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) return NextResponse.redirect(new URL('/login?google=error', req.url));

    const tokens = await tokenRes.json();
    const idToken = typeof tokens.id_token === 'string' ? tokens.id_token : '';
    const profile = await verifyGoogleIdToken(idToken);
    if (!profile) return NextResponse.redirect(new URL('/login?google=error', req.url));

    let user = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: profile.email, name: profile.name, passwordHash: null },
      });
    }

    const token = await signSession({ sub: user.id, email: user.email, name: user.name });
    const res = NextResponse.redirect(new URL('/dashboard', req.url));
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_MAX_AGE_SECONDS));
    res.cookies.delete('gcs_oauth_state');
    return res;
  } catch {
    return NextResponse.redirect(new URL('/login?google=error', req.url));
  }
}
