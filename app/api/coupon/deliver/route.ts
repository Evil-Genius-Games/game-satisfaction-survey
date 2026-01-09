import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { responseId, couponCode, emailAddress } = body;
    
    if (!responseId || !couponCode) {
      return NextResponse.json({ error: 'responseId and couponCode are required' }, { status: 400 });
    }

    // Check if delivery already exists
    const existing = await pool.query(
      'SELECT * FROM coupon_deliveries WHERE response_id = $1',
      [responseId]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing record
      result = await pool.query(
        `UPDATE coupon_deliveries 
         SET email_sent = COALESCE($3, email_sent), 
             email_address = COALESCE($4, email_address)
         WHERE response_id = $1
         RETURNING *`,
        [responseId, couponCode, emailAddress ? true : undefined, emailAddress || null]
      );
    } else {
      // Insert new record
      result = await pool.query(
        `INSERT INTO coupon_deliveries (response_id, coupon_code, email_sent, email_address)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [responseId, couponCode, !!emailAddress, emailAddress || null]
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

