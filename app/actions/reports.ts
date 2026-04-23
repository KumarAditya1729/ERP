'use server'
import { requireAuth } from '@/lib/auth-guard';

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function getDashboardAnalytics() {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient()
  
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) throw new Error("Unauthorized");

  const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', supabaseUser.id).single();
  if (!profile) throw new Error("Profile not found");

  const tenant = profile.tenant_id;

  // 1. Fee Analytics (Revenue) using materialized view
  const { data: feesSummary } = await supabaseAdmin.from('tenant_fee_summary').select('collected, pending').eq('tenant_id', tenant).single();
  let totalCollected = feesSummary?.collected || 0;
  let totalPending = feesSummary?.pending || 0;

  // 2. Admissions Pipeline
  const { data: admissions } = await supabaseAdmin.from('admission_applications').select('stage').eq('tenant_id', tenant);
  const admissionsFunnel = { Applied: 0, Verified: 0, Interviewed: 0, Offered: 0, Enrolled: 0, Rejected: 0 };
  if (admissions) {
    admissions.forEach(a => {
      if (admissionsFunnel[a.stage as keyof typeof admissionsFunnel] !== undefined) {
        admissionsFunnel[a.stage as keyof typeof admissionsFunnel]++;
      }
    });
  }

  // 3. Students by Gender & Class (Mocked aggregate for presentation if DB is small)
  const { count: totalStudents } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant).eq('status', 'active');
  
  // 4. Daily Attendance Trend (Last 7 Days)
  const today = new Date();
  const past7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  
  const { data: attendanceData } = await supabaseAdmin
    .from('attendance')
    .select('date, status')
    .eq('tenant_id', tenant)
    .gte('date', past7Days[0])
    .lte('date', past7Days[6]);

  const attendanceTrend = past7Days.map(date => {
    if (!attendanceData) return 0;
    const records = attendanceData.filter(a => a.date === date);
    if (records.length === 0) return 0;
    const present = records.filter(a => a.status === 'present').length;
    return Math.round((present / records.length) * 100);
  });

  return {
    success: true,
    data: {
      fees: { collected: totalCollected, pending: totalPending },
      admissions: admissionsFunnel,
      totalStudents: totalStudents || 0,
      attendanceTrend
    }
  };
}
