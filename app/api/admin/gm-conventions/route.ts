import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Fetch all GM-convention associations
export async function GET() {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gm_conventions'
      )`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      // Table doesn't exist yet - return empty array
      return NextResponse.json([]);
    }
    
    const result = await client.query(
      `SELECT 
        gc.id,
        gc.gm_interest_id,
        gc.convention,
        gc.created_at,
        gi.first_name,
        gi.last_name,
        gi.email
      FROM gm_conventions gc
      JOIN gm_interest gi ON gc.gm_interest_id = gi.id
      ORDER BY gi.last_name ASC, gi.first_name ASC, gc.convention ASC`
    );
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching GM-convention associations:', error);
    // If table doesn't exist, return empty array instead of error
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation "gm_conventions"')) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST - Create a new GM-convention association
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gm_conventions'
      )`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_conventions table does not exist. Please run the database migration first.'
      }, { status: 503 });
    }
    
    const body = await request.json();
    const { gm_interest_id, convention } = body;

    if (!gm_interest_id || !convention) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        message: 'gm_interest_id and convention are required'
      }, { status: 400 });
    }

    const result = await client.query(
      `INSERT INTO gm_conventions (gm_interest_id, convention)
       VALUES ($1, $2)
       ON CONFLICT (gm_interest_id, convention) DO NOTHING
       RETURNING *`,
      [gm_interest_id, convention]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Association already exists',
        message: 'This GM is already associated with this convention'
      }, { status: 409 });
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating GM-convention association:', error);
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation "gm_conventions"')) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_conventions table does not exist. Please run the database migration first.'
      }, { status: 503 });
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE - Remove a GM-convention association
export async function DELETE(request: Request) {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gm_conventions'
      )`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_conventions table does not exist.'
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
      'DELETE FROM gm_conventions WHERE id = $1 RETURNING *',
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
    console.error('Error deleting GM-convention association:', error);
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation "gm_conventions"')) {
      return NextResponse.json({ 
        error: 'Table not found',
        message: 'The gm_conventions table does not exist.'
      }, { status: 503 });
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

