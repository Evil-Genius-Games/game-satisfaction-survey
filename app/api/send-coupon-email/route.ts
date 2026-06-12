import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import pool from '@/lib/db';
import { verifyResponseToken } from '@/lib/responseTokens';
import { isValidEmail, normalizeOptionalText } from '@/lib/surveyValidation';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, couponCode, responseId, responseToken } = body;
    const normalizedEmail = normalizeOptionalText(email);
    const normalizedCouponCode = normalizeOptionalText(couponCode);
    const numericResponseId = Number(responseId);
    
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    
    if (!normalizedCouponCode) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
    }

    if (!Number.isInteger(numericResponseId) || numericResponseId <= 0) {
      return NextResponse.json({ error: 'responseId is required' }, { status: 400 });
    }

    const responseResult = await pool.query(
      'SELECT id, survey_id FROM responses WHERE id = $1',
      [numericResponseId]
    );

    if (responseResult.rows.length === 0) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    const tokenValidation = verifyResponseToken(responseToken, {
      responseId: numericResponseId,
      surveyId: Number(responseResult.rows[0].survey_id),
    });

    if (!tokenValidation.ok) {
      return NextResponse.json({ error: tokenValidation.error }, { status: 403 });
    }
    
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json({ 
        error: 'Email service is not configured. Please contact support.' 
      }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@evilgeniusgames.com';
    const safeCouponCode = escapeHtml(normalizedCouponCode);
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: normalizedEmail,
      subject: 'Your Coupon Code - Evil Genius Games',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Coupon Code</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Thank You!</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                Thank you for completing our survey! We appreciate your feedback.
              </p>
              <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your Coupon Code:</p>
                <h2 style="margin: 0; font-size: 32px; color: #667eea; letter-spacing: 3px; font-family: 'Courier New', monospace;">
                  ${safeCouponCode}
                </h2>
              </div>
              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                Use this code at checkout to redeem your discount. We hope you enjoy your purchase!
              </p>
              <p style="font-size: 14px; color: #666; margin-top: 30px;">
                Best regards,<br>
                <strong>The Evil Genius Games Team</strong>
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Thank you for completing our survey!

Your Coupon Code: ${normalizedCouponCode}

Use this code at checkout to redeem your discount. We hope you enjoy your purchase!

Best regards,
The Evil Genius Games Team
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ 
        error: 'Failed to send email',
        details: error.message 
      }, { status: 500 });
    }

    console.log('Email sent successfully', { emailId: data?.id });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      emailId: data?.id 
    });
  } catch (error: any) {
    console.error('Error in send-coupon-email:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
