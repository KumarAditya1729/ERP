import { requireAuth } from '@/lib/auth-guard';
import { NextResponse } from 'next/server';
import { getUpstashRedisEnv } from '@/lib/env';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

// Prevent Next.js from pre-rendering this route at build time
export const dynamic = 'force-dynamic';

type DashboardStatsPayload = {
  kpis: Array<{
    label: string
    value: string
    change: string
    up: boolean
    icon: string
    color: string
    border: string
  }>
  timestamp: string
}

export async function GET() {
  const { tenantId, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    if (!tenantId) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
    }

    const CACHE_KEY = `dashboard_stats:${tenantId}`;
    const redisEnv = getUpstashRedisEnv();

    // 1. Check Redis Cache first
    if (redisEnv) {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis(redisEnv);
      const cached = await redis.get<DashboardStatsPayload>(CACHE_KEY);
      if (cached) {
        return NextResponse.json(cached, { status: 200, headers: { 'X-Cache': 'HIT' } });
      }
    }

    // 2. Real DB queries — all scoped to tenant
    const [studentsResult, viewResult, staffResult] = await Promise.all([
      supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active'),
      supabaseAdmin.from('tenant_fee_summary_view').select('collected, pending').eq('tenant_id', tenantId).single(),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('role', ['staff', 'teacher', 'admin']),
    ]);

    const totalStudents = studentsResult.count || 0;
    const totalStaff = staffResult.count || 0;
    const feesCollected = Number(viewResult.data?.collected || 0);
    const feesPending = Number(viewResult.data?.pending || 0);

    const payload: DashboardStatsPayload = {
      kpis: [
        { label: 'Total Students', value: totalStudents.toLocaleString(), change: 'active enrollment', up: true, icon: '🎓', color: 'from-violet-600/25 to-violet-900/10', border: 'border-violet-500/25' },
        { label: 'Fees Collected', value: `₹${(feesCollected / 100000).toFixed(1)}L`, change: 'this session', up: true, icon: '💰', color: 'from-emerald-600/25 to-emerald-900/10', border: 'border-emerald-500/25' },
        { label: 'Pending Fees', value: `₹${(feesPending / 1000).toFixed(0)}k`, change: 'needs collection', up: false, icon: '⏳', color: 'from-amber-600/25 to-amber-900/10', border: 'border-amber-500/25' },
        { label: 'Staff Count', value: totalStaff.toString(), change: 'active staff', up: true, icon: '👩‍💼', color: 'from-cyan-600/25 to-cyan-900/10', border: 'border-cyan-500/25' },
      ],
      timestamp: new Date().toISOString()
    };

    // 3. Cache for 60 seconds
    if (redisEnv) {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis(redisEnv);
      await redis.set(CACHE_KEY, payload, { ex: 60 });
    }

    return NextResponse.json(payload, { status: 200, headers: { 'X-Cache': 'MISS' } });

  } catch (error: any) {
    console.error('[Dashboard Stats] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
