import { test, expect, type Page } from '@playwright/test';

// ─── Seed credentials (from seed_mock_users.js output) ────────────────────────
const ADMIN   = { email: 'admin@dps.nexschool.ai',   password: 'Password!123' };
const TEACHER = { email: 'teacher@dps.nexschool.ai', password: 'Password!123' };

// ─── Helper: sign in programmatically via UI ──────────────────────────────────
async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button[type="submit"]').click();
  // Wait for navigation away from /login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC PAGES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Public Pages', () => {
  test('Landing page renders the NexSchool brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=NexSchool').first()).toBeVisible();
  });

  test('Pricing section is visible on the landing page', async ({ page }) => {
    await page.goto('/#pricing');
    await expect(page.locator('#pricing')).toBeVisible();
  });

  test('Login page mounts form correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Register page mounts with tier selector', async ({ page }) => {
    await page.goto('/register?tier=growth');
    await expect(page.locator('h1', { hasText: /register your school/i })).toBeVisible();
    // "Growth" plan should be pre-checked
    const checked = page.locator('input[name="tier"][value="growth"]');
    await expect(checked).toBeChecked();
  });

  test('Pricing CTA correctly routes to /register with tier param', async ({ page }) => {
    await page.goto('/');
    // Click the first non-enterprise CTA (e.g., "Start Free Trial")
    const ctaLink = page.locator('a[href^="/register?tier="]').first();
    await expect(ctaLink).toBeVisible();
    const href = await ctaLink.getAttribute('href');
    expect(href).toContain('/register?tier=');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. AUTHENTICATION GUARD (Middleware / Double-Lock)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Auth Guard — Unauthenticated Blocking', () => {
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/attendance',
    '/dashboard/students',
    '/dashboard/fees',
    '/dashboard/hostel',
    '/billing',
    '/saas',
  ];

  for (const route of protectedRoutes) {
    test(`Unauthenticated: ${route} → redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/.*\/login/, { timeout: 8_000 });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. RBAC ENFORCEMENT — Role-Based Access Control
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('RBAC — Teacher cannot access Admin-only routes', () => {
  // Log in as teacher once, reuse cookie state per the suite
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEACHER);
  });

  test('Teacher is blocked from /saas (SaaS control plane)', async ({ page }) => {
    await page.goto('/saas');
    // Must either redirect to /login or /unauthorized — never stay on /saas
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/saas');
  });

  test('Teacher is blocked from /billing (subscription management)', async ({ page }) => {
    await page.goto('/billing');
    // Billing is an admin-only financial page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/billing');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ADMIN DASHBOARD — Core Module Smoke Tests
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Admin Dashboard — Core Module Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, ADMIN);
  });

  test('Admin reaches dashboard after login', async ({ page }) => {
    // Should have navigated to /dashboard/* after submit
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('Student Management page mounts without crashing', async ({ page }) => {
    await page.goto('/dashboard/students');
    await expect(page.locator('h1', { hasText: /student management/i })).toBeVisible({ timeout: 8_000 });
    // Either shows student table OR empty state — no crash
    const hasTable  = await page.locator('table.data-table').isVisible().catch(() => false);
    const hasEmpty  = await page.locator('text=No Students Found').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('Hostel Management page mounts correctly', async ({ page }) => {
    await page.goto('/dashboard/hostel');
    await expect(page.locator('h1', { hasText: /hostel management/i })).toBeVisible({ timeout: 8_000 });
    // Tabs should be present
    await expect(page.locator('#hostel-tab-rooms')).toBeVisible();
    await expect(page.locator('#hostel-tab-wardens')).toBeVisible();
  });

  test('Hostel tab navigation works correctly', async ({ page }) => {
    await page.goto('/dashboard/hostel');
    await page.locator('#hostel-tab-wardens').click();
    // Warden section should show after tab click
    await expect(page.locator('text=Rajesh Kumar').or(page.locator('text=Wardens'))).toBeVisible({ timeout: 5_000 });
  });

  test('Attendance page mounts without crashing', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 });
  });

  test('AI Copilot FAB button is rendered on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // The floating NexBot button should be visible
    const fab = page.locator('button.fixed.bottom-6.right-6');
    await expect(fab).toBeVisible({ timeout: 8_000 });
  });

  test('NexBot chat window toggles open on click', async ({ page }) => {
    await page.goto('/dashboard');
    const fab = page.locator('button.fixed.bottom-6.right-6');
    await fab.click();
    // The chat window panel should now be visible
    await expect(page.locator('text=NexSchool AI Copilot')).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ONBOARDING FLOW — SaaS Funnel Validation
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Onboarding Funnel — SaaS Signup Flow', () => {
  test('Register form step 1 validates and advances', async ({ page }) => {
    await page.goto('/register?tier=starter');
    // Fill step 1
    await page.locator('input[name="school_name"]').fill('Test School');
    await page.locator('input[name="city"]').fill('Delhi');
    // Advance to step 2
    await page.locator('button', { hasText: /continue to admin/i }).click();
    // Step 2 fields should appear
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('Register form step 2 back button returns to step 1', async ({ page }) => {
    await page.goto('/register');
    await page.locator('button', { hasText: /continue to admin/i }).click();
    await page.locator('button', { hasText: /back/i }).click();
    // Should see step 1 inputs again
    await expect(page.locator('input[name="school_name"]')).toBeVisible();
  });
});
