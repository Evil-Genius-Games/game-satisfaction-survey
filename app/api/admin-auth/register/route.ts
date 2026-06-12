import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
  isAllowedAdminEmail,
  normalizeAdminEmail,
} from '@/lib/adminAuth';
import { hashAdminPassword, validateAdminPassword } from '@/lib/adminPassword';

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
    return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const existingUser = await client.query('SELECT id FROM admin_users WHERE lower(email) = lower($1)', [email]);
    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'An admin account already exists for this email. Please log in instead.' },
        { status: 409 }
      );
    }

    const { salt, hash } = await hashAdminPassword(password as string);
    const result = await client.query(
      `INSERT INTO admin_users (email, password_hash, password_salt)
       VALUES ($1, $2, $3)
       RETURNING id, email`,
      [email, hash, salt]
    );
    const user = result.rows[0];
    const sessionToken = await createAdminSessionToken(user.id, user.email);
    const response = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });

    response.cookies.set(getAdminSessionCookieName(), sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: getAdminSessionMaxAgeSeconds(),
    });

    return response;
  } catch (error: any) {
    if (error?.code === '23514') {
      return NextResponse.json(
        { error: 'Admin accounts must use an @evilgeniusgaming.com email address.' },
        { status: 400 }
      );
    }

    console.error('Admin registration error:', error);
    return NextResponse.json({ error: 'Failed to create admin account' }, { status: 500 });
  } finally {
    client.release();
  }
}
