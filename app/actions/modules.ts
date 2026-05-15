'use server'
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ─── LIBRARY ──────────────────────────────────────────────────────────────────

export async function issueBook(bookId: string, studentId: string, dueDays: number = 14) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Check availability
    const { data: book } = await supabase.from('library_books').select('available_copies, title').eq('id', bookId).single();
    if (!book || book.available_copies < 1) return { success: false, error: 'No copies available' };

    // Create issue record
    const { error: issueErr } = await supabase.from('library_issues').insert({
      tenant_id: tenantId,
      book_id: bookId,
      student_id: studentId,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      status: 'issued'
    });
    if (issueErr) throw issueErr;

    // Decrement available copies
    await supabase.from('library_books').update({ available_copies: book.available_copies - 1 }).eq('id', bookId);

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function returnBook(issueId: string) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const { data: issue } = await supabase.from('library_issues').select('*, library_books(fine_per_day)').eq('id', issueId).single();
    if (!issue) return { success: false, error: 'Issue record not found' };

    const today = new Date();
    const due = new Date(issue.due_date);
    let fine = 0;
    if (today > due) {
      const daysLate = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      fine = daysLate * (issue.library_books?.fine_per_day || 2);
    }

    await supabase.from('library_issues').update({
      status: fine > 0 ? 'overdue' : 'returned',
      return_date: today.toISOString().split('T')[0],
      fine_amount: fine
    }).eq('id', issueId);

    // Fetch current count and increment
    const { data: bookData } = await supabase.from('library_books').select('available_copies').eq('id', issue.book_id).single();
    if (bookData) {
      await supabase.from('library_books').update({ available_copies: bookData.available_copies + 1 }).eq('id', issue.book_id);
    }

    revalidatePath('/', 'layout');
    return { success: true, fine };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getLibraryDashboard() {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const [booksRes, issuesRes] = await Promise.all([
      supabase.from('library_books').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('library_issues').select('*, library_books(title, isbn), students(first_name, last_name, roll_number, class_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50)
    ]);
    
    // Mark overdue issues
    const today = new Date().toISOString().split('T')[0];
    const issues = (issuesRes.data || []).map((i: any) => ({
      ...i,
      status: i.status === 'issued' && i.due_date < today ? 'overdue' : i.status
    }));

    return { success: true, data: { books: booksRes.data || [], issues } };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── HOSTEL ───────────────────────────────────────────────────────────────────

export async function requestGatePass(payload: { studentId: string; reason: string; departureDate: string; returnDate: string; phoneNumber: string }) {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'parent', 'student']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data, error } = await supabase.from('hostel_gate_passes').insert({
      tenant_id: tenantId,
      student_id: payload.studentId,
      reason: payload.reason,
      departure_date: payload.departureDate,
      return_date: payload.returnDate,
      otp_code: otp,
      otp_expires_at: otpExpiry,
      status: 'pending_otp'
    }).select().single();
    if (error) throw error;

    // Send OTP via existing notifications utility
    if (process.env.TWILIO_ACCOUNT_SID) {
      try {
        const { dispatchNotification } = await import('@/lib/notifications');
        await dispatchNotification({
          channel: 'SMS',
          to: payload.phoneNumber,
          body: `NexSchool Gate Pass OTP: ${otp}. Valid for 15 minutes. Do not share.`
        });
      } catch (notifErr: any) { console.error('OTP send error:', notifErr); }
    }

    revalidatePath('/', 'layout');
    return { success: true, gatePassId: data.id };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function verifyGatePassOTP(gatePassId: string, otp: string) {
  const { tenantId, user, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const { data: gatePass } = await supabase.from('hostel_gate_passes').select('*').eq('id', gatePassId).single();
    if (!gatePass) return { success: false, error: 'Gate pass not found' };
    if (gatePass.otp_code !== otp) return { success: false, error: 'Invalid OTP' };
    if (new Date() > new Date(gatePass.otp_expires_at)) return { success: false, error: 'OTP expired' };

    await supabase.from('hostel_gate_passes').update({
      otp_verified: true,
      status: 'approved',
      approved_by: user?.id,
      approved_at: new Date().toISOString()
    }).eq('id', gatePassId);

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getGatePasses() {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('hostel_gate_passes')
      .select('*, students(first_name, last_name, class_name, roll_number)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── HR & PAYROLL ─────────────────────────────────────────────────────────────

export async function getHRDashboard() {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const [staffRes, payslipsRes, leaveRes] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, role, email, phone, created_at').eq('tenant_id', tenantId).in('role', ['teacher', 'staff', 'admin']).order('first_name'),
      supabase.from('hr_payslips').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
      supabase.from('hr_leave_requests').select('*, profiles(first_name, last_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50)
    ]);
    return { success: true, data: {
      staff: staffRes.data || [],
      payslips: payslipsRes.data || [],
      leaveRequests: leaveRes.data || []
    }};
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function generatePayslip(payload: { staffId: string; month: string; basicSalary: number; allowances: number; deductions: number }) {
  const { tenantId, error: authErr } = await requireAuth(['admin']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    // Count approved leaves for that month to auto-calculate leave deductions
    const [year, mon] = payload.month.split('-');
    const { count: leaveDays } = await supabase.from('hr_leave_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('staff_id', payload.staffId).eq('status', 'approved')
      .gte('start_date', `${year}-${mon}-01`).lte('end_date', `${year}-${mon}-31`);

    const leaveDeductions = Math.min((leaveDays || 0) * (payload.basicSalary / 26), payload.basicSalary);
    const netPayable = payload.basicSalary + payload.allowances - payload.deductions - leaveDeductions;

    const { error } = await supabase.from('hr_payslips').upsert({
      tenant_id: tenantId,
      staff_id: payload.staffId,
      month: payload.month,
      basic_salary: payload.basicSalary,
      allowances: payload.allowances,
      deductions: payload.deductions,
      leave_deductions: leaveDeductions,
      net_payable: netPayable,
      status: 'draft'
    }, { onConflict: 'tenant_id,staff_id,month' });
    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true, netPayable };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function submitLeaveRequest(payload: { leaveType: string; startDate: string; endDate: string; reason: string }) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId || !user) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const start = new Date(payload.startDate);
    const end = new Date(payload.endDate);
    const daysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { error } = await supabase.from('hr_leave_requests').insert({
      tenant_id: tenantId, staff_id: user.id,
      leave_type: payload.leaveType, start_date: payload.startDate,
      end_date: payload.endDate, days_count: daysCount,
      reason: payload.reason, status: 'pending'
    });
    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function reviewLeaveRequest(requestId: string, status: 'approved' | 'rejected') {
  const { user, tenantId, error: authErr } = await requireAuth(['admin']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const { error } = await supabase.from('hr_leave_requests').update({
      status, reviewed_by: user?.id, reviewed_at: new Date().toISOString()
    }).eq('id', requestId).eq('tenant_id', tenantId);
    if (error) throw error;
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function markPayslipPaid(payslipId: string) {
  const { tenantId, error: authErr } = await requireAuth(['admin']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    await supabase.from('hr_payslips').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payslipId).eq('tenant_id', tenantId);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────

export async function bulkSubmitAttendance(className: string, records: { studentId: string; status: 'present' | 'absent' | 'late' }[]) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const rows = records.map(r => ({
      tenant_id: tenantId,
      student_id: r.studentId,
      date: today,
      status: r.status,
      class_name: className
    }));

    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'tenant_id,student_id,date' });
    if (error) throw error;

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount = records.filter(r => r.status === 'absent').length;

    // Log bulk submission
    await supabase.from('attendance_bulk_logs').upsert({
      tenant_id: tenantId, class_name: className, date: today,
      submitted_by: user?.id, total_students: records.length,
      present_count: presentCount, absent_count: absentCount
    }, { onConflict: 'tenant_id,class_name,date' });

    // Trigger SMS for absent students via QStash if configured
    if (process.env.QSTASH_TOKEN && absentCount > 0) {
      const absentStudentIds = records.filter(r => r.status === 'absent').map(r => r.studentId);
      const { Client } = await import('@upstash/qstash');
      const qstash = new Client({ token: process.env.QSTASH_TOKEN });
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;
      await qstash.publishJSON({ url: `${baseUrl}/api/jobs/send-absence-sms`, body: { tenantId, studentIds: absentStudentIds, date: today } }).catch(() => null);
    }

    revalidatePath('/', 'layout');
    return { success: true, presentCount, absentCount };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getAttendanceDashboard(className?: string) {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    let studentsQuery = supabase.from('students').select('id, first_name, last_name, roll_number, class_name').eq('tenant_id', tenantId).order('class_name').order('roll_number');
    if (className) studentsQuery = studentsQuery.eq('class_name', className);

    const [studentsRes, todayAttRes, bulkLogsRes] = await Promise.all([
      studentsQuery,
      supabase.from('attendance').select('student_id, status').eq('tenant_id', tenantId).eq('date', today),
      supabase.from('attendance_bulk_logs').select('*').eq('tenant_id', tenantId).order('date', { ascending: false }).limit(10)
    ]);

    const todayMap: Record<string, string> = {};
    (todayAttRes.data || []).forEach((a: any) => { todayMap[a.student_id] = a.status; });

    return { success: true, data: { students: studentsRes.data || [], todayMap, bulkLogs: bulkLogsRes.data || [] } };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── COMMUNICATION ────────────────────────────────────────────────────────────

export async function sendNotice(payload: { title: string; body: string; rawContent: string; targetAudience: string; channels: string[] }) {
  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();

    const { data: notice, error } = await supabase.from('notices').insert({
      tenant_id: tenantId, title: payload.title, body: payload.body,
      raw_content: payload.rawContent, target_audience: payload.targetAudience,
      channels: payload.channels, sent_by: user?.id
    }).select().single();
    if (error) throw error;

    // Dispatch via QStash for async email/SMS
    if (process.env.QSTASH_TOKEN) {
      const { Client } = await import('@upstash/qstash');
      const qstash = new Client({ token: process.env.QSTASH_TOKEN });
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${process.env.VERCEL_URL}`;
      for (const channel of payload.channels) {
        await qstash.publishJSON({ url: `${baseUrl}/api/jobs/send-notice`, body: { noticeId: notice.id, tenantId, channel } }).catch(() => null);
      }
    }

    revalidatePath('/', 'layout');
    return { success: true, noticeId: notice.id };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getNotices() {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'parent', 'student']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from('notices')
      .select('*, notice_deliveries(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────

export async function getReportsDashboard() {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const [studentsRes, feesRes, attendanceRes, examsRes, hwRes] = await Promise.all([
      supabase.from('students').select('id, class_name, created_at, status').eq('tenant_id', tenantId),
      supabase.from('fee_payments').select('amount, paid_at, method').eq('tenant_id', tenantId).gte('paid_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('attendance').select('status, date, class_name').eq('tenant_id', tenantId).gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabase.from('exams_data').select('marks_obtained, max_marks, subject').eq('tenant_id', tenantId),
      supabase.from('homework_submissions').select('status, created_at').eq('tenant_id', tenantId)
    ]);

    const students = studentsRes.data || [];
    const payments = feesRes.data || [];
    const attendance = attendanceRes.data || [];
    const exams = examsRes.data || [];
    const submissions = hwRes.data || [];

    // Monthly revenue (last 6 months)
    const revenueByMonth: Record<string, number> = {};
    payments.forEach((p: any) => {
      const month = new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      revenueByMonth[month] = (revenueByMonth[month] || 0) + Number(p.amount);
    });

    // Class-wise student count
    const studentsByClass: Record<string, number> = {};
    students.forEach((s: any) => { studentsByClass[s.class_name || 'Unknown'] = (studentsByClass[s.class_name || 'Unknown'] || 0) + 1; });

    // Attendance rate
    const presentCount = attendance.filter((a: any) => a.status === 'present').length;
    const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

    // Avg exam score
    const avgScore = exams.length > 0 ? Math.round(exams.reduce((s: number, e: any) => s + (Number(e.marks_obtained) / Number(e.max_marks)) * 100, 0) / exams.length) : 0;

    // HW submission rate
    const submittedHW = submissions.filter((s: any) => s.status !== 'missing').length;
    const hwRate = submissions.length > 0 ? Math.round((submittedHW / submissions.length) * 100) : 0;

    return { success: true, data: {
      totalStudents: students.length,
      activeStudents: students.filter((s: any) => s.status === 'active').length,
      totalRevenue: payments.reduce((s: number, p: any) => s + Number(p.amount), 0),
      revenueByMonth: Object.entries(revenueByMonth).map(([month, amount]) => ({ month, amount })),
      studentsByClass: Object.entries(studentsByClass).map(([class_name, count]) => ({ class_name, count })),
      attendanceRate,
      avgExamScore: avgScore,
      hwSubmissionRate: hwRate,
    }};
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ─── STUDENTS 360° ────────────────────────────────────────────────────────────

export async function getStudent360(studentId: string) {
  const { tenantId, error: authErr } = await requireAuth(['admin', 'staff', 'teacher', 'parent', 'student']);
  if (authErr || !tenantId) return { success: false, error: 'Unauthorized' };
  try {
    const supabase = createClient();
    const [studentRes, feesRes, attendanceRes, examsRes, hwRes, libraryRes, transportRes] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).eq('tenant_id', tenantId).single(),
      supabase.from('fee_invoices').select('month_label, total_amount, status, paid_at').eq('student_id', studentId).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(12),
      supabase.from('attendance').select('status, date').eq('student_id', studentId).eq('tenant_id', tenantId).order('date', { ascending: false }).limit(30),
      supabase.from('exams_data').select('subject, marks_obtained, max_marks').eq('student_id', studentId).eq('tenant_id', tenantId),
      supabase.from('homework_submissions').select('status, score, assignment_id, updated_at').eq('student_id', studentId).eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(10),
      supabase.from('library_issues').select('*, library_books(title, author)').eq('student_id', studentId).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
      supabase.from('transport_student_assignments').select('*, transport_routes(name, bus_number)').eq('student_id', studentId).eq('tenant_id', tenantId).single()
    ]);

    const attendance = attendanceRes.data || [];
    const present = attendance.filter((a: any) => a.status === 'present').length;
    const attendancePct = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

    const exams = examsRes.data || [];
    const avgScore = exams.length > 0 ? Math.round(exams.reduce((s: number, e: any) => s + (Number(e.marks_obtained) / Number(e.max_marks)) * 100, 0) / exams.length) : 0;

    const pendingFees = (feesRes.data || []).filter((f: any) => f.status === 'pending').reduce((s: number, f: any) => s + Number(f.total_amount), 0);

    return { success: true, data: {
      student: studentRes.data,
      attendance: { records: attendance, pct: attendancePct },
      exams: { records: exams, avgScore },
      fees: { invoices: feesRes.data || [], pendingFees },
      homework: hwRes.data || [],
      library: libraryRes.data || [],
      transport: transportRes.data
    }};
  } catch (e: any) { return { success: false, error: e.message }; }
}
