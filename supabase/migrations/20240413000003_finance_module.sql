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
