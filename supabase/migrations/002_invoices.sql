CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  amount numeric,
  status text,
  created_at timestamp DEFAULT now()
);
