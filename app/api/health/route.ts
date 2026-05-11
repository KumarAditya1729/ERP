import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/health
 *
 * Public health-check endpoint consumed by:
 *  - Vercel deployment smoke tests
 *  - Uptime monitoring (Better Uptime, UptimeRobot, etc.)
 *  - GitHub Actions post-deploy verification
 *
 * Returns HTTP 200 when healthy, 503 when degraded.
 * Does NOT expose secrets or internal error details.
 */
export async function GET() {
  const timestamp = new Date().toISOString();
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    '0.1.0';

  // ── Lightweight DB ping ────────────────────────────────────────────────────
  let dbStatus: 'ok' | 'degraded' = 'degraded';
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      // Single lightweight query — uses anon key, no RLS bypass needed
      const { error } = await supabase
        .from('tenants')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (!error) dbStatus = 'ok';
    }
  } catch {
    // DB unreachable — status stays degraded
  }

  const overallStatus: 'ok' | 'degraded' = dbStatus === 'ok' ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      version,
      checks: { database: dbStatus },
    },
    { status: overallStatus === 'ok' ? 200 : 503 },
  );
}
