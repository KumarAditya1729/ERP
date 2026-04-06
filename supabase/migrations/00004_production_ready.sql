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
