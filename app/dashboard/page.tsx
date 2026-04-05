'use client';
import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass border border-white/10 rounded-xl px-4 py-3 text-xs">
        <p className="text-slate-300 font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}{p.name === 'pct' ? '%' : ''}</p>
        ))}
      </div>
    );
  }
  return null;
};

const defaultKpis = [
  { label: 'Total Students', value: '—', change: 'loading...', up: true, icon: '🎓', color: 'from-violet-600/25 to-violet-900/10', border: 'border-violet-500/25' },
  { label: 'Fees Collected', value: '—', change: 'loading...', up: true, icon: '💰', color: 'from-emerald-600/25 to-emerald-900/10', border: 'border-emerald-500/25' },
  { label: 'Pending Fees', value: '—', change: 'loading...', up: false, icon: '⏳', color: 'from-amber-600/25 to-amber-900/10', border: 'border-amber-500/25' },
  { label: 'Staff Count', value: '—', change: 'loading...', up: true, icon: '👩‍💼', color: 'from-cyan-600/25 to-cyan-900/10', border: 'border-cyan-500/25' },
];

export default function DashboardOverview() {
  const [kpis, setKpis] = useState(defaultKpis);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [feeChartData, setFeeChartData] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function fetchDashboardData() {
      // 1. Fetch KPIs from cached API route
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (data.kpis) setKpis(data.kpis);
      } catch (e) {
        console.error('[Dashboard] KPI fetch failed', e);
      }

      // 2. Fetch attendance trend (last 7 days)
      try {
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const { data: attData } = await supabase
          .from('attendance')
          .select('date, status')
          .gte('date', since.toISOString().split('T')[0]);
        
        if (attData && attData.length > 0) {
          // Group by date and calculate % present
          const byDate: Record<string, { present: number; total: number }> = {};
          attData.forEach(r => {
            if (!byDate[r.date]) byDate[r.date] = { present: 0, total: 0 };
            byDate[r.date].total++;
            if (r.status === 'present') byDate[r.date].present++;
          });
          const chartData = Object.entries(byDate).map(([date, counts]) => ({
            day: new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            pct: Math.round((counts.present / counts.total) * 100)
          }));
          setAttendanceChartData(chartData);
        }
      } catch (e) {
        console.error('[Dashboard] Attendance trend fetch failed', e);
      }

      // 3. Fetch fee collection by month (last 4 months)
      try {
        const { data: fees } = await supabase.from('fees').select('amount, status, created_at');
        if (fees && fees.length > 0) {
          const byMonth: Record<string, { collected: number; pending: number }> = {};
          fees.forEach(f => {
            const month = new Date(f.created_at).toLocaleDateString('en-IN', { month: 'short' });
            if (!byMonth[month]) byMonth[month] = { collected: 0, pending: 0 };
            const amt = Number(f.amount) / 1000; // in thousands
            if (f.status === 'paid') byMonth[month].collected += amt;
            else byMonth[month].pending += amt;
          });
          setFeeChartData(Object.entries(byMonth).slice(-4).map(([month, vals]) => ({
            month,
            collected: parseFloat(vals.collected.toFixed(1)),
            pending: parseFloat(vals.pending.toFixed(1))
          })));
        }
      } catch (e) {
        console.error('[Dashboard] Fee chart fetch failed', e);
      }

      // 4. Fetch recent notices as activity feed
      try {
        const { data: notices } = await supabase.from('notices').select('title, created_at, audience_segment').order('created_at', { ascending: false }).limit(5);
        if (notices) {
          setRecentActivities(notices.map(n => ({
            icon: '📣',
            text: `Notice sent: "${n.title}" → ${n.audience_segment || 'all'}`,
            time: new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            badge: 'badge-yellow'
          })));
        }
      } catch (e) {
        console.error('[Dashboard] Activity feed failed', e);
      }
    }

    fetchDashboardData();
  }, [supabase]);

  // Fallback empty state for charts
  const chartData = attendanceChartData.length > 0 ? attendanceChartData : [
    { day: 'Mon', pct: 0 }, { day: 'Tue', pct: 0 }, { day: 'Wed', pct: 0 }
  ];
  const feesData = feeChartData.length > 0 ? feeChartData : [
    { month: '—', collected: 0, pending: 0 }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">School Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} — here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex gap-3">
          <button id="export-btn" className="btn-secondary text-sm py-2 px-4">
            📥 Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`glass bg-gradient-to-br ${kpi.color} border ${kpi.border} rounded-2xl p-5 card-hover`}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-xl">
                {kpi.icon}
              </div>
              <span className={`badge text-[10px] ${kpi.up ? 'badge-green' : 'badge-yellow'}`}>
                {kpi.up ? '↑' : '→'}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-white mb-1">{kpi.value}</p>
            <p className="text-xs text-slate-400 font-medium">{kpi.label}</p>
            <p className="text-[11px] text-slate-500 mt-1">{kpi.change}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Attendance Chart */}
        <div className="lg:col-span-2 glass border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white">Attendance Trend</h2>
              <p className="text-xs text-slate-400">Last 7 days — school-wide %</p>
            </div>
            {attendanceChartData.length > 0 ? (
              <span className="badge badge-green">
                Avg {Math.round(attendanceChartData.reduce((s, d) => s + d.pct, 0) / attendanceChartData.length)}%
              </span>
            ) : (
              <span className="badge badge-yellow">No Data Yet</span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="pct" stroke="#7C3AED" strokeWidth={2} fill="url(#attGrad)" name="pct" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity (DB-driven) */}
        <div className="glass border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-1">Recent Activity</h2>
          <p className="text-xs text-slate-400 mb-4">Latest notices & events</p>
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-slate-500 text-xs">No recent activity. Compose a notice to get started.</p>
              </div>
            ) : recentActivities.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.04]">
                <span className="text-base shrink-0">{a.icon}</span>
                <p className="text-xs text-slate-300 flex-1">{a.text}</p>
                <span className={`badge ${a.badge} text-[10px] shrink-0`}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fee Chart */}
      <div className="glass border border-white/[0.07] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-white">Fee Collections</h2>
            <p className="text-xs text-slate-400">Amount in ₹K per month</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={feesData} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="collected" fill="#7C3AED" radius={[4, 4, 0, 0]} name="collected" />
            <Bar dataKey="pending" fill="rgba(239,68,68,0.4)" radius={[4, 4, 0, 0]} name="pending" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
