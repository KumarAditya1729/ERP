# NexSchool AI — Operations Runbook

> **Audience**: Engineering team, on-call staff, and technical co-founders.  
> **Updated**: 11 May 2025  
> For incidents, triage in this order: Auth → DB → Payments → Notifications.

---

## 1. Database Connection Exhaustion

### Symptoms
- API routes returning `500` or `PGRST` errors
- Supabase dashboard showing "Max client connections reached"
- Slow queries or timeout errors in server logs

### Immediate Mitigation
1. Check active connections in Supabase Dashboard → Database → Connections
2. Verify the app is using the **pgBouncer pooler URL** (port `6543`), NOT the direct URL (port `5432`)
3. Check Vercel environment variables:
   ```
   DATABASE_URL_POOLER=postgres://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
4. If direct URL is being used in production, update to pooler URL and redeploy immediately
5. Kill long-running queries:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE state = 'idle' AND query_start < NOW() - INTERVAL '5 minutes';
   ```

### Scale Recommendations
- Supabase Free plan: 60 connections max → use pgBouncer pooler (transaction mode)
- Supabase Pro plan: 200 connections → still use pooler for Vercel serverless
- Never use direct connections from Vercel functions (new connection per invocation)

---

## 2. Missed Razorpay Payment Webhooks

### Symptoms
- Parent reports payment deducted but fee still shows "pending"
- `webhook_events` table has no record of the payment
- Razorpay dashboard shows webhook "failed" with 4xx/5xx

### Identification
```sql
-- Check if webhook was received:
SELECT * FROM webhook_events
WHERE provider = 'razorpay'
  AND event_id = 'pay_XXXXXXX'  -- Razorpay payment_id
ORDER BY created_at DESC;

-- Check the fee record:
SELECT * FROM fees
WHERE razorpay_order_id = 'order_XXXXXXX';
```

### Replay a Missed Webhook
1. Log into [Razorpay Dashboard](https://dashboard.razorpay.com) → Webhooks → Event Log
2. Find the failed event by payment ID
3. Click "Retry" — Razorpay will resend the webhook
4. The `/api/webhooks/razorpay` handler is **idempotent** — duplicate delivery is safe
5. Verify in `webhook_events` table and `fees` table after replay

> ⚠️ **Idempotency warning**: Never manually mark a fee as paid AND also replay the webhook. The webhook is the canonical source of truth.

---

## 3. Failed Notification Queue Jobs

### Symptoms
- Parents not receiving attendance SMS
- `notification_dlq` Redis key is growing

### Inspection
```bash
# Via Upstash Console or Redis CLI:
# Check DLQ depth
LLEN nexschool:sms_dlq

# Peek at failed jobs (without removing)
LRANGE nexschool:sms_dlq 0 9
```

### Replay Failed Jobs
1. Pop jobs from DLQ one at a time:
   ```bash
   RPOP nexschool:sms_dlq
   ```
2. Re-push to main queue after fixing the root cause:
   ```bash
   LPUSH nexschool:sms_queue '{"to":"+91XXXXXXXXXX","body":"..."}'
   ```
3. Trigger the SMS worker manually:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://erp-beryl-phi.vercel.app/api/workers/sms
   ```
4. After successful replay, verify DLQ is empty: `LLEN nexschool:sms_dlq`

### Clear DLQ After Resolution
```bash
# Only after confirming all jobs have been replayed successfully
DEL nexschool:sms_dlq
```

---

## 4. Manual Webhook Replay

**Required permissions**: Engineering team only — requires `CRON_SECRET` or Razorpay dashboard access.

### Steps
1. Identify the missed event (order_id or payment_id) from parent complaint or Razorpay dashboard
2. Check if already processed: `SELECT * FROM webhook_events WHERE event_id = 'pay_XXX'`
3. If NOT processed: trigger replay via Razorpay dashboard (see section 2 above)
4. If webhook table shows it IS processed but fee is still pending: run the DB update manually:
   ```sql
   -- Run as service role only
   UPDATE fees SET status = 'paid', payment_method = 'razorpay', paid_at = NOW()
   WHERE razorpay_order_id = 'order_XXXXXXX'
     AND tenant_id = 'TENANT_UUID';  -- Always include tenant_id
   ```
5. Log the manual action in Sentry or internal incident tracker

---

## 5. Vercel 404 or Deployment Failure

### Middleware / Routing Check
1. Verify `/api/health` returns 200: `curl https://erp-beryl-phi.vercel.app/api/health`
2. Check `middleware.ts` — confirm public routes are listed in `isPublic`:
   - `/[locale]` (root)
   - `/[locale]/login`
   - `/[locale]/register`
   - `/[locale]/privacy-policy`
   - `/[locale]/terms-of-service`
   - `/[locale]/data-processing-agreement`
3. Confirm middleware env guard: if `NEXT_PUBLIC_SUPABASE_URL` is missing, middleware returns `next()` (safe)

### Environment Variables Check
Required in Vercel Dashboard (Settings → Environment Variables):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
CRON_SECRET
JWT_SECRET
GPS_DEVICE_SECRET
RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

### Build Failure Debug
1. Check Vercel deployment logs for TypeScript errors
2. Run locally: `npm run lint && npm run build`
3. Common causes: missing env var used at build time, type error in new file

---

## 6. Supabase RLS / Tenant Isolation Incident

### Immediate Containment (< 5 minutes)
1. **Disable the affected API route** (set maintenance mode or remove from Vercel)
2. **Do NOT rotate service role key yet** — coordinate with team first to avoid breaking active sessions
3. Identify which tenant(s) may have been exposed

### Investigation
```sql
-- Check audit logs for suspicious cross-tenant reads
SELECT * FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 100;

-- Check if RLS is enabled on all tenant tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('students', 'fees', 'attendance', 'profiles');
```

### Remediation
1. Re-enable RLS on any table where it was disabled:
   ```sql
   ALTER TABLE public.[table_name] ENABLE ROW LEVEL SECURITY;
   ```
2. Verify all policies exist on affected tables
3. If service role key was exposed to client code, rotate it immediately:
   - Supabase Dashboard → Settings → API → Rotate Service Role Key
   - Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables
   - Trigger a new Vercel deployment
4. Notify affected schools per DPDP Act 2023 breach notification requirements (within 72 hours)

---

## Required GitHub Secrets (for CI/CD and Daily Backup)

Add these in GitHub → Repo → Settings → Secrets → Actions:

| Secret | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for backup script |
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `R2_ACCOUNT_ID` | Cloudflare R2 account (if using R2) |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret |
| `R2_BUCKET` | R2 bucket name |

---

*Last reviewed by engineering: 11 May 2025*
