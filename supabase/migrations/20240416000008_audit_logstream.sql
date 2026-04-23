-- ==============================================================================
-- MIGRATION: Audit Log Stream (Tenant-isolated, real-time)
-- ==============================================================================

-- 1. Central audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name     TEXT NOT NULL DEFAULT 'System',
  action         TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'SMS_SENT', 'PAYMENT', 'ERROR')),
  resource_type  TEXT NOT NULL,   -- 'student' | 'fee' | 'attendance' | 'leave_request' | 'hostel_allocation' | ...
  resource_id    UUID,
  resource_label TEXT,            -- human-readable identifier e.g. student name
  metadata       JSONB DEFAULT '{}'::jsonb,
  severity       TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'success')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_audit_logs" ON public.audit_logs
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX idx_audit_logs_tenant_time   ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(tenant_id, resource_type);
CREATE INDEX idx_audit_logs_action        ON public.audit_logs(tenant_id, action);
CREATE INDEX idx_audit_logs_user          ON public.audit_logs(user_id);

-- 2. Generic trigger function — auto-logs INSERT/UPDATE/DELETE on any table
CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_resource_label TEXT;
  v_new_json JSONB;
  v_old_json JSONB;
BEGIN
  -- Convert RECORDs to JSONB for safe key extraction
  v_new_json := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE '{}'::jsonb END;
  v_old_json := CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN row_to_json(OLD)::jsonb ELSE '{}'::jsonb END;

  -- Extract tenant_id from the row being changed
  v_tenant_id := COALESCE((v_new_json->>'tenant_id')::UUID, (v_old_json->>'tenant_id')::UUID);

  -- Best-effort human label from common columns
  v_resource_label := COALESCE(
    (v_new_json ->> 'first_name') || ' ' || COALESCE((v_new_json ->> 'last_name'), ''),
    v_new_json ->> 'name',
    v_new_json ->> 'invoice_number',
    v_new_json ->> 'room_number',
    v_old_json ->> 'first_name',
    '—'
  );

  INSERT INTO public.audit_logs (tenant_id, actor_name, action, resource_type, resource_id, resource_label, severity, metadata)
  VALUES (
    v_tenant_id,
    'System',
    TG_OP,
    TG_TABLE_NAME,
    COALESCE((v_new_json->>'id')::UUID, (v_old_json->>'id')::UUID),
    TRIM(v_resource_label),
    CASE TG_OP WHEN 'DELETE' THEN 'warn' ELSE 'info' END,
    jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to all major tables
CREATE OR REPLACE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_fees
  AFTER INSERT OR UPDATE OR DELETE ON public.fees
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_leave_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_hostel_allocations
  AFTER INSERT OR UPDATE OR DELETE ON public.hostel_allocations
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_admission_applications
  AFTER INSERT OR UPDATE OR DELETE ON public.admission_applications
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_transport_routes
  AFTER INSERT OR UPDATE OR DELETE ON public.transport_routes
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();
