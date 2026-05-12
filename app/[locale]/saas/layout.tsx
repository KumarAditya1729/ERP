'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logout } from '@/app/actions/auth';

export default function SaaSLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!prof || prof.role !== 'superadmin') {
         router.push('/dashboard');
         return;
      }
      setProfile(prof);
    }
    loadUser();
  }, [supabase, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-black text-white selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-white/10 bg-[#050505]">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/10">
          <Link href="/saas" className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-lg tracking-tight">NexSchool <span className="text-cyan-400">HQ</span></span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 py-2 mb-2">Platform Control</p>
          <Link href="/saas" className={`sidebar-link active bg-white/5 border border-white/10 text-cyan-400`}>
            <span className="text-base leading-none">🏢</span>
            Tenants (Schools)
          </Link>
          <Link href="#" className="sidebar-link opacity-50 cursor-not-allowed select-none flex items-center justify-between hover:bg-transparent">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">💳</span> Billing Engine
            </div>
            <span className="text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full border border-white/20">SOON</span>
          </Link>
          <Link href="#" className="sidebar-link opacity-50 cursor-not-allowed select-none flex items-center justify-between hover:bg-transparent">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">🔥</span> Global Analytics
            </div>
            <span className="text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full border border-white/20">SOON</span>
          </Link>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold shrink-0 uppercase">
              {profile?.first_name?.[0] || 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate capitalize">{profile ? `${profile.first_name} ${profile.last_name}` : 'Loading...'}</p>
              <p className="text-[10px] text-cyan-400 truncate uppercase tracking-wider font-bold">Super Admin</p>
            </div>
            <form action={logout}>
              <button type="submit" className="text-slate-500 hover:text-red-400">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0A0A]">
        {/* Top Header */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-[#050505]">
           <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-xs text-slate-400 font-mono">Platform Status: ALL SYSTEMS OPERATIONAL</span>
           </div>
           
           <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 border border-white/10 rounded-xl px-3 h-9 bg-white/5">
                <span className="text-xs text-cyan-400 font-mono font-medium">ADMIN: {profile?.id?.split('-')[0] || '***'}</span>
              </div>
           </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8 relative">
           {children}
        </main>
      </div>
    </div>
  );
}
