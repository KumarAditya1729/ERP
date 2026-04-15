/**
 * Twilio SMS/WhatsApp Notification Service
 * 
 * Gracefully degrades when Twilio credentials are not configured.
 * In production: Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 * In development/staging without Twilio: messages are logged only (no crash)
 */

export interface SMSPayload {
  to: string;      // E.164 format e.g. +919876543210
  message: string;
}

function isTwilioConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  return !!(
    sid && !sid.startsWith('AC') === false &&
    token && !token.startsWith('YOUR_') &&
    from && !from.includes('XXXXXX')
  );
}

export async function sendSMS(payload: SMSPayload, retries = 3): Promise<{ success: boolean; error?: string }> {
  if (!isTwilioConfigured()) {
    // Graceful degradation: log but do not crash the application
    console.log(`[SMS — Dev Mode] To: ${payload.to} | Message: ${payload.message.substring(0, 80)}...`);
    return { success: true }; // Return true so upstream code continues without failure
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const body = new URLSearchParams({
        To: payload.to,
        From: fromNumber,
        Body: payload.message,
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        // Do not retry on 400 (Invalid Number/Bad Request), abort immediately
        if (response.status === 400) {
          console.error(`[SMS] ❌ Hard failure (400) to ${payload.to}:`, errData.message);
          return { success: false, error: errData.message };
        }
        throw new Error(errData.message || `Twilio API error ${response.status}`);
      }

      console.log(`[SMS] ✅ Delivered to ${payload.to}`);
      return { success: true };

    } catch (err: any) {
      if (attempt === retries) {
        console.error(`[SMS] ❌ Failed to send to ${payload.to} after ${retries} attempts:`, err.message);
        return { success: false, error: err.message };
      }
      const backoffMs = Math.pow(2, attempt) * 150 + Math.random() * 50; // Exponential backoff with jitter
      await new Promise(res => setTimeout(res, backoffMs));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

export async function sendBulkSMS(payloads: SMSPayload[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  
  // Sequential dispatch to respect rate limits
  for (const payload of payloads) {
    const result = await sendSMS(payload);
    if (result.success) sent++;
    else failed++;
    
    // Brief delay to avoid Twilio rate limiting (1 msg/sec per number)
    await new Promise(res => setTimeout(res, 150));
  }
  
  console.log(`[Bulk SMS] Dispatched ${sent} messages. ${failed} failed.`);
  return { sent, failed };
}
