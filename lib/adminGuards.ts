import { NextResponse } from 'next/server';

export function requireDangerousAdminAction(request: Request, expectedAction: string) {
  if (process.env.ENABLE_DANGEROUS_ADMIN_ACTIONS !== 'true') {
    return NextResponse.json(
      {
        error: 'Dangerous admin action is disabled',
        message: 'Set ENABLE_DANGEROUS_ADMIN_ACTIONS=true only for a controlled maintenance window.',
      },
      { status: 403 }
    );
  }

  const confirmation = request.headers.get('x-confirm-action');
  if (confirmation !== expectedAction) {
    return NextResponse.json(
      {
        error: 'Missing destructive action confirmation',
        message: `Send header x-confirm-action: ${expectedAction} to confirm this operation.`,
      },
      { status: 400 }
    );
  }

  return null;
}
