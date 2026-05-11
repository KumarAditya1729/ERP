-- ==============================================================================
-- ⚠️  DANGER: DESTRUCTIVE RESET SCRIPT
-- This wipes the entire schema. ONLY for local development / fresh project setup.
-- DO NOT run this against a production or staging database.
-- ==============================================================================

-- ── Safety Guard ──────────────────────────────────────────────────────────────
-- Set this in your local Supabase session before running:
--   SET app.environment = 'development';
DO $$
BEGIN
  IF current_setting('app.environment', true) IS DISTINCT FROM 'development' THEN
    RAISE EXCEPTION
      'ABORT: Reset script can only run when app.environment = ''development''. '
      'Run: SET app.environment = ''development''; first. Current value: %',
      COALESCE(current_setting('app.environment', true), '<not set>');
  END IF;
END $$;

-- ── Drop all public tables (cascades FKs) ─────────────────────────────────────
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Confirm
SELECT '✅ Schema reset complete. Run migrations to rebuild.' AS status;
