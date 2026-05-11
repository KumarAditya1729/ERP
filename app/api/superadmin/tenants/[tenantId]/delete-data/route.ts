import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const BodySchema = z.object({
  confirmation: z.literal('DELETE TENANT DATA', {
    errorMap: () => ({ message: 'You must send { "confirmation": "DELETE TENANT DATA" } to confirm.' }),
  }),
});

/**
 * POST /api/superadmin/tenants/[tenantId]/delete-data
 *
 * Permanently deletes ALL data for a tenant. Superadmin role only.
 * Requires a confirmation phrase in the body to prevent accidental calls.
 *
 * Body: { "confirmation": "DELETE TENANT DATA" }
 *
 * NEVER expose this route to tenant-level admins.
 */
export async function POST(
  req: Request,
  { params }: { params: { tenantId: string } },
) {
  // ── Auth guard: superadmin only ──────────────────────────────────────────
  const { user, role, error: authErr } = await requireAuth(['admin']);
  if (authErr) return authErr;

  // Superadmin check: must have app_metadata.superadmin = true
  const isSuperAdmin = user?.app_metadata?.superadmin === true;
  if (!isSuperAdmin) {
    logger.warn('[SuperAdmin] Non-superadmin attempted tenant deletion', {
      userId: user?.id,
      role,
      targetTenantId: params.tenantId,
    });
    return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 });
  }

  // ── Validate target tenantId ─────────────────────────────────────────────
  const tenantIdSchema = z.string().uuid('Invalid tenantId format');
  const tenantIdResult = tenantIdSchema.safeParse(params.tenantId);
  if (!tenantIdResult.success) {
    return NextResponse.json({ error: 'Invalid tenantId' }, { status: 400 });
  }
  const targetTenantId = tenantIdResult.data;

  // ── Validate confirmation phrase ─────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodyResult = BodySchema.safeParse(body);
  if (!bodyResult.success) {
    return NextResponse.json({
      error: bodyResult.error.errors[0].message,
    }, { status: 400 });
  }

  // ── Execute deletion via service-role client ─────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  logger.info('[SuperAdmin] Tenant data deletion initiated', {
    requestedBy: user?.id,
    targetTenantId,
  });

  const { data, error } = await supabase.rpc('delete_tenant_data', {
    target_tenant_id: targetTenantId,
  });

  if (error) {
    logger.error('[SuperAdmin] Tenant deletion failed', error, { targetTenantId });
    return NextResponse.json({ error: 'Deletion failed. See server logs.' }, { status: 500 });
  }

  logger.info('[SuperAdmin] Tenant data deletion completed', {
    requestedBy: user?.id,
    targetTenantId,
    result: data,
  });

  return NextResponse.json({ success: true, result: data }, { status: 200 });
}
