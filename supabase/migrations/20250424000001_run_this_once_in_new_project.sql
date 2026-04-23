-- ==============================================================================
-- RUN THIS ONCE in your new Supabase project SQL Editor
-- Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
-- Paste this entire file and click "Run"
-- ==============================================================================

-- ── Transport Tables (if not yet created) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transport_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    bus_number TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 40,
    enrolled_students INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'on-route' CHECK (status IN ('on-route', 'at-school', 'delayed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_routes' AND policyname = 'Tenant isolation for routes'
  ) THEN
    CREATE POLICY "Tenant isolation for routes" ON public.transport_routes
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transport_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL,
    scheduled_time TEXT,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('done', 'current', 'upcoming')),
    sequence_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_stops' AND policyname = 'Tenant isolation for stops'
  ) THEN
    CREATE POLICY "Tenant isolation for stops" ON public.transport_stops
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transport_fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    fuel_type TEXT DEFAULT 'Diesel',
    fuel_volume_liters DECIMAL(8,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    odometer_reading INTEGER,
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_fuel_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_fuel_logs' AND policyname = 'Tenant isolation for fuel logs'
  ) THEN
    CREATE POLICY "Tenant isolation for fuel logs" ON public.transport_fuel_logs
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transport_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    maintenance_type TEXT NOT NULL,
    description TEXT,
    cost DECIMAL(10,2) DEFAULT 0,
    next_due_date DATE NOT NULL,
    notes TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_maintenance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_maintenance' AND policyname = 'Tenant isolation for maintenance'
  ) THEN
    CREATE POLICY "Tenant isolation for maintenance" ON public.transport_maintenance
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transport_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('Harsh Braking', 'Overspeed Warning', 'Route Deviation', 'SOS Activated', 'Traffic Delay')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_incidents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_incidents' AND policyname = 'Tenant isolation for incidents'
  ) THEN
    CREATE POLICY "Tenant isolation for incidents" ON public.transport_incidents
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transport_routes_tenant ON public.transport_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON public.transport_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_route ON public.transport_fuel_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_route ON public.transport_maintenance(route_id);
CREATE INDEX IF NOT EXISTS idx_incidents_route_severity ON public.transport_incidents(route_id, severity);

-- Atomic function for enrolled student counter
CREATE OR REPLACE FUNCTION public.update_enrolled_students(
  p_route_id UUID,
  p_delta INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE public.transport_routes
  SET enrolled_students = GREATEST(0, enrolled_students + p_delta)
  WHERE id = p_route_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Students table (if missing) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    roll_number TEXT,
    class_grade TEXT NOT NULL,
    section TEXT NOT NULL,
    guardian_name TEXT,
    guardian_phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'alumni')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'students' AND policyname = 'Tenant isolation for students'
  ) THEN
    CREATE POLICY "Tenant isolation for students" ON public.students
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

-- ── Admission Applications (if missing) ───────────────────────────────────────
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

ALTER TABLE public.admission_applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admission_applications' AND policyname = 'tenant_isolation_admissions'
  ) THEN
    CREATE POLICY "tenant_isolation_admissions" ON public.admission_applications
      FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
  END IF;
END $$;

-- Storage bucket for admission documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('admissions', 'admissions', false)
ON CONFLICT (id) DO NOTHING;

-- ── Done! ─────────────────────────────────────────────────────────────────────
-- After running this, go to your ERP and navigate to Transport page.
-- It will auto-seed 4 routes with stops on first load.
SELECT 'Migration complete! Transport, Students, and Admissions tables are ready.' as status;
