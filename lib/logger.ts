/**
 * lib/logger.ts — Structured JSON logger for NexSchool AI
 *
 * - JSON output compatible with Vercel Log Drains and Datadog
 * - Captures errors in Sentry automatically
 * - Safe for server-only runtime (no browser globals)
 * - Never logs secrets: keys filtered from context objects
 */
import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

// Keys that must never appear in structured logs
const REDACTED_KEYS = new Set([
  'password', 'token', 'secret', 'key', 'authorization',
  'cookie', 'supabase_key', 'service_role', 'anon_key',
  'razorpay_signature', 'webhook_secret',
]);

function redact(obj: LogContext): LogContext {
  const out: LogContext = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v as LogContext);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function write(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? redact(context) : {}),
    env: process.env.NODE_ENV,
  };

  const line = JSON.stringify(entry);

  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      write('debug', message, context);
    }
  },

  info(message: string, context?: LogContext) {
    write('info', message, context);
  },

  warn(message: string, context?: LogContext) {
    write('warn', message, context);
  },

  error(message: string, err?: unknown, context?: LogContext) {
    const errorContext: LogContext = {};

    if (err instanceof Error) {
      errorContext.error = err.message;
      errorContext.stack = err.stack?.split('\n').slice(0, 5).join(' | ');
      // Capture in Sentry for alerting
      Sentry.captureException(err, { extra: context });
    } else if (err !== undefined) {
      errorContext.error = String(err);
    }

    write('error', message, { ...context, ...errorContext });
  },
};
