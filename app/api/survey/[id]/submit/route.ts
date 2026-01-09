import { NextResponse } from 'next/server';
import { createResponse } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = parseInt(id);
    const body = await request.json();
    const { answers, respondentInfo } = body;
    
    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid answers format' }, { status: 400 });
    }
    
    const responseId = await createResponse(surveyId, answers, respondentInfo);
    
    return NextResponse.json({ success: true, responseId });
  } catch (error) {
    console.error('Error submitting survey:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

