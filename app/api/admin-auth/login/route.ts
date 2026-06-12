import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
  isAllowedAdminEmail,
  normalizeAdminEmail,
} from '@/lib/adminAuth';
import { validateAdminPassword, verifyAdminPassword } from '@/lib/adminPassword';

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = normalizeAdminEmail(body.email);
  const password = body.password;

  if (!isAllowedAdminEmail(email)) {
    return NextResponse.json(
      { error: 'Admin accounts must use an @evilgeniusgaming.com email address.' },
      { status: 400 }
    );
  }

  const passwordValidation = validateAdminPassword(password);
  if (!passwordValidation.ok) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, email, password_hash, password_salt, is_active
       FROM admin_users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [email]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const passwordMatches = await verifyAdminPassword(password as string, user.password_salt, user.password_hash);
    if (!passwordMatches) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    await client.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const sessionToken = await createAdminSessionToken(user.id, user.email);
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });

    response.cookies.set(getAdminSessionCookieName(), sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: getAdminSessionMaxAgeSeconds(),
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Failed to log in' }, { status: 500 });
  } finally {
    client.release();
  }
}
