import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// POST - Mark a coupon code as used (copied or emailed)
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { code, action } = body; // action: 'copied' or 'emailed'
    
    if (!code) {
      return NextResponse.json({ 
        error: 'code is required'
      }, { status: 400 });
    }
    
    if (!action || !['copied', 'emailed'].includes(action)) {
      return NextResponse.json({ 
        error: 'action must be "copied" or "emailed"'
      }, { status: 400 });
    }
    
    // Update the appropriate timestamp and mark as used
    const timestampField = action === 'copied' ? 'copied_at' : 'emailed_at';
    const result = await client.query(
      `UPDATE coupon_codes 
       SET ${timestampField} = CURRENT_TIMESTAMP,
           status = 'used'
       WHERE code = $1
       RETURNING *`,
      [code.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Coupon code not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      couponCode: result.rows[0] 
    });
  } catch (error: any) {
    console.error('Error marking coupon code as used:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

