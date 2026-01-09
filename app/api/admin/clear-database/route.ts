import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE() {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Delete in order to respect foreign key constraints
      await client.query('DELETE FROM answers');
      await client.query('DELETE FROM responses');
      
      await client.query('COMMIT');
      
      return NextResponse.json({ success: true, message: 'Database cleared successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

