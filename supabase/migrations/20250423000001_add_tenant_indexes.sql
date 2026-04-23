-- Add Missing Indexes for Multi-Tenant Performance
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fees_tenant_id ON fees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date ON attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_admissions_tenant_id ON admission_applications(tenant_id);
