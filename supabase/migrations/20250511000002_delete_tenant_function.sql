-- ==============================================================================
-- Migration: delete_tenant_data() — Superadmin-only safe tenant wipe
-- NEVER expose this function to tenant admins. Service role only.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_tenant_data(target_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as the owner (postgres), bypasses RLS
SET search_path = public
AS $$
DECLARE
  deleted_counts JSONB := '{}'::JSONB;
  n INTEGER;
BEGIN
  -- Log the deletion request to audit log if the table exists
  BEGIN
    INSERT INTO public.audit_logs (
      action, entity_type, entity_id, performed_by, metadata, created_at
    ) VALUES (
      'TENANT_DATA_DELETION',
      'tenant',
      target_tenant_id,
      current_user,
      jsonb_build_object('initiated_at', NOW()),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- audit_logs table may not exist in all deployments; continue safely
    NULL;
  END;

  -- Delete in safe FK order (children before parents)

  -- 1. Transport sub-tables
  DELETE FROM public.transport_incidents    WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('transport_incidents', n);

  DELETE FROM public.transport_maintenance  WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('transport_maintenance', n);

  DELETE FROM public.transport_fuel_logs   WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('transport_fuel_logs', n);

  DELETE FROM public.transport_stops       WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('transport_stops', n);

  DELETE FROM public.transport_routes      WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('transport_routes', n);

  -- 2. Academic / attendance
  DELETE FROM public.exam_results          WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('exam_results', n);

  DELETE FROM public.exams                 WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('exams', n);

  DELETE FROM public.attendance            WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('attendance', n);

  -- 3. Finance
  DELETE FROM public.fees                  WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('fees', n);

  -- 4. Admissions
  DELETE FROM public.admission_applications WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('admission_applications', n);

  -- 5. Students
  DELETE FROM public.students              WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('students', n);

  -- 6. Communication
  DELETE FROM public.notices               WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('notices', n);

  -- 7. Profiles (FK to auth.users — delete profile first)
  DELETE FROM public.profiles              WHERE tenant_id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('profiles', n);

  -- 8. Finally delete the tenant row itself
  DELETE FROM public.tenants               WHERE id = target_tenant_id; GET DIAGNOSTICS n = ROW_COUNT;
  deleted_counts := deleted_counts || jsonb_build_object('tenants', n);

  RETURN jsonb_build_object(
    'success', TRUE,
    'tenant_id', target_tenant_id,
    'deleted', deleted_counts,
    'completed_at', NOW()
  );
END;
$$;

-- Restrict direct function execution: only postgres (service role) can call it
REVOKE ALL ON FUNCTION public.delete_tenant_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_tenant_data(UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.delete_tenant_data(UUID) FROM anon;

COMMENT ON FUNCTION public.delete_tenant_data(UUID) IS
  'Superadmin-only: Permanently deletes ALL data for a tenant in safe FK order. '
  'Called only via POST /api/superadmin/tenants/[tenantId]/delete-data with service role key. '
  'This action is IRREVERSIBLE.';
