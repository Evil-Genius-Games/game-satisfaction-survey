import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const conventionFilter = searchParams.get('convention');

    // Build the query with optional convention filtering
    let query = `
      SELECT 
        r.id as response_id,
        r.submitted_at,
        r.respondent_email,
        r.respondent_name,
        q.question_text,
        a.answer_text,
        a.answer_value
      FROM responses r
      LEFT JOIN answers a ON r.id = a.response_id
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE r.survey_id = 1
    `;

    const queryParams: any[] = [];
    
    // If convention filter is provided, filter responses by convention
    if (conventionFilter) {
      query += `
        AND r.id IN (
          SELECT DISTINCT a2.response_id
          FROM answers a2
          JOIN questions q2 ON a2.question_id = q2.id
          WHERE q2.question_text = 'What convention are you attending?'
            AND (a2.answer_value = $1 OR a2.answer_text = $1)
        )
      `;
      queryParams.push(conventionFilter);
    }

    query += ` ORDER BY r.submitted_at DESC, r.id, q.display_order`;

    const responsesResult = await pool.query(query, queryParams);

    // Transform data for CSV
    const responsesMap = new Map();
    
    responsesResult.rows.forEach((row: any) => {
      if (!responsesMap.has(row.response_id)) {
        responsesMap.set(row.response_id, {
          'Response ID': row.response_id,
          'Submitted At': new Date(row.submitted_at).toISOString(),
          'Email': row.respondent_email || '',
          'Name': row.respondent_name || '',
        });
      }
      const response = responsesMap.get(row.response_id);
      const answer = row.answer_text || row.answer_value || '';
      response[row.question_text] = answer;
    });

    // Get all unique question texts for headers
    const allQuestions = await pool.query(
      'SELECT question_text FROM questions WHERE survey_id = 1 GROUP BY question_text, display_order ORDER BY display_order'
    );
    const questionHeaders = allQuestions.rows.map((q: any) => q.question_text);

    // Build CSV
    const headers = ['Response ID', 'Submitted At', 'Email', 'Name', ...questionHeaders];
    const rows = Array.from(responsesMap.values());
    
    let csv = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
    
    rows.forEach((row: any) => {
      const csvRow = headers.map((header: string) => {
        const value = row[header] || '';
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csv += csvRow.join(',') + '\n';
    });

    const filename = conventionFilter 
      ? `survey-responses-${conventionFilter.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
      : `survey-responses-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}

