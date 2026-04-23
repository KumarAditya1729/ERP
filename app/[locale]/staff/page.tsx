'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getOperationsStats } from '@/app/actions/hostel';

export default function StaffDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ routes: 0, rooms: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
      
      const statsRes = await getOperationsStats();
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      setLoading(false);
    }
    loadData();
  }, [supabase]);

  return (
    <div className="space-y-8 animate-fade-in pt-4 pb-20">
      <div className="relative">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-600/20 to-orange-600/20 blur-2xl opacity-50 z-0 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Operations Center</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Welcome back, {profile?.first_name || 'Staff'}. Manage facility logistics, transport, and inventory operations below.</p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center animate-pulse text-amber-400">Loading operations matrix...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Transport Fleet Card */}
          <div className="glass-strong border border-white/[0.08] rounded-3xl p-7 relative overflow-hidden group hover:border-amber-500/30 transition-all shadow-lg hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-colors" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                🚌
              </div>
              <span className="text-[10px] font-bold tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                {stats.routes} ACTIVE ROUTES
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 relative z-10">Transport Fleet</h2>
            <p className="text-sm text-slate-400 mb-6 flex-1 relative z-10 leading-relaxed">
              Manage live bus routes, driver assignments, and track daily student onboarding manifests.
            </p>
            <Link href="/staff/transport" className="relative z-10 bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-white font-semibold text-sm w-full py-3 rounded-xl transition-all shadow-sm text-center">
              Manage Routes
            </Link>
          </div>

          {/* Hostel Rooms Card */}
          <div className="glass-strong border border-white/[0.08] rounded-3xl p-7 relative overflow-hidden group hover:border-pink-500/30 transition-all shadow-lg hover:shadow-[0_0_30px_rgba(236,72,153,0.1)] flex flex-col">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/20 transition-colors" />
            <div className="flex items-center justify-between mb-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform">
                🏨
              </div>
              <span className="text-[10px] font-bold tracking-wider text-pink-400 bg-pink-500/10 px-3 py-1.5 rounded-lg border border-pink-500/20">
                {stats.rooms} TOTAL ROOMS
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 relative z-10">Hostel Matrix</h2>
            <p className="text-sm text-slate-400 mb-6 flex-1 relative z-10 leading-relaxed">
              Monitor live bed allocations, manage room vacancies, and assign students to respective dorms.
            </p>
            <Link href="/staff/hostel" className="relative z-10 bg-white/5 hover:bg-pink-500/20 border border-white/10 hover:border-pink-500/40 text-white font-semibold text-sm w-full py-3 rounded-xl transition-all shadow-sm text-center">
              View Matrix
            </Link>
          </div>
          
          {/* Inventory placeholder */}
          <div className="glass border border-white/5 rounded-3xl p-7 relative overflow-hidden flex flex-col opacity-60">
            <div className="flex items-center justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl opacity-50 grayscale">
                📦
              </div>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg">
                COMING SOON
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-400 mb-2">Inventory Ledger</h2>
            <p className="text-sm text-slate-500 mb-6 flex-1 leading-relaxed">
              Asset tracking, stationery management, and supply chain logistics module.
            </p>
            <button disabled className="bg-white/5 border border-white/5 text-slate-500 font-semibold text-sm w-full py-3 rounded-xl cursor-not-allowed">
              Locked
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
