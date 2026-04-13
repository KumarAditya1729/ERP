-- ==============================================================================
-- 02_ATTENDANCE MODULE
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

CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, date);

-- 3.2 Partitioned attendance table
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
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
