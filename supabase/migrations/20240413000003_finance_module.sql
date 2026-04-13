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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
