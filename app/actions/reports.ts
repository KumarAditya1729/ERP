'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function getDashboardAnalytics() {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: profile } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', user.id).single();
  if (!profile) throw new Error("Profile not found");

  const tenant = profile.tenant_id;

  // 1. Fee Analytics (Revenue)
  const { data: fees } = await supabase.from('fees').select('amount, status').eq('tenant_id', tenant);
  let totalCollected = 0;
  let totalPending = 0;
  if (fees) {
    fees.forEach(f => {
      if (f.status === 'paid') totalCollected += f.amount;
      else totalPending += f.amount;
    });
  }

  // 2. Admissions Pipeline
  const { data: admissions } = await supabase.from('admission_applications').select('stage').eq('tenant_id', tenant);
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
