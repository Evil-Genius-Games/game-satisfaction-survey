import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Fetch GMs associated with a specific convention
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const convention = searchParams.get('convention');

    if (!convention) {
      return NextResponse.json({ 
        error: 'Missing convention parameter'
      }, { status: 400 });
    }

    const result = await client.query(
      `SELECT 
        gi.id,
        gi.first_name,
        gi.last_name,
        gi.email,
        CONCAT(gi.first_name, ' ', gi.last_name) as full_name
      FROM gm_interest gi
      JOIN gm_conventions gc ON gi.id = gc.gm_interest_id
      WHERE gc.convention = $1
      ORDER BY gi.last_name ASC, gi.first_name ASC`,
      [convention]
    );
    
    return NextResponse.json(result.rows);
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

