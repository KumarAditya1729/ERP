-- ==============================================================================
-- MIGRATION 3: ADMISSIONS STORAGE (Digital Document Vault)
-- ==============================================================================

-- 1. Create secure private Storage Bucket 'admissions'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('admissions', 'admissions', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Restrict Bucket Access (RLS over Storage)
-- Allow authenticated staff/admins to select/insert files
CREATE POLICY "Admissions files accessible by authenticated users" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admissions files insertable by authenticated users" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admissions files deletable by authenticated users" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'admissions' AND auth.uid() IS NOT NULL);

-- 3. Database Schema Alteration
-- Add new JSONB column to track file paths
ALTER TABLE public.admission_applications 
ADD COLUMN IF NOT EXISTS document_files JSONB DEFAULT '{}'::jsonb;

-- Ensure an index on JSONB isn't strictly necessary for typical lookups on ID, 
-- but it prepares the schema for storing actual file keys.
