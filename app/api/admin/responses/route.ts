import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    const responsesResult = await client.query(
      `SELECT r.*, 
        json_agg(
          json_build_object(
            'question_text', q.question_text,
            'question_id', q.id,
            'display_order', q.display_order,
            'answer_text', a.answer_text,
            'answer_value', a.answer_value
          ) ORDER BY q.display_order
        ) FILTER (WHERE a.id IS NOT NULL) as answers
      FROM responses r
      LEFT JOIN answers a ON r.id = a.response_id
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE r.survey_id = 1
      GROUP BY r.id
      ORDER BY r.submitted_at DESC
      LIMIT 1000`
    );
    
    return NextResponse.json(responsesResult.rows);
  } catch (error: any) {
    console.error('Error fetching responses:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

