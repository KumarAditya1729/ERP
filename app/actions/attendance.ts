'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'
import { sendSMS } from '@/lib/services/twilio'
import { unstable_after as after } from 'next/server'

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
      const { data: absentStudents } = await supabaseAdmin
        .from('students')
        .select('first_name, last_name, guardian_name, guardian_phone')
        .in('id', absentIds);
      
      if (absentStudents && absentStudents.length > 0) {
        // Enqueue background processing safely in Next.js Serverless environments
        after(() => {
          Promise.all(
            absentStudents
              .filter((s: any) => s.guardian_phone && s.guardian_phone.length >= 10)
              .map((s: any) => sendSMS({
                to: s.guardian_phone.startsWith('+') ? s.guardian_phone : `+91${s.guardian_phone.replace(/[- ]/g, '')}`,
                message: `Dear ${s.guardian_name}, your child ${s.first_name} ${s.last_name} was marked ABSENT today (${dateStr}). Please contact the school for information. — NexSchool`
              }))
          ).catch(err => console.error('[Attendance SMS] Batch SMS failed:', err));
        });
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
