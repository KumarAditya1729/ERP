'use client';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  Sentry.captureException(error);

  return (
    <html>
      <body className="flex items-center justify-center h-screen bg-[#080C1A] text-slate-300 font-sans">
        <div className="glass-strong border border-red-500/20 rounded-3xl p-10 max-w-lg w-full text-center float space-y-4">
          <div className="text-6xl mb-4">🚨</div>
          <h1 className="text-2xl font-bold text-white">Critical System Exception</h1>
          <p className="text-sm text-slate-400">
            {error?.message || "An edge runtime error occurred. Our engineering team has been notified via Sentry."}
          </p>
          <button
            onClick={reset}
            className="mt-6 px-6 py-2.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 font-semibold rounded-xl border border-red-500/30 transition-colors"
          >
            Re-initialize System
          </button>
        </div>
      </body>
    </html>
  );
}
