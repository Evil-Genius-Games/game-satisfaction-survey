import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Fetch adventures associated with a specific GM
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const gmId = searchParams.get('gmId');

    if (!gmId) {
      return NextResponse.json({ 
        error: 'Missing gmId parameter'
      }, { status: 400 });
    }

    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'gm_adventures'
      )`
    );
    
    if (!tableCheck.rows[0]?.exists) {
      return NextResponse.json([]);
    }

    const result = await client.query(
      `SELECT DISTINCT ga.adventure
      FROM gm_adventures ga
      WHERE ga.gm_interest_id = $1
      ORDER BY ga.adventure ASC`,
      [gmId]
    );
    
    return NextResponse.json(result.rows.map((row: any) => row.adventure));
  } catch (error: any) {
    console.error('Error fetching adventures by GM:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

