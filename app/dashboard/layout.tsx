'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { logout } from '@/app/actions/auth';
import AICopilot from '@/components/AI_Copilot';

// Feature flags — driven by env vars, no redeployment needed
const FEATURE_TRANSPORT_GPS = process.env.NEXT_PUBLIC_FEATURE_TRANSPORT_GPS === 'true';
const FEATURE_HOSTEL = process.env.NEXT_PUBLIC_FEATURE_HOSTEL === 'true';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '📊' },
  { href: '/dashboard/students', label: 'Students', icon: '🎓' },
  { href: '/dashboard/admissions', label: 'Admissions', icon: '📋' },
  { href: '/dashboard/fees', label: 'Fee Management', icon: '💰' },
  { href: '/dashboard/communication', label: 'Communication', icon: '📣' },
  { href: '/dashboard/transport', label: 'Transport', icon: '🚌', comingSoon: !FEATURE_TRANSPORT_GPS },
  { href: '/dashboard/exams', label: 'Examinations', icon: '📝' },
  { href: '/dashboard/academics', label: 'Academics & Timetable', icon: '⏰' },
  { href: '/dashboard/homework', label: 'Homework', icon: '✍️' },
  { href: '/dashboard/library', label: 'Library', icon: '📚' },
  { href: '/dashboard/hostel', label: 'Hostel', icon: '🏨', comingSoon: !FEATURE_HOSTEL },
  { href: '/dashboard/hr', label: 'HR & Payroll', icon: '👩‍💼' },
  { href: '/dashboard/reports', label: 'Reports', icon: '📈' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.app_metadata?.role !== 'admin') {
        router.push('/unauthorized');
        return;
      }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
      if (prof?.tenant_id) {
         const { data: ten } = await supabase.from('tenants').select('*').eq('id', prof.tenant_id).single();
         setTenant(ten);
      }
    }
    loadUser();
  }, [supabase, router]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080C1A' }}>
      {/* Sidebar */}
      <aside
        className={`fixed lg:relative inset-y-0 left-0 z-30 w-64 flex flex-col glass border-r border-white/[0.07] transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="NexSchool AI Logo" className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <span className="font-bold text-lg text-white">
              NexSchool <span className="gradient-text">AI</span>
            </span>
          </Link>
        </div>

        {/* School Badge */}
        <div className="mx-4 my-4 p-3 glass-strong rounded-xl border border-violet-500/20">
          <p className="text-xs text-slate-400 font-medium">Current School</p>
          <p className="text-sm font-bold text-white truncate">
            {tenant ? tenant.name : 'Loading School...'}
          </p>
          {tenant && <span className="badge badge-green text-[10px] mt-1">{tenant.subscription_tier}</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 py-2 mt-2">Main Menu</p>
          {navItems.slice(0, 6).map((item) => (
            item.comingSoon ? (
              <div key={item.href} className="sidebar-link opacity-40 cursor-not-allowed select-none flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </div>
                <span className="text-[9px] font-bold bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full border border-violet-500/30">SOON</span>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          ))}

          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 py-2 mt-4">Advanced</p>
          {navItems.slice(6).map((item) => (
            item.comingSoon ? (
              <div key={item.href} className="sidebar-link opacity-40 cursor-not-allowed select-none flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </div>
                <span className="text-[9px] font-bold bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full border border-violet-500/30">SOON</span>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            )
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0 uppercase">
              {profile?.first_name?.[0] || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate capitalize">
                {profile ? `${profile.first_name} ${profile.last_name}` : 'Loading...'}
              </p>
              <p className="text-[11px] text-slate-400 truncate uppercase tracking-wider">{profile?.role || 'Admin'}</p>
            </div>
            <form action={logout}>
              <button type="submit" title="Sign Out" className="text-slate-500 hover:text-red-400 transition-colors">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 glass border-b border-white/[0.07] flex items-center px-6 gap-4 shrink-0">
          <button
            id="sidebar-toggle"
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="dashboard-search"
                type="text"
                className="erp-input pl-10 text-sm"
                placeholder="Search students, fees, reports…"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Notification bell */}
            <button id="notifications-btn" className="relative w-9 h-9 glass border border-white/[0.08] rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            {/* Date */}
            <div className="hidden md:flex items-center gap-2 glass border border-white/[0.08] rounded-xl px-3 h-9">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-slate-300 font-medium">
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      
      {/* AI Copilot Widget */}
      <AICopilot role={profile?.role || 'admin'} />
    </div>
  );
}
