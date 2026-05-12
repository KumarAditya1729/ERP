-- 1. Create fee_structures table
CREATE TABLE IF NOT EXISTS public.fee_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_group TEXT NOT NULL,
    tuition_fee NUMERIC DEFAULT 0,
    transport_fee NUMERIC DEFAULT 0,
    activity_fee NUMERIC DEFAULT 0,
    hostel_fee NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own tenant's fee structures"
    ON public.fee_structures FOR SELECT
    USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY "Admins can manage fee structures"
    ON public.fee_structures FOR ALL
    USING (auth.jwt() ->> 'tenant_id' = tenant_id::text AND (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'super_admin'));

-- 2. Add columns to library_books if missing (e.g. rack location)
-- (Already seems to be there in the schema but let's be safe)

-- 3. Seed some data for the demo tenant (if it exists)
DO $$
DECLARE
    demo_tenant_id UUID;
BEGIN
    SELECT id INTO demo_tenant_id FROM public.tenants WHERE subdomain = 'nexschool' LIMIT 1;
    
    IF demo_tenant_id IS NOT NULL THEN
        -- Fee Structures
        INSERT INTO public.fee_structures (tenant_id, class_group, tuition_fee, transport_fee, activity_fee, hostel_fee)
        VALUES 
            (demo_tenant_id, 'Class 6–8', 7500, 1800, 500, 4000),
            (demo_tenant_id, 'Class 9–10', 9500, 1800, 700, 4500),
            (demo_tenant_id, 'Class 11–12', 11500, 1800, 600, 5000)
        ON CONFLICT DO NOTHING;

        -- Hostel Rooms
        INSERT INTO public.hostel_rooms (tenant_id, room_number, block_name, room_type, capacity, floor_level, status)
        VALUES 
            (demo_tenant_id, 'A-101', 'Block A (Boys)', 'Triple', 3, 1, 'vacant'),
            (demo_tenant_id, 'A-102', 'Block A (Boys)', 'Double', 2, 1, 'vacant'),
            (demo_tenant_id, 'B-201', 'Block B (Boys)', 'Triple', 3, 2, 'vacant'),
            (demo_tenant_id, 'C-301', 'Block C (Girls)', 'Triple', 3, 3, 'vacant'),
            (demo_tenant_id, 'D-401', 'Block D (Girls)', 'Double', 2, 4, 'vacant')
        ON CONFLICT DO NOTHING;

        -- Library Books
        INSERT INTO public.library_books (tenant_id, title, author, category, total_copies, available_copies, location_rack, isbn)
        VALUES 
            (demo_tenant_id, 'Concepts of Physics (Vol 1)', 'H.C. Verma', 'Science', 10, 4, 'Sci-Rack-A', '978-8177091878'),
            (demo_tenant_id, 'Mathematics Grade 10', 'R.D. Sharma', 'Math', 15, 15, 'Math-Rack-C', '978-9383182054'),
            (demo_tenant_id, 'The Merchant of Venice', 'William Shakespeare', 'Literature', 5, 1, 'Lit-Rack-1', '978-0198328674'),
            (demo_tenant_id, 'Macroeconomics', 'Sandeep Garg', 'Commerce', 8, 0, 'Comm-Rack-B', '978-9388836467')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
