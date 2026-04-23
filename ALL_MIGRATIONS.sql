-- FRESH DEPLOYMENT FULL MIGRATION

-- File: 20240413000000_core_architecture.sql
-- ==============================================================================
-- 00_CORE ARCHITECTURE: Multi-Tenancy & User Profiles
-- ==============================================================================

-- 1.1 Tenants (Schools)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    city TEXT,
    subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'growth', 'enterprise')),
    subdomain TEXT UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    max_students INTEGER DEFAULT 1000,
    billing_email TEXT,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for profiles" ON public.profiles
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 1.3 Unified Updated_At Function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1.4 Auth Trigger (Auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    extracted_tenant_id uuid;
    extracted_role text;
BEGIN
    extracted_tenant_id := (new.raw_user_meta_data ->> 'tenant_id')::uuid;
    extracted_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

    IF extracted_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required in user metadata';
    END IF;

    -- Profile creation
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


-- File: 20240413000001_sis_module.sql
-- ==============================================================================
-- 01_SIS MODULE: Students & Parent Links
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

-- PARENT - STUDENT LINKS
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

CREATE INDEX IF NOT EXISTS idx_students_tenant_class ON public.students(tenant_id, class_grade, section);
CREATE INDEX IF NOT EXISTS idx_students_tenant_status ON public.students(tenant_id, status);


-- File: 20240413000002_attendance_module.sql
-- ==============================================================================
-- 02_ATTENDANCE MODULE
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman;

-- Partitioned attendance table
DROP TABLE IF EXISTS public.attendance CASCADE;
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half-day')),
    marked_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Insert attendance" ON public.attendance FOR ALL
USING (
    tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'teacher')
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON public.attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);

-- Initialize pg_partman for the attendance table (monthly partitions, pre-make for 6 months)
SELECT partman.create_parent(
  p_parent_table => 'public.attendance',
  p_control => 'date',
  p_interval => '1 month',
  p_premake => 6
);


-- File: 20240413000003_finance_module.sql
-- ==============================================================================
-- 03_FINANCE MODULE: Fees & Payment Tracking
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_paid_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
        NEW.paid_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fees_paid_at_trigger
    BEFORE UPDATE ON public.fees
    FOR EACH ROW EXECUTE FUNCTION public.set_paid_at();

CREATE TRIGGER fees_updated_at_trigger
    BEFORE UPDATE ON public.fees
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

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
USING (
    tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff')
);

CREATE INDEX IF NOT EXISTS idx_fees_tenant_status ON public.fees(tenant_id, status);

CREATE MATERIALIZED VIEW public.tenant_fee_summary AS
SELECT tenant_id, 
  SUM(CASE WHEN status='paid' THEN amount ELSE 0 END) as collected,
  SUM(CASE WHEN status!='paid' THEN amount ELSE 0 END) as pending
FROM public.fees GROUP BY tenant_id;

CREATE UNIQUE INDEX idx_tenant_fee_summary ON public.tenant_fee_summary(tenant_id);

CREATE OR REPLACE FUNCTION public.refresh_fee_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.tenant_fee_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- File: 20240413000004_admissions_module.sql
-- ==============================================================================
-- 04_ADMISSIONS MODULE: Pipeline & Document Vault
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
    document_files JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER admission_updated_at_trigger
    BEFORE UPDATE ON public.admission_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_admissions" ON public.admission_applications
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_admissions_tenant_stage ON public.admission_applications(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_admissions_tenant_date ON public.admission_applications(tenant_id, applied_date DESC);

-- Vault: Create secure private Storage Bucket 'admissions'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('admissions', 'admissions', false)
ON CONFLICT (id) DO NOTHING;

-- Restrict Bucket Access (RLS over Storage)
CREATE POLICY "Admissions files accessible by authenticated users" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admissions files insertable by authenticated users" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admissions files deletable by authenticated users" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);


-- File: 20240413000005_academics_module.sql
-- ==============================================================================
-- 05_ACADEMICS MODULE: Hierarchy, Homework, & Exams
-- ==============================================================================

-- 5.1 Hierarchy: Classes, Sections, Subjects
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

CREATE POLICY "tenant_isolation_classes" ON public.classes FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_isolation_sections" ON public.sections FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_isolation_subjects" ON public.subjects FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_isolation_teacher_assignments" ON public.teacher_assignments FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_isolation_student_placements" ON public.student_placements FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 5.2 Homework & Assignments
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
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'missing' CHECK (status IN ('pending', 'missing', 'graded')),
    score TEXT,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER assignments_updated_at_trigger BEFORE UPDATE ON public.homework_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER submissions_updated_at_trigger BEFORE UPDATE ON public.homework_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_assignments" ON public.homework_assignments FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_isolation_submissions" ON public.homework_submissions FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_hw_assignments_tenant ON public.homework_assignments(tenant_id, subject);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_assignment ON public.homework_submissions(assignment_id);

-- 5.3 Exams
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

CREATE TABLE IF NOT EXISTS public.exams_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    marks_obtained NUMERIC NOT NULL DEFAULT 0,
    max_marks NUMERIC NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant exams read" ON public.exams FOR SELECT USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "Tenant exams write" ON public.exams FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

ALTER TABLE public.exams_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant Isolated Exams" ON public.exams_data FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));


-- File: 20240413000006_infrastructure.sql
-- ==============================================================================
-- 06_INFRASTRUCTURE MODULE: Hostel & Transport
-- ==============================================================================

-- 6.1 Hostel Management
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
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    bed_number INTEGER NOT NULL,
    allocated_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, bed_number)
);

CREATE TRIGGER rooms_updated_at_trigger BEFORE UPDATE ON public.hostel_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER allocations_updated_at_trigger BEFORE UPDATE ON public.hostel_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_hostel_rooms" ON public.hostel_rooms FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_isolation_hostel_allocations" ON public.hostel_allocations FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 6.2 Transport (Routes, Stops, Fuel, Maintenance, Incidents)
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
CREATE POLICY "Tenant isolation for routes" ON public.transport_routes FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

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
CREATE POLICY "Tenant isolation for stops" ON public.transport_stops FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

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
CREATE POLICY "Tenant isolation for fuel logs" ON public.transport_fuel_logs FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

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
CREATE POLICY "Tenant isolation for maintenance" ON public.transport_maintenance FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

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
CREATE POLICY "Tenant isolation for incidents" ON public.transport_incidents FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_transport_routes_tenant ON public.transport_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON public.transport_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_route ON public.transport_fuel_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_route ON public.transport_maintenance(route_id);
CREATE INDEX IF NOT EXISTS idx_incidents_route_severity ON public.transport_incidents(route_id, severity);

-- Atomic function to update enrolled students and prevent race conditions (Overbooking)
CREATE OR REPLACE FUNCTION public.update_enrolled_students(
  p_route_id UUID,
  p_tenant_id UUID,
  p_delta INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE public.transport_routes
  SET enrolled_students = LEAST(capacity, GREATEST(0, enrolled_students + p_delta))
  WHERE id = p_route_id AND tenant_id = p_tenant_id
  RETURNING enrolled_students INTO v_new_count;
  
  RETURN coalesce(v_new_count, -1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- File: 20240413000007_library_hr_communication.sql
-- ==============================================================================
-- 07_LIBRARY, HR & COMMUNICATION MODULE
-- ==============================================================================

-- 7.1 Library Management
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
CREATE POLICY "Tenant isolation for library books" ON public.library_books FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

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
CREATE POLICY "Tenant isolation for library issues" ON public.library_issues FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 7.2 HR Payroll
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
CREATE POLICY "Tenant Isolated Payroll" ON public.hr_payroll FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id') AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 7.3 Communication (Notices)
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
CREATE POLICY "Tenant isolation for notices" ON public.notices FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_notices_tenant_created ON public.notices(tenant_id, created_at DESC);


-- File: 20240416000007_hr_exams_payroll.sql
-- ==============================================================================
-- MIGRATION: Leave Requests & Payroll Runs Tables
-- Required by HR module (leave approval) and Payroll (run tracking)
-- ==============================================================================

-- 1. Leave Requests (replaces hardcoded front-end array)
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_name     TEXT NOT NULL,
  leave_type     TEXT NOT NULL CHECK (leave_type IN ('Sick Leave', 'Casual Leave', 'Medical Leave', 'Earned Leave', 'Maternity Leave')),
  from_date      DATE NOT NULL,
  to_date        DATE NOT NULL,
  days           INTEGER NOT NULL GENERATED ALWAYS AS (to_date - from_date + 1) STORED,
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by    UUID REFERENCES public.profiles(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_leave_requests" ON public.leave_requests
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON public.leave_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Payroll Runs (audit trail — replaces fake setTimeout timer)
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  month            TEXT NOT NULL,          -- e.g. "2026-04"
  processed_count  INTEGER NOT NULL DEFAULT 0,
  total_amount     BIGINT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  processed_by     UUID REFERENCES public.profiles(id),
  processed_at     TIMESTAMPTZ DEFAULT NOW(),
  notes            TEXT,
  UNIQUE(tenant_id, month)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_payroll_runs" ON public.payroll_runs
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE INDEX IF NOT EXISTS idx_payroll_runs_tenant ON public.payroll_runs(tenant_id, month);

-- 3. Add salary & shift fields to profiles (required by HR & Hostel modules)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salary       BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_block TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS shift        TEXT;

-- 4. Exams schedule table (replaces hardcoded front-end array)
CREATE TABLE IF NOT EXISTS public.exams (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  classes       TEXT NOT NULL DEFAULT 'All Classes',
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  subject_count INTEGER DEFAULT 5,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_exams" ON public.exams
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE INDEX IF NOT EXISTS idx_exams_tenant_status ON public.exams(tenant_id, status);
CREATE TRIGGER exams_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- File: 20240416000008_audit_logstream.sql
-- ==============================================================================
-- MIGRATION: Audit Log Stream (Tenant-isolated, real-time)
-- ==============================================================================

-- 1. Central audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name     TEXT NOT NULL DEFAULT 'System',
  action         TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'SMS_SENT', 'PAYMENT', 'ERROR')),
  resource_type  TEXT NOT NULL,   -- 'student' | 'fee' | 'attendance' | 'leave_request' | 'hostel_allocation' | ...
  resource_id    UUID,
  resource_label TEXT,            -- human-readable identifier e.g. student name
  metadata       JSONB DEFAULT '{}'::jsonb,
  severity       TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'success')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_audit_logs" ON public.audit_logs
  FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX idx_audit_logs_tenant_time   ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(tenant_id, resource_type);
CREATE INDEX idx_audit_logs_action        ON public.audit_logs(tenant_id, action);
CREATE INDEX idx_audit_logs_user          ON public.audit_logs(user_id);

-- 2. Generic trigger function — auto-logs INSERT/UPDATE/DELETE on any table
CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_resource_label TEXT;
BEGIN
  -- Extract tenant_id from the row being changed
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

  -- Best-effort human label from common columns
  v_resource_label := COALESCE(
    (NEW ->> 'first_name') || ' ' || COALESCE((NEW ->> 'last_name'), ''),
    NEW ->> 'name',
    NEW ->> 'invoice_number',
    NEW ->> 'room_number',
    OLD ->> 'first_name',
    '—'
  );

  INSERT INTO public.audit_logs (tenant_id, actor_name, action, resource_type, resource_id, resource_label, severity, metadata)
  VALUES (
    v_tenant_id,
    'System',
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TRIM(v_resource_label),
    CASE TG_OP WHEN 'DELETE' THEN 'warn' ELSE 'info' END,
    jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to all major tables
CREATE OR REPLACE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_fees
  AFTER INSERT OR UPDATE OR DELETE ON public.fees
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_attendance
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_leave_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_hostel_allocations
  AFTER INSERT OR UPDATE OR DELETE ON public.hostel_allocations
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_admission_applications
  AFTER INSERT OR UPDATE OR DELETE ON public.admission_applications
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE OR REPLACE TRIGGER audit_transport_routes
  AFTER INSERT OR UPDATE OR DELETE ON public.transport_routes
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();


-- File: 20250423000001_add_tenant_indexes.sql
-- Add Missing Indexes for Multi-Tenant Performance
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fees_tenant_id ON fees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date ON attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_admissions_tenant_id ON admission_applications(tenant_id);


-- File: 20250423000002_add_audit_log.sql
-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,          -- 'INSERT', 'UPDATE', 'DELETE'
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only read their own tenant's audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON audit_log
  USING (tenant_id = (current_setting('app.tenant_id'))::uuid);


-- File: 20250423000003_add_gps_tables.sql
-- GPS vehicles table (extends existing transport module)
CREATE TABLE IF NOT EXISTS gps_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,    -- Hardware GPS device ID
  device_token_hash TEXT NOT NULL,   -- bcrypt hash of device auth token
  driver_name TEXT,
  driver_phone TEXT,
  capacity INTEGER DEFAULT 40,
  route_name TEXT,
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, vehicle_number)
);

-- Real-time GPS ping storage
CREATE TABLE IF NOT EXISTS gps_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES gps_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  speed_kmh DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,    -- degrees 0-360
  accuracy_meters DOUBLE PRECISION,
  battery_percent INTEGER,
  ignition_on BOOLEAN DEFAULT true,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Latest position (materialized for fast parent portal queries)
CREATE TABLE IF NOT EXISTS gps_vehicle_latest (
  vehicle_id UUID PRIMARY KEY REFERENCES gps_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  ignition_on BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofences (school entry/exit alerts)
CREATE TABLE IF NOT EXISTS gps_geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,              -- e.g. "School Campus", "Route Stop 3"
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER DEFAULT 100,
  alert_on_entry BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route stops
CREATE TABLE IF NOT EXISTS gps_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID REFERENCES gps_vehicles(id),
  stop_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  stop_order INTEGER NOT NULL,
  estimated_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students assigned to vehicles
CREATE TABLE IF NOT EXISTS gps_student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id),
  vehicle_id UUID NOT NULL REFERENCES gps_vehicles(id),
  pickup_stop_id UUID REFERENCES gps_route_stops(id),
  drop_stop_id UUID REFERENCES gps_route_stops(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, student_id)
);

-- RLS policies for all GPS tables
ALTER TABLE gps_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_vehicle_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_student_assignments ENABLE ROW LEVEL SECURITY;

-- Tenant isolation on all tables
CREATE POLICY "tenant_gps_vehicles" ON gps_vehicles USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_pings" ON gps_pings USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_latest" ON gps_vehicle_latest USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_fences" ON gps_geofences USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_stops" ON gps_route_stops USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_assignments" ON gps_student_assignments USING (tenant_id = (current_setting('app.tenant_id'))::uuid);

-- Enable Supabase Realtime on the latest position table
ALTER PUBLICATION supabase_realtime ADD TABLE gps_vehicle_latest;

-- Trigger: auto-upsert latest position on every ping
CREATE OR REPLACE FUNCTION update_vehicle_latest()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gps_vehicle_latest (vehicle_id, tenant_id, latitude, longitude, speed_kmh, heading, ignition_on, updated_at)
  VALUES (NEW.vehicle_id, NEW.tenant_id, NEW.latitude, NEW.longitude, NEW.speed_kmh, NEW.heading, NEW.ignition_on, NEW.recorded_at)
  ON CONFLICT (vehicle_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    speed_kmh = EXCLUDED.speed_kmh,
    heading = EXCLUDED.heading,
    ignition_on = EXCLUDED.ignition_on,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER gps_ping_latest_trigger
  AFTER INSERT ON gps_pings
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_latest();


-- File: 20250423000004_add_tenant_features.sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "gps_tracking": false,
  "hostel": false,
  "ai_copilot": true,
  "parent_portal": true,
  "advanced_analytics": false
}'::jsonb;


