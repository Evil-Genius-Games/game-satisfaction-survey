import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT 
        gi.id,
        gi.response_id,
        gi.first_name,
        gi.last_name,
        gi.email,
        gi.submitted_at,
        r.submitted_at as response_submitted_at
      FROM gm_interest gi
      JOIN responses r ON gi.response_id = r.id
      ORDER BY gi.submitted_at DESC`
    );

    // Build CSV
    const headers = ['ID', 'Response ID', 'First Name', 'Last Name', 'Email', 'Submitted At', 'Response Submitted At'];
    const rows = result.rows;
    
    let csv = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
    
    rows.forEach((row: any) => {
      const csvRow = [
        row.id,
        row.response_id,
        row.first_name || '',
        row.last_name || '',
        row.email || '',
        row.submitted_at ? new Date(row.submitted_at).toISOString() : '',
        row.response_submitted_at ? new Date(row.response_submitted_at).toISOString() : ''
      ];
      csv += csvRow.map((value: any) => `"${String(value).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="gm-interest-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting GM interest CSV:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

