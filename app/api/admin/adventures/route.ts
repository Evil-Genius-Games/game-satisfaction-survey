import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    // First, get adventures from question_options (available dropdown options)
    const optionsResult = await client.query(
      `SELECT DISTINCT 
        COALESCE(qo.option_text, qo.option_value) as adventure,
        qo.option_text,
        qo.option_value,
        LOWER(COALESCE(qo.option_text, qo.option_value)) as sort_key
      FROM question_options qo
      JOIN questions q ON qo.question_id = q.id
      WHERE q.question_text = 'What adventure did you play?'
        AND (qo.option_text IS NOT NULL OR qo.option_value IS NOT NULL)
      ORDER BY sort_key`
    );
    
    // Also get any adventures from answers that might not be in options yet
    const answersResult = await client.query(
      `SELECT DISTINCT 
        COALESCE(a.answer_text, a.answer_value) as adventure,
        a.answer_text,
        a.answer_value,
        LOWER(COALESCE(a.answer_text, a.answer_value)) as sort_key
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      WHERE q.question_text = 'What adventure did you play?'
        AND (a.answer_text IS NOT NULL OR a.answer_value IS NOT NULL)
      ORDER BY sort_key`
    );
    
    // Combine both sources, preferring option_text for display
    const optionAdventures = optionsResult.rows
      .map((row: any) => row.option_text || row.option_value)
      .filter(Boolean);
    
    const answerAdventures = answersResult.rows
      .map((row: any) => row.answer_text || row.answer_value || row.adventure)
      .filter(Boolean);
    
    // Merge and deduplicate, prioritizing options
    const allAdventures = [...new Set([...optionAdventures, ...answerAdventures])];
    
    // Sort alphabetically (case-insensitive)
    const sortedAdventures = allAdventures.sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    return NextResponse.json(sortedAdventures);
  } catch (error: any) {
    console.error('Error fetching adventures:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

