import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    // Get GM question IDs (display_order 8, 9, 10)
    const gmQuestionsResult = await pool.query(
      `SELECT id 
       FROM questions 
       WHERE survey_id = 1 AND display_order IN (8, 9, 10)`
    );

    if (gmQuestionsResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'GM questions not found'
      }, { status: 400 });
    }

    const gmQuestionIds = gmQuestionsResult.rows.map((row: any) => row.id);

    // Count answers before deletion
    const countBefore = await pool.query(
      `SELECT COUNT(*) as count FROM answers WHERE question_id = ANY($1::int[])`,
      [gmQuestionIds]
    );
    const beforeCount = parseInt(countBefore.rows[0].count);

    // Delete answers for GM questions
    const deleteResult = await pool.query(
      `DELETE FROM answers WHERE question_id = ANY($1::int[])`,
      [gmQuestionIds]
    );

    return NextResponse.json({
      success: true,
      deleted: deleteResult.rowCount || 0,
      beforeCount,
      gmQuestionIds
    });
  } catch (error: any) {
    console.error('Error removing GM answers:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}

