'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logout } from '@/app/actions/auth';
import AICopilot from '@/components/AI_Copilot';

const navItems = [
  { href: '/teacher', label: 'My Classes', icon: '👨‍🏫' },
  { href: '/teacher/attendance', label: 'Mark Attendance', icon: '📅' },
  { href: '/teacher/homework', label: 'Assignments', icon: '📚' },
  { href: '/teacher/exams', label: 'Grading', icon: '📝' },
  { href: '/teacher/students', label: 'Student Profiles', icon: '🎓' },
  { href: '/teacher/communication', label: 'Messages', icon: '📣' },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
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
            <span className="badge badge-blue">Teacher</span>
          </Link>
        </div>

        {/* School Badge */}
        <div className="mx-4 my-4 p-3 glass-strong rounded-xl border border-violet-500/20">
          <p className="text-xs text-slate-400 font-medium">Teacher Portal</p>
          <p className="text-sm font-bold text-white truncate">
            {profile ? `Prof. ${profile.first_name} ${profile.last_name}` : 'Loading...'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">{tenant?.name}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 py-2 mt-2">Classroom Tools</p>
          {navItems.map((item) => (
             <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-white/[0.06]">
          <form action={logout}>
            <button type="submit" className="flex items-center gap-3 w-full px-4 py-2 hover:bg-white/[0.05] rounded-xl text-slate-400 hover:text-white transition-colors">
              <span>🚪</span>
              <span className="font-medium text-sm">Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative z-10 w-full">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 flex items-center justify-between px-4 glass border-b border-white/[0.06] sticky top-0 z-20">
          <Link href="/" className="font-bold text-lg text-white">NexSchool <span className="gradient-text">AI</span></Link>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </header>
        
        {/* Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Page Content injected here */}
        <div className="p-4 lg:p-8 w-full max-w-7xl mx-auto min-h-screen">
          {children}
        </div>
      </main>

      <AICopilot />
    </div>
  );
}
