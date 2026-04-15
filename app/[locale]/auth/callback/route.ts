import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth callback handler — called when a user clicks the email verification link.
 * Supabase redirects here with a `code` query param which we exchange for a session.
 * After exchange, redirect the new school admin straight to their dashboard.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Read role from app_metadata (set by our trigger) and route correctly
      const role = data.user.app_metadata?.role as string | undefined

      if (role === 'admin')   return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
      if (role === 'teacher') return NextResponse.redirect(new URL('/teacher', requestUrl.origin))
      if (role === 'staff')   return NextResponse.redirect(new URL('/staff', requestUrl.origin))
      return NextResponse.redirect(new URL('/portal', requestUrl.origin))
    }
  }

  // Something went wrong — send to login with error
  return NextResponse.redirect(new URL('/login?error=Email verification failed. Please try again.', requestUrl.origin))
}
