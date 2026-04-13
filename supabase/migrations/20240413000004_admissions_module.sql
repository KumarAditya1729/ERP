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
