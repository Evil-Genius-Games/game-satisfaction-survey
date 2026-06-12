import { NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureTablesExist() {
  const requiredColumns: Record<string, string[]> = {
    gm_conventions: ['id', 'gm_option_id', 'convention_option_id', 'created_at'],
    gm_adventures: ['id', 'gm_option_id', 'convention_option_id', 'adventure_option_id', 'created_at'],
  };

  const { rows } = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [Object.keys(requiredColumns)]
  );

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!columnsByTable.has(row.table_name)) {
      columnsByTable.set(row.table_name, new Set<string>());
    }
    columnsByTable.get(row.table_name)!.add(row.column_name);
  }

  const missing = Object.entries(requiredColumns).flatMap(([table, columns]) => {
    const present = columnsByTable.get(table);
    if (!present) return [`${table} table`];
    return columns.filter(column => !present.has(column)).map(column => `${table}.${column}`);
  });

  if (missing.length > 0) {
    throw new Error(`Database schema is incomplete. Run migrations/20260606_harden_schema.sql before using GM adventure administration. Missing: ${missing.join(', ')}`);
  }
}

// GET - Get all GMs with their associated adventures
export async function GET() {
  const client = await pool.connect();
  try {
    await ensureTablesExist();

    // Find the GM question (Who was your GM?)
    const gmQuestionResult = await client.query(`
      SELECT id, question_text
      FROM questions
      WHERE question_text ILIKE '%GM%' OR question_text ILIKE '%game master%'
      ORDER BY id
      LIMIT 1
    `);

    if (gmQuestionResult.rows.length === 0) {
      return NextResponse.json({
        error: 'GM question not found',
        message: 'Please create a question with "GM" or "Game Master" in the text'
      }, { status: 404 });
    }

    const gmQuestion = gmQuestionResult.rows[0];

    // Get all GM options from the GM question
    const gmsResult = await client.query(`
      SELECT qo.id, qo.option_text, qo.option_value, qo.display_order
      FROM question_options qo
      WHERE qo.question_id = $1
      ORDER BY qo.display_order
    `, [gmQuestion.id]);

    // Get all GM-Convention associations
    const conventionAssociationsResult = await client.query(`
      SELECT gc.gm_option_id, gc.convention_option_id, qo.option_text, qo.option_value
      FROM gm_conventions gc
      JOIN question_options qo ON gc.convention_option_id = qo.id
      JOIN questions q ON qo.question_id = q.id
      WHERE q.question_text = 'What convention are you attending?'
      ORDER BY qo.display_order
    `);

    // Get all GM-Adventure associations (now includes convention)
    const associationsResult = await client.query(`
      SELECT ga.gm_option_id, ga.convention_option_id, ga.adventure_option_id, 
             qo.option_text, qo.option_value,
             conv_qo.option_text as convention_text, conv_qo.option_value as convention_value
      FROM gm_adventures ga
      JOIN question_options qo ON ga.adventure_option_id = qo.id
      JOIN questions q ON qo.question_id = q.id
      JOIN question_options conv_qo ON ga.convention_option_id = conv_qo.id
      WHERE q.question_text = 'What adventure did you play?'
      ORDER BY qo.display_order
    `);

    // Get all available conventions
    const conventionsResult = await client.query(`
      SELECT qo.id, qo.option_text, qo.option_value
      FROM question_options qo
      JOIN questions q ON qo.question_id = q.id
      WHERE q.question_text = 'What convention are you attending?'
      ORDER BY qo.display_order
    `);

    // Get all available adventures
    const adventuresResult = await client.query(`
      SELECT qo.id, qo.option_text, qo.option_value
      FROM question_options qo
      JOIN questions q ON qo.question_id = q.id
      WHERE q.question_text = 'What adventure did you play?'
      ORDER BY qo.display_order
    `);

    // Group convention associations by GM option ID
    const conventionAssociationsByGM = new Map<number, any[]>();
    conventionAssociationsResult.rows.forEach((row: any) => {
      if (!conventionAssociationsByGM.has(row.gm_option_id)) {
        conventionAssociationsByGM.set(row.gm_option_id, []);
      }
      conventionAssociationsByGM.get(row.gm_option_id)!.push({
        id: row.convention_option_id,
        option_text: row.option_text,
        option_value: row.option_value
      });
    });

    // Group adventure associations by GM option ID and Convention option ID
    // Structure: Map<gm_id, Map<convention_id, adventures[]>>
    const associationsByGMAndConvention = new Map<number, Map<number, any[]>>();
    associationsResult.rows.forEach((row: any) => {
      if (!associationsByGMAndConvention.has(row.gm_option_id)) {
        associationsByGMAndConvention.set(row.gm_option_id, new Map());
      }
      const conventionMap = associationsByGMAndConvention.get(row.gm_option_id)!;
      if (!conventionMap.has(row.convention_option_id)) {
        conventionMap.set(row.convention_option_id, []);
      }
      conventionMap.get(row.convention_option_id)!.push({
        id: row.adventure_option_id,
        option_text: row.option_text,
        option_value: row.option_value,
        convention_id: row.convention_option_id,
        convention_text: row.convention_text,
        convention_value: row.convention_value
      });
    });

    // Combine GMs with their conventions and adventures (grouped by convention)
    const gms = gmsResult.rows.map((gm: any) => {
      const conventions = conventionAssociationsByGM.get(gm.id) || [];
      const adventuresByConvention = associationsByGMAndConvention.get(gm.id) || new Map();
      
      // Build adventures structure: { convention_id: { id, text, adventures: [...] } }
      const adventuresByConv: Record<number, { convention: any; adventures: any[] }> = {};
      conventions.forEach((conv: any) => {
        adventuresByConv[conv.id] = {
          convention: conv,
          adventures: adventuresByConvention.get(conv.id) || []
        };
      });
      
      return {
        id: gm.id,
        option_text: gm.option_text,
        option_value: gm.option_value,
        display_order: gm.display_order,
        conventions: conventions,
        adventuresByConvention: adventuresByConv
      };
    });

    return NextResponse.json({
      gms,
      availableConventions: conventionsResult.rows,
      availableAdventures: adventuresResult.rows,
      gmQuestion: {
        id: gmQuestion.id,
        question_text: gmQuestion.question_text
      }
    });
  } catch (error: any) {
    console.error('Error fetching GM adventures:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST - Associate convention or adventure with GM
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    await ensureTablesExist();
    const body = await request.json();

    if (body.action === 'associate_convention') {
      // Associate a convention with a GM (using GM option ID)
      const { gm_option_id, convention_option_id } = body;
      if (!gm_option_id || !convention_option_id) {
        return NextResponse.json({ error: 'GM option ID and convention option ID are required' }, { status: 400 });
      }

      const result = await client.query(
        'INSERT INTO gm_conventions (gm_option_id, convention_option_id) VALUES ($1, $2) ON CONFLICT (gm_option_id, convention_option_id) DO NOTHING RETURNING *',
        [gm_option_id, convention_option_id]
      );

      return NextResponse.json({ success: true, association: result.rows[0] || { message: 'Association already exists' } });
    } else if (body.action === 'associate_adventure') {
      // Associate an adventure with a GM and Convention (three-way relationship)
      const { gm_option_id, convention_option_id, adventure_option_id } = body;
      if (!gm_option_id || !convention_option_id || !adventure_option_id) {
        return NextResponse.json({ error: 'GM option ID, convention option ID, and adventure option ID are required' }, { status: 400 });
      }

      const result = await client.query(
        'INSERT INTO gm_adventures (gm_option_id, convention_option_id, adventure_option_id) VALUES ($1, $2, $3) ON CONFLICT (gm_option_id, convention_option_id, adventure_option_id) DO NOTHING RETURNING *',
        [gm_option_id, convention_option_id, adventure_option_id]
      );

      return NextResponse.json({ success: true, association: result.rows[0] || { message: 'Association already exists' } });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in POST /api/admin/gm-adventures:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE - Remove association
export async function DELETE(request: Request) {
  const client = await pool.connect();
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'convention' or 'adventure'
    const gmOptionId = searchParams.get('gm_option_id');
    const conventionOptionId = searchParams.get('convention_option_id');
    const adventureOptionId = searchParams.get('adventure_option_id');
    const associationId = searchParams.get('association_id');

    if (type === 'convention') {
      if (associationId) {
        // Get the gm_option_id and convention_option_id before deleting to cascade delete adventures
        const conventionResult = await client.query(
          'SELECT gm_option_id, convention_option_id FROM gm_conventions WHERE id = $1',
          [associationId]
        );
        const row = conventionResult.rows[0];
        const gmOptionIdToDelete = row?.gm_option_id;
        const conventionOptionIdToDelete = row?.convention_option_id;
        
        // Delete the convention association
        await client.query('DELETE FROM gm_conventions WHERE id = $1', [associationId]);
        
        // Cascade delete all adventure associations for this GM-convention pair
        if (conventionOptionIdToDelete && gmOptionIdToDelete) {
          await client.query(
            'DELETE FROM gm_adventures WHERE gm_option_id = $1 AND convention_option_id = $2',
            [gmOptionIdToDelete, conventionOptionIdToDelete]
          );
        }
        
        return NextResponse.json({ success: true, message: 'Convention association and related adventures removed' });
      } else if (gmOptionId && conventionOptionId) {
        // Delete the convention association
        await client.query(
          'DELETE FROM gm_conventions WHERE gm_option_id = $1 AND convention_option_id = $2',
          [gmOptionId, conventionOptionId]
        );
        
        // Cascade delete all adventure associations for this GM-convention pair
        await client.query(
          'DELETE FROM gm_adventures WHERE gm_option_id = $1 AND convention_option_id = $2',
          [gmOptionId, conventionOptionId]
        );
        
        return NextResponse.json({ success: true, message: 'Convention association and related adventures removed' });
      }
    } else if (type === 'adventure') {
      const conventionOptionId = searchParams.get('convention_option_id');
      if (associationId) {
        await client.query('DELETE FROM gm_adventures WHERE id = $1', [associationId]);
        return NextResponse.json({ success: true, message: 'Adventure association removed' });
      } else if (gmOptionId && conventionOptionId && adventureOptionId) {
        // Delete specific GM-Convention-Adventure association
        await client.query(
          'DELETE FROM gm_adventures WHERE gm_option_id = $1 AND convention_option_id = $2 AND adventure_option_id = $3',
          [gmOptionId, conventionOptionId, adventureOptionId]
        );
        return NextResponse.json({ success: true, message: 'Adventure association removed' });
      } else if (gmOptionId && adventureOptionId) {
        // Backward compatibility: delete all associations for this GM-Adventure pair
        await client.query(
          'DELETE FROM gm_adventures WHERE gm_option_id = $1 AND adventure_option_id = $2',
          [gmOptionId, adventureOptionId]
        );
        return NextResponse.json({ success: true, message: 'Adventure association removed' });
      }
    } else {
      // Backward compatibility - assume adventure if type not specified
      if (associationId) {
        await client.query('DELETE FROM gm_adventures WHERE id = $1', [associationId]);
        return NextResponse.json({ success: true, message: 'Association removed' });
      } else if (gmOptionId && adventureOptionId) {
        await client.query(
          'DELETE FROM gm_adventures WHERE gm_option_id = $1 AND adventure_option_id = $2',
          [gmOptionId, adventureOptionId]
        );
        return NextResponse.json({ success: true, message: 'Association removed' });
      }
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/gm-adventures:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}
