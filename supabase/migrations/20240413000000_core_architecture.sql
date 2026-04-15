-- ==============================================================================
-- 00_CORE ARCHITECTURE: Multi-Tenancy & User Profiles
-- ==============================================================================

-- 1.1 Tenants (Schools)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    city TEXT,
    subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'growth', 'enterprise')),
    subdomain TEXT UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    max_students INTEGER DEFAULT 1000,
    billing_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants are viewable by everyone" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Tenants insertable by service role only" ON public.tenants FOR ALL USING (false);

-- 1.2 Profiles (Users: Admin, Teacher, Parent, Staff)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent', 'staff')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for profiles" ON public.profiles
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 1.3 Unified Updated_At Function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1.4 Auth Trigger (Auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    extracted_tenant_id uuid;
    extracted_role text;
BEGIN
    extracted_tenant_id := (new.raw_user_meta_data ->> 'tenant_id')::uuid;
    extracted_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

    IF extracted_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required in user metadata';
    END IF;

    -- Profile creation
    INSERT INTO public.profiles (id, tenant_id, role, first_name, last_name, email)
    VALUES (
        new.id,
        extracted_tenant_id,
        extracted_role,
        coalesce(new.raw_user_meta_data ->> 'first_name', 'System'),
        coalesce(new.raw_user_meta_data ->> 'last_name', 'User'),
        new.email
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
