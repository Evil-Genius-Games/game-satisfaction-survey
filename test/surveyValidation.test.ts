import { describe, expect, it } from 'vitest';
import { validateAnswersForSurvey } from '../lib/surveyValidation';

function createMockClient() {
  return {
    async query(sql: string, params: unknown[]) {
      if (sql.includes('FROM surveys')) {
        return { rows: [{ id: params[0], is_active: true }] };
      }

      if (sql.includes('FROM questions')) {
        return {
          rows: [
            { id: 10, question_type: 'single_choice', is_required: true, validation_rules: null },
            { id: 11, question_type: 'rating', is_required: true, validation_rules: { min: 1, max: 5 } },
            { id: 12, question_type: 'email', is_required: false, validation_rules: null },
            { id: 13, question_type: 'multiple_choice', is_required: false, validation_rules: null },
          ],
        };
      }

      if (sql.includes('FROM question_options')) {
        const questionId = params[0];
        if (questionId === 10) {
          return { rows: [{ option_text: 'Alpha', option_value: 'alpha' }] };
        }
        if (questionId === 13) {
          return {
            rows: [
              { option_text: 'A', option_value: 'a' },
              { option_text: 'B', option_value: 'b' },
            ],
          };
        }
      }

      return { rows: [] };
    },
  } as any;
}

describe('validateAnswersForSurvey', () => {
  it('normalizes a valid payload', async () => {
    const result = await validateAnswersForSurvey(createMockClient(), 1, [
      { question_id: 10, answer_value: 'alpha' },
      { question_id: 11, answer_value: '5' },
      { question_id: 12, answer_text: 'player@example.com' },
      { question_id: 13, answer_value: 'a' },
      { question_id: 13, answer_value: 'b' },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answers).toHaveLength(5);
      expect(result.answers[0]).toEqual({ question_id: 10, answer_text: null, answer_value: 'alpha' });
    }
  });

  it('rejects questions that do not belong to the survey', async () => {
    const result = await validateAnswersForSurvey(createMockClient(), 1, [
      { question_id: 999, answer_value: 'alpha' },
    ]);

    expect(result).toMatchObject({ ok: false, status: 400, error: 'Invalid answers' });
    if (!result.ok) {
      expect(result.details).toContain('Question 999 does not belong to survey 1');
    }
  });

  it('rejects invalid options, invalid ratings, and invalid emails', async () => {
    const result = await validateAnswersForSurvey(createMockClient(), 1, [
      { question_id: 10, answer_value: 'not-allowed' },
      { question_id: 11, answer_value: '10' },
      { question_id: 12, answer_text: 'bad-email' },
    ]);

    expect(result).toMatchObject({ ok: false, status: 400, error: 'Invalid answers' });
    if (!result.ok) {
      expect(result.details).toEqual([
        'Answer for question 10 is not one of the allowed options',
        'Rating for question 11 must be an integer from 1 to 5',
        'Answer for question 12 must be a valid email address',
      ]);
    }
  });

  it('rejects duplicate scalar answers but allows multiple-choice answers', async () => {
    const result = await validateAnswersForSurvey(createMockClient(), 1, [
      { question_id: 10, answer_value: 'alpha' },
      { question_id: 10, answer_value: 'alpha' },
      { question_id: 13, answer_value: 'a' },
      { question_id: 13, answer_value: 'b' },
    ]);

    expect(result).toMatchObject({ ok: false, status: 400, error: 'Invalid answers' });
    if (!result.ok) {
      expect(result.details).toContain('Duplicate answer for question 10');
      expect(result.details).not.toContain('Duplicate answer for question 13');
    }
  });
});
