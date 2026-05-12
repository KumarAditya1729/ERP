/**
 * SendGrid Email Notification Service
 * 
 * In production: Set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL
 * In development: Logs messages to console.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  body: string; // HTML supported
  text?: string;
}

function isSendGridConfigured(): boolean {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  return !!(key && key.startsWith('SG.') && from && from.includes('@'));
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!isSendGridConfigured()) {
    console.log(`[Email — Dev Mode] To: ${payload.to} | Subject: ${payload.subject}`);
    return { success: true };
  }

  const apiKey = process.env.SENDGRID_API_KEY!;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL!;

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: payload.to }]
        }],
        from: { email: fromEmail, name: 'NexSchool AI' },
        subject: payload.subject,
        content: [
          { type: 'text/plain', value: payload.text || payload.body.replace(/<[^>]*>/g, '') },
          { type: 'text/html', value: payload.body }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('[Email] ❌ SendGrid failure:', errData);
      return { success: false, error: errData.errors?.[0]?.message || 'SendGrid API error' };
    }

    console.log(`[Email] ✅ Delivered to ${payload.to}`);
    return { success: true };

  } catch (err: any) {
    console.error('[Email] ❌ Fatal error:', err.message);
    return { success: false, error: err.message };
  }
}
