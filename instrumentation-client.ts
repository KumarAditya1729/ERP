import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Only initialize if we have the proper DSN so we don't crash dev without tokens
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 1.0,
      debug: false,
    });
  }
}

export const onRequestError = Sentry.captureException;
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
