'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'
import { sendSMS } from '@/lib/services/twilio'
import { Client } from "@upstash/qstash";

type AttendanceRecord = {
  student_id: string;
  status: string;
};

export async function saveAttendance(dateStr: string, records: AttendanceRecord[]) {
  const supabase = createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return { success: false, error: 'Profile not found' };

    const dbRecords = records.map(r => ({
      tenant_id: profile.tenant_id,
      student_id: r.student_id,
      date: dateStr,
      status: r.status,
      marked_by: user.id
    }));

    const { error } = await supabaseAdmin.from('attendance').upsert(dbRecords, { onConflict: 'student_id,date' });

    if (error) {
      console.error("Save Attendance Error:", error);
      return { success: false, error: error.message };
    }

    // Trigger SMS for absent students — fetch their guardian phone numbers
    const absentIds = records.filter(r => r.status === 'absent').map(r => r.student_id);
    
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
