-- -------------------------------------------------------------
-- MIGRATION: Multi-Tenant Zero-Trust Isolation (Level 3 SaaS)
-- -------------------------------------------------------------

-- Force RLS on all primary transactional tables to block crossover leaks
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;

-- Dynamic Tenant Assertion Policy:
-- Verifies the authenticated user's profile maps to the matching tenant_id.
-- (Avoids relying purely on JWT claims which can go stale without session refreshes).

CREATE POLICY "Tenant Strict Isolation: Profiles" 
ON profiles 
FOR ALL 
USING (
   tenant_id = (SELECT tenant_id FROM profiles p2 WHERE p2.id = auth.uid()) OR auth.uid() = id
);

CREATE POLICY "Tenant Strict Isolation: Applications" 
ON admission_applications 
FOR ALL 
USING (
   tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Note: Ensure ALL tables created moving forward have `tenant_id` attached as a foreign key!
