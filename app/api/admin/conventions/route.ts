import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const client = await pool.connect();
  try {
    // Get all distinct convention values from answers
    const answersResult = await client.query(
      `SELECT DISTINCT
        a.answer_value,
        a.answer_text,
        COALESCE(a.answer_value, a.answer_text) as sort_key
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      WHERE q.question_text = 'What convention are you attending?'
        AND (a.answer_text IS NOT NULL OR a.answer_value IS NOT NULL)
      ORDER BY sort_key`
    );
    
    // Get all convention options
    const optionsResult = await client.query(
      `SELECT qo.option_text, qo.option_value
      FROM question_options qo
      JOIN questions q ON qo.question_id = q.id
      WHERE q.question_text = 'What convention are you attending?'
      ORDER BY qo.display_order`
    );
    
    // Helper to normalize for matching (handles hyphens, underscores, spaces)
    const normalize = (str: string): string => {
      return str.toLowerCase().replace(/[-_\s]+/g, '_');
    };
    
    // Helper to format nicely
    const formatName = (str: string): string => {
      return str
        .split(/[-_\s]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };
    
    // Build lookup maps
    const exactMap = new Map<string, string>(); // exact match
    const normalizedMap = new Map<string, string>(); // normalized match
    
    optionsResult.rows.forEach((row: any) => {
      if (row.option_value) {
        exactMap.set(row.option_value.toLowerCase(), row.option_text);
        normalizedMap.set(normalize(row.option_value), row.option_text);
      }
      if (row.option_text) {
        exactMap.set(row.option_text.toLowerCase(), row.option_text);
        normalizedMap.set(normalize(row.option_text), row.option_text);
      }
    });
    
    // Match answers to options
    const conventionMap = new Map<string, { value: string; display: string }>();
    
    answersResult.rows.forEach((row: any) => {
      // Try answer_value first, then answer_text
      const candidates = [
        row.answer_value,
        row.answer_text
      ].filter(Boolean);
      
      for (const candidate of candidates) {
        if (!candidate) continue;
        
        const normalized = normalize(candidate);
        let display: string | undefined;
        
        // Try exact match
        display = exactMap.get(candidate.toLowerCase());
        
        // Try normalized match
        if (!display) {
          display = normalizedMap.get(normalized);
        }
        
        // If found, use it
        if (display) {
          // Use answer_value as the canonical value if available, otherwise answer_text
          const value = row.answer_value || candidate;
          if (!conventionMap.has(normalized)) {
            conventionMap.set(normalized, { value, display });
          }
          break; // Found a match, move to next answer
        }
      }
      
      // If no match found, format the value
      if (candidates.length > 0) {
        const value = row.answer_value || row.answer_text!;
        const normalized = normalize(value);
        if (!conventionMap.has(normalized)) {
          conventionMap.set(normalized, { 
            value, 
            display: formatName(value) 
          });
        }
      }
    });
    
    // Convert to array and sort
    const conventions = Array.from(conventionMap.values())
      .sort((a, b) => a.display.localeCompare(b.display));
    
    return NextResponse.json(conventions);
  } catch (error: any) {
    console.error('Error fetching conventions:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}
