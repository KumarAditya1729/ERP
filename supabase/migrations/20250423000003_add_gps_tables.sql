-- GPS vehicles table (extends existing transport module)
CREATE TABLE IF NOT EXISTS gps_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  device_id TEXT NOT NULL UNIQUE,    -- Hardware GPS device ID
  device_token_hash TEXT NOT NULL,   -- bcrypt hash of device auth token
  driver_name TEXT,
  driver_phone TEXT,
  capacity INTEGER DEFAULT 40,
  route_name TEXT,
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, vehicle_number)
);

-- Real-time GPS ping storage
CREATE TABLE IF NOT EXISTS gps_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES gps_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  speed_kmh DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,    -- degrees 0-360
  accuracy_meters DOUBLE PRECISION,
  battery_percent INTEGER,
  ignition_on BOOLEAN DEFAULT true,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Latest position (materialized for fast parent portal queries)
CREATE TABLE IF NOT EXISTS gps_vehicle_latest (
  vehicle_id UUID PRIMARY KEY REFERENCES gps_vehicles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  ignition_on BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofences (school entry/exit alerts)
CREATE TABLE IF NOT EXISTS gps_geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,              -- e.g. "School Campus", "Route Stop 3"
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER DEFAULT 100,
  alert_on_entry BOOLEAN DEFAULT true,
  alert_on_exit BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route stops
CREATE TABLE IF NOT EXISTS gps_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vehicle_id UUID REFERENCES gps_vehicles(id),
  stop_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  stop_order INTEGER NOT NULL,
  estimated_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students assigned to vehicles
CREATE TABLE IF NOT EXISTS gps_student_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id),
  vehicle_id UUID NOT NULL REFERENCES gps_vehicles(id),
  pickup_stop_id UUID REFERENCES gps_route_stops(id),
  drop_stop_id UUID REFERENCES gps_route_stops(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, student_id)
);

-- RLS policies for all GPS tables
ALTER TABLE gps_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_vehicle_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_student_assignments ENABLE ROW LEVEL SECURITY;

-- Tenant isolation on all tables
CREATE POLICY "tenant_gps_vehicles" ON gps_vehicles USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_pings" ON gps_pings USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_latest" ON gps_vehicle_latest USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_fences" ON gps_geofences USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_stops" ON gps_route_stops USING (tenant_id = (current_setting('app.tenant_id'))::uuid);
CREATE POLICY "tenant_gps_assignments" ON gps_student_assignments USING (tenant_id = (current_setting('app.tenant_id'))::uuid);

-- Enable Supabase Realtime on the latest position table
ALTER PUBLICATION supabase_realtime ADD TABLE gps_vehicle_latest;

-- Trigger: auto-upsert latest position on every ping
CREATE OR REPLACE FUNCTION update_vehicle_latest()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO gps_vehicle_latest (vehicle_id, tenant_id, latitude, longitude, speed_kmh, heading, ignition_on, updated_at)
  VALUES (NEW.vehicle_id, NEW.tenant_id, NEW.latitude, NEW.longitude, NEW.speed_kmh, NEW.heading, NEW.ignition_on, NEW.recorded_at)
  ON CONFLICT (vehicle_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    speed_kmh = EXCLUDED.speed_kmh,
    heading = EXCLUDED.heading,
    ignition_on = EXCLUDED.ignition_on,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER gps_ping_latest_trigger
  AFTER INSERT ON gps_pings
  FOR EACH ROW EXECUTE FUNCTION update_vehicle_latest();
