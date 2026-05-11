-- ==============================================================================
-- Migration: onboarding support columns + academic_years table
-- Adds onboarding state tracking to tenants table.
-- academic_years, classes, and sections already exist from academics module.
-- ==============================================================================

-- Add onboarding tracking columns to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_step      INTEGER NOT NULL DEFAULT 1;

-- academic_years table (if not present from a prior migration)
CREATE TABLE IF NOT EXISTS public.academic_years (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,           -- e.g. "2025–26"
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_current    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'academic_years' AND policyname = 'tenant_isolation_academic_years'
  ) THEN
    CREATE POLICY "tenant_isolation_academic_years" ON public.academic_years
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

-- staff_invites table: track invitation status for staff accounts
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'failed')),
  invited_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_invites' AND policyname = 'tenant_isolation_staff_invites'
  ) THEN
    CREATE POLICY "tenant_isolation_staff_invites" ON public.staff_invites
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

-- Index for quick onboarding status checks
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding ON public.tenants(onboarding_completed);

COMMENT ON COLUMN public.tenants.onboarding_completed IS 'True once the school has completed the post-registration setup wizard.';
COMMENT ON COLUMN public.tenants.onboarding_step IS 'Last completed onboarding step (1=school info, 2=academic year, 3=classes, 4=csv import, 5=staff invite, 6=done).';
