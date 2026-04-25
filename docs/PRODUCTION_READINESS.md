# Production Readiness

NexSchool AI is now in a better hardening state, but production readiness is more than a passing build.

## What the repo now enforces

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npm run test:e2e`

The default E2E suite covers public pages, onboarding, and unauthenticated route protection without requiring a live Supabase tenant.

## Optional auth-backed E2E

Some end-to-end scenarios still require a real Supabase project with seeded demo users.

1. Configure `.env.local` with real Supabase credentials.
2. Run `node scripts/seed_mock_users.js`.
3. Start the suite with `E2E_AUTH_ENABLED=true npm run test:e2e`.

Those scenarios validate:

- role-aware login redirects
- RBAC enforcement for teacher vs admin routes
- admin dashboard smoke flows

## Release gates before a real school rollout

- Stage and production secrets stored in the host platform, not in the repo
- Database backup and restore runbook documented and rehearsed
- Sentry alerts wired to a real on-call destination
- Payment webhook secret, notice webhook secret, cron secret, and GPS device secret set
- Demo mode disabled in production
- Seed route disabled in production unless explicitly enabled for a temporary internal environment

## Still required outside the codebase

- A pilot with at least one real school using non-demo data
- Legal review of privacy notice, contracts, and consent flows
- Data migration tooling for the legacy systems you plan to replace
- Mobile or offline strategy for attendance, fees, and parent access
- Load testing with realistic concurrency and recovery drills

## Recommended next delivery track

1. Add authenticated Playwright fixtures backed by seeded tenants in CI secrets.
2. Build importers for students, fee ledgers, staff, and exam history.
3. Add a PWA shell and offline-safe attendance capture.
4. Run backup restore drills and write the incident response checklist into ops onboarding.
