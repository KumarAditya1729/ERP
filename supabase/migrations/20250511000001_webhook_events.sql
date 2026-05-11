-- ==============================================================================
-- Migration: webhook_events — Razorpay webhook idempotency table
-- Prevents duplicate payment processing when Razorpay retries webhooks.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,          -- e.g. 'razorpay'
  event_id      TEXT NOT NULL,          -- Razorpay payment_id / event ID
  event_type    TEXT,                   -- e.g. 'payment.captured'
  processed_at  TIMESTAMPTZ DEFAULT NOW(),
  payload       JSONB,                  -- Full webhook payload for audit/replay
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Idempotency constraint: one row per provider + event_id
  CONSTRAINT uq_webhook_events_provider_event UNIQUE (provider, event_id)
);

-- Index for fast lookup during dedup check
CREATE INDEX IF NOT EXISTS idx_webhook_events_lookup
  ON public.webhook_events (provider, event_id);

-- Superadmin-only access via service role. Anon/authenticated roles cannot touch this.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No RLS policy = only service role (BYPASSRLS) can read/write
-- This is intentional: webhook processing is a background server operation only.

COMMENT ON TABLE public.webhook_events IS
  'Idempotency log for incoming webhooks. Prevents double-processing of duplicate webhook deliveries from Razorpay and other providers.';
