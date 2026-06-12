import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createResponse } from '@/lib/db';
import { createResponseToken } from '@/lib/responseTokens';

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  return request.headers.get('x-real-ip')?.trim() || null;
}

function createParticipantKey(ipAddress: string | null, userAgent: string | null) {
  const source = [ipAddress, userAgent].filter(Boolean).join('|');
  if (!source) return null;
  return createHash('sha256').update(source).digest('hex');
}

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

    const ipAddress = getRequestIp(request);
    const userAgent = request.headers.get('user-agent')?.trim() || null;
    const requestParticipantKey = createParticipantKey(ipAddress, userAgent);
    const enrichedRespondentInfo = {
      ...(respondentInfo && typeof respondentInfo === 'object' ? respondentInfo : {}),
      ipAddress,
      userAgent,
      participantKey: requestParticipantKey,
    };
    
    const responseId = await createResponse(surveyId, answers, enrichedRespondentInfo);
    const responseToken = createResponseToken({ responseId, surveyId });
    
    return NextResponse.json({ success: true, responseId, responseToken });
  } catch (error: any) {
    console.error('Error submitting survey:', error);
    return NextResponse.json(
      {
        error: error?.status ? error.message : 'Internal server error',
        details: error?.details,
      },
      { status: error?.status || 500 }
    );
  }
}
