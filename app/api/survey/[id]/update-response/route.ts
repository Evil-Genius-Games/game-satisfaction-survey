import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = parseInt(id);
    const body = await request.json();
    const { responseId, answers } = body;
    
    if (!responseId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'responseId and answers are required' }, { status: 400 });
    }
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Add remaining answers to existing response
      for (const answer of answers) {
        await client.query(
          'INSERT INTO answers (response_id, question_id, answer_text, answer_value) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [responseId, answer.question_id, answer.answer_text || null, answer.answer_value || null]
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

