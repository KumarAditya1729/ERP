'use client';
import { useState, useEffect } from 'react';
import { getReportsDashboard } from '@/app/actions/modules';
import { getDashboardAnalytics } from '@/app/actions/reports';

const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [legacyData, setLegacyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [r1, r2] = await Promise.all([getReportsDashboard(), getDashboardAnalytics()]);
      if (r1.success) setData(r1.data);
      if (r2.success) setLegacyData(r2.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-4">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 font-semibold tracking-wider animate-pulse">GENERATING REPORTS...</p>
    </div>
  );

  const funnel = legacyData?.admissions || {};
  const maxAdmissions = Math.max(funnel.Applied || 1, 1);

  const kpis = [
    { label: 'Total Revenue', value: formatter.format(data?.totalRevenue || legacyData?.fees?.collected || 0), color: 'border-emerald-500/30', textColor: 'text-emerald-400', icon: '💰' },
    { label: 'Active Students', value: String(data?.activeStudents || data?.totalStudents || legacyData?.totalStudents || 0), color: 'border-cyan-500/30', textColor: 'text-cyan-400', icon: '👩‍🎓' },
    { label: 'Attendance Rate', value: `${data?.attendanceRate ?? 0}%`, color: 'border-violet-500/30', textColor: 'text-violet-400', icon: '📅' },
    { label: 'Avg Exam Score', value: `${data?.avgExamScore ?? 0}%`, color: 'border-amber-500/30', textColor: 'text-amber-400', icon: '📊' },
    { label: 'HW Submission Rate', value: `${data?.hwSubmissionRate ?? 0}%`, color: 'border-pink-500/30', textColor: 'text-pink-400', icon: '📝' },
    { label: 'Pending Fees', value: formatter.format(legacyData?.fees?.pending || 0), color: 'border-red-500/30', textColor: 'text-red-400', icon: '⏳' },
  ];

  return (
    <div className="space-y-6 animate-fade-in relative pb-10">
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">Analytics & BI</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time institutional performance metrics</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`glass border ${k.color} rounded-2xl p-4 text-center`}>
            <span className="text-2xl">{k.icon}</span>
            <p className={`text-2xl font-black ${k.textColor} mt-2`}>{k.value}</p>
            <p className="text-[10px] text-slate-500 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue by Month — CSS bar chart with real data */}
        <div className="glass border border-white/10 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Revenue (Last 6 Months)</h3>
          {data?.revenueByMonth?.length > 0 ? (
            <div className="flex items-end gap-2 h-48 border-b border-white/5 pb-2">
              {data.revenueByMonth.slice(-6).map((m: any) => {
                const maxAmt = Math.max(...data.revenueByMonth.map((x: any) => x.amount), 1);
                const pct = Math.max(5, (m.amount / maxAmt) * 100);
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                    <div className="absolute -top-8 px-2 py-1 bg-slate-800 text-white font-bold text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 border border-white/10">
                      {formatter.format(m.amount)}
                    </div>
                    <div className="w-full bg-gradient-to-t from-violet-600/60 to-cyan-400/80 rounded-t-md" style={{ height: `${pct}%` }} />
                    <span className="text-[9px] text-slate-500 mt-2 font-medium">{m.month}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No payment data yet</div>
          )}
        </div>

        {/* Students by Class — horizontal bars */}
        <div className="glass border border-white/10 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Students by Class</h3>
          {data?.studentsByClass?.length > 0 ? (
            <div className="space-y-3">
              {data.studentsByClass.sort((a: any, b: any) => b.count - a.count).map((c: any) => {
                const maxCount = Math.max(...data.studentsByClass.map((x: any) => x.count), 1);
                const pct = Math.max(5, (c.count / maxCount) * 100);
                return (
                  <div key={c.class_name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-semibold">Class {c.class_name}</span>
                      <span className="text-white font-bold">{c.count}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No student data yet</div>
          )}
        </div>

        {/* Admissions Funnel */}
        <div className="glass border border-white/10 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Admissions Pipeline</h3>
          <div className="space-y-4">
            {['Applied', 'Verified', 'Interviewed', 'Offered', 'Enrolled'].map((stage, idx) => {
              const val = funnel[stage] || 0;
              const pct = Math.max(5, (val / maxAdmissions) * 100);
              const colors = ['from-slate-400 to-slate-300', 'from-blue-500 to-indigo-400', 'from-violet-500 to-purple-400', 'from-teal-500 to-emerald-400', 'from-emerald-500 to-green-400'];
              return (
                <div key={stage}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300 uppercase tracking-wider">{stage}</span>
                    <span className="text-white">{val}</span>
                  </div>
                  <div className="w-full bg-slate-900/50 rounded-full h-3 overflow-hidden border border-white/5">
                    <div className={`h-full rounded-full bg-gradient-to-r ${colors[idx]} transition-all duration-700`} style={{ width: `${pct}%`, opacity: val === 0 ? 0.3 : 1 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm font-bold text-violet-400 mt-4">
            Conversion: {maxAdmissions > 0 && funnel.Applied > 0 ? Math.round(((funnel.Enrolled || 0) / funnel.Applied) * 100) : 0}%
          </p>
        </div>

        {/* Academic Performance Snapshot */}
        <div className="glass border border-white/10 rounded-3xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Academic Performance</h3>
          <div className="space-y-5">
            {[
              { label: 'Attendance Rate', value: data?.attendanceRate ?? 0, color: 'from-emerald-600 to-emerald-400' },
              { label: 'Avg Exam Score', value: data?.avgExamScore ?? 0, color: 'from-violet-600 to-violet-400' },
              { label: 'HW Submission', value: data?.hwSubmissionRate ?? 0, color: 'from-cyan-600 to-cyan-400' },
            ].map(m => (
              <div key={m.label} className="group">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-300">{m.label}</span>
                  <span className="text-white font-bold">{m.value}%</span>
                </div>
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${m.color} transition-all duration-1000`} style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
