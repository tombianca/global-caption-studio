import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import bcrypt from 'bcryptjs';
import { config } from './config';

const secret = new TextEncoder().encode(config.authSecret);

export const SESSION_COOKIE = 'gcs_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}

/** Cookie options used when setting / clearing the session cookie. */
export function sessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.nodeEnv === 'production',
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

export function isGoogleConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret);
}

let remoteJwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<{ sub: string; email: string; name: string } | null> {
  try {
    if (!remoteJwkSet) {
      remoteJwkSet = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
    }
    const { payload } = await jwtVerify(idToken, remoteJwkSet, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
    });
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!payload.sub || !email) return null;
    const name = typeof payload.name === 'string' ? payload.name : email.split('@')[0];
    return { sub: payload.sub, email, name };
  } catch {
    return null;
  }
}
