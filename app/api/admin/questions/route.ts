import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    const questionsResult = await client.query(
      `SELECT q.*, 
        json_agg(
          json_build_object(
            'id', qo.id,
            'option_text', qo.option_text,
            'option_value', qo.option_value,
            'display_order', qo.display_order
          ) ORDER BY qo.display_order
        ) FILTER (WHERE qo.id IS NOT NULL) as options
      FROM questions q
      LEFT JOIN question_options qo ON q.id = qo.question_id
      WHERE q.survey_id = 1
      GROUP BY q.id
      ORDER BY q.display_order`
    );
    
    return NextResponse.json(questionsResult.rows);
  } catch (error: any) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

