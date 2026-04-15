-- ==============================================================================
-- MIGRATION: Leave Requests & Payroll Runs Tables
-- Required by HR module (leave approval) and Payroll (run tracking)
-- ==============================================================================

-- 1. Leave Requests (replaces hardcoded front-end array)
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_name     TEXT NOT NULL,
  leave_type     TEXT NOT NULL CHECK (leave_type IN ('Sick Leave', 'Casual Leave', 'Medical Leave', 'Earned Leave', 'Maternity Leave')),
  from_date      DATE NOT NULL,
  to_date        DATE NOT NULL,
  days           INTEGER NOT NULL GENERATED ALWAYS AS (to_date - from_date + 1) STORED,
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by    UUID REFERENCES public.profiles(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_leave_requests" ON public.leave_requests
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON public.leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Payroll Runs (audit trail — replaces fake setTimeout timer)
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month            TEXT NOT NULL,          -- e.g. "2026-04"
  processed_count  INTEGER NOT NULL DEFAULT 0,
  total_amount     BIGINT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  processed_by     UUID REFERENCES public.profiles(id),
  processed_at     TIMESTAMPTZ DEFAULT NOW(),
  notes            TEXT,
  UNIQUE(tenant_id, month)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_payroll_runs" ON public.payroll_runs
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON public.payroll_runs(tenant_id, month);

-- 3. Add salary & shift fields to profiles (required by HR & Hostel modules)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary       BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_block TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS shift        TEXT;

-- 4. Exams schedule table (replaces hardcoded front-end array)
CREATE TABLE IF NOT EXISTS public.exams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  classes       TEXT NOT NULL DEFAULT 'All Classes',
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  subject_count INTEGER DEFAULT 5,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_exams" ON public.exams
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE INDEX IF NOT EXISTS idx_exams_tenant_status ON public.exams(tenant_id, status);
CREATE TRIGGER exams_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
