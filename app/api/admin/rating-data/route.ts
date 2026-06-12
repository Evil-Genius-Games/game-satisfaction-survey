import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const convention = searchParams.get('convention');

    // Build convention filter if provided
    let conventionJoin = '';
    let conventionWhere = '';
    if (convention && convention !== 'all') {
      conventionJoin = `
        JOIN answers a_conv ON a.response_id = a_conv.response_id
        JOIN questions q_conv ON a_conv.question_id = q_conv.id
      `;
      conventionWhere = `
        AND q_conv.question_text = 'What convention are you attending?'
        AND (a_conv.answer_text = $1 OR a_conv.answer_value = $1 OR a_conv.answer_text ILIKE $1 OR a_conv.answer_value ILIKE $1)
      `;
    }

    const ratingQuery = (questionPredicate: string) => `
      SELECT 
        a.answer_value::INTEGER as rating,
        COUNT(*)::INTEGER as count
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      ${conventionJoin}
      WHERE q.question_type = 'rating'
        AND ${questionPredicate}
        AND a.answer_value IS NOT NULL
        AND a.answer_value ~ '^[0-9]+$'
        ${conventionWhere}
      GROUP BY a.answer_value::INTEGER
      ORDER BY rating`;

    const ratingParams = convention && convention !== 'all' ? [convention] : [];

    // Get GM Rating data (1-5 scale). Match by role and max value so wording updates do not break reporting.
    const gmRatingResult = await client.query(
      ratingQuery(`
        lower(q.question_text) LIKE '%gm%'
        AND COALESCE((q.validation_rules ->> 'max')::INTEGER, 5) = 5
      `),
      ratingParams
    );

    // Get Adventure Rating data (1-5 scale). Match by role and max value so wording updates do not break reporting.
    const adventureRatingResult = await client.query(
      ratingQuery(`
        lower(q.question_text) LIKE '%adventure%'
        AND COALESCE((q.validation_rules ->> 'max')::INTEGER, 5) = 5
      `),
      ratingParams
    );

    // Get Recommendation/NPS Rating data (1-10 scale). Match by role and max value so wording updates do not break reporting.
    const recommendationRatingResult = await client.query(
      ratingQuery(`
        (lower(q.question_text) LIKE '%recommend%' OR lower(q.question_text) LIKE '%friend%' OR lower(q.question_text) LIKE '%nps%')
        AND COALESCE((q.validation_rules ->> 'max')::INTEGER, 10) = 10
      `),
      ratingParams
    );

    // Fill in missing ratings with 0 count
    const fillRatings = (data: any[], maxRating: number) => {
      const filled = [];
      for (let i = 1; i <= maxRating; i++) {
        const existing = data.find((d: any) => d.rating === i);
        filled.push({
          rating: i,
          count: existing ? Number(existing.count) : 0
        });
      }
      return filled;
    };

    return NextResponse.json({
      gmRating: fillRatings(gmRatingResult.rows, 5),
      adventureRating: fillRatings(adventureRatingResult.rows, 5),
      recommendationRating: fillRatings(recommendationRatingResult.rows, 10)
    });
  } catch (error: any) {
    console.error('Error fetching rating data:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  } finally {
    client.release();
  }
}

