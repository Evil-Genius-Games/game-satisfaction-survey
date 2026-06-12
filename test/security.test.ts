import { describe, expect, it } from 'vitest';
import { createResponseToken, verifyResponseToken } from '../lib/responseTokens';
import { isValidEmail, normalizeOptionalText } from '../lib/surveyValidation';

describe('response ownership tokens', () => {
  it('accepts a token for the matching response and survey', () => {
    const token = createResponseToken({ responseId: 42, surveyId: 1 });

    expect(verifyResponseToken(token, { responseId: 42, surveyId: 1 })).toEqual({ ok: true });
  });

  it('rejects a token for a different response', () => {
    const token = createResponseToken({ responseId: 42, surveyId: 1 });

    expect(verifyResponseToken(token, { responseId: 43, surveyId: 1 })).toEqual({
      ok: false,
      error: 'responseToken does not match this response',
    });
  });

  it('rejects tampered token signatures', () => {
    const token = createResponseToken({ responseId: 42, surveyId: 1 });
    const tamperedToken = token.replace(/.$/, 'x');

    expect(verifyResponseToken(tamperedToken, { responseId: 42, surveyId: 1 })).toEqual({
      ok: false,
      error: 'Invalid responseToken signature',
    });
  });
});

describe('shared input validation helpers', () => {
  it('validates basic email format', () => {
    expect(isValidEmail('player@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing-domain@')).toBe(false);
  });

  it('normalizes optional text values', () => {
    expect(normalizeOptionalText('  hello  ')).toBe('hello');
    expect(normalizeOptionalText('   ')).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
  });
});
