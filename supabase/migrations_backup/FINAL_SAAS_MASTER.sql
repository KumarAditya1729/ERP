-- ==============================================================================
-- 🏫 NEXSCHOOL ERP — CONSOLIDATED MASTER SCHEMA
-- Single source of truth for all database tables, RLS policies, triggers & functions.
-- Apply this ONE file to any fresh Supabase project to fully initialize NexSchool.
-- ==============================================================================

-- ==============================================================================
-- SECTION 1: CORE MULTI-TENANCY
-- ==============================================================================

-- 1.1 Tenants (Schools)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    city TEXT,
    subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'growth', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants are viewable by everyone" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Tenants insertable by service role only" ON public.tenants FOR ALL USING (false);

-- 1.2 Profiles (Users: Admin, Teacher, Parent, Staff)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent', 'staff')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for profiles" ON public.profiles
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));


-- ==============================================================================
-- SECTION 2: STUDENTS (SIS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    roll_number TEXT,
    class_grade TEXT NOT NULL,
    section TEXT NOT NULL,
    guardian_name TEXT,
    guardian_phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'alumni')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for students" ON public.students
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- ==============================================================================
-- SECTION 2.5: PARENT - STUDENT LINKS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.parent_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT parent_links_parent_student_unique UNIQUE (parent_id, student_id)
);

ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parent Links readable by Admins or actual Parent" ON public.parent_links FOR SELECT
USING (
    tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR parent_id = auth.uid()
    )
);
-- ==============================================================================
-- SECTION 3: ATTENDANCE
-- ==============================================================================

-- 3.1 Live attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day')),
    marked_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for attendance" ON public.attendance
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);

-- 3.2 Partitioned attendance table (for scale — 1M+ records)
CREATE TABLE IF NOT EXISTS public.attendance_partitioned (
    id uuid DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id),
    student_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day')),
    date date NOT NULL,
    recorded_by uuid REFERENCES auth.users(id),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

-- Monthly partitions for academic year 2026
CREATE TABLE IF NOT EXISTS public.attendance_2026_04 PARTITION OF public.attendance_partitioned FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.attendance_2026_05 PARTITION OF public.attendance_partitioned FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.attendance_2026_06 PARTITION OF public.attendance_partitioned FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX IF NOT EXISTS idx_attendance_part_tenant ON public.attendance_partitioned(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_part_student ON public.attendance_partitioned(student_id);

ALTER TABLE public.attendance_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_2026_04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_2026_06 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant attendance_partitioned" ON public.attendance_partitioned
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation attendance_2026_04" ON public.attendance_2026_04
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation attendance_2026_05" ON public.attendance_2026_05
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation attendance_2026_06" ON public.attendance_2026_06
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));


-- ==============================================================================
-- SECTION 4: FEES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    title TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    payment_method TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
-- Role-based fee isolation: Admin/Staff see all, Parents see only their linked children
CREATE POLICY "Strict isolated fees" ON public.fees FOR SELECT
USING (
    tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
        OR
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'parent'
         AND student_id IN (SELECT student_id FROM public.parent_links WHERE parent_id = auth.uid()))
    )
);
CREATE POLICY "Admin staff write fees" ON public.fees FOR ALL
USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff'));

CREATE INDEX IF NOT EXISTS idx_fees_tenant_status ON public.fees(tenant_id, status);


-- ==============================================================================
-- SECTION 5: COMMUNICATION (Notices)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    channels TEXT[] NOT NULL,
    sent_by UUID REFERENCES public.profiles(id),
    reach_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for notices" ON public.notices
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_notices_tenant_created ON public.notices(tenant_id, created_at DESC);


-- ==============================================================================
-- SECTION 6: ADMISSIONS PIPELINE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admission_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    applying_class TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    previous_school TEXT,
    previous_grade TEXT,
    guardian_name TEXT NOT NULL,
    guardian_phone TEXT NOT NULL,
    guardian_email TEXT,
    stage TEXT NOT NULL DEFAULT 'Applied'
        CHECK (stage IN ('Applied','Documents Verified','Interview Scheduled','Offer Letter','Enrolled','Rejected')),
    docs_status JSONB NOT NULL DEFAULT '{"birth": false, "marks": false, "transfer": false, "photo": false, "aadhar": false}'::jsonb,
    applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
    interview_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.update_admission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER admission_updated_at_trigger
    BEFORE UPDATE ON public.admission_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_admission_updated_at();

ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_admissions" ON public.admission_applications
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admissions_tenant_stage ON public.admission_applications(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_admissions_tenant_date ON public.admission_applications(tenant_id, applied_date DESC);


-- ==============================================================================
-- SECTION 7: HOMEWORK & ASSIGNMENTS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.homework_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    class_name TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    due_date DATE NOT NULL,
    instructions TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'review', 'graded')),
    total_students INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    assignment_id UUID NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('pending', 'missing', 'graded')),
    score TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.update_homework_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER assignments_updated_at_trigger
    BEFORE UPDATE ON public.homework_assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_homework_updated_at();

CREATE TRIGGER submissions_updated_at_trigger
    BEFORE UPDATE ON public.homework_submissions
    FOR EACH ROW EXECUTE FUNCTION public.update_homework_updated_at();

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_assignments" ON public.homework_assignments
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_isolation_submissions" ON public.homework_submissions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_hw_assignments_tenant ON public.homework_assignments(tenant_id, subject);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_assignment ON public.homework_submissions(assignment_id);


-- ==============================================================================
-- SECTION 8: HOSTEL MANAGEMENT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.hostel_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    block_name TEXT NOT NULL,
    room_type TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    floor_level INTEGER NOT NULL,
    occupied INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'partial', 'full')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, room_number)
);

CREATE TABLE IF NOT EXISTS public.hostel_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    bed_number INTEGER NOT NULL,
    allocated_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, bed_number)
);

CREATE OR REPLACE FUNCTION public.update_hostel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER rooms_updated_at_trigger
    BEFORE UPDATE ON public.hostel_rooms
    FOR EACH ROW EXECUTE FUNCTION public.update_hostel_updated_at();

CREATE TRIGGER allocations_updated_at_trigger
    BEFORE UPDATE ON public.hostel_allocations
    FOR EACH ROW EXECUTE FUNCTION public.update_hostel_updated_at();

ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_hostel_rooms" ON public.hostel_rooms
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_isolation_hostel_allocations" ON public.hostel_allocations
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));


-- ==============================================================================
-- SECTION 9: TRANSPORT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.transport_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    bus_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 40,
    enrolled_students INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'on-route' CHECK (status IN ('on-route', 'at-school', 'delayed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for routes" ON public.transport_routes
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE TABLE IF NOT EXISTS public.transport_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('done', 'current', 'upcoming')),
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for stops" ON public.transport_stops
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_transport_routes_tenant ON public.transport_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON public.transport_stops(route_id);


-- ==============================================================================
-- SECTION 10: EXAMS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT,
    class_name TEXT,
    class_grade TEXT,
    exam_date DATE,
    max_marks INTEGER DEFAULT 100,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant exams read" ON public.exams
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Tenant exams write" ON public.exams
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Exam grade results
CREATE TABLE IF NOT EXISTS public.exams_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    exam_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    marks_obtained NUMERIC NOT NULL DEFAULT 0,
    max_marks NUMERIC NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.exams_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolated Exams" ON public.exams_data
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));


-- ==============================================================================
-- SECTION 11: HR PAYROLL
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.hr_payroll (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    month TEXT NOT NULL,
    base_salary NUMERIC NOT NULL DEFAULT 0,
    deductions NUMERIC NOT NULL DEFAULT 0,
    net_payable NUMERIC NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.hr_payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolated Payroll" ON public.hr_payroll
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ==============================================================================
-- SECTION 12: ACADEMIC HIERARCHY
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    room_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    is_class_teacher BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(teacher_id, section_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.student_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    roll_number INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, academic_year)
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_classes" ON public.classes
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_isolation_sections" ON public.sections
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_isolation_subjects" ON public.subjects
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_isolation_teacher_assignments" ON public.teacher_assignments
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "tenant_isolation_student_placements" ON public.student_placements
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));


-- ==============================================================================
-- SECTION 13: RBAC — PARENT-STUDENT LINKS & AUTH TRIGGER
-- ==============================================================================

-- 13.1 Parent → Student relationship table (MOVED TO SECTION 2.5 TO FIX DEPENDENCIES)

-- 13.2 Role-based attendance access
DROP POLICY IF EXISTS "Strict isolated attendance" ON public.attendance;
CREATE POLICY "Strict isolated attendance" ON public.attendance FOR SELECT
USING (
    tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'teacher', 'staff')
        OR
        ((auth.jwt() -> 'app_metadata' ->> 'role') = 'parent'
         AND student_id IN (SELECT student_id FROM public.parent_links WHERE parent_id = auth.uid()))
    )
);


-- ==============================================================================
-- SECTION 14: AUTH TRIGGER — Auto-create profile on user signup
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    extracted_tenant_id uuid;
    extracted_role text;
BEGIN
    extracted_tenant_id := (new.raw_user_meta_data ->> 'tenant_id')::uuid;
    extracted_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

    -- Default to MVP demo tenant if not provided
    IF extracted_tenant_id IS NULL THEN
        extracted_tenant_id := '550e8400-e29b-41d4-a716-446655440000'::uuid;
    END IF;

    -- Ensure tenant exists (idempotent upsert)
    INSERT INTO public.tenants (id, name, city, subscription_tier)
    VALUES (extracted_tenant_id, 'Delhi Public School', 'New Delhi', 'growth')
    ON CONFLICT (id) DO NOTHING;

    -- Auto-create user profile (idempotent)
    INSERT INTO public.profiles (id, tenant_id, role, first_name, last_name, email)
    VALUES (
        new.id,
        extracted_tenant_id,
        extracted_role,
        coalesce(new.raw_user_meta_data ->> 'first_name', 'System'),
        coalesce(new.raw_user_meta_data ->> 'last_name', 'User'),
        new.email
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- SECTION 15: BACKFILL LEGACY USERS (run once after initial deployment)
-- Ensures users created before the trigger had JWT app_metadata from meta_data
-- ==============================================================================

-- This UPDATE merges role and tenant_id into raw_app_meta_data for any
-- users who signed up before the trigger was applied.
UPDATE auth.users u
SET raw_app_meta_data = raw_app_meta_data ||
    jsonb_build_object(
        'role',      p.role,
        'tenant_id', p.tenant_id::text
    )
FROM public.profiles p
WHERE p.id = u.id
  AND (
      u.raw_app_meta_data ->> 'role' IS NULL
      OR u.raw_app_meta_data ->> 'tenant_id' IS NULL
  );


-- ==============================================================================
-- SECTION 16: DEMO SEED DATA (remove / comment out in production)
-- ==============================================================================

-- Seed the demo tenant
INSERT INTO public.tenants (id, name, city, subscription_tier)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Delhi Public School', 'New Delhi', 'growth')
ON CONFLICT (id) DO NOTHING;

-- Seed sample students
INSERT INTO public.students (tenant_id, first_name, last_name, class_grade, section, roll_number, guardian_name, guardian_phone, status)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Arjun', 'Mehta', 'Grade 6', 'A', '101', 'Rajesh Mehta', '+919988776655', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Priya', 'Sharma', 'Grade 6', 'B', '102', 'Sanjay Sharma', '+919988776656', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Rahul', 'Verma', 'Grade 7', 'A', '201', 'Vikram Verma', '+919988776657', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Sneha', 'Gupta', 'Grade 8', 'C', '301', 'Anil Gupta', '+919988776658', 'active'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Vikram', 'Singh', 'Grade 10', 'A', '405', 'Rajendra Singh', '+919988776659', 'active')
ON CONFLICT DO NOTHING;

-- Seed hostel rooms
INSERT INTO public.hostel_rooms (tenant_id, room_number, block_name, room_type, capacity, floor_level, status, occupied)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', '101', 'A Block', 'Dormitory', 8, 1, 'full', 8),
    ('550e8400-e29b-41d4-a716-446655440000', '102', 'A Block', 'Dormitory', 8, 1, 'partial', 4),
    ('550e8400-e29b-41d4-a716-446655440000', '103', 'A Block', 'Semi-Private', 4, 1, 'vacant', 0),
    ('550e8400-e29b-41d4-a716-446655440000', '201', 'B Block', 'Dormitory', 10, 2, 'full', 10),
    ('550e8400-e29b-41d4-a716-446655440000', '202', 'B Block', 'Private', 2, 2, 'vacant', 0),
    ('550e8400-e29b-41d4-a716-446655440000', '203', 'B Block', 'Dormitory', 10, 2, 'partial', 5),
    ('550e8400-e29b-41d4-a716-446655440000', '301', 'C Block', 'Private', 2, 3, 'partial', 1),
    ('550e8400-e29b-41d4-a716-446655440000', '302', 'C Block', 'Semi-Private', 4, 3, 'vacant', 0)
ON CONFLICT DO NOTHING;

-- Seed demo exams
INSERT INTO public.exams (tenant_id, title, subject, class_grade, exam_date, max_marks, status)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Mid-Term Exam', 'Mathematics', 'Grade 6', '2026-05-15', 100, 'upcoming'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Weekly Test', 'Science', 'Grade 6', '2026-04-10', 50, 'upcoming'),
    ('550e8400-e29b-41d4-a716-446655440000', 'Final Exam', 'English', 'Grade 8', '2026-12-10', 100, 'upcoming')
ON CONFLICT DO NOTHING;
-- ==============================================================================
-- MIGRATION 2: FLEET MANAGEMENT (Fuel, Maintenance, Safety Incidents)
-- ==============================================================================

-- 1. Fuel Tracking Logs
CREATE TABLE IF NOT EXISTS public.transport_fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    fuel_volume_liters DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    odometer_reading INTEGER NOT NULL,
    receipt_url TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for fuel logs" ON public.transport_fuel_logs
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 2. Maintenance Logs
CREATE TABLE IF NOT EXISTS public.transport_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('Oil Change', 'PUC Certificate', 'Insurance Renewal', 'Tire Replacement', 'General Service')),
    cost DECIMAL(10,2) DEFAULT 0,
    next_due_date DATE NOT NULL,
    notes TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for maintenance" ON public.transport_maintenance
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 3. Safety Incidents
CREATE TABLE IF NOT EXISTS public.transport_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('Harsh Braking', 'Overspeed Warning', 'Route Deviation', 'SOS Activated', 'Traffic Delay')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for incidents" ON public.transport_incidents
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_fuel_logs_route ON public.transport_fuel_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_route ON public.transport_maintenance(route_id);
CREATE INDEX IF NOT EXISTS idx_incidents_route_severity ON public.transport_incidents(route_id, severity);
-- ==============================================================================
-- MIGRATION 3: ADMISSIONS STORAGE (Digital Document Vault)
-- ==============================================================================

-- 1. Create secure private Storage Bucket 'admissions'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('admissions', 'admissions', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Restrict Bucket Access (RLS over Storage)
-- Allow authenticated staff/admins to select/insert files
CREATE POLICY "Admissions files accessible by authenticated users" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admissions files insertable by authenticated users" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admissions files deletable by authenticated users" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

-- 3. Database Schema Alteration
-- Add new JSONB column to track file paths
ALTER TABLE public.admission_applications 
ADD COLUMN IF NOT EXISTS document_files JSONB DEFAULT '{}'::jsonb;

-- Ensure an index on JSONB isn't strictly necessary for typical lookups on ID, 
-- but it prepares the schema for storing actual file keys.
-- ==============================================================================
-- 🏫 NEXSCHOOL ERP — MIGRATION 4: PRODUCTION MODULES
-- Library, Gate Passes, and Academic Timetable
-- ==============================================================================

-- ==============================================================================
-- SECTION 1: LIBRARY MANAGEMENT
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.library_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT,
    isbn TEXT,
    category TEXT,
    total_copies INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1,
    location_rack TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for library books" ON public.library_books
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE TABLE IF NOT EXISTS public.library_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    return_date DATE,
    status TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'returned', 'overdue', 'lost')),
    fine_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.library_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for library issues" ON public.library_issues
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- ==============================================================================
-- SECTION 2: HOSTEL GATE PASSES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.hostel_gate_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    room_id UUID REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    out_time TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_in_time TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'returned', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.hostel_gate_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for gate passes" ON public.hostel_gate_passes
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- ==============================================================================
-- SECTION 3: ACADEMICS TIMETABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.timetable_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    section TEXT NOT NULL,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun, 1=Mon...
    period_number INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    subject TEXT NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id),
    room_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraint to prevent a teacher from being assigned to two classes at the same time period on the same day
ALTER TABLE public.timetable_slots
ADD CONSTRAINT unique_teacher_period_day UNIQUE (tenant_id, teacher_id, day_of_week, period_number);

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for timetable" ON public.timetable_slots
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
-- TENANTS TABLE (Idempotent Create)
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  created_at timestamp DEFAULT now()
);

-- Safely add columns if they don't exist in backend
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subdomain text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status text;

-- ADD tenant_id to existing profile tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE admission_applications ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- DEFAULT TENANT (NO DATA LOSS)
INSERT INTO tenants (id, name, subdomain)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'DPS School', 'dps')
ON CONFLICT DO NOTHING;

-- MAP OLD DATA
UPDATE profiles SET tenant_id = '550e8400-e29b-41d4-a716-446655440000';
UPDATE admission_applications SET tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- MAKE REQUIRED
ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE admission_applications ALTER COLUMN tenant_id SET NOT NULL;

-- ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;

-- POLICY
CREATE POLICY "Tenant Isolation Users"
ON profiles
FOR ALL
USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Tenant Isolation Students"
ON admission_applications
FOR ALL
USING (tenant_id = auth.jwt() ->> 'tenant_id');
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  amount numeric,
  status text,
  created_at timestamp DEFAULT now()
);
