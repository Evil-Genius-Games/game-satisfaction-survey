import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET - Fetch all coupon codes with optional filtering
export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coupon_codes'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      // Table doesn't exist yet, return empty array
      return NextResponse.json([]);
    }
    
    // Check if columns exist
    const columnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'coupon_codes'
      AND column_name IN ('copied_at', 'emailed_at');
    `);
    
    const hasCopiedAt = columnsCheck.rows.some((r: any) => r.column_name === 'copied_at');
    const hasEmailedAt = columnsCheck.rows.some((r: any) => r.column_name === 'emailed_at');
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    // Build query based on which columns exist
    let usedCondition = 'FALSE';
    if (hasCopiedAt && hasEmailedAt) {
      usedCondition = '(copied_at IS NOT NULL OR emailed_at IS NOT NULL)';
    } else if (hasCopiedAt) {
      usedCondition = 'copied_at IS NOT NULL';
    } else if (hasEmailedAt) {
      usedCondition = 'emailed_at IS NOT NULL';
    }
    
    // Calculate status based on copied_at, emailed_at, and expires_at
    let query = `
      SELECT *,
        CASE 
          WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN 'expired'
          WHEN ${usedCondition} THEN 'used'
          ELSE 'available'
        END as computed_status
      FROM coupon_codes 
      ORDER BY created_at DESC
    `;
    const params: any[] = [];
    
    if (status) {
      query = `
        SELECT *,
          CASE 
            WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN 'expired'
            WHEN ${usedCondition} THEN 'used'
            ELSE 'available'
          END as computed_status
        FROM coupon_codes 
        WHERE (
          CASE 
            WHEN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP THEN 'expired'
            WHEN ${usedCondition} THEN 'used'
            ELSE 'available'
          END
        ) = $1
        ORDER BY created_at DESC
      `;
      params.push(status);
    }
    
    const result = await client.query(query, params);
    
    // Update status in database if it differs from computed status
    for (const row of result.rows) {
      if (row.status !== row.computed_status) {
        await client.query(
          'UPDATE coupon_codes SET status = $1 WHERE id = $2',
          [row.computed_status, row.id]
        );
        row.status = row.computed_status;
      }
      // Remove computed_status from response
      delete row.computed_status;
    }
    
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching coupon codes:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST - Upload/create coupon codes (supports bulk upload)
export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    // Check if table exists first
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'coupon_codes'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return NextResponse.json({ 
        error: 'Coupon codes table does not exist',
        message: 'Please run the database migration to create the coupon_codes table. See migrations/create_coupon_codes.sql'
      }, { status: 500 });
    }
    
    const body = await request.json();
    const { codes, notes } = body;
    
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ 
        error: 'codes array is required'
      }, { status: 400 });
    }
    
    const results = [];
    const errors = [];
    
    for (const code of codes) {
      try {
        const codeValue = code.trim().toUpperCase();
        if (!codeValue) continue;
        
        // Automatically set expiration to 1 year from now
        const result = await client.query(
          `INSERT INTO coupon_codes (code, expires_at, notes, status)
           VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 year', $2, 'available')
           ON CONFLICT (code) DO NOTHING
           RETURNING *`,
          [codeValue, notes || null]
        );
        
        if (result.rows.length > 0) {
          results.push(result.rows[0]);
        } else {
          errors.push({ code: codeValue, error: 'Duplicate code' });
        }
      } catch (error: any) {
        errors.push({ code: code, error: error.message });
      }
    }
    
    return NextResponse.json({
      success: true,
      created: results.length,
      errorCount: errors.length,
      results,
      errors
    });
  } catch (error: any) {
    console.error('Error creating coupon codes:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE - Delete a coupon code
export async function DELETE(request: Request) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ 
        error: 'id parameter is required'
      }, { status: 400 });
    }
    
    const result = await client.query(
      'DELETE FROM coupon_codes WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Coupon code not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, deleted: result.rows[0] });
  } catch (error: any) {
    console.error('Error deleting coupon code:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

