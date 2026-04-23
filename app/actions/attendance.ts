'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'
import { sendSMS } from '@/lib/services/twilio'
import { Client } from "@upstash/qstash";

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { z } from 'zod';

// Zod Schema for Validation
const attendanceSchema = z.object({
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  records: z.array(z.object({
    student_id: z.string().uuid("Invalid student ID"),
    status: z.enum(['present', 'absent', 'late'])
  }))
});

// Setup Rate Limiting
const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;
const ratelimit = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
}) : null;

export async function saveAttendance(dateStr: string, records: any[]) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  // 1. Zod Validation
  const parsed = attendanceSchema.safeParse({ dateStr, records });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }
  const validatedRecords = parsed.data.records;

  // 2. Rate Limiting
  if (ratelimit) {
    const { success } = await ratelimit.limit(`attendance_${user.id}`);
    if (!success) {
      return { success: false, error: 'Too many requests. Please try again later.' };
    }
  }

  const supabase = createClient()
  
  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) return { success: false, error: 'Unauthorized' };
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
    if (!profile) return { success: false, error: 'Profile not found' };

    const dbRecords = validatedRecords.map(r => ({
      tenant_id: profile.tenant_id,
      student_id: r.student_id,
      date: dateStr,
      status: r.status,
      marked_by: supabaseUser.id
    }));

    const { error } = await supabaseAdmin.from('attendance').upsert(dbRecords, { onConflict: 'student_id,date' });

    if (error) {
      console.error("Save Attendance Error:", error);
      return { success: false, error: error.message };
    }

    // Trigger SMS for absent students — fetch their guardian phone numbers
    const absentIds = validatedRecords.filter(r => r.status === 'absent').map(r => r.student_id);
    
    if (absentIds.length > 0) {
      if (process.env.QSTASH_TOKEN) {
        const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        
        await qstashClient.publishJSON({
          url: `${baseUrl}/api/jobs/send-attendance-sms`,
          body: {
            absentIds,
            dateStr,
            tenantId: profile.tenant_id
          }
        });
      } else {
        console.warn('QSTASH_TOKEN missing. SMS queue bypassed.');
      }
    }

    revalidatePath('/', 'layout');
    revalidatePath('/', 'layout');
    return { success: true, absentCount: absentIds.length };

  } catch (err: any) {
    console.error('[saveAttendance] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred. Please try again.' };
  }
}
