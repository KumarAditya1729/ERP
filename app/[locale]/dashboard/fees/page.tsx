'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function FeesDashboardPage() {
  const [stats, setStats] = useState({ billed: 0, collected: 0, pending: 0, invoices: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('fee_invoices')
        .select('total_amount, paid_amount, balance_amount')
        .eq('tenant_id', user.app_metadata?.tenant_id);

      if (data) {
        const billed = data.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
        const collected = data.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
        const pending = data.reduce((sum, inv) => sum + Number(inv.balance_amount), 0);
        setStats({ billed, collected, pending, invoices: data.length });
      }
      setLoading(false);
    }
    fetchStats();
  }, [supabase]);

  const navLinks = [
    { name: 'Fee Categories', href: '/dashboard/fees/categories', icon: '🏷️', desc: 'Manage master fee types' },
    { name: 'Fee Structures', href: '/dashboard/fees/structures', icon: '📋', desc: 'Define costs for academic year' },
    { name: 'Student Assignments', href: '/dashboard/fees/assignments', icon: '👤', desc: 'Assign fees to individual students' },
    { name: 'Manage Invoices', href: '/dashboard/fees/invoices', icon: '🧾', desc: 'Generate & track monthly bills' }
  ];

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <h1 className="text-2xl font-bold text-white">Fees Administration</h1>
      <p className="text-sm text-slate-400">Complete financial tracking and billing system.</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Total Billed</p>
          <p className="text-3xl font-extrabold text-white">₹{stats.billed.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.invoices} invoices generated</p>
        </div>
        <div className="glass border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-5">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Collected</p>
          <p className="text-3xl font-extrabold text-emerald-400">₹{stats.collected.toLocaleString()}</p>
          <p className="text-xs text-emerald-400/50 mt-1">Paid securely</p>
        </div>
        <div className="glass border border-amber-500/20 bg-amber-500/5 rounded-2xl p-5">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Pending Balance</p>
          <p className="text-3xl font-extrabold text-amber-400">₹{stats.pending.toLocaleString()}</p>
          <p className="text-xs text-amber-400/50 mt-1">Awaiting collection</p>
        </div>
        <div className="glass border border-blue-500/20 bg-blue-500/5 rounded-2xl p-5">
          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Collection Rate</p>
          <p className="text-3xl font-extrabold text-blue-400">
            {stats.billed > 0 ? Math.round((stats.collected / stats.billed) * 100) : 0}%
          </p>
          <p className="text-xs text-blue-400/50 mt-1">Of total billed</p>
        </div>
      </div>

      {/* Navigation Grid */}
      <h2 className="text-lg font-bold text-white pt-4">Module Navigation</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {navLinks.map(link => (
          <Link key={link.name} href={link.href} className="glass p-6 rounded-2xl border border-white/[0.08] hover:bg-white/[0.02] transition-colors flex items-start gap-4">
            <span className="text-3xl">{link.icon}</span>
            <div>
              <h3 className="text-white font-bold">{link.name}</h3>
              <p className="text-sm text-slate-400 mt-1">{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
