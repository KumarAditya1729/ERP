import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Prevent Next.js from pre-rendering this route at build time
export const dynamic = 'force-dynamic';

// Only init Redis if tokens are present
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    // Get tenant from session cookie — multi-tenant safe
    const cookieStore = cookies();
    const supabaseUser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const tenantId = profile.tenant_id;
    const CACHE_KEY = `dashboard_stats:${tenantId}`;

    // 1. Check Redis Cache first
    if (redisUrl && redisToken) {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return NextResponse.json(cached, { status: 200, headers: { 'X-Cache': 'HIT' } });
      }
    }

    // 2. Real DB queries — all scoped to tenant
    const [studentsResult, feesResult, staffResult] = await Promise.all([
      supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active'),
      supabaseAdmin.from('fees').select('amount, status').eq('tenant_id', tenantId),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('role', ['staff', 'teacher', 'admin']),
    ]);

    const totalStudents = studentsResult.count || 0;
    const totalStaff = staffResult.count || 0;
    const feesCollected = (feesResult.data || []).filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.amount), 0);
    const feesPending = (feesResult.data || []).filter(f => f.status === 'pending').reduce((s, f) => s + Number(f.amount), 0);

    const payload = {
      kpis: [
        { label: 'Total Students', value: totalStudents.toLocaleString(), change: 'active enrollment', up: true, icon: '🎓', color: 'from-violet-600/25 to-violet-900/10', border: 'border-violet-500/25' },
        { label: 'Fees Collected', value: `₹${(feesCollected / 100000).toFixed(1)}L`, change: 'this session', up: true, icon: '💰', color: 'from-emerald-600/25 to-emerald-900/10', border: 'border-emerald-500/25' },
        { label: 'Pending Fees', value: `₹${(feesPending / 1000).toFixed(0)}k`, change: 'needs collection', up: false, icon: '⏳', color: 'from-amber-600/25 to-amber-900/10', border: 'border-amber-500/25' },
        { label: 'Staff Count', value: totalStaff.toString(), change: 'active staff', up: true, icon: '👩‍💼', color: 'from-cyan-600/25 to-cyan-900/10', border: 'border-cyan-500/25' },
      ],
      timestamp: new Date().toISOString()
    };

    // 3. Cache for 60 seconds
    if (redisUrl && redisToken) {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({ url: redisUrl, token: redisToken });
      await redis.set(CACHE_KEY, JSON.stringify(payload), { ex: 60 });
    }

    return NextResponse.json(payload, { status: 200, headers: { 'X-Cache': 'MISS' } });

  } catch (error: any) {
    console.error('[Dashboard Stats] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
