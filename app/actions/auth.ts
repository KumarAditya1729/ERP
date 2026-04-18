'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
    // Map raw Supabase errors to safe, user-friendly messages
    const safeErrorMap: Record<string, string> = {
      'Invalid login credentials': 'Invalid email or password',
      'Email not confirmed': 'Please verify your email before logging in',
      'Too many requests': 'Too many login attempts. Please try again later',
    }
    const safeMessage = safeErrorMap[error.message] || 'Login failed. Please try again.'
    return redirect('/login?error=' + encodeURIComponent(safeMessage))
  }

  if (authData.user) {
    // First: try the fast JWT path (works for newly-created users with trigger)
    let role = authData.user.app_metadata?.role as string | undefined;

    // Fallback: if JWT doesn't have role yet (older users), read from DB authoritatively
    if (!role) {
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
  const requestedRole = formData.get('role') as string
  const supabase = createClient()

  // SECURITY: Block admin role self-assignment from public forms
  const role = requestedRole === 'admin' ? 'parent' : requestedRole || 'parent'

  // ── Leaked Password Protection (replaces Supabase Pro Plan HIBP feature) ──
  const pwnedCount = await checkPasswordPwned(password)
  if (pwnedCount > 0) {
    return redirect(
      `/login?error=This password has appeared in ${pwnedCount.toLocaleString()} known data breaches. Please choose a stronger, unique password.`
    )
  }

  const tenant_id = formData.get('tenant_id') as string;
  if (!tenant_id) {
    return redirect('/login?error=School (Tenant ID) must be specified for user registration. Or register a new school.')
  }

  const { error: adminError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: role || 'admin',
      tenant_id: tenant_id,
      first_name: formData.get('first_name') || 'New',
      last_name: formData.get('last_name') || 'User'
    }
  })

  if (adminError) {
    console.error("Supabase Admin Create User Error:", adminError);
    // Map raw Supabase errors to safe, user-friendly messages
    const safeErrorMap: Record<string, string> = {
      'User already registered': 'An account with this email already exists',
      'Password should be at least 6 characters': 'Password must be at least 6 characters long',
      'Invalid email': 'Please enter a valid email address',
    }
    const safeMessage = safeErrorMap[adminError.message] || 'Registration failed. Please try again.'
    return redirect('/login?error=' + encodeURIComponent(safeMessage))
  }

  // Log them in so session cookies are securely set
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Map raw Supabase errors to safe, user-friendly messages
    const safeErrorMap: Record<string, string> = {
      'Invalid login credentials': 'Invalid email or password',
      'Email not confirmed': 'Please verify your email before logging in',
      'Too many requests': 'Too many login attempts. Please try again later',
    }
    const safeMessage = safeErrorMap[error.message] || 'Login failed. Please try again.'
    return redirect('/login?error=' + encodeURIComponent(safeMessage))
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
