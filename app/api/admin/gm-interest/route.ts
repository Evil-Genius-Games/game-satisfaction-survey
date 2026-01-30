import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT gi.*, r.submitted_at as response_submitted_at
       FROM gm_interest gi
       JOIN responses r ON gi.response_id = r.id
<<<<<<< HEAD
       ORDER BY gi.submitted_at DESC
=======
       ORDER BY 
         COALESCE(LOWER(gi.last_name), '') ASC,
         COALESCE(LOWER(gi.first_name), '') ASC,
         gi.submitted_at DESC
>>>>>>> d2d0cfed99cc64aaa43d507d95554cd6ac8f9023
       LIMIT 1000`
    );
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching GM interest:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

