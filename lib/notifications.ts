import { createClient } from '@supabase/supabase-js';

// Setup Supabase admin client for notification logging (bypassing RLS safely from server)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const resendApiKey = process.env.RESEND_API_KEY;
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

export async function sendNotification(
  tenantId: string,
  studentId: string,
  eventType: 'invoice.generated' | 'payment.success',
  recipientEmail: string | null,
  recipientPhone: string | null,
  messageData: any,
  invoiceId?: string,
  paymentId?: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const results = { email: false, sms: false, warning: '' };

  // 1. Email via Resend
  if (recipientEmail && resendApiKey) {
    try {
      let subject = '';
      let html = '';

      if (eventType === 'invoice.generated') {
        subject = `New Fee Invoice: ${messageData.invoiceNumber}`;
        html = `
          <p>Dear Parent,</p>
          <p>A new fee invoice <strong>${messageData.invoiceNumber}</strong> has been generated for ${messageData.studentName}.</p>
          <p><strong>Amount Due:</strong> Rs. ${messageData.amount}</p>
          <p><strong>Due Date:</strong> ${messageData.dueDate}</p>
          <p>Please login to the portal to view and pay the invoice.</p>
        `;
      } else if (eventType === 'payment.success') {
        subject = `Payment Receipt: ${messageData.receiptNumber}`;
        html = `
          <p>Dear Parent,</p>
          <p>We have successfully received a payment of <strong>Rs. ${messageData.amount}</strong> for ${messageData.studentName}.</p>
          <p><strong>Receipt Number:</strong> ${messageData.receiptNumber}</p>
          <p><strong>Payment Method:</strong> ${messageData.method}</p>
          <p>Thank you.</p>
        `;
      }

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'NexSchool ERP <no-reply@nexschool.com>',
          to: recipientEmail,
          subject: subject,
          html: html
        })
      });

      if (!resendRes.ok) {
        throw new Error(await resendRes.text());
      }
      
      const resendData = await resendRes.json();
      
      await supabase.from('notification_logs').insert({
        tenant_id: tenantId, student_id: studentId, invoice_id: invoiceId, payment_id: paymentId,
        channel: 'email', event_type: eventType, recipient: recipientEmail, status: 'sent', provider: 'resend', provider_message_id: resendData.id
      });
      results.email = true;

    } catch (err: any) {
      await supabase.from('notification_logs').insert({
        tenant_id: tenantId, student_id: studentId, invoice_id: invoiceId, payment_id: paymentId,
        channel: 'email', event_type: eventType, recipient: recipientEmail, status: 'failed', provider: 'resend', error_message: err.message
      });
      results.warning += `Email failed: ${err.message}. `;
    }
  }

  // 2. SMS via Twilio
  if (recipientPhone && twilioSid && twilioToken && twilioPhone) {
    try {
      let body = '';
      if (eventType === 'invoice.generated') {
        body = `NexSchool: Invoice ${messageData.invoiceNumber} for ${messageData.studentName} is generated. Rs.${messageData.amount} due on ${messageData.dueDate}.`;
      } else if (eventType === 'payment.success') {
        body = `NexSchool: Received Rs.${messageData.amount} for ${messageData.studentName}. Receipt: ${messageData.receiptNumber}. Thank you.`;
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const encodedBody = new URLSearchParams({
        To: recipientPhone,
        From: twilioPhone,
        Body: body
      });

      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: encodedBody
      });

      if (!twilioRes.ok) {
        throw new Error(await twilioRes.text());
      }

      const twilioData = await twilioRes.json();

      await supabase.from('notification_logs').insert({
        tenant_id: tenantId, student_id: studentId, invoice_id: invoiceId, payment_id: paymentId,
        channel: 'sms', event_type: eventType, recipient: recipientPhone, status: 'sent', provider: 'twilio', provider_message_id: twilioData.sid
      });
      results.sms = true;

    } catch (err: any) {
      await supabase.from('notification_logs').insert({
        tenant_id: tenantId, student_id: studentId, invoice_id: invoiceId, payment_id: paymentId,
        channel: 'sms', event_type: eventType, recipient: recipientPhone, status: 'failed', provider: 'twilio', error_message: err.message
      });
      results.warning += `SMS failed: ${err.message}. `;
    }
  }

  return results;
}

export type NotificationChannel = 'SMS' | 'EMAIL' | 'PUSH';

export interface NotificationPayload {
  to: string;
  subject?: string;
  body: string;
  channel: NotificationChannel;
  priority?: "high" | "normal";
}

export async function dispatchNotification(payload: NotificationPayload, retryCount = 0): Promise<boolean> {
  const maxRetries = 3;

  try {
    if (payload.channel === 'SMS') {
       console.log(`[SMS Gateway] Delivering to ${payload.to}: ${payload.body.substring(0, 50)}...`);
    } else if (payload.channel === 'EMAIL') {
       console.log(`[Email Gateway] To: ${payload.to} | Subject: ${payload.subject}`);
    } else {
       console.log(`[FCM] Push Notification to device ${payload.to}`);
    }
    return true;
  } catch (error: any) {
    if (retryCount < maxRetries) {
       console.warn(`Notification Delivery Failed. Retrying ${retryCount + 1}/${maxRetries}...`);
       await new Promise(res => setTimeout(res, 1000 * Math.pow(2, retryCount)));
       return dispatchNotification(payload, retryCount + 1);
    } else {
       console.error("Critical Notification Failure Logged.");
       return false;
    }
  }
}
