'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'
import { sendBulkSMS } from '@/lib/services/twilio'
// using direct async execution instead of unstable_after due to Next 14
import { CommunicationNoticeSchema } from '@/lib/validation'

// Removed getAdminClientAndTenant() to fix N+1 query and RLS bypass

export async function getTeacherNotices() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId) throw new Error('Unauthorized');

  try {
    const supabase = createClient();
    
    // Teachers should see notices meant for staff or all-staff or all
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendNotice(formData: {
  title: string;
  body: string;
  target: string;
  channels: string[];
}) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr || !tenantId || !user) throw new Error('Unauthorized');

  try {
    const supabase = createClient();

    const parseResult = CommunicationNoticeSchema.safeParse(formData);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.errors[0].message };
    }

    const validData = parseResult.data;

    // Get real recipient count from DB
    let recipientCount = 0;
    if (validData.target === 'all-parents' || validData.target === 'all-students') {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active');
      recipientCount = count || 0;
    } else if (validData.target === 'all-staff') {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('role', ['staff', 'teacher', 'admin']);
      recipientCount = count || 0;
    } else {
      recipientCount = 0;
    }

    const { error: insertError } = await supabase.from('notices').insert([{
      tenant_id: tenantId,
      title: validData.title.trim(),
      raw_content: validData.body.trim(),
      audience_segment: validData.target,
      channels: validData.channels,
      target_count: recipientCount,
      created_by: user.id
    }]);

    if (insertError) {
      console.error('[sendNotice] DB insert failed:', insertError);
      return { success: false, error: insertError.message };
    }

    // 5. Dispatch multi-channel notifications
    const { data: students } = await supabase
      .from('students')
      .select('guardian_phone, guardian_name, email')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (students && students.length > 0) {
      // SMS Channel
      if (validData.channels.includes('SMS')) {
        const smsPayloads = students
          .filter(s => s.guardian_phone && s.guardian_phone.length >= 10)
          .map(s => ({
            to: s.guardian_phone.startsWith('+') ? s.guardian_phone : `+91${s.guardian_phone.replace(/[^\d]/g, '')}`,
            message: `[${validData.title}] ${validData.body.substring(0, 120)} — NexSchool`
          }));

        (async () => {
          const chunkSize = 50;
          for (let i = 0; i < smsPayloads.length; i += chunkSize) {
            const chunk = smsPayloads.slice(i, i + chunkSize);
            await sendBulkSMS(chunk).catch(err => console.error('[Notice SMS] Bulk SMS chunk error:', err));
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        })();
      }

      // EMAIL Channel
      if (validData.channels.includes('Email')) {
        const { sendEmail } = await import('@/lib/services/email');
        (async () => {
          for (const s of students) {
            if (s.email && s.email.includes('@')) {
              await sendEmail({
                to: s.email,
                subject: `School Notice: ${validData.title}`,
                body: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #7C3AED;">NexSchool AI Notice</h2>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p>Dear Parent/Student,</p>
                    <p style="font-size: 16px; line-height: 1.5;">${validData.body}</p>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                      This is an automated notification from NexSchool AI ERP.
                    </div>
                  </div>
                `
              }).catch(err => console.error('[Notice Email] Send error:', err));
            }
          }
        })();
      }

      // IN-APP Notification Channel
      if (validData.channels.includes('In-App')) {
         (async () => {
           // 1. Get all relevant profile IDs based on target
           let targetProfiles: any[] = [];
           if (validData.target === 'all-parents' || validData.target === 'all-students') {
              const { data } = await supabase.from('profiles').select('id').eq('tenant_id', tenantId).in('role', ['parent', 'student']);
              targetProfiles = data || [];
           } else if (validData.target === 'all-staff') {
              const { data } = await supabase.from('profiles').select('id').eq('tenant_id', tenantId).in('role', ['staff', 'teacher', 'admin']);
              targetProfiles = data || [];
           }

           if (targetProfiles.length > 0) {
              const notificationRecords = targetProfiles.map(p => ({
                tenant_id: tenantId,
                user_id: p.id,
                title: validData.title,
                body: validData.body.substring(0, 200),
                type: 'info'
              }));
              await supabase.from('notifications').insert(notificationRecords);
           }
         })();
      }
    }

    revalidatePath('/', 'layout');
    return { success: true, recipientCount };

  } catch (err: any) {
    console.error('[sendNotice] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
