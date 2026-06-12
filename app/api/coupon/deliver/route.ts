import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyResponseToken } from '@/lib/responseTokens';
import { isValidEmail, normalizeOptionalText } from '@/lib/surveyValidation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { responseId, responseToken, couponCode, emailAddress } = body;
    const numericResponseId = Number(responseId);
    const normalizedCouponCode = normalizeOptionalText(couponCode);
    const normalizedEmail = normalizeOptionalText(emailAddress);
    
    if (!Number.isInteger(numericResponseId) || numericResponseId <= 0 || !normalizedCouponCode) {
      return NextResponse.json({ error: 'responseId and couponCode are required' }, { status: 400 });
    }

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

    const existing = await pool.query(
      'SELECT * FROM coupon_deliveries WHERE response_id = $1',
      [numericResponseId]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE coupon_deliveries 
         SET coupon_code = COALESCE($2, coupon_code),
             email_address = COALESCE($3, email_address),
             delivered_at = CURRENT_TIMESTAMP
         WHERE response_id = $1
         RETURNING *`,
        [numericResponseId, normalizedCouponCode, normalizedEmail]
      );
    } else {
      result = await pool.query(
        `INSERT INTO coupon_deliveries (response_id, coupon_code, email_address)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [numericResponseId, normalizedCouponCode, normalizedEmail]
      );
    }

    return NextResponse.json({ success: true, delivery: result.rows[0] });
  } catch (error: any) {
    console.error('Error recording coupon delivery:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
