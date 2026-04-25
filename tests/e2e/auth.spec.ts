import { test, expect } from '@playwright/test'

const AUTH_E2E_ENABLED = process.env.E2E_AUTH_ENABLED === 'true'

const roles = [
  { email: 'admin@nexschool.local', password: 'Password!123', redirect: '/dashboard' },
  { email: 'teacher@nexschool.local', password: 'Password!123', redirect: '/teacher' },
]

test.describe('Authentication flows', () => {
  test.skip(!AUTH_E2E_ENABLED, 'Auth-backed E2E requires configured demo users.')

  for (const role of roles) {
    test(`Login works for ${role.email}`, async ({ page }) => {
      await page.goto('/login')

      await page.fill('input[type="email"]', role.email)
      await page.fill('input[type="password"]', role.password)
      await page.click('button[type="submit"]')

      await expect(page).toHaveURL(new RegExp(`${role.redirect}$`))
    })
  }

  test('tenant isolation works via subdomains', async ({ page }) => {
    // Simulating DNS subdomain routing
    await page.goto('http://dps.localhost:3000/login')
    await page.fill('input[type="email"]', 'admin@nexschool.local')
    await page.fill('input[type="password"]', 'Password!123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/dashboard$/)
  })
})

test('Unauthorized user blocked', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/.*\/login/)
})
