import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionCookieName, verifyAdminSessionToken } from './lib/adminAuth';

function isAdminLoginRoute(pathname: string) {
  return pathname === '/admin/login';
}

function isAdminAuthRoute(pathname: string) {
  return pathname.startsWith('/api/admin-auth/');
}

function unauthenticatedResponse(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (isApiRoute) {
    return NextResponse.json({ error: 'Admin login required' }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/admin/login';
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);

  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isAdminLoginRoute(pathname) || isAdminAuthRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(sessionToken);

  if (!session.ok) {
    return unauthenticatedResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/admin-auth/:path*'],
};
