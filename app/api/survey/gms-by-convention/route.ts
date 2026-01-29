import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Ensure tables exist (same function as in gm-adventures route)
async function ensureTablesExist() {
  const client = await pool.connect();
  try {
    const conventionsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gm_conventions'
      )
    `);

    if (!conventionsTableExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE gm_conventions (
          id SERIAL PRIMARY KEY,
          gm_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
          convention_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(gm_option_id, convention_option_id)
        )
      `);
      await client.query(`CREATE INDEX idx_gm_conventions_gm_option_id ON gm_conventions(gm_option_id)`);
      await client.query(`CREATE INDEX idx_gm_conventions_convention_option_id ON gm_conventions(convention_option_id)`);
    }
  } finally {
    client.release();
  }
}

// GET - Get GMs for a specific convention (by convention option value/name or option ID)
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(request.url);
    const conventionName = searchParams.get('convention_name');
    const conventionOptionId = searchParams.get('convention_option_id');
    const conventionValue = searchParams.get('convention_value');

    if (!conventionName && !conventionOptionId && !conventionValue) {
      return NextResponse.json({ error: 'Convention name, option ID, or value is required' }, { status: 400 });
    }

    let conventionOptionIdValue: number | null = null;

    if (conventionOptionId) {
      conventionOptionIdValue = parseInt(conventionOptionId);
    } else {
      // Find convention option by name or value
      let query = `
        SELECT qo.id 
        FROM question_options qo
        JOIN questions q ON qo.question_id = q.id
        WHERE q.question_text = 'What convention are you attending?'
      `;
      const params: any[] = [];

      if (conventionValue) {
        query += ` AND (LOWER(qo.option_value) = LOWER($1) OR LOWER(qo.option_text) = LOWER($1))`;
        params.push(conventionValue);
      } else if (conventionName) {
        query += ` AND (LOWER(qo.option_text) = LOWER($1) OR LOWER(qo.option_value) = LOWER($1))`;
        params.push(conventionName);
      }

      query += ` LIMIT 1`;

      const conventionResult = await client.query(query, params);

      if (conventionResult.rows.length === 0) {
        // If convention not found, return all GMs (fallback)
        const allGMsResult = await client.query(`
          SELECT qo.id, qo.option_text, qo.option_value
          FROM question_options qo
          JOIN questions q ON qo.question_id = q.id
          WHERE (q.question_text ILIKE '%GM%' OR q.question_text ILIKE '%game master%')
            AND qo.question_id = (SELECT id FROM questions WHERE question_text ILIKE '%GM%' OR question_text ILIKE '%game master%' LIMIT 1)
          ORDER BY qo.display_order
        `);
        return NextResponse.json({ gms: allGMsResult.rows });
      }

      conventionOptionIdValue = conventionResult.rows[0].id;
    }

    // Get GMs associated with this convention
    const gmsResult = await client.query(`
      SELECT qo.id, qo.option_text, qo.option_value
      FROM gm_conventions gc
      JOIN question_options qo ON gc.gm_option_id = qo.id
      WHERE gc.convention_option_id = $1
      ORDER BY qo.display_order
    `, [conventionOptionIdValue]);

    // If no associations found, return all GMs (fallback)
    if (gmsResult.rows.length === 0) {
      const allGMsResult = await client.query(`
        SELECT qo.id, qo.option_text, qo.option_value
        FROM question_options qo
        JOIN questions q ON qo.question_id = q.id
        WHERE (q.question_text ILIKE '%GM%' OR q.question_text ILIKE '%game master%')
          AND qo.question_id = (SELECT id FROM questions WHERE question_text ILIKE '%GM%' OR question_text ILIKE '%game master%' LIMIT 1)
        ORDER BY qo.display_order
      `);
      return NextResponse.json({ gms: allGMsResult.rows });
    }

    return NextResponse.json({ gms: gmsResult.rows });
  } catch (error: any) {
    console.error('Error fetching GMs by convention:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}
