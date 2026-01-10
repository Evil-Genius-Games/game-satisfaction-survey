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

export async function getSurveyWithQuestions(id: number, selectedGMId?: string | null, preSelectedConvention?: string | null) {
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
        // Check if this is a GM question
        const isGMQuestion = question.question_text?.toLowerCase().includes('gm') || 
                            question.question_text?.toLowerCase().includes('game master') ||
                            question.question_text?.toLowerCase().includes('who was your');
        
        // Check if this is a convention question
        const isConventionQuestion = question.question_text === 'What convention are you attending?';
        
        // Check if this is an adventure question
        const isAdventureQuestion = question.question_text?.toLowerCase().includes('adventure') ||
                                   question.question_text === 'What adventure did you play?';
        
        // Handle GM question - filter by convention if pre-selected, otherwise show all
        if (isGMQuestion) {
          if (preSelectedConvention) {
            // Filter GMs by pre-selected convention
            const gmResult = await client.query(
              `SELECT DISTINCT
                gi.id,
                gi.first_name,
                gi.last_name,
                gi.email,
                CONCAT(gi.first_name, ' ', gi.last_name) as option_text,
                gi.id::text as option_value
              FROM gm_interest gi
              JOIN gm_conventions gc ON gi.id = gc.gm_interest_id
              WHERE gc.convention = $1
              ORDER BY gi.last_name ASC, gi.first_name ASC`,
              [preSelectedConvention]
            );
            
            question.options = gmResult.rows.map((row: any) => ({
              id: row.id,
              question_id: question.id,
              option_text: row.option_text || `${row.first_name} ${row.last_name}`,
              option_value: row.option_value,
              display_order: row.id
            }));
          } else {
            // Show all GMs
            const gmResult = await client.query(
              `SELECT 
                gi.id,
                gi.first_name,
                gi.last_name,
                gi.email,
                CONCAT(gi.first_name, ' ', gi.last_name) as option_text,
                gi.id::text as option_value
              FROM gm_interest gi
              ORDER BY gi.last_name ASC, gi.first_name ASC`
            );
            
            question.options = gmResult.rows.map((row: any) => ({
              id: row.id,
              question_id: question.id,
              option_text: row.option_text || `${row.first_name} ${row.last_name}`,
              option_value: row.option_value,
              display_order: row.id
            }));
          }
        }
        // If a GM is selected, filter both convention and adventure options by that GM
        else if (selectedGMId) {
          if (isConventionQuestion) {
            // Fetch conventions filtered by selected GM
            const conventionResult = await client.query(
              `SELECT DISTINCT gc.convention
              FROM gm_conventions gc
              WHERE gc.gm_interest_id = $1
              ORDER BY gc.convention ASC`,
              [selectedGMId]
            );
            
            // Get the original convention options from question_options to get their IDs and structure
            const originalOptionsResult = await client.query(
              'SELECT * FROM question_options WHERE question_id = $1 ORDER BY display_order',
              [question.id]
            );
            
            // Filter original options to only include conventions associated with the selected GM
            const gmConventions = conventionResult.rows.map((row: any) => row.convention);
            question.options = originalOptionsResult.rows.filter((opt: any) => 
              gmConventions.includes(opt.option_text) || gmConventions.includes(opt.option_value)
            );
            
            // Sort by convention name
            question.options.sort((a: any, b: any) => {
              const aText = a.option_text || a.option_value || '';
              const bText = b.option_text || b.option_value || '';
              return aText.toLowerCase().localeCompare(bText.toLowerCase());
            });
          } else if (isAdventureQuestion) {
            // Fetch adventures filtered by selected GM
            // First check if table exists
            const tableCheck = await client.query(
              `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'gm_adventures'
              )`
            );
            
            if (tableCheck.rows[0]?.exists) {
              const adventureResult = await client.query(
                `SELECT DISTINCT ga.adventure
                FROM gm_adventures ga
                WHERE ga.gm_interest_id = $1
                ORDER BY ga.adventure ASC`,
                [selectedGMId]
              );
              
              // Get the original adventure options from question_options to get their IDs and structure
              const originalOptionsResult = await client.query(
                'SELECT * FROM question_options WHERE question_id = $1 ORDER BY display_order',
                [question.id]
              );
              
              // Filter original options to only include adventures associated with the selected GM
              const gmAdventures = adventureResult.rows.map((row: any) => row.adventure);
              question.options = originalOptionsResult.rows.filter((opt: any) => 
                gmAdventures.includes(opt.option_text) || gmAdventures.includes(opt.option_value)
              );
              
              // Sort by adventure name
              question.options.sort((a: any, b: any) => {
                const aText = a.option_text || a.option_value || '';
                const bText = b.option_text || b.option_value || '';
                return aText.toLowerCase().localeCompare(bText.toLowerCase());
              });
            } else {
              // Table doesn't exist, use regular options
              const optionsResult = await client.query(
                'SELECT * FROM question_options WHERE question_id = $1 ORDER BY display_order',
                [question.id]
              );
              question.options = optionsResult.rows;
            }
          } else {
            // Regular question options
            const optionsResult = await client.query(
              'SELECT * FROM question_options WHERE question_id = $1 ORDER BY display_order',
              [question.id]
            );
            question.options = optionsResult.rows;
          }
        } else {
          // No GM selected yet - show all regular options
          const optionsResult = await client.query(
            'SELECT * FROM question_options WHERE question_id = $1 ORDER BY display_order',
            [question.id]
          );
          question.options = optionsResult.rows;
        }
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

