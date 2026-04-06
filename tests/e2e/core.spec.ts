import { test, expect } from '@playwright/test';

// 1. Landing Page Smoke Test
test('Landing page renders correctly', async ({ page }) => {
  await page.goto('/');
  // Next.js landing page should load and display the main branded text
  await expect(page.locator('text=NexSchool').first()).toBeVisible();
});

// 2. Auth Gateway Render Test
test('Login page mounts correctly', async ({ page }) => {
  await page.goto('/login');
  
  // The login frame/box should be visible
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

// 3. Unauthenticated Redirection Test
test('Unauthenticated users are blocked from dashboard', async ({ page }) => {
  // Navigate to an internal route
  await page.goto('/dashboard/attendance');
  
  // Middleware should redirect back to /login
  await expect(page).toHaveURL(/.*\/login/);
});
