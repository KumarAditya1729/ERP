<div align="center">

<h1>
  <img src="public/logo.svg" alt="NexSchool AI" width="48" height="48" /><br/>
  NexSchool AI — Enterprise School ERP
</h1>

<p><strong>A multi-tenant school ERP platform with production hardening in progress.</strong></p>

<p>
  <a href="https://erp-omega-brown.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-%E2%86%92-7c3aed?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo"/></a>
  <img src="https://img.shields.io/github/last-commit/KumarAditya1729/ERP?style=for-the-badge&color=06b6d4" alt="Last Commit"/>
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js 14"/>
  <img src="https://img.shields.io/badge/Supabase-Multi--Tenant-3ecf8e?style=for-the-badge&logo=supabase" alt="Supabase"/>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT License"/>
</p>

</div>

---

## 🚀 What is NexSchool AI?

NexSchool AI is a **multi-tenant School ERP** built on the modern SaaS stack. Each school gets its own **isolated, secure data workspace** powered by Supabase Row Level Security (RLS).

It replaces legacy, monolithic school software with a cloud-native platform that scales from a 200-student school to a 10,000-student university group on the same infrastructure.

```
School A (DPS Delhi)  ─┐
School B (St. Mary's) ──► Single NexSchool Cloud ─► Isolated Supabase RLS per tenant
School C (Ryan Intl.) ─┘
```

---

## ✨ Core Features

| Module | Description |
|---|---|
| 🎓 **Student Management** | Full student profiles, CSV bulk import, guardian linking, class/section routing |
| 📋 **Admissions Pipeline** | Digital application forms, document uploads (Supabase Storage + RLS), status tracking |
| 📅 **Attendance System** | Real-time daily attendance with bulk marking and absence alerts |
| 💰 **Fee Management** | Invoice generation, Razorpay payment gateway integration, receipt history |
| 📣 **Communication** | SMS/WhatsApp blast via Twilio, queue-based delivery with Upstash Redis |
| 🚌 **Transport Module** | Fleet management, route tracking, driver assignment |
| 🏨 **Hostel Management** | Room allocation, bed-level tracking, gate pass system, hostel fee collection |
| 📝 **Examinations** | Exam scheduling, marks entry, automated grade calculation |
| ⏰ **Academics & Timetable** | AI-powered collision-free timetable generation |
| 📚 **Library** | Book inventory, issue/return tracking |
| 👩‍💼 **HR & Payroll** | Staff profiles, payroll calculation, leave management |
| 📈 **Reports** | Export-ready financial and academic reports |
| 🤖 **AI Copilot** | NexBot — real-time OpenAI-powered assistant embedded inside every dashboard view |
| 👪 **Parent Portal** | Dedicated portal for parents to track attendance, fees, and bus location |

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | Server Components, Edge Runtime |
| **Backend** | Next.js API Routes + Server Actions | Secure server-side mutations |
| **Database** | Supabase (PostgreSQL) | Multi-tenant with Row Level Security |
| **Auth** | Supabase Auth | JWT with custom claims (`tenant_id`, `role`) |
| **Storage** | Supabase Storage | RLS-protected document buckets |
| **AI** | OpenAI GPT-4o-mini via Vercel AI SDK | Streaming chat completions |
| **Payments** | Razorpay | Order creation + signature verification |
| **Notifications** | Twilio + Resend | SMS, WhatsApp, and transactional email |
| **Queue** | Upstash Redis | Async notification dispatching |
| **Monitoring** | Sentry | Error tracking and alerting |
| **Deployment** | Vercel (Edge Network) | Global CDN, serverless Edge functions |
| **CI/CD** | GitHub Actions | Lint → Test → Build → Deploy pipeline |

### Multi-Tenant Security Model

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Next.js Middleware (Edge)                     │
│  → Checks auth cookie, injects x-tenant-subdomain      │
│  → Blocks unauthenticated requests before they hit DB   │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Layout Server Component (SSR)                 │
│  → Verifies role from JWT app_metadata                  │
│  → Redirects unauthorized roles to /unauthorized        │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Supabase Row Level Security (Database)        │
│  → Every query is filtered by tenant_id::text           │
│  → No cross-tenant data is physically returnable        │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) project
- (Optional) Razorpay test keys

### 1. Clone the repo
```bash
git clone https://github.com/KumarAditya1729/ERP.git
cd ERP
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and service role key
```

### 3. Initialize the database
Open the Supabase SQL Editor and run both files **in order**:
1. `supabase/migrations/00_RESET_DATABASE.sql` *(wipes schema — skip on fresh project)*
2. `supabase/migrations/V2_MASTER_COMPILED.sql` *(creates all tables, RLS policies, triggers)*

### 4. Seed test accounts
```bash
node scripts/seed_mock_users.js
```
This creates 5 test accounts (admin, teacher, staff, parent, student) — all with password `Password!123`.

### 5. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

---

## 🔑 Environment Variables

See `.env.example` for the full list. Critical variables:

```env
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role (server-only)
NEXT_PUBLIC_RAZORPAY_KEY_ID=      # Razorpay publishable key
RAZORPAY_KEY_SECRET=              # Razorpay secret (server-only)
OPENAI_API_KEY=                   # OpenAI key for NexBot AI Copilot
RESEND_API_KEY=                   # Resend for transactional emails
```

---

## 🏢 SaaS Onboarding Flow

```
Public Landing Page
      │
      ▼ Click "Select Pro"
/register?tier=pro
      │
      ▼ Fill School Name + Admin Email + Password
Server Action: registerSchool()
      ├── Creates tenant row in DB (generates isolated tenant_id)
      └── Signs up admin user with tenant_id in JWT metadata
              │
              ▼ Email verified
/dashboard  (Admin's isolated school workspace)
              │
              ▼ Click "Upgrade"
/billing  (Razorpay checkout — payment tied to tenant_id)
```

---

## 🧪 Testing

```bash
# Lint
npm run lint

# Unit + integration tests (Jest)
npm test -- --runInBand

# Production build
npm run build

# E2E tests (public + unauthenticated coverage)
npm run test:e2e
```

Auth-backed browser tests are available when a real Supabase project is configured:

```bash
node scripts/seed_mock_users.js
E2E_AUTH_ENABLED=true npm run test:e2e
```

Default E2E coverage includes:
- public page renders
- unauthenticated route blocking
- onboarding form flow

Additional production notes live in:
- `docs/PRODUCTION_READINESS.md`
- `docs/OPERATIONS_AND_COMPLIANCE.md`

---

## 📁 Project Structure

```
├── app/
│   ├── (public)/           # Landing, Login, Register, Billing
│   ├── api/                # API routes (Razorpay, AI chat, Webhooks, Cron workers)
│   ├── actions/            # Server Actions (students, fees, admissions, HR...)
│   ├── dashboard/          # Admin dashboard (13 modules)
│   ├── teacher/            # Teacher portal
│   ├── staff/              # Staff portal
│   └── portal/             # Parent portal
├── components/
│   ├── landing/            # Navbar, Hero, Features, Pricing, Testimonials, Footer
│   ├── dashboard/          # Modal components (Student, Invoice, Staff...)
│   └── AI_Copilot.tsx      # NexBot floating chat widget
├── lib/                    # Supabase clients, helpers, notifications
├── middleware.ts            # Edge RBAC + tenant subdomain injection
├── supabase/migrations/    # V2_MASTER_COMPILED.sql — single source of truth
├── tests/
│   ├── e2e/                # Playwright E2E tests
│   └── integration/        # Jest integration tests
└── scripts/                # DB seed scripts
```

---

## 🌍 Deployment

Deployment is split into a quality gate and a deployment workflow:

```
Pull Request / Push
    │
    ▼ GitHub Actions CI
  Lint → Test → Build → Public E2E
    │
    ▼ (on success for main)
  Vercel Production Deploy
```

Add all environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**.

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/KumarAditya1729">Kumar Aditya</a></p>
  <p>
    <a href="https://erp-omega-brown.vercel.app">Live Demo</a> · 
    <a href="https://erp-omega-brown.vercel.app/register">Register Your School</a>
  </p>
</div>
