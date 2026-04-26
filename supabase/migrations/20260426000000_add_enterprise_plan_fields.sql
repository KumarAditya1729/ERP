ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS branch_count INTEGER,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS custom_requirements TEXT,
  ADD COLUMN IF NOT EXISTS custom_monthly_amount INTEGER;
