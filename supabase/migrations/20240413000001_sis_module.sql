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
