import { Pool } from 'pg';

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

export async function createResponse(surveyId: number, answers: Array<{question_id: number, answer_text?: string, answer_value?: string}>, respondentInfo?: {email?: string, name?: string}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const responseResult = await client.query(
      'INSERT INTO responses (survey_id, respondent_email, respondent_name) VALUES ($1, $2, $3) RETURNING id',
      [surveyId, respondentInfo?.email || null, respondentInfo?.name || null]
    );
    
    const responseId = responseResult.rows[0].id;
    
    for (const answer of answers) {
      await client.query(
        'INSERT INTO answers (response_id, question_id, answer_text, answer_value) VALUES ($1, $2, $3, $4)',
        [responseId, answer.question_id, answer.answer_text || null, answer.answer_value || null]
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

