import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    // Get GM question IDs
    const gmQuestionsResult = await pool.query(
      `SELECT id, question_text, display_order 
       FROM questions 
       WHERE survey_id = 1 AND display_order IN (8, 9, 10)
       ORDER BY display_order`
    );

    if (gmQuestionsResult.rows.length !== 3) {
      return NextResponse.json({ 
        error: 'GM questions not found',
        message: 'Expected 3 GM questions (display_order 8, 9, 10)'
      }, { status: 400 });
    }

    const firstNameQuestion = gmQuestionsResult.rows.find((q: any) => q.display_order === 8);
    const lastNameQuestion = gmQuestionsResult.rows.find((q: any) => q.display_order === 9);
    const emailQuestion = gmQuestionsResult.rows.find((q: any) => q.display_order === 10);

    if (!firstNameQuestion || !lastNameQuestion || !emailQuestion) {
      return NextResponse.json({ 
        error: 'GM questions not found',
        message: 'Could not find all GM questions'
      }, { status: 400 });
    }

    // Get all responses that have GM question answers
    const responsesWithGMData = await pool.query(
      `SELECT DISTINCT r.id as response_id
       FROM responses r
       JOIN answers a ON r.id = a.response_id
       WHERE a.question_id IN ($1, $2, $3)
       ORDER BY r.id`,
      [firstNameQuestion.id, lastNameQuestion.id, emailQuestion.id]
    );

    let processed = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    // Process each response
    for (const row of responsesWithGMData.rows) {
      const responseId = row.response_id;

      try {
        // Get GM answers for this response
        const gmAnswersResult = await pool.query(
          `SELECT a.question_id, a.answer_text, a.answer_value
           FROM answers a
           WHERE a.response_id = $1 
             AND a.question_id IN ($2, $3, $4)`,
          [responseId, firstNameQuestion.id, lastNameQuestion.id, emailQuestion.id]
        );

        let firstName = null;
        let lastName = null;
        let email = null;

        // Extract answers
        for (const answer of gmAnswersResult.rows) {
          const value = answer.answer_text || answer.answer_value;
          if (answer.question_id === firstNameQuestion.id) {
            firstName = value;
          } else if (answer.question_id === lastNameQuestion.id) {
            lastName = value;
          } else if (answer.question_id === emailQuestion.id) {
            email = value;
          }
        }

        // Only insert if we have at least one value
        if (firstName || lastName || email) {
          // Check if record already exists
          const existing = await pool.query(
            'SELECT id FROM gm_interest WHERE response_id = $1',
            [responseId]
          );

          if (existing.rows.length === 0) {
            // Insert new record
            await pool.query(
              `INSERT INTO gm_interest (response_id, first_name, last_name, email)
               VALUES ($1, $2, $3, $4)`,
              [responseId, firstName, lastName, email]
            );
            processed++;
          } else {
            // Update existing record
            await pool.query(
              `UPDATE gm_interest 
               SET first_name = COALESCE($2, first_name),
                   last_name = COALESCE($3, last_name),
                   email = COALESCE($4, email)
               WHERE response_id = $1`,
              [responseId, firstName, lastName, email]
            );
            processed++;
          }
        }
      } catch (error: any) {
        errors++;
        errorDetails.push({
          responseId,
          error: error.message
        });
        console.error(`Error processing response ${responseId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      errors,
      totalResponses: responsesWithGMData.rows.length,
      errorDetails: errors > 0 ? errorDetails : undefined
    });
  } catch (error: any) {
    console.error('Error reprocessing GM interest:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}

