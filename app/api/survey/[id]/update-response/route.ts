import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyResponseToken } from '@/lib/responseTokens';
import { validateAnswersForSurvey } from '@/lib/surveyValidation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = parseInt(id, 10);
    const body = await request.json();
    const { responseId, responseToken, answers } = body;
    const numericResponseId = Number(responseId);
    
    if (!Number.isInteger(numericResponseId) || numericResponseId <= 0 || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'responseId and answers are required' }, { status: 400 });
    }

    const tokenValidation = verifyResponseToken(responseToken, {
      responseId: numericResponseId,
      surveyId,
    });

    if (!tokenValidation.ok) {
      return NextResponse.json({ error: tokenValidation.error }, { status: 403 });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const responseResult = await client.query(
        'SELECT id FROM responses WHERE id = $1 AND survey_id = $2',
        [numericResponseId, surveyId]
      );

      if (responseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Response not found for this survey' }, { status: 404 });
      }

      const validation = await validateAnswersForSurvey(client, surveyId, answers);
      if (!validation.ok) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: validation.error, details: validation.details },
          { status: validation.status }
        );
      }

      const questionIds = validation.answers.map((answer) => answer.question_id);
      await client.query(
        'DELETE FROM answers WHERE response_id = $1 AND question_id = ANY($2::int[])',
        [numericResponseId, questionIds]
      );
      
      for (const answer of validation.answers) {
        await client.query(
          'INSERT INTO answers (response_id, question_id, answer_text, answer_value) VALUES ($1, $2, $3, $4)',
          [numericResponseId, answer.question_id, answer.answer_text, answer.answer_value]
        );
      }
      
      await client.query('COMMIT');
      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating response:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
