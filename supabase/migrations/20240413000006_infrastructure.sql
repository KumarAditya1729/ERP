-- ==============================================================================
-- 06_INFRASTRUCTURE MODULE: Hostel & Transport
-- ==============================================================================

-- 6.1 Hostel Management
CREATE TABLE IF NOT EXISTS public.hostel_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_number TEXT NOT NULL,
    block_name TEXT NOT NULL,
    room_type TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    floor_level INTEGER NOT NULL,
    occupied INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'partial', 'full')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, room_number)
);

CREATE TABLE IF NOT EXISTS public.hostel_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    bed_number INTEGER NOT NULL,
    allocated_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(room_id, bed_number)
);

CREATE TRIGGER rooms_updated_at_trigger BEFORE UPDATE ON public.hostel_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER allocations_updated_at_trigger BEFORE UPDATE ON public.hostel_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_hostel_rooms" ON public.hostel_rooms FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));
CREATE POLICY "tenant_isolation_hostel_allocations" ON public.hostel_allocations FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 6.2 Transport (Routes, Stops, Fuel, Maintenance, Incidents)
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
CREATE POLICY "Tenant isolation for routes" ON public.transport_routes FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE TABLE IF NOT EXISTS public.transport_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('done', 'current', 'upcoming')),
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for stops" ON public.transport_stops FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE TABLE IF NOT EXISTS public.transport_fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    fuel_volume_liters DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    odometer_reading INTEGER NOT NULL,
    receipt_url TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for fuel logs" ON public.transport_fuel_logs FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE TABLE IF NOT EXISTS public.transport_maintenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL CHECK (service_type IN ('Oil Change', 'PUC Certificate', 'Insurance Renewal', 'Tire Replacement', 'General Service')),
    cost DECIMAL(10,2) DEFAULT 0,
    next_due_date DATE NOT NULL,
    notes TEXT,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transport_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for maintenance" ON public.transport_maintenance FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

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
CREATE POLICY "Tenant isolation for incidents" ON public.transport_incidents FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

CREATE INDEX IF NOT EXISTS idx_transport_routes_tenant ON public.transport_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON public.transport_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_route ON public.transport_fuel_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_route ON public.transport_maintenance(route_id);
CREATE INDEX IF NOT EXISTS idx_incidents_route_severity ON public.transport_incidents(route_id, severity);

-- Atomic function to update enrolled students and prevent race conditions (Overbooking)
CREATE OR REPLACE FUNCTION public.update_enrolled_students(
  p_route_id UUID,
  p_tenant_id UUID,
  p_delta INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE public.transport_routes
  SET enrolled_students = LEAST(capacity, GREATEST(0, enrolled_students + p_delta))
  WHERE id = p_route_id AND tenant_id = p_tenant_id
  RETURNING enrolled_students INTO v_new_count;
  
  RETURN coalesce(v_new_count, -1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
