-- Run this in your Supabase SQL Editor to fix the "operator does not exist: record ->> unknown" error.
-- The issue was that the PL/pgSQL trigger tried to use the JSON ->> operator directly on a PostgreSQL RECORD.

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
