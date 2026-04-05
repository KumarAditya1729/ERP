import * as Sentry from '@sentry/nextjs';

export type NotificationChannel = 'SMS' | 'EMAIL' | 'PUSH';

export interface NotificationPayload {
  to: string;
  subject?: string;
  body: string;
  channel: NotificationChannel;
  priority?: "high" | "normal";
}

/**
 * 1M-USER SCALE: Notification Delivery System
 * 
 * Direct API calls string-tied across components scale poorly.
 * We modularize this so we can easily swap providers (Twilio -> AWS SNS) 
 * and introduce Retry Queues (via Upstash QStash or similar outbox pattern).
 */
export async function dispatchNotification(payload: NotificationPayload, retryCount = 0): Promise<boolean> {
  const maxRetries = 3;

  try {
    if (payload.channel === 'SMS') {
       // Mock Twilio API integration
       console.log(`[SMS Gateway] Delivering to ${payload.to}: ${payload.body.substring(0, 50)}...`);
       // If fail, throw...
    } else if (payload.channel === 'EMAIL') {
       // Mock SendGrid/Resend API
       console.log(`[Email Gateway] To: ${payload.to} | Subject: ${payload.subject}`);
    } else {
       // Mock Firebase Cloud Messaging
       console.log(`[FCM] Push Notification to device ${payload.to}`);
    }

    return true; // Success
  } catch (error: any) {
    if (retryCount < maxRetries) {
       console.warn(`Notification Delivery Failed. Retrying ${retryCount + 1}/${maxRetries}...`);
       // Exponential Backoff
       await new Promise(res => setTimeout(res, 1000 * Math.pow(2, retryCount)));
       return dispatchNotification(payload, retryCount + 1);
    } else {
       // Exhausted retries
       Sentry.captureException(new Error(`Failed to deliver ${payload.channel} to ${payload.to}: ${error.message}`));
       console.error("Critical Notification Failure Logged.");
       return false;
    }
  }
}
