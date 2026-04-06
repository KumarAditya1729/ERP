-- ==============================================================================
-- MIGRATION 2: FLEET MANAGEMENT (Fuel, Maintenance, Safety Incidents)
-- ==============================================================================

-- 1. Fuel Tracking Logs
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
CREATE POLICY "Tenant isolation for fuel logs" ON public.transport_fuel_logs
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 2. Maintenance Logs
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
CREATE POLICY "Tenant isolation for maintenance" ON public.transport_maintenance
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- 3. Safety Incidents
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
CREATE POLICY "Tenant isolation for incidents" ON public.transport_incidents
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_fuel_logs_route ON public.transport_fuel_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_route ON public.transport_maintenance(route_id);
CREATE INDEX IF NOT EXISTS idx_incidents_route_severity ON public.transport_incidents(route_id, severity);
