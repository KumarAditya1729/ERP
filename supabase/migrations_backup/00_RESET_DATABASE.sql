-- ⚠️ DANGER: COMPLETE DATABASE FACTORY RESET ⚠️
-- This drops ALL tables, policies, and data in the public schema. 
-- It does NOT drop your Auth Users or Storage buckets safely.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Standard Extensions for UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;
