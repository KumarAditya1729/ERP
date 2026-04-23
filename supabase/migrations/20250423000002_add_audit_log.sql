-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,          -- 'INSERT', 'UPDATE', 'DELETE'
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only read their own tenant's audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON audit_log
  USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
