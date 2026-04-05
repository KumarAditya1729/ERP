'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache'
import { sendBulkSMS } from '@/lib/services/twilio'

async function getAdminClientAndTenant() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) throw new Error('Profile not found');

  return { supabaseAdmin, user, profile, tenantId: profile.tenant_id as string };
}

export async function getTeacherNotices() {
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
  try {
    const { supabaseAdmin, user, tenantId } = await getAdminClientAndTenant();

    if (!formData.title.trim() || !formData.body.trim()) {
      return { success: false, error: 'Title and message body are required.' };
    }

    // Get real recipient count from DB
    let recipientCount = 0;
    if (formData.target === 'all-parents' || formData.target === 'all-students') {
      const { count } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active');
      recipientCount = count || 0;
    } else if (formData.target === 'all-staff') {
      const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('role', ['staff', 'teacher', 'admin']);
      recipientCount = count || 0;
    } else {
      recipientCount = 0;
    }

    const { error: insertError } = await supabaseAdmin.from('notices').insert([{
      tenant_id: tenantId,
      title: formData.title.trim(),
      raw_content: formData.body.trim(),
      audience_segment: formData.target,
      channels: formData.channels,
      target_count: recipientCount,
      created_by: user.id
    }]);

    if (insertError) {
      console.error('[sendNotice] DB insert failed:', insertError);
      return { success: false, error: insertError.message };
    }

    // If SMS channel selected — dispatch real SMS via Twilio
    if (formData.channels.includes('SMS')) {
      const { data: students } = await supabaseAdmin
        .from('students')
        .select('guardian_phone, guardian_name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .limit(200); // cap at 200 per bulk send for MVP

      if (students && students.length > 0) {
        const smsPayloads = students
          .filter(s => s.guardian_phone && s.guardian_phone.length >= 10)
          .map(s => ({
            to: s.guardian_phone.startsWith('+') ? s.guardian_phone : `+91${s.guardian_phone.replace(/[^\d]/g, '')}`,
            message: `[${formData.title}] ${formData.body.substring(0, 120)} — NexSchool`
          }));

        // Fire-and-forget bulk SMS 
        sendBulkSMS(smsPayloads).catch(err => console.error('[Notice SMS] Bulk SMS error:', err));
      }
    }

    revalidatePath('/dashboard/communication');
    return { success: true, recipientCount };

  } catch (err: any) {
    console.error('[sendNotice] Unexpected error:', err);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
