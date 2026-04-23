-- Add Missing Indexes for Multi-Tenant Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_tenant_id ON students(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fees_tenant_id ON fees(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_tenant_date ON attendance(tenant_id, date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admissions_tenant_id ON admissions(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transport_vehicles_tenant ON transport_vehicles(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gps_pings_vehicle_time ON gps_pings(vehicle_id, recorded_at DESC);
