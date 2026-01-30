import { NextResponse } from 'next/server';
import pool from '@/lib/db';

<<<<<<< HEAD
// Initialize tables if they don't exist
async function ensureTablesExist() {
  const client = await pool.connect();
  try {
    // Check if gm_conventions table exists
    const conventionsTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gm_conventions'
      )
    `);

    if (!conventionsTableExists.rows[0].exists) {
      // Create gm_conventions table
      await client.query(`
        CREATE TABLE gm_conventions (
          id SERIAL PRIMARY KEY,
          gm_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
          convention_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(gm_option_id, convention_option_id)
        )
      `);

      await client.query(`
        CREATE INDEX idx_gm_conventions_gm_option_id ON gm_conventions(gm_option_id)
      `);
      await client.query(`
        CREATE INDEX idx_gm_conventions_convention_option_id ON gm_conventions(convention_option_id)
      `);
    } else {
      // Table exists, check what columns it has
      const conventionColumns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gm_conventions'
      `);

      const conventionColumnNames = conventionColumns.rows.map((row: any) => row.column_name);
      const hasGmOptionId = conventionColumnNames.includes('gm_option_id');
      const hasConventionOptionId = conventionColumnNames.includes('convention_option_id');

      // If table has wrong schema, drop and recreate
      if (!hasGmOptionId || !hasConventionOptionId) {
        await client.query('DROP TABLE IF EXISTS gm_conventions CASCADE');
        
        // Recreate with correct schema
        await client.query(`
          CREATE TABLE gm_conventions (
            id SERIAL PRIMARY KEY,
            gm_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
            convention_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(gm_option_id, convention_option_id)
          )
        `);

        await client.query(`
          CREATE INDEX idx_gm_conventions_gm_option_id ON gm_conventions(gm_option_id)
        `);
        await client.query(`
          CREATE INDEX idx_gm_conventions_convention_option_id ON gm_conventions(convention_option_id)
        `);
      }
    }

    // Check if gm_adventures table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gm_adventures'
      )
    `);

    if (!tableExists.rows[0].exists) {
      // Table doesn't exist, create it with new schema (includes convention_option_id)
      await client.query(`
        CREATE TABLE gm_adventures (
          id SERIAL PRIMARY KEY,
          gm_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
          convention_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
          adventure_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(gm_option_id, convention_option_id, adventure_option_id)
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX idx_gm_adventures_gm_option_id ON gm_adventures(gm_option_id)
      `);
      await client.query(`
        CREATE INDEX idx_gm_adventures_convention_option_id ON gm_adventures(convention_option_id)
      `);
      await client.query(`
        CREATE INDEX idx_gm_adventures_adventure_option_id ON gm_adventures(adventure_option_id)
      `);
      await client.query(`
        CREATE INDEX idx_gm_adventures_gm_convention ON gm_adventures(gm_option_id, convention_option_id)
      `);
    } else {
      // Table exists, check what columns it has
      const columns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gm_adventures'
      `);

      const columnNames = columns.rows.map((row: any) => row.column_name);
      const hasGmOptionId = columnNames.includes('gm_option_id');
      const hasGmId = columnNames.includes('gm_id');
      const hasAdventureOptionId = columnNames.includes('adventure_option_id');
      const hasConventionOptionId = columnNames.includes('convention_option_id');

      // If table has old schema (missing convention_option_id), migrate it
      if (hasGmId || !hasGmOptionId || !hasAdventureOptionId || !hasConventionOptionId) {
        // Drop the old table (data will be lost, but that's okay for migration)
        await client.query('DROP TABLE IF EXISTS gm_adventures CASCADE');
        
        // Recreate with new schema (includes convention_option_id)
        await client.query(`
          CREATE TABLE gm_adventures (
            id SERIAL PRIMARY KEY,
            gm_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
            convention_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
            adventure_option_id INTEGER NOT NULL REFERENCES question_options(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(gm_option_id, convention_option_id, adventure_option_id)
          )
        `);

        // Create indexes
        await client.query(`
          CREATE INDEX idx_gm_adventures_gm_option_id ON gm_adventures(gm_option_id)
        `);
        await client.query(`
          CREATE INDEX idx_gm_adventures_convention_option_id ON gm_adventures(convention_option_id)
        `);
        await client.query(`
          CREATE INDEX idx_gm_adventures_adventure_option_id ON gm_adventures(adventure_option_id)
        `);
        await client.query(`
          CREATE INDEX idx_gm_adventures_gm_convention ON gm_adventures(gm_option_id, convention_option_id)
        `);
      }
    }
  } catch (error: any) {
    console.error('Error ensuring tables exist:', error);
    throw error;
  } finally {
    client.release();
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
=======
// GET - Fetch all GM-adventure associations
export async function GET() {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gm_adventures'
      )`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist yet - return empty array
      return NextResponse.json([]);
    }
    
    const result = await client.query(
      `SELECT 
        ga.id,
        ga.gm_interest_id,
        ga.adventure,
        ga.created_at,
        gi.first_name,
        gi.last_name,
        gi.email
      FROM gm_adventures ga
      JOIN gm_interest gi ON ga.gm_interest_id = gi.id
      ORDER BY gi.last_name ASC, gi.first_name ASC, ga.adventure ASC`
    );
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching GM-adventure associations:', error);
    // If table doesn't exist, return empty array instead of error
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation "gm_adventures"')) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ 
>>>>>>> d2d0cfed99cc64aaa43d507d95554cd6ac8f9023
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

<<<<<<< HEAD
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
=======
// POST - Create a new GM-adventure association
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gm_adventures'
      )`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_adventures table does not exist. Please run the database migration first.'
      }, { status: 503 });
    }
    
    const body = await request.json();
    const { gm_interest_id, adventure } = body;

    if (!gm_interest_id || !adventure) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'gm_interest_id and adventure are required'
      }, { status: 400 });
    }

    const result = await client.query(
      `INSERT INTO gm_adventures (gm_interest_id, adventure)
       VALUES ($1, $2)
       ON CONFLICT (gm_interest_id, adventure) DO NOTHING
       RETURNING *`,
      [gm_interest_id, adventure]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Association already exists',
        message: 'This GM is already associated with this adventure'
      }, { status: 409 });
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating GM-adventure association:', error);
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation "gm_adventures"')) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_adventures table does not exist. Please run the database migration first.'
      }, { status: 503 });
    }
    return NextResponse.json({ 
>>>>>>> d2d0cfed99cc64aaa43d507d95554cd6ac8f9023
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

<<<<<<< HEAD
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
=======
// DELETE - Remove a GM-adventure association
export async function DELETE(request: Request) {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gm_adventures'
      )`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_adventures table does not exist.'
      }, { status: 503 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: 'Missing id parameter'
      }, { status: 400 });
    }

    const result = await client.query(
      'DELETE FROM gm_adventures WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Association not found'
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      deleted: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error deleting GM-adventure association:', error);
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation "gm_adventures"')) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_adventures table does not exist.'
      }, { status: 503 });
    }
    return NextResponse.json({ 
>>>>>>> d2d0cfed99cc64aaa43d507d95554cd6ac8f9023
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}
<<<<<<< HEAD
=======

>>>>>>> d2d0cfed99cc64aaa43d507d95554cd6ac8f9023
