import { NextResponse } from 'next/server';
import { getSurveyWithQuestions } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = parseInt(id);
<<<<<<< HEAD
    const survey = await getSurveyWithQuestions(surveyId);
=======
    
    // Get selectedGMId and convention from query parameters
    const { searchParams } = new URL(request.url);
    const selectedGMId = searchParams.get('gmId');
    const preSelectedConvention = searchParams.get('convention');
    
    const survey = await getSurveyWithQuestions(surveyId, selectedGMId, preSelectedConvention);
>>>>>>> d2d0cfed99cc64aaa43d507d95554cd6ac8f9023
    
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }
    
    return NextResponse.json(survey);
  } catch (error) {
    console.error('Error fetching survey:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

