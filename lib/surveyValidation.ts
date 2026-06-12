import type { PoolClient } from 'pg';

export interface IncomingAnswer {
  question_id: unknown;
  answer_text?: unknown;
  answer_value?: unknown;
}

export interface NormalizedAnswer {
  question_id: number;
  answer_text: string | null;
  answer_value: string | null;
}

interface ValidationQuestion {
  id: number;
  question_type: string;
  is_required: boolean;
  validation_rules: any;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPTION_TYPES = new Set(['multiple_choice', 'single_choice', 'dropdown']);

function normalizeNullableString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function answerDisplayValue(answer: NormalizedAnswer) {
  return answer.answer_value ?? answer.answer_text ?? '';
}

async function getSurveyQuestions(client: PoolClient, surveyId: number) {
  const surveyResult = await client.query(
    'SELECT id, is_active FROM surveys WHERE id = $1',
    [surveyId]
  );

  if (surveyResult.rows.length === 0) {
    return { error: 'Survey not found' } as const;
  }

  if (surveyResult.rows[0].is_active === false) {
    return { error: 'Survey is not active' } as const;
  }

  const questionsResult = await client.query(
    'SELECT id, question_type, is_required, validation_rules FROM questions WHERE survey_id = $1',
    [surveyId]
  );

  const questions = new Map<number, ValidationQuestion>();
  for (const question of questionsResult.rows) {
    questions.set(Number(question.id), question);
  }

  return { questions } as const;
}

async function getAllowedOptionValues(client: PoolClient, questionId: number) {
  const optionsResult = await client.query(
    'SELECT option_text, option_value FROM question_options WHERE question_id = $1',
    [questionId]
  );

  return new Set(
    optionsResult.rows.flatMap((option) =>
      [option.option_text, option.option_value]
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
        .map((value) => String(value).trim())
    )
  );
}

export async function validateAnswersForSurvey(
  client: PoolClient,
  surveyId: number,
  answers: unknown
): Promise<
  | { ok: true; answers: NormalizedAnswer[] }
  | { ok: false; status: number; error: string; details?: string[] }
> {
  if (!Number.isInteger(surveyId) || surveyId <= 0) {
    return { ok: false, status: 400, error: 'Invalid survey id' };
  }

  if (!Array.isArray(answers) || answers.length === 0) {
    return { ok: false, status: 400, error: 'answers must be a non-empty array' };
  }

  const surveyValidation = await getSurveyQuestions(client, surveyId);
  if ('error' in surveyValidation) {
    return { ok: false, status: 404, error: surveyValidation.error ?? 'Survey not found' };
  }

  const normalizedAnswers: NormalizedAnswer[] = [];
  const seenQuestionIds = new Map<number, string>();
  const errors: string[] = [];

  for (const [index, rawAnswer] of answers.entries()) {
    const answer = rawAnswer as IncomingAnswer;
    const questionId = Number(answer?.question_id);

    if (!Number.isInteger(questionId) || questionId <= 0) {
      errors.push(`answers[${index}].question_id must be a positive integer`);
      continue;
    }

    const question = surveyValidation.questions.get(questionId);
    if (!question) {
      errors.push(`Question ${questionId} does not belong to survey ${surveyId}`);
      continue;
    }

    const priorType = seenQuestionIds.get(questionId);
    if (priorType && question.question_type !== 'multiple_choice') {
      errors.push(`Duplicate answer for question ${questionId}`);
      continue;
    }
    seenQuestionIds.set(questionId, question.question_type);

    const normalizedAnswer = {
      question_id: questionId,
      answer_text: normalizeNullableString(answer.answer_text),
      answer_value: normalizeNullableString(answer.answer_value),
    };

    const submittedValue = answerDisplayValue(normalizedAnswer);
    if (question.is_required && submittedValue.length === 0) {
      errors.push(`Question ${questionId} is required`);
      continue;
    }

    if (submittedValue.length === 0) {
      normalizedAnswers.push(normalizedAnswer);
      continue;
    }

    if (OPTION_TYPES.has(question.question_type)) {
      const allowedValues = await getAllowedOptionValues(client, questionId);
      if (allowedValues.size > 0 && !allowedValues.has(submittedValue)) {
        errors.push(`Answer for question ${questionId} is not one of the allowed options`);
        continue;
      }
    }

    if (question.question_type === 'rating') {
      const rating = Number(submittedValue);
      const rules = question.validation_rules || {};
      const min = Number.isFinite(Number(rules.min)) ? Number(rules.min) : 1;
      const max = Number.isFinite(Number(rules.max)) ? Number(rules.max) : 10;

      if (!Number.isInteger(rating) || rating < min || rating > max) {
        errors.push(`Rating for question ${questionId} must be an integer from ${min} to ${max}`);
        continue;
      }
    }

    if (question.question_type === 'email' && !EMAIL_PATTERN.test(submittedValue)) {
      errors.push(`Answer for question ${questionId} must be a valid email address`);
      continue;
    }

    normalizedAnswers.push(normalizedAnswer);
  }

  if (errors.length > 0) {
    return { ok: false, status: 400, error: 'Invalid answers', details: errors };
  }

  return { ok: true, answers: normalizedAnswers };
}

export function isValidEmail(value: unknown) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

export function normalizeOptionalText(value: unknown) {
  return normalizeNullableString(value);
}
