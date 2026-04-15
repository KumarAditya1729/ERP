const { Client } = require('pg');

const sql = `
CREATE OR REPLACE VIEW public.tenant_fee_summary_view AS
SELECT 
    tenant_id,
    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS collected,
    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending
FROM public.fees
GROUP BY tenant_id;

GRANT SELECT ON public.tenant_fee_summary_view TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.attendance_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day')),
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);

ALTER TABLE public.attendance_partitioned ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_attendance_part" ON public.attendance_partitioned;
CREATE POLICY "tenant_isolation_attendance_part" ON public.attendance_partitioned
    FOR ALL USING (tenant_id::text = (auth.jwt() -> 'app_metadata' ->> 'tenant_id'));

DO $$
BEGIN
    PERFORM extensions.create_parent(
        p_parent_table => 'public.attendance_partitioned',
        p_control => 'date',
        p_type => 'native',
        p_interval => 'monthly',
        p_premake => 6
    );
EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'pg_partman initialization skipped.';
END $$;
`;

// Try pooler with port 6543 (transaction pooling)
const connectionString = "postgresql://postgres.luasgmhhmcihqjfzwfxe:N5HQHtFUx1RD7L8Z@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

const client = new Client({ connectionString });

async function main() {
    try {
        console.log("Connecting...");
        await client.connect();
        console.log("Running SQL...");
        await client.query(sql);
        console.log("Execution successful!");
    } catch (e) {
        console.error("Error connecting/running:", e);
    } finally {
        await client.end();
    }
}
main();
