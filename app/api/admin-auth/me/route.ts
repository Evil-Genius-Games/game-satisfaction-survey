import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '@/lib/adminAuth';

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionCookie = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${getAdminSessionCookieName()}=`));
  const sessionToken = sessionCookie ? decodeURIComponent(sessionCookie.split('=').slice(1).join('=')) : '';
  const session = await verifyAdminSessionToken(sessionToken);

  if (!session.ok) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const client = await pool.connect();

  try {
    const result = await client.query(
      'SELECT id, email, is_active FROM admin_users WHERE id = $1 AND lower(email) = lower($2) LIMIT 1',
      [session.payload.userId, session.payload.email]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error('Admin session lookup error:', error);
    return NextResponse.json({ error: 'Failed to load admin session' }, { status: 500 });
  } finally {
    client.release();
  }
}
