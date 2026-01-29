import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Get adventures for a specific GM and Convention (three-way relationship)
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const gmName = searchParams.get('gm_name');
    const gmOptionId = searchParams.get('gm_option_id');
    const conventionOptionId = searchParams.get('convention_option_id');
    const conventionValue = searchParams.get('convention_value');

    if (!gmName && !gmOptionId) {
      return NextResponse.json({ error: 'GM name or option ID is required' }, { status: 400 });
    }

    if (!conventionOptionId && !conventionValue) {
      return NextResponse.json({ error: 'Convention option ID or value is required' }, { status: 400 });
    }

    let gmOptionIdValue: number | null = null;
    let conventionOptionIdValue: number | null = null;

    if (gmOptionId) {
      gmOptionIdValue = parseInt(gmOptionId);
    } else if (gmName) {
      // Find GM option by name (check option_text or option_value)
      const gmResult = await client.query(
        `SELECT qo.id 
         FROM question_options qo
         JOIN questions q ON qo.question_id = q.id
         WHERE (q.question_text ILIKE '%GM%' OR q.question_text ILIKE '%game master%')
           AND (LOWER(qo.option_text) = LOWER($1) OR LOWER(qo.option_value) = LOWER($1))
         LIMIT 1`,
        [gmName]
      );

      if (gmResult.rows.length === 0) {
        return NextResponse.json({ adventures: [] });
      }

      gmOptionIdValue = gmResult.rows[0].id;
    }

    if (conventionOptionId) {
      conventionOptionIdValue = parseInt(conventionOptionId);
    } else if (conventionValue) {
      // Find convention option by value
      const conventionResult = await client.query(
        `SELECT qo.id 
         FROM question_options qo
         JOIN questions q ON qo.question_id = q.id
         WHERE q.question_text = 'What convention are you attending?'
           AND (LOWER(qo.option_value) = LOWER($1) OR LOWER(qo.option_text) = LOWER($1))
         LIMIT 1`,
        [conventionValue]
      );

      if (conventionResult.rows.length === 0) {
        return NextResponse.json({ adventures: [] });
      }

      conventionOptionIdValue = conventionResult.rows[0].id;
    }

    // Get adventures associated with this GM option AND convention option
    const adventuresResult = await client.query(`
      SELECT qo.id, qo.option_text, qo.option_value
      FROM gm_adventures ga
      JOIN question_options qo ON ga.adventure_option_id = qo.id
      WHERE ga.gm_option_id = $1 AND ga.convention_option_id = $2
      ORDER BY qo.display_order
    `, [gmOptionIdValue, conventionOptionIdValue]);

    // If no associations found, return all adventures (fallback)
    if (adventuresResult.rows.length === 0) {
      const allAdventuresResult = await client.query(`
        SELECT qo.id, qo.option_text, qo.option_value
        FROM question_options qo
        JOIN questions q ON qo.question_id = q.id
        WHERE q.question_text = 'What adventure did you play?'
        ORDER BY qo.display_order
      `);
      return NextResponse.json({ adventures: allAdventuresResult.rows });
    }

    return NextResponse.json({ adventures: adventuresResult.rows });
  } catch (error: any) {
    console.error('Error fetching adventures by GM and Convention:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}
