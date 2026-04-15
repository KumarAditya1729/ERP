import React from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { logout } from '@/app/actions/auth';
import AICopilot from '@/components/AI_Copilot';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Rely on the JWT natively injected by the Auth Trigger and verified by Middleware
  const role = user?.app_metadata?.role || 'parent';

  if (!user || (role !== 'student' && role !== 'parent')) {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-[#080C1A] text-slate-300 relative flex flex-col font-sans">
      {/* Background aesthetics */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-cyan-900/10 blur-[150px]" />
      </div>

      {/* Top Mobile-Friendly Navbar */}
      <header className="sticky top-0 z-40 bg-[#080C1A]/80 backdrop-blur-xl border-b border-white/[0.08] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
            <img src="/logo.svg" alt="NexSchool AI" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight tracking-tight">NexSchool Portal</h1>
            <p className="text-[10px] text-violet-400 font-semibold tracking-wider uppercase">Parent Access</p>
          </div>
        </div>

        <form action={logout}>
          <button className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </form>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-lg mx-auto w-full pb-24">
        {children}
      </main>

      {/* Bottom App Bar (Mobile UI Style) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080C1A]/90 backdrop-blur-xl border-t border-white/[0.08] px-6 py-3 pb-safe max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between">
          <Link href="/portal" className="flex flex-col items-center gap-1 group">
            <svg className="w-6 h-6 text-violet-400 group-hover:text-violet-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px] font-medium text-violet-400">Home</span>
          </Link>

          <Link href="/portal/academics" className="flex flex-col items-center gap-1 group">
            <svg className="w-6 h-6 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-[10px] font-medium text-slate-500">Academics</span>
          </Link>

          <Link href="/portal/admissions" className="flex flex-col items-center gap-1 group">
            <svg className="w-6 h-6 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-[10px] font-medium text-slate-500">Admissions</span>
          </Link>

          <Link href="/portal/fees" className="flex flex-col items-center gap-1 group relative">
            <div className="absolute -top-1 -right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#080C1A]" />
            <svg className="w-6 h-6 text-slate-500 group-hover:text-slate-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-[10px] font-medium text-slate-500">Fees</span>
          </Link>

          <Link href="/portal/tracking" className="flex flex-col items-center gap-1 group relative">
            <div className="w-12 h-12 -mt-6 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 border-4 border-[#080C1A]">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-emerald-400">Track Bus</span>
          </Link>
        </div>
      </nav>
      
      {/* AI Copilot Widget */}
      <AICopilot role={role} />
    </div>
  );
}
