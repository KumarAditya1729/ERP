'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SaaSDashboard() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total_schools: 0, mrr: 0, total_students: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const supabase = createClient();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchData() {
      // Fetch tenants
      const { data, error } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
      if (data) {
        setTenants(data);
        
        // Demo MRR calculation and Student counts for the saas dashboard
        // In a real world scenario, you'd aggregate this from other tables securely or via RPC
        setMetrics({
           total_schools: data.length,
           mrr: data.length * 45000, 
           total_students: data.length * 1250 
        });
      }
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const toggleTenantStatus = async (id: string, currentStatus: string) => {
    // In this demo, we just bounce a toast since we don't have a specific "status" column outside of subscription tier yet
    // But this visualizes the capability
    showToast(`Tenant ${id.split('-')[0]} access has been toggled.`, 'success');
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border ${toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 'bg-red-950/90 text-red-400 border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Tenant Fleet Command</h1>
          <p className="text-slate-400 text-sm mt-1">Manage active schools, billing tiers, and master platform access.</p>
        </div>
        <button onClick={() => showToast('Tenant Onboarding workflow initialized.')} className="bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-sm py-2 px-5 rounded-lg transition-colors">
          + Onboard New School
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl">🏢</div>
           <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2">Active Schools</p>
           <p className="text-4xl font-extrabold text-white">{metrics.total_schools}</p>
           <p className="text-xs text-emerald-400 mt-2">↑ 2 from last month</p>
        </div>
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl">💳</div>
           <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2">Monthly Recurring Rev</p>
           <p className="text-4xl font-extrabold text-cyan-400">₹{(metrics.mrr/100000).toFixed(2)}L</p>
           <p className="text-xs text-cyan-400/50 mt-2">Predicted for next cycle</p>
        </div>
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl">👩‍🎓</div>
           <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2">Platform Students End-Users</p>
           <p className="text-4xl font-extrabold text-white">{metrics.total_students.toLocaleString()}</p>
           <p className="text-xs text-slate-400 mt-2">Across all tenant instances</p>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Active Instances (Tenants)</h2>
          <span className="text-xs text-slate-500 font-mono">DB: public.tenants</span>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-slate-500">Scanning fleet infrastructure...</div>
        ) : tenants.length === 0 ? (
           <div className="p-12 text-center text-slate-500">No active schools found in the database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant ID</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">School Name</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">City</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subscription</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 text-xs font-mono text-cyan-400/50 group-hover:text-cyan-400">{t.id.split('-')[0]}</td>
                    <td className="p-4 font-bold text-white">{t.name}</td>
                    <td className="p-4 text-sm text-slate-400">{t.city || 'N/A'}</td>
                    <td className="p-4">
                       <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${t.subscription_tier === 'enterprise' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : t.subscription_tier === 'growth' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                         {t.subscription_tier}
                       </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                       <div className="flex gap-2 justify-end">
                         <button onClick={() => toggleTenantStatus(t.id, 'active')} className="bg-white/5 hover:bg-white/10 text-white text-xs px-3 py-1.5 rounded border border-white/10 transition-colors">
                            Manage
                         </button>
                         <button onClick={() => toggleTenantStatus(t.id, 'suspend')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-3 py-1.5 rounded border border-red-500/20 transition-colors">
                            Lock Access
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
