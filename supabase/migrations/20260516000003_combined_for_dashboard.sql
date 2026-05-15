-- ============================================================================
-- NexSchool ERP — Phase B+C Deep Build Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- URL: https://supabase.com/dashboard/project/ksivirncnutmjzscsacp/sql/new
-- ============================================================================

-- ─── HOMEWORK: Submission Files & Comments ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.homework_submission_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.homework_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_role TEXT,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.homework_submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_view_hw_files" ON public.homework_submission_files
  FOR SELECT USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "admin_write_hw_files" ON public.homework_submission_files
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff', 'teacher'));
CREATE POLICY "student_insert_hw_files" ON public.homework_submission_files
  FOR INSERT WITH CHECK (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE POLICY "tenant_view_hw_comments" ON public.homework_comments
  FOR SELECT USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_insert_hw_comments" ON public.homework_comments
  FOR INSERT WITH CHECK (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND author_id = auth.uid());

-- Storage bucket for homework files
INSERT INTO storage.buckets (id, name, public) VALUES ('homework_files', 'homework_files', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "hw_files_select" ON storage.objects FOR SELECT USING (bucket_id = 'homework_files');
CREATE POLICY "hw_files_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'homework_files');

-- ─── LIBRARY: Fine tracking ───────────────────────────────────────────────────

ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS fine_per_day NUMERIC DEFAULT 2.00;
ALTER TABLE public.library_issues
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── HOSTEL: Gate Pass System ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hostel_gate_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    otp_code TEXT,
    otp_verified BOOLEAN DEFAULT false,
    otp_expires_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('pending_otp', 'approved', 'rejected', 'completed')) DEFAULT 'pending_otp',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hostel_gate_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_gate_passes" ON public.hostel_gate_passes FOR ALL
  USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- ─── HR: Leave Requests & Payslips ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type TEXT CHECK (leave_type IN ('sick', 'casual', 'earned', 'unpaid')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    basic_salary NUMERIC NOT NULL DEFAULT 0,
    allowances NUMERIC NOT NULL DEFAULT 0,
    deductions NUMERIC NOT NULL DEFAULT 0,
    leave_deductions NUMERIC NOT NULL DEFAULT 0,
    net_payable NUMERIC NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('draft', 'paid')) DEFAULT 'draft',
    paid_at TIMESTAMPTZ,
    pdf_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, staff_id, month)
);

ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_hr_leave" ON public.hr_leave_requests FOR ALL
  USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff'));
CREATE POLICY "staff_own_leave_select" ON public.hr_leave_requests FOR SELECT
  USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id') AND staff_id = auth.uid());
CREATE POLICY "staff_own_leave_insert" ON public.hr_leave_requests FOR INSERT
  WITH CHECK (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id') AND staff_id = auth.uid());

CREATE POLICY "admin_payslips" ON public.hr_payslips FOR ALL
  USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
CREATE POLICY "staff_own_payslips" ON public.hr_payslips FOR SELECT
  USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id') AND staff_id = auth.uid());

-- ─── ATTENDANCE: Bulk Submission Logs ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance_bulk_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    submitted_by UUID REFERENCES public.profiles(id),
    total_students INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    sms_sent_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, class_name, date)
);

ALTER TABLE public.attendance_bulk_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_attendance_bulk" ON public.attendance_bulk_logs FOR ALL
  USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff', 'teacher'));

-- ─── COMMUNICATION: Notice Delivery Tracking ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notice_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
    channel TEXT CHECK (channel IN ('email', 'sms', 'push')) NOT NULL,
    recipient_count INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ DEFAULT now(),
    status TEXT CHECK (status IN ('sent', 'failed', 'partial')) DEFAULT 'sent',
    error_message TEXT
);

ALTER TABLE public.notice_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_notice_deliveries" ON public.notice_deliveries FOR ALL
  USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff'));

ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS raw_content TEXT;

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_hw_sub_files_sub ON public.homework_submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_hw_comments_sub ON public.homework_comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_student ON public.hostel_gate_passes(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON public.hr_leave_requests(staff_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_payslips_staff_month ON public.hr_payslips(staff_id, month);
CREATE INDEX IF NOT EXISTS idx_attendance_bulk ON public.attendance_bulk_logs(tenant_id, class_name, date);
CREATE INDEX IF NOT EXISTS idx_notice_deliveries ON public.notice_deliveries(notice_id);
