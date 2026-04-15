'use client';
import { useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { login, signup } from '@/app/actions/auth';
import { useSearchParams } from 'next/navigation';

const DEMO_ACCOUNTS = [
  { role: 'admin' as const,   label: 'Admin',   icon: '🏫', email: 'admin_v3@nexschool.com',   password: 'Admin1234!', color: 'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300' },
  { role: 'teacher' as const, label: 'Teacher', icon: '👩‍🏫', email: 'teacher_v3@nexschool.com', password: 'Admin1234!', color: 'border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300' },
  { role: 'parent' as const,  label: 'Parent',  icon: '👪', email: 'parent_v3@nexschool.com',  password: 'Admin1234!', color: 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300' },
  { role: 'staff' as const,   label: 'Staff',   icon: '👨‍💼', email: 'staff_v3@nexschool.com',   password: 'Admin1234!', color: 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300' },
] as const;

function LoginForm() {
  const searchParams = useSearchParams();
  const errorMsg = searchParams?.get('error');

  const [role, setRole] = useState<'admin' | 'teacher' | 'parent' | 'staff'>('admin');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [filledDemo, setFilledDemo] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const roles = [
    { id: 'admin', label: 'Admin', icon: '🏫' },
    { id: 'teacher', label: 'Teacher', icon: '👩‍🏫' },
    { id: 'parent', label: 'Parent', icon: '👪' },
    { id: 'staff', label: 'Staff', icon: '👨‍💼' },
  ] as const;

  const fillDemo = (demo: typeof DEMO_ACCOUNTS[number]) => {
    setRole(demo.role);
    setIsLogin(true);
    if (emailRef.current) emailRef.current.value = demo.email;
    if (passwordRef.current) passwordRef.current.value = demo.password;
    setFilledDemo(demo.role);
  };

  return (
    <div className="w-full max-w-md relative">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
          <img src="/logo.svg" alt="NexSchool AI" className="w-10 h-10 object-contain" onError={(e) => (e.currentTarget.style.display='none')} />
          <span className="font-bold text-2xl text-white">
            NexSchool <span className="gradient-text">AI</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">
          {isLogin ? 'Welcome back' : 'Create Demo Account'}
        </h1>
        <p className="text-slate-400 text-sm">
          {isLogin ? 'Sign in to your school portal' : 'Start your ERP evaluation today'}
        </p>
      </div>

      {errorMsg && (
        <div className="glass bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-6 text-sm text-center font-medium">
          {errorMsg}
        </div>
      )}

      {/* Role Selector */}
      <div className="glass border border-white/[0.08] rounded-2xl p-1.5 grid grid-cols-4 gap-1 mb-6">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setRole(r.id)}
            type="button"
            className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all duration-200 ${
              role === r.id
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="text-base">{r.icon}</span>
            {r.label}
          </button>
        ))}
      </div>

      {/* Login / Signup Form */}
      <form action={isLogin ? login : signup} onSubmit={() => setLoading(true)} className="glass border border-white/[0.08] rounded-2xl p-7 space-y-5">
        <input type="hidden" name="role" value={role} />

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
            Email Address
          </label>
          <input
            ref={emailRef}
            name="email"
            type="email"
            className="erp-input"
            placeholder="principal@school.edu.in"
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Password
            </label>
            {isLogin && <a href="#" className="text-xs text-violet-400 hover:text-violet-300">Forgot password?</a>}
          </div>
          <input
            ref={passwordRef}
            name="password"
            type="password"
            className="erp-input"
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-3 text-base"
          style={{ opacity: loading ? 0.7 : 1 }}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {isLogin ? 'Signing in…' : 'Creating Account…'}
            </>
          ) : (
            <>
              {isLogin ? 'Sign In as' : 'Sign Up as'} {roles.find((r) => r.id === role)?.label}
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </>
          )}
        </button>

        <div className="text-center pt-2">
          <p className="text-xs text-slate-500">
            New school?{' '}
            <Link href="/register" className="text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2">
              Register your school →
            </Link>
          </p>
        </div>
      </form>

      {/* ── One-Click Demo Access ─────────────────────────────────────────── */}
      <div className="mt-5 glass border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">🧪 One-Click Demo Access</span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((demo) => (
            <button
              key={demo.role}
              type="button"
              onClick={() => fillDemo(demo)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${demo.color} ${
                filledDemo === demo.role ? 'ring-1 ring-white/20 scale-[0.98]' : ''
              }`}
            >
              <span className="text-base">{demo.icon}</span>
              <div className="text-left">
                <p className="font-bold">{demo.label} Portal</p>
                <p className="text-[10px] opacity-60 truncate max-w-[110px]">{demo.email}</p>
              </div>
              {filledDemo === demo.role && (
                <svg className="w-3.5 h-3.5 ml-auto shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-3 text-center">
          Click any role above → credentials auto-fill → hit Sign In
        </p>
      </div>

      <p className="text-center text-sm text-slate-500 mt-4">
        &copy; {new Date().getFullYear()} NexSchool. All rights reserved.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: '#080C1A' }}>
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-700/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full bg-cyan-700/15 blur-[100px] pointer-events-none" />

      <Suspense fallback={<div className="text-emerald-500 relative z-10 font-bold">Loading Identity Provider...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
