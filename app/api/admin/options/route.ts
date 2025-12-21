import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { questionId, option_text } = await request.json();
    
    if (!questionId || !option_text) {
      return NextResponse.json({ error: 'questionId and option_text are required' }, { status: 400 });
    }

    // Get the max display_order for this question
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM question_options WHERE question_id = $1',
      [questionId]
    );
    const nextOrder = (maxOrderResult.rows[0].max_order || 0) + 1;

    const result = await pool.query(
      'INSERT INTO question_options (question_id, option_text, option_value, display_order) VALUES ($1, $2, $3, $4) RETURNING *',
      [questionId, option_text, option_text.toLowerCase().replace(/\s+/g, '_'), nextOrder]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding option:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { optionId, option_text } = await request.json();
    
    if (!optionId || !option_text) {
      return NextResponse.json({ error: 'optionId and option_text are required' }, { status: 400 });
    }

    const result = await pool.query(
      'UPDATE question_options SET option_text = $1 WHERE id = $2 RETURNING *',
      [option_text, optionId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating option:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { optionId } = await request.json();
    
    if (!optionId) {
      return NextResponse.json({ error: 'optionId is required' }, { status: 400 });
    }

    await pool.query('DELETE FROM question_options WHERE id = $1', [optionId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting option:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

