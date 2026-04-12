-- TENANTS TABLE
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  created_at timestamp DEFAULT now(),
  features jsonb
);

-- ADD tenant_id to existing tables
ALTER TABLE profiles ADD COLUMN tenant_id uuid;
ALTER TABLE admission_applications ADD COLUMN tenant_id uuid;

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
