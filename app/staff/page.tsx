'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function StaffDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    }
    loadData();
  }, [supabase]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">Operations Center</h1>
        <p className="text-slate-400">Welcome, {profile?.first_name || 'Staff'}. Manage facility logistics, transport, and inventory operations below.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass border border-white/[0.08] rounded-2xl p-6 hover:border-amber-500/30 transition-colors">
          <div className="text-4xl mb-4">🚌</div>
          <h2 className="text-xl font-semibold text-white mb-2">Transport Fleet</h2>
          <p className="text-sm text-slate-400 mb-4">Manage 4 active bus routes, driver assignments, and student onboarding manifests.</p>
          <button className="btn-secondary w-full text-sm">Manage Routes</button>
        </div>

        <div className="glass border border-white/[0.08] rounded-2xl p-6 hover:border-pink-500/30 transition-colors">
          <div className="text-4xl mb-4">🏨</div>
          <h2 className="text-xl font-semibold text-white mb-2">Hostel Rooms</h2>
          <p className="text-sm text-slate-400 mb-4">Monitor bed allocations, room vacancies, and student assignments.</p>
          <button className="btn-secondary w-full text-sm">View Rooms</button>
        </div>
      </div>
    </div>
  );
}
