import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Only initialize if we have the proper DSN so we don't crash dev without tokens
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 1.0,
        debug: false,
      });
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 1.0,
        debug: false,
      });
    }
  } else {
    // console.warn("Sentry DSN missing. Observability instrumentation bypassed.");
  }
}
