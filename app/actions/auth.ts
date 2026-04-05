'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

// Admin client — uses service role key, runs only on server, never in browser
const getAdminClient = () => createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getRouteForRole(role: string): string {
  if (role === 'admin') return '/dashboard'
  if (role === 'teacher') return '/teacher'
  if (role === 'staff') return '/staff'
  return '/portal'
}

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = createClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/login?error=' + error.message)
  }

  if (authData.user) {
    // First: try the fast JWT path (works for newly-created users with trigger)
    let role = authData.user.app_metadata?.role as string | undefined;

    // Fallback: if JWT doesn't have role yet (older users), read from DB authoritatively
    if (!role) {
      const supabaseAdmin = createSupabaseAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();
      role = profile?.role || 'parent';
    }

    revalidatePath('/', 'layout')
    return redirect(getRouteForRole(role || 'parent'))
  }

  revalidatePath('/', 'layout')
  redirect('/portal')
}

/**
 * Free leaked-password check using HaveIBeenPwned k-anonymity API.
 * Only the first 5 chars of the SHA1 hash are sent to HIBP.
 * The full password NEVER leaves this server. Works on Supabase Free Plan.
 * @returns number of times the password appeared in known data breaches (0 = safe)
 */
async function checkPasswordPwned(password: string): Promise<number> {
  try {
    const { createHash } = await import('crypto')
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)  // only send first 5 chars to HIBP
    const suffix = sha1.slice(5)     // compare the rest locally — never sent

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' }, // padded response prevents traffic analysis
      cache: 'no-store',
    })

    if (!res.ok) return 0 // HIBP unreachable → fail open, don't block signup

    const text = await res.text()
    for (const line of text.split('\n')) {
      const [hashSuffix, countStr] = line.trim().split(':')
      if (hashSuffix === suffix) return parseInt(countStr, 10)
    }
    return 0
  } catch {
    return 0 // network error → fail open
  }
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = formData.get('role') as string
  const supabase = createClient()

  // ── Leaked Password Protection (replaces Supabase Pro Plan HIBP feature) ──
  const pwnedCount = await checkPasswordPwned(password)
  if (pwnedCount > 0) {
    return redirect(
      `/login?error=This password has appeared in ${pwnedCount.toLocaleString()} known data breaches. Please choose a stronger, unique password.`
    )
  }

  // Use service role to bypass email confirmation & rate limits for demo signups
  const supabaseAdmin = getAdminClient()

  // ENSURE Mock Tenant Exists to prevent Foreign Key Violation during Trigger!
  await supabaseAdmin.from('tenants').upsert({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Delhi Public School',
    city: 'New Delhi',
    subscription_tier: 'growth'
  });

  const { error: adminError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: role || 'admin',
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      first_name: 'Test',
      last_name: 'User'
    }
  })

  if (adminError) {
    console.error("Supabase Admin Create User Error:", adminError);
    return redirect('/login?error=' + adminError.message)
  }

  // Log them in so session cookies are securely set
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return redirect('/login?error=' + error.message)
  }

  // Profile insertion handled by Postgres trigger `on_auth_user_created`
  revalidatePath('/', 'layout')

  if (role === 'admin') return redirect('/dashboard')
  if (role === 'teacher') return redirect('/teacher')
  if (role === 'staff') return redirect('/staff')
  return redirect('/portal')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
