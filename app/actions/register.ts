'use server'
import { requireAuth } from '@/lib/auth-guard';

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { RegistrationSchema } from '@/lib/validation'

/**
 * Register a brand-new school (tenant) and its first admin user.
 * Each school gets a unique tenant_id — this is what makes it true multi-tenant SaaS.
 *
 * Steps:
 *  1. Generate a new UUID for the school (tenant)
 *  2. Insert the tenant row via admin client (bypasses RLS)
 *  3. Call regular auth.signUp() so Supabase sends an email confirmation
 *     (the PostgreSQL trigger picks up the new user and creates the profile automatically)
 *  4. Redirect to "check your email" page
 */
export async function registerSchool(formData: FormData) {
  // Registration is a public action, no requireAuth needed

  const parseResult = RegistrationSchema.safeParse({
    school_name: formData.get('school_name'),
    city: formData.get('city'),
    tier: formData.get('tier') || 'starter',
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parseResult.success) {
    return redirect(`/register?error=${encodeURIComponent(parseResult.error.errors[0].message)}`)
  }

  const { school_name, city, tier, first_name, last_name, email, password } = parseResult.data;

  // 1. Generate a fresh UUID for this school's tenant
  const newTenantId = crypto.randomUUID()

  // 2. Create the tenant row first (the trigger will FK reference this)
  const { error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({
      id: newTenantId,
      name: school_name,
      city: city,
      subscription_tier: tier,
    })

  if (tenantError) {
    console.error('Tenant creation error:', tenantError)
    return redirect('/register?error=Failed to create school: ' + tenantError.message)
  }

  // 3. Sign up the admin user via the regular client so an email is sent
  //    The on_auth_user_created trigger auto-creates their profile + backfills JWT metadata
  const supabase = createClient()
  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'admin',
        tenant_id: newTenantId,
        first_name: first_name,
        last_name: last_name,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (signUpError) {
    // Roll back: delete the tenant we just created so we don't leave orphans
    await supabaseAdmin.from('tenants').delete().eq('id', newTenantId)
    console.error('Signup error:', signUpError)
    return redirect('/register?error=' + signUpError.message)
  }

  // 4. Redirect to check-your-email page with school context for personalization
  return redirect(`/register/verify?school=${encodeURIComponent(school_name)}&email=${encodeURIComponent(email)}`)
}
