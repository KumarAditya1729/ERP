'use client';
import { useState, useEffect } from 'react';
import { getStudent360 } from '@/app/actions/modules';

export default function Student360Page({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudent360(params.id).then(res => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <div className="p-12 text-center animate-pulse text-violet-400">Loading Student Profile...</div>;
  if (!data || !data.student) return <div className="p-12 text-center text-slate-400">Student not found.</div>;

  const { student, attendance, exams, fees, homework, library, transport } = data;
  const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Card */}
      <div className="glass border border-white/[0.08] rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
            <span className="text-3xl font-black text-white">{student.first_name?.[0]}{student.last_name?.[0]}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">{student.first_name} {student.last_name}</h1>
            <p className="text-slate-400 mt-1">Class {student.class_name} &nbsp;·&nbsp; Roll #{student.roll_number} &nbsp;·&nbsp; {student.email}</p>
          </div>
          <div className={`px-4 py-2 rounded-xl border text-sm font-bold ${student.status === 'active' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
            {(student.status || 'active').toUpperCase()}
          </div>
        </div>
        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 relative z-10">
          {[
            { label: 'Attendance', value: `${attendance.pct}%`, color: 'text-emerald-400' },
            { label: 'Avg Score', value: `${exams.avgScore}%`, color: 'text-violet-400' },
            { label: 'Pending Fees', value: fmt.format(fees.pendingFees), color: fees.pendingFees > 0 ? 'text-red-400' : 'text-emerald-400' },
            { label: 'Books Issued', value: String(library.filter((l: any) => l.status === 'issued').length), color: 'text-cyan-400' },
          ].map(s => (
            <div key={s.label} className="glass border border-white/5 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Attendance */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">📅 Last 30 Days Attendance</h2>
          <div className="flex flex-wrap gap-1.5">
            {attendance.records.map((a: any, i: number) => (
              <div key={i} title={`${a.date}: ${a.status}`} className={`w-5 h-5 rounded-sm ${a.status === 'present' ? 'bg-emerald-500' : a.status === 'late' ? 'bg-amber-500' : 'bg-red-500/60'}`} />
            ))}
            {attendance.records.length === 0 && <p className="text-xs text-slate-500 italic">No attendance records yet.</p>}
          </div>
          <div className="flex gap-4 mt-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Present</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500/60 inline-block" /> Absent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> Late</span>
          </div>
        </div>

        {/* Exam Results */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">📊 Exam Results</h2>
          <div className="space-y-3">
            {exams.records.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No exam records yet.</p>
            ) : exams.records.map((e: any, i: number) => {
              const pct = Math.round((Number(e.marks_obtained) / Number(e.max_marks)) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{e.subject}</span>
                    <span className={`font-bold ${pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{e.marks_obtained}/{e.max_marks}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fees */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">💰 Fee History</h2>
          <div className="space-y-2">
            {fees.invoices.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No fee records yet.</p>
            ) : fees.invoices.slice(0, 6).map((f: any) => (
              <div key={f.month_label} className="flex justify-between items-center p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-xs text-slate-300">{f.month_label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white font-semibold">{fmt.format(f.total_amount)}</span>
                  <span className={`badge text-[9px] ${f.status === 'paid' ? 'badge-green' : f.status === 'partial' ? 'badge-yellow' : 'badge-red'}`}>{f.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Homework */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">📝 Recent Homework</h2>
          <div className="space-y-2">
            {homework.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No submissions yet.</p>
            ) : homework.map((h: any) => (
              <div key={h.assignment_id} className="flex justify-between items-center p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-xs text-slate-400">{new Date(h.updated_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  {h.score && <span className="text-xs font-bold text-white">{h.score}</span>}
                  <span className={`badge text-[9px] ${h.status === 'graded' ? 'badge-green' : h.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{h.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Library */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">📚 Library</h2>
          <div className="space-y-2">
            {library.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No books issued.</p>
            ) : library.map((l: any) => (
              <div key={l.id} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                <p className="text-xs text-slate-200 font-medium">{l.library_books?.title}</p>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-500">Due: {l.due_date}</span>
                  <span className={`badge text-[9px] ${l.status === 'issued' ? 'badge-blue' : l.status === 'overdue' ? 'badge-red' : 'badge-green'}`}>{l.status}</span>
                </div>
                {Number(l.fine_amount) > 0 && <p className="text-[10px] text-red-400 mt-0.5">Fine: {fmt.format(l.fine_amount)}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Transport */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4">🚌 Transport</h2>
          {transport ? (
            <div className="space-y-3">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <p className="text-xs text-slate-400 mb-0.5">Route</p>
                <p className="text-sm text-white font-semibold">{transport.transport_routes?.name || 'N/A'}</p>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <p className="text-xs text-slate-400 mb-0.5">Bus Number</p>
                <p className="text-sm text-white font-semibold">{transport.transport_routes?.bus_number || 'N/A'}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No transport assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}
