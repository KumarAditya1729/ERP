import { requireAuth } from '@/lib/auth-guard';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/logs/stream
 * Server-Sent Events endpoint that streams live audit log entries.
 * Polls Supabase every 2s for new rows since the connection opened.
 * Tenant-isolated via session profile lookup.
 */
export async function GET(req: Request) {
  const { user, tenantId, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  }

  // user and tenantId are already authenticated by requireAuth
  const since = new Date().toISOString();

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send a connection-established event immediately
      controller.enqueue(encoder.encode(
        `event: connected\ndata: ${JSON.stringify({ tenantId, since })}\n\n`
      ));

      const poll = async () => {
        if (closed) return;
        try {
          const { data: logs } = await supabaseAdmin
            .from('audit_logs')
            .select('*')
            .eq('tenant_id', tenantId)
            .gte('created_at', since)
            .order('created_at', { ascending: true })
            .limit(50);

          if (logs && logs.length > 0) {
            for (const log of logs) {
              if (closed) break;
              controller.enqueue(encoder.encode(
                `event: log\ndata: ${JSON.stringify(log)}\n\n`
              ));
            }
          }
        } catch {
          // Silently continue on transient errors
        }

        if (!closed) {
          setTimeout(poll, 2000);
        }
      };

      setTimeout(poll, 2000);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for SSE
    },
  });
}
