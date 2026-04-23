'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache'
import { sendBulkSMS } from '@/lib/services/twilio'
// using direct async execution instead of unstable_after due to Next 14
import { CommunicationNoticeSchema } from '@/lib/validation'

async function getAdminClientAndTenant() {
  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error('Unauthorized');

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error('Profile not found');

  return { supabaseAdmin, user: supabaseUser, profile, tenantId: profile.tenant_id as string };
}

export async function getTeacherNotices() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, tenantId } = await getAdminClientAndTenant();
    
    // Teachers should see notices meant for staff or all-staff or all
    const { data, error } = await supabaseAdmin
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
  if (authErr) throw new Error('Unauthorized');

  try {
    const { supabaseAdmin, user, tenantId } = await getAdminClientAndTenant();

    const parseResult = CommunicationNoticeSchema.safeParse(formData);
    if (!parseResult.success) {
      return { success: false, error: parseResult.error.errors[0].message };
    }

    const validData = parseResult.data;

    // Get real recipient count from DB
    let recipientCount = 0;
    if (validData.target === 'all-parents' || validData.target === 'all-students') {
      const { count } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active');
      recipientCount = count || 0;
    } else if (validData.target === 'all-staff') {
      const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('role', ['staff', 'teacher', 'admin']);
      recipientCount = count || 0;
    } else {
      recipientCount = 0;
    }

    const { error: insertError } = await supabaseAdmin.from('notices').insert([{
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

    // If SMS channel selected — dispatch real SMS via Twilio
      if (validData.channels.includes('SMS')) {
        const { data: students } = await supabaseAdmin
          .from('students')
          .select('guardian_phone, guardian_name')
          .eq('tenant_id', tenantId)
          .eq('status', 'active');

        if (students && students.length > 0) {
            const smsPayloads = students
              .filter(s => s.guardian_phone && s.guardian_phone.length >= 10)
              .map(s => ({
                to: s.guardian_phone.startsWith('+') ? s.guardian_phone : `+91${s.guardian_phone.replace(/[^\d]/g, '')}`,
                message: `[${validData.title}] ${validData.body.substring(0, 120)} — NexSchool`
              }));

            // Fire-and-forget background processing
            (async () => {
              const chunkSize = 100;
              for (let i = 0; i < smsPayloads.length; i += chunkSize) {
                const chunk = smsPayloads.slice(i, i + chunkSize);
                await sendBulkSMS(chunk).catch(err => console.error('[Notice SMS] Bulk SMS chunk error:', err));
                // Prevent Twilio API rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
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
