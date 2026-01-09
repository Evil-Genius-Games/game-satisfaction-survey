import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT 
        COALESCE(a.answer_text, a.answer_value) as convention,
        a.answer_text,
        a.answer_value
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      WHERE q.question_text = 'What convention are you attending?'
        AND (a.answer_text IS NOT NULL OR a.answer_value IS NOT NULL)
      ORDER BY COALESCE(a.answer_text, a.answer_value)`
    );
    
    // Return both text and value, preferring text for display
    const conventions = result.rows
      .map((row: any) => row.answer_text || row.answer_value || row.convention)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
    
    return NextResponse.json(conventions);
  } catch (error: any) {
    console.error('Error fetching conventions:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

