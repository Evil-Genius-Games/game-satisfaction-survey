import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyResponseToken } from '@/lib/responseTokens';
import { isValidEmail, normalizeOptionalText } from '@/lib/surveyValidation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { responseId, responseToken, firstName, lastName, email } = body;
    const numericResponseId = Number(responseId);
    
    if (!Number.isInteger(numericResponseId) || numericResponseId <= 0) {
      return NextResponse.json({ error: 'responseId is required' }, { status: 400 });
    }

    const normalizedEmail = normalizeOptionalText(email);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }

    const responseResult = await pool.query(
      'SELECT id, survey_id FROM responses WHERE id = $1',
      [numericResponseId]
    );

    if (responseResult.rows.length === 0) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    const surveyId = Number(responseResult.rows[0].survey_id);
    const tokenValidation = verifyResponseToken(responseToken, {
      responseId: numericResponseId,
      surveyId,
    });

    if (!tokenValidation.ok) {
      return NextResponse.json({ error: tokenValidation.error }, { status: 403 });
    }

    const result = await pool.query(
      `INSERT INTO gm_interest (response_id, first_name, last_name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (response_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email
       RETURNING *`,
      [
        numericResponseId,
        normalizeOptionalText(firstName),
        normalizeOptionalText(lastName),
        normalizedEmail,
      ]
    );

    return NextResponse.json({ success: true, gmInterest: result.rows[0] });
  } catch (error: any) {
    console.error('Error submitting GM interest:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
