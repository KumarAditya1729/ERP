'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function VerifyContent() {
  const searchParams = useSearchParams()
  const school = searchParams?.get('school') || 'your school'
  const email = searchParams?.get('email') || 'your email'

  return (
    <div className="w-full max-w-md text-center relative">
      {/* Animated envelope icon */}
      <div className="relative mx-auto mb-8 w-24 h-24">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-600/30 to-indigo-600/30 flex items-center justify-center animate-pulse">
          <span className="text-5xl">✉️</span>
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-emerald-500/30">
          <span className="text-xs">✓</span>
        </div>
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Check Your Email</h1>
      <p className="text-slate-400 mb-2">
        We&apos;ve sent a verification link to:
      </p>
      <p className="text-violet-400 font-semibold text-lg mb-6">{email}</p>

      <div className="glass border border-white/[0.08] rounded-2xl p-6 mb-6 text-left space-y-3">
        <p className="text-white font-semibold text-sm">What happens next?</p>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs text-violet-400 font-bold shrink-0 mt-0.5">1</div>
          <p className="text-slate-400 text-sm">Click the link in your email to verify your address</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs text-violet-400 font-bold shrink-0 mt-0.5">2</div>
          <p className="text-slate-400 text-sm">You&apos;ll be automatically signed into your admin dashboard for <span className="text-white font-medium">{school}</span></p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs text-violet-400 font-bold shrink-0 mt-0.5">3</div>
          <p className="text-slate-400 text-sm">Start onboarding your teachers, students, and staff</p>
        </div>
      </div>

      <div className="glass border border-white/[0.08] rounded-xl p-4 mb-6">
        <p className="text-xs text-slate-500">
          Didn&apos;t receive an email? Check your spam folder. The link expires in 24 hours.
        </p>
      </div>

      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        ← Back to Sign In
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: '#080C1A' }}>
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-700/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-emerald-700/10 blur-[100px] pointer-events-none" />
      <Suspense fallback={<div className="text-violet-400 font-bold">Loading…</div>}>
        <VerifyContent />
      </Suspense>
    </div>
  )
}
