import crypto from 'crypto';

export interface ResponseTokenPayload {
  responseId: number;
  surveyId: number;
}

function getResponseTokenSecret() {
  const secret = process.env.RESPONSE_TOKEN_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('RESPONSE_TOKEN_SECRET must be configured in production');
  }

  return secret || 'development-only-response-token-secret-change-me';
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function signPayload(encodedPayload: string) {
  return crypto
    .createHmac('sha256', getResponseTokenSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createResponseToken(payload: ResponseTokenPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyResponseToken(
  token: unknown,
  expected: ResponseTokenPayload
): { ok: true } | { ok: false; error: string } {
  if (typeof token !== 'string' || token.length === 0) {
    return { ok: false, error: 'responseToken is required' };
  }

  const [encodedPayload, signature, ...extra] = token.split('.');
  if (!encodedPayload || !signature || extra.length > 0) {
    return { ok: false, error: 'Invalid responseToken format' };
  }

  const expectedSignature = signPayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false, error: 'Invalid responseToken signature' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    if (
      payload?.responseId !== expected.responseId ||
      payload?.surveyId !== expected.surveyId
    ) {
      return { ok: false, error: 'responseToken does not match this response' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid responseToken payload' };
  }
}
