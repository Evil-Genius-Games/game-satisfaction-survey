import { Pool, type PoolClient } from 'pg';
import { validateAnswersForSurvey, type IncomingAnswer, type NormalizedAnswer } from './surveyValidation';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
});

export interface Survey {
  id: number;
  title: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
  settings: any;
}

export interface Question {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: 'short_text' | 'long_text' | 'multiple_choice' | 'single_choice' | 'dropdown' | 'rating' | 'yes_no' | 'email' | 'number' | 'date';
  is_required: boolean;
  display_order: number;
  placeholder_text: string | null;
  validation_rules: any;
  created_at: Date;
}

export interface QuestionOption {
  id: number;
  question_id: number;
  option_text: string;
  option_value: string | null;
  display_order: number;
}

export interface Response {
  id: number;
  survey_id: number;
  respondent_email: string | null;
  respondent_name: string | null;
  submitted_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  metadata: any;
}

export interface Answer {
  id: number;
  response_id: number;
  question_id: number;
  answer_text: string | null;
  answer_value: string | null;
  created_at: Date;
}

interface RespondentInfo {
  email?: string;
  name?: string;
  participantId?: string;
  participantKey?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface SurveyCombination {
  convention: string;
  gm: string;
  adventure: string;
}

interface CoreQuestionIds {
  conventionQuestionId: number;
  gmQuestionId: number;
  adventureQuestionId: number;
}

function normalizeMetadataValue(value: unknown, maxLength = 255) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (normalized.length === 0) return null;
  return normalized.slice(0, maxLength);
}

function getAnswerDisplayValue(answer: NormalizedAnswer) {
  return (answer.answer_value ?? answer.answer_text ?? '').trim();
}

function findAnswerDisplayValue(answers: NormalizedAnswer[], questionId: number) {
  const answer = answers.find((candidate) => candidate.question_id === questionId);
  return answer ? getAnswerDisplayValue(answer) : '';
}

function createDuplicateCombinationError(existingResponseId: number) {
  const error = new Error('Thanks for playing! You’ve already completed the survey for this convention, GM, and adventure. We’d love to hear from you again—please sign up for another game and share feedback after that session.') as Error & {
    status?: number;
    details?: string[];
    existingResponseId?: number;
  };
  error.status = 409;
  error.details = ['Duplicate convention, GM, and adventure combination for this participant'];
  error.existingResponseId = existingResponseId;
  return error;
}

async function getCoreQuestionIds(client: PoolClient, surveyId: number): Promise<CoreQuestionIds | null> {
  const result = await client.query(
    `SELECT id, display_order
       FROM questions
      WHERE survey_id = $1
        AND display_order IN (1, 2, 3)`,
    [surveyId]
  );

  const idsByOrder = new Map<number, number>();
  for (const row of result.rows) {
    idsByOrder.set(Number(row.display_order), Number(row.id));
  }

  const conventionQuestionId = idsByOrder.get(1);
  const gmQuestionId = idsByOrder.get(2);
  const adventureQuestionId = idsByOrder.get(3);

  if (!conventionQuestionId || !gmQuestionId || !adventureQuestionId) {
    return null;
  }

  return { conventionQuestionId, gmQuestionId, adventureQuestionId };
}

async function getSurveyCombination(
  client: PoolClient,
  surveyId: number,
  answers: NormalizedAnswer[]
): Promise<(SurveyCombination & { questionIds: CoreQuestionIds }) | null> {
  const questionIds = await getCoreQuestionIds(client, surveyId);
  if (!questionIds) return null;

  const convention = findAnswerDisplayValue(answers, questionIds.conventionQuestionId);
  const gm = findAnswerDisplayValue(answers, questionIds.gmQuestionId);
  const adventure = findAnswerDisplayValue(answers, questionIds.adventureQuestionId);

  if (!convention || !gm || !adventure) {
    return null;
  }

  return { convention, gm, adventure, questionIds };
}

async function findDuplicateCombination(
  client: PoolClient,
  surveyId: number,
  participantId: string | null,
  _participantKey: string | null,
  combination: SurveyCombination & { questionIds: CoreQuestionIds }
) {
  if (!participantId) return null;

  const result = await client.query(
    `SELECT r.id
       FROM responses r
       JOIN answers convention_answer
         ON convention_answer.response_id = r.id
        AND convention_answer.question_id = $3
       JOIN answers gm_answer
         ON gm_answer.response_id = r.id
        AND gm_answer.question_id = $4
       JOIN answers adventure_answer
         ON adventure_answer.response_id = r.id
        AND adventure_answer.question_id = $5
      WHERE r.survey_id = $1
        AND r.metadata->>'participant_id' = $2
        AND TRIM(COALESCE(NULLIF(convention_answer.answer_value, ''), convention_answer.answer_text, '')) = $6
        AND TRIM(COALESCE(NULLIF(gm_answer.answer_value, ''), gm_answer.answer_text, '')) = $7
        AND TRIM(COALESCE(NULLIF(adventure_answer.answer_value, ''), adventure_answer.answer_text, '')) = $8
      LIMIT 1`,
    [
      surveyId,
      participantId,
      combination.questionIds.conventionQuestionId,
      combination.questionIds.gmQuestionId,
      combination.questionIds.adventureQuestionId,
      combination.convention,
      combination.gm,
      combination.adventure,
    ]
  );

  return result.rows[0]?.id ? Number(result.rows[0].id) : null;
}

export async function getSurvey(id: number): Promise<Survey | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM surveys WHERE id = $1', [id]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getSurveyWithQuestions(id: number) {
  const client = await pool.connect();
  try {
    const surveyResult = await client.query('SELECT * FROM surveys WHERE id = $1', [id]);
    const survey = surveyResult.rows[0];
    
    if (!survey) return null;

    const questionsResult = await client.query(
      'SELECT * FROM questions WHERE survey_id = $1 ORDER BY display_order',
      [id]
    );
    
    const questions = questionsResult.rows;
    
    // Get options for each question
    for (const question of questions) {
      if (['multiple_choice', 'single_choice', 'dropdown'].includes(question.question_type)) {
        const optionsResult = await client.query(
          'SELECT * FROM question_options WHERE question_id = $1 ORDER BY display_order',
          [question.id]
        );
        question.options = optionsResult.rows;
      }
    }
    
    return { ...survey, questions };
  } finally {
    client.release();
  }
}

export async function createResponse(
  surveyId: number,
  answers: IncomingAnswer[],
  respondentInfo?: RespondentInfo
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const validation = await validateAnswersForSurvey(client, surveyId, answers);
    if (!validation.ok) {
      const error = new Error(validation.error) as Error & { status?: number; details?: string[] };
      error.status = validation.status;
      error.details = validation.details;
      throw error;
    }

    const participantId = normalizeMetadataValue(respondentInfo?.participantId, 128);
    const participantKey = normalizeMetadataValue(respondentInfo?.participantKey, 128);
    const ipAddress = normalizeMetadataValue(respondentInfo?.ipAddress, 128);
    const userAgent = normalizeMetadataValue(respondentInfo?.userAgent, 512);
    const surveyCombination = await getSurveyCombination(client, surveyId, validation.answers);

    if (surveyCombination) {
      const existingResponseId = await findDuplicateCombination(
        client,
        surveyId,
        participantId,
        participantKey,
        surveyCombination
      );

      if (existingResponseId) {
        throw createDuplicateCombinationError(existingResponseId);
      }
    }

    const metadata = {
      participant_id: participantId,
      // Kept for abuse forensics only. It must not block submissions because many convention players can share the same network/browser fingerprint.
      participant_key: participantKey,
      survey_combo: surveyCombination ? {
        convention: surveyCombination.convention,
        gm: surveyCombination.gm,
        adventure: surveyCombination.adventure,
      } : null,
    };
    
    const responseResult = await client.query(
      `INSERT INTO responses (survey_id, respondent_email, respondent_name, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        surveyId,
        respondentInfo?.email || null,
        respondentInfo?.name || null,
        ipAddress,
        userAgent,
        JSON.stringify(metadata),
      ]
    );
    
    const responseId = responseResult.rows[0].id;
    
    for (const answer of validation.answers) {
      await client.query(
        'INSERT INTO answers (response_id, question_id, answer_text, answer_value) VALUES ($1, $2, $3, $4)',
        [responseId, answer.question_id, answer.answer_text, answer.answer_value]
      );
    }
    
    await client.query('COMMIT');
    return responseId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
