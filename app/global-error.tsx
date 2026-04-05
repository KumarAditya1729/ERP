'use client';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Report React render errors to Sentry automatically
  Sentry.captureException(error);

  return (
    <html>
      <body style={{ background: '#080C1A', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚨</div>
          <h2 style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Our team has been automatically notified. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.6rem 1.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
