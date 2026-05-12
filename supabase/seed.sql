-- Seed the demo tenant (Keep for login functionality, but remove all sample records)
INSERT INTO public.tenants (id, name, city, subscription_tier)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Delhi Public School', 'New Delhi', 'growth')
ON CONFLICT (id) DO NOTHING;

-- ALL SAMPLE RECORDS REMOVED FOR PRODUCTION READINESS
