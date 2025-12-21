import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const responsesResult = await pool.query(
      `SELECT 
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
      ORDER BY r.submitted_at DESC, r.id, q.display_order`
    );

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
      'SELECT DISTINCT question_text FROM questions WHERE survey_id = 1 ORDER BY display_order'
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

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="survey-responses-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

