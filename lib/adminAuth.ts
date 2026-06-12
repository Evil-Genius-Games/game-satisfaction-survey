const ADMIN_SESSION_COOKIE = 'gss_admin_session';
const ADMIN_EMAIL_DOMAIN = 'evilgeniusgaming.com';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

export interface AdminSessionPayload {
  userId: number;
  email: string;
  exp: number;
}

function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.RESPONSE_TOKEN_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET or RESPONSE_TOKEN_SECRET must be configured in production');
  }

  return secret || 'development-only-admin-session-secret-change-me';
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function byteArrayToBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signPayload(encodedPayload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getAdminSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));

  return byteArrayToBase64Url(new Uint8Array(signature));
}

export function normalizeAdminEmail(email: unknown) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isAllowedAdminEmail(email: unknown) {
  const normalizedEmail = normalizeAdminEmail(email);
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) {
    return false;
  }

  return normalizedEmail.slice(atIndex + 1) === ADMIN_EMAIL_DOMAIN;
}

export function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE;
}

export function getAdminSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}

export async function createAdminSessionToken(userId: number, email: string) {
  const payload: AdminSessionPayload = {
    userId,
    email: normalizeAdminEmail(email),
    exp: Date.now() + SESSION_MAX_AGE_MS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(token: unknown): Promise<{ ok: true; payload: AdminSessionPayload } | { ok: false; error: string }> {
  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, error: 'Admin session is required' };
  }

  const [encodedPayload, signature, ...extra] = token.split('.');
  if (!encodedPayload || !signature || extra.length > 0) {
    return { ok: false, error: 'Invalid admin session format' };
  }

  const expectedSignature = await signPayload(encodedPayload);
  if (signature !== expectedSignature) {
    return { ok: false, error: 'Invalid admin session signature' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;

    if (!payload?.userId || !payload?.email || !payload?.exp) {
      return { ok: false, error: 'Invalid admin session payload' };
    }

    if (!isAllowedAdminEmail(payload.email)) {
      return { ok: false, error: 'Admin email domain is not allowed' };
    }

    if (payload.exp < Date.now()) {
      return { ok: false, error: 'Admin session has expired' };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, error: 'Invalid admin session payload' };
  }
}
