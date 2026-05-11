-- Fix for Supabase Security Advisor warnings: "RLS Disabled in Public" for partitions.
-- PostgreSQL partitions do not automatically inherit "ENABLE ROW LEVEL SECURITY" from the parent table.
-- We must enable it on existing partitions, and on the pg_partman template table for future partitions.

DO $$
DECLARE
    partition_name text;
BEGIN
    -- 1. Enable RLS on all existing attendance partitions dynamically
    FOR partition_name IN
        SELECT inhrelid::regclass::text
        FROM pg_inherits
        WHERE inhparent = 'public.attendance'::regclass
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', partition_name);
    END LOOP;

    -- 2. Enable RLS on the default partition if it exists
    IF EXISTS (
        SELECT FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'attendance_default' AND n.nspname = 'public'
    ) THEN
        ALTER TABLE public.attendance_default ENABLE ROW LEVEL SECURITY;
    END IF;

    -- 3. Enable RLS on the pg_partman template table so ALL future partitions get it automatically
    IF EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'partman'
        AND tablename = 'template_public_attendance'
    ) THEN
        ALTER TABLE partman.template_public_attendance ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
