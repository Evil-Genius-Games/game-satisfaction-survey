import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST - Assign an available coupon code to a response
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { responseId } = body;
    
    if (!responseId) {
      return NextResponse.json({ 
        error: 'responseId is required'
      }, { status: 400 });
    }
    
    // Find an available coupon code (not used, and not expired)
    // Only assign if code hasn't been copied or emailed yet
    const result = await client.query(
      `UPDATE coupon_codes 
       SET response_id = $1, 
           assigned_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM coupon_codes 
         WHERE status = 'available' 
           AND expires_at > CURRENT_TIMESTAMP
           AND copied_at IS NULL
           AND emailed_at IS NULL
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [responseId]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'No available coupon codes',
        code: null
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      couponCode: result.rows[0] 
    });
  } catch (error: any) {
    console.error('Error assigning coupon code:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

