import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { config } from '@/lib/config';
import { isGoogleConfigured } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL('/login?google=unavailable', req.url));
  }
  const state = randomBytes(16).toString('hex');
  (await cookies()).set('gcs_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: config.google.clientId!,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
