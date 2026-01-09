import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { responseId, firstName, lastName, email } = body;
    
    if (!responseId) {
      return NextResponse.json({ error: 'responseId is required' }, { status: 400 });
    }

    // Insert or update GM interest record
    const result = await pool.query(
      `INSERT INTO gm_interest (response_id, first_name, last_name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (response_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email
       RETURNING *`,
      [responseId, firstName || null, lastName || null, email || null]
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

