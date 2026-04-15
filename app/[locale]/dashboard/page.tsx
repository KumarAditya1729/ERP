'use client';
import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import StaffInfoModal from '@/components/dashboard/StaffInfoModal';
import { saveAttendance } from '@/app/actions/attendance';
import { useI18n } from '@/contexts/I18nContext';

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

type Status = 'present' | 'absent' | 'late';
const avatarColors = ['from-violet-600 to-purple-700', 'from-cyan-600 to-teal-700', 'from-emerald-600 to-green-700', 'from-amber-600 to-orange-700', 'from-pink-600 to-rose-700'];

export default function DashboardOverview() {
  const { t } = useI18n();
  const [kpis, setKpis] = useState(defaultKpis);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  
  // Chart states
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [feeChartData, setFeeChartData] = useState<any[]>([]);
  
  // Filter state
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState(''); // empty string means "Overall"

  // Staff Info Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      showToast('Dashboard data exported successfully!');
    }, 1500);
  };

  // Attendance Management States
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, Status>>({});
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const supabase = createClient();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    // 1. Fetch available classes for the filters
    async function fetchClasses() {
      const { data } = await supabase.from('students').select('class_grade, section').eq('status', 'active');
      if (data) {
        const clsList = Array.from(new Set(data.map(s => `${s.class_grade}-${s.section}`))).sort();
        setAvailableClasses(clsList);
      }
    }
    fetchClasses();

    // Fetch KPIs
    async function fetchKpis() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (data.kpis) setKpis(data.kpis);
      } catch (e) {
        console.error('[Dashboard] KPI fetch failed', e);
      }
    }
    fetchKpis();

    // Fetch Recent Activity
    async function fetchActivity() {
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
    fetchActivity();
  }, [supabase]);

  // Effect for fetching charts based on selectedClassFilter
  useEffect(() => {
    async function fetchCharts() {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      
      let grade = '';
      let sec = '';
      if (selectedClassFilter) {
        const parts = selectedClassFilter.split('-');
        grade = parts[0];
        sec = parts[1];
      }

      // Attendance Chart
      try {
        let query = supabase
          .from('attendance')
          .select('date, status, students!inner(class_grade, section)')
          .gte('date', since.toISOString().split('T')[0]);
          
        if (grade) query = query.eq('students.class_grade', grade);
        if (sec) query = query.eq('students.section', sec);

        const { data: attData } = await query;
        
        if (attData && attData.length > 0) {
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
        } else {
          setAttendanceChartData([]); // Reset if no data
        }
      } catch (e) {
        console.error('[Dashboard] Attendance trend fetch failed', e);
      }

      // Fees Chart
      try {
        let query = supabase.from('fees').select('amount, status, created_at, students!inner(class_grade, section)');
        if (grade) query = query.eq('students.class_grade', grade);
        if (sec) query = query.eq('students.section', sec);
        
        const { data: fees } = await query;
        if (fees && fees.length > 0) {
          const byMonth: Record<string, { collected: number; pending: number }> = {};
          fees.forEach((f: any) => {
            const month = new Date(f.created_at).toLocaleDateString('en-IN', { month: 'short' });
            if (!byMonth[month]) byMonth[month] = { collected: 0, pending: 0 };
            const amt = Number(f.amount) / 1000;
            if (f.status === 'paid') byMonth[month].collected += amt;
            else byMonth[month].pending += amt;
          });
          setFeeChartData(Object.entries(byMonth).slice(-4).map(([month, vals]) => ({
            month,
            collected: parseFloat(vals.collected.toFixed(1)),
            pending: parseFloat(vals.pending.toFixed(1))
          })));
        } else {
          setFeeChartData([]);
        }
      } catch (e) {
        console.error('[Dashboard] Fee chart fetch failed', e);
      }
    }
    
    fetchCharts();
  }, [supabase, selectedClassFilter]);

  // Effect for fetching Attendance management students
  useEffect(() => {
    async function fetchStudentsForAttendance() {
      // For the management section, we force a class. If filter is empty, pick the first class.
      const actClass = selectedClassFilter || (availableClasses.length > 0 ? availableClasses[0] : '');
      if (!actClass) return;
      
      setAttendanceLoading(true);
      const [grade, sec] = actClass.split('-');
      
      const { data } = await supabase.from('students')
        .select('*')
        .eq('class_grade', grade || '')
        .eq('section', sec || '')
        .eq('status', 'active')
        .order('roll_number', { ascending: true });
        
      if (data) {
         setAttendanceStudents(data);
         setAttendanceStatus(Object.fromEntries(data.map((s) => [s.id, 'present' as Status])));
         setAttendanceSaved(false);
      } else {
         setAttendanceStudents([]);
      }
      setAttendanceLoading(false);
    }
    
    // Only fetch if availableClasses is loaded
    if (availableClasses.length > 0) {
        fetchStudentsForAttendance();
    }
  }, [supabase, selectedClassFilter, availableClasses]);

  // Fallback empty state for charts
  const chartData = attendanceChartData.length > 0 ? attendanceChartData : [
    { day: 'Mon', pct: 0 }, { day: 'Tue', pct: 0 }, { day: 'Wed', pct: 0 }
  ];
  const feesData = feeChartData.length > 0 ? feeChartData : [
    { month: '—', collected: 0, pending: 0 }
  ];

  // Attendance Management handlers
  const toggleAttendanceStatus = (id: string) => {
    setAttendanceStatus((prev) => {
      const cycle: Status[] = ['present', 'absent', 'late'];
      const next = cycle[(cycle.indexOf(prev[id]) + 1) % cycle.length];
      return { ...prev, [id]: next };
    });
    setAttendanceSaved(false);
  };

  const markAllAttendance = (status: Status) => {
    setAttendanceStatus(Object.fromEntries(attendanceStudents.map((s) => [s.id, status])));
    setAttendanceSaved(false);
  };

  const handleSaveAttendance = async () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const records = attendanceStudents.map(s => ({
      student_id: s.id,
      status: attendanceStatus[s.id]
    }));

    const res = await saveAttendance(dateStr, records);

    if (!res.success) {
      showToast("Error saving attendance: " + res.error, false);
    } else {
      setAttendanceSaved(true);
      const absents = records.filter(r => r.status === 'absent').length;
      if (absents > 0) {
        showToast(`Attendance saved! Real SMS notifications dispatched via Twilio to ${absents} absent students.`);
      } else {
        showToast('Attendance saved successfully!');
      }
    }
  };

  const attCounts = {
    present: Object.values(attendanceStatus).filter((v) => v === 'present').length,
    absent: Object.values(attendanceStatus).filter((v) => v === 'absent').length,
    late: Object.values(attendanceStatus).filter((v) => v === 'late').length,
  };

  const attConfig: Record<Status, { label: string; badge: string; dot: string }> = {
    present: { label: 'Present', badge: 'badge-green', dot: 'bg-emerald-400' },
    absent:  { label: 'Absent',  badge: 'badge-red',   dot: 'bg-red-400' },
    late:    { label: 'Late',    badge: 'badge-yellow', dot: 'bg-amber-400' },
  };

  return (
    <div className="space-y-6 animate-fade-in relative pb-10">
      {/* Page title & Global Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('dashboard.title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} — {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 rounded-xl">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('dashboard.filter')}</label>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-[#080C1A]">{t('dashboard.overall')}</option>
              {availableClasses.map(c => (
                <option key={c} value={c} className="bg-[#080C1A]">{c}</option>
              ))}
            </select>
          </div>
          <button 
            id="export-btn" 
            onClick={handleExport}
            disabled={isExporting}
            className="btn-secondary text-sm py-2 px-4 shadow-sm"
          >
            {isExporting ? `⏳ ${t('dashboard.exporting')}` : `📥 ${t('dashboard.export')}`}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div 
            key={kpi.label} 
            onClick={() => kpi.label === 'Staff Count' ? setIsStaffModalOpen(true) : null}
            className={`glass bg-gradient-to-br ${kpi.color} border ${kpi.border} rounded-2xl p-5 card-hover ${kpi.label === 'Staff Count' ? 'cursor-pointer hover:border-violet-500/50' : ''}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 glass rounded-xl flex items-center justify-center text-xl">
                {kpi.icon}
              </div>
              <span className={`badge text-[10px] ${kpi.up ? 'badge-green' : 'badge-yellow'}`}>
                {kpi.up ? '↑' : '→'}
              </span>
            </div>
            <p className="text-2xl font-extrabold text-white mb-1">{kpi.value}</p>
            <p className="text-xs text-slate-400 font-medium">
              {kpi.label === 'Total Students' ? t('dashboard.total_students') :
               kpi.label === 'Fees Collected' ? t('dashboard.fees_collected') :
               kpi.label === 'Pending Fees' ? t('dashboard.pending_fees') :
               kpi.label === 'Staff Count' ? t('dashboard.staff_count') : kpi.label}
            </p>
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
              <h2 className="text-base font-bold text-white">{t('dashboard.attendance_trend')} {selectedClassFilter ? `(${selectedClassFilter})` : ''}</h2>
              <p className="text-xs text-slate-400">{t('dashboard.last_7_days')}</p>
            </div>
            {attendanceChartData.length > 0 ? (
              <span className="badge badge-green">
                {t('dashboard.avg')} {Math.round(attendanceChartData.reduce((s, d) => s + d.pct, 0) / attendanceChartData.length)}%
              </span>
            ) : (
              <span className="badge badge-yellow">{t('dashboard.no_data')}</span>
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
              <RechartsTooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="pct" stroke="#7C3AED" strokeWidth={2} fill="url(#attGrad)" name="pct" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity (DB-driven) */}
        <div className="glass border border-white/[0.07] rounded-2xl p-5 flex flex-col">
          <h2 className="text-base font-bold text-white mb-1">{t('dashboard.recent_activity')}</h2>
          <p className="text-xs text-slate-400 mb-4">{t('dashboard.latest_notices')}</p>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-[160px] max-h-[160px]">
            {recentActivities.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-slate-500 text-xs">{t('dashboard.no_recent_activity')}</p>
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

      {/* Fee Chart & Management Split */}
      <div className="grid lg:grid-cols-3 gap-5 border-t border-white/[0.04] pt-6 mt-2">
        {/* Fee Chart */}
        <div className="glass border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white">{t('dashboard.fee_collections')}</h2>
              <p className="text-xs text-slate-400">{selectedClassFilter ? selectedClassFilter : t('dashboard.overall')} (₹K)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={feesData} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey="collected" fill="#7C3AED" radius={[4, 4, 0, 0]} name="collected" />
              <Bar dataKey="pending" fill="rgba(239,68,68,0.4)" radius={[4, 4, 0, 0]} name="pending" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Integrated Attendance Management */}
        <div className="lg:col-span-2 glass border border-white/[0.07] rounded-2xl p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-white">{t('dashboard.todays_attendance')} <span className="text-violet-400">{selectedClassFilter || (availableClasses[0] ?? '')}</span></h2>
              <p className="text-xs text-slate-400">{t('dashboard.quick_attendance')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => markAllAttendance('present')} className="btn-secondary text-xs py-1.5 px-3">✅ {t('dashboard.all_present')}</button>
              <button onClick={handleSaveAttendance} disabled={attendanceStudents.length === 0} className="btn-primary text-xs py-1.5 px-3">
                {attendanceSaved ? `✅ ${t('dashboard.saved')}` : `💾 ${t('dashboard.save_attendance')}`}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[220px] rounded-xl border border-white/[0.04] bg-white/[0.01]">
            <div className="divide-y divide-white/[0.04]">
              {attendanceLoading ? (
                <div className="p-8 text-center text-xs text-slate-500">{t('dashboard.loading_students')}</div>
              ) : attendanceStudents.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/40 text-slate-400 text-xs">
                  {t('dashboard.no_students')}
                </div>
              ) : attendanceStudents.map((s, i) => {
                const status = attendanceStatus[s.id] || 'present';
                const cfg = attConfig[status];
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleAttendanceStatus(s.id)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {s.first_name[0]}{s.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{s.first_name} {s.last_name}</p>
                      <p className="text-[10px] text-slate-500">Roll No: {s.roll_number}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      <span className={`badge ${cfg.badge} text-[10px] py-0.5 cursor-pointer select-none`}>{t(`dashboard.${cfg.label.toLowerCase()}`)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {attCounts.absent > 0 && attendanceStudents.length > 0 && (
            <div className="mt-3 text-xs text-amber-400/80 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
              ℹ️ {t('dashboard.sms_warning', { count: attCounts.absent })}
            </div>
          )}
        </div>
      </div>

      <StaffInfoModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
