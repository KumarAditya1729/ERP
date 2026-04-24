'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { saveAttendance } from '@/app/actions/attendance';

type Status = 'present' | 'absent' | 'late';

const avatarColors = ['from-violet-600 to-purple-700', 'from-cyan-600 to-teal-700', 'from-emerald-600 to-green-700', 'from-amber-600 to-orange-700', 'from-pink-600 to-rose-700'];

export default function AttendancePage() {
  const [classes, setClasses] = useState<string[]>(['10-A']);
  const [selectedClass, setSelectedClass] = useState('10-A');
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const supabase = createClient();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchStudents();
  }, [selectedClass, fetchStudents]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    // Fetch unique classes for dropdown
    const { data: allStudents } = await supabase.from('students').select('class_grade, section, status').eq('status', 'active');
    if (allStudents) {
      const clsList = Array.from(new Set(allStudents.map(s => `${s.class_grade}-${s.section}`))).sort();
      if (clsList.length > 0) {
        setClasses(clsList);
        if (!clsList.includes(selectedClass)) setSelectedClass(clsList[0]);
      }
    }

    // Fetch students for selected class
    const [grade, sec] = selectedClass.split('-');
    const { data } = await supabase.from('students')
        .select('*')
        .eq('class_grade', grade || '')
        .eq('section', sec || '')
        .eq('status', 'active')
        .order('roll_number', { ascending: true });
        
    if (data) {
       setStudents(data);
       setAttendance(Object.fromEntries(data.map((s) => [s.id, 'present' as Status])));
       setSaved(false);
    }
    setLoading(false);
  }, [selectedClass, supabase]);

  const toggleStatus = (id: string) => {
    setAttendance((prev) => {
      const cycle: Status[] = ['present', 'absent', 'late'];
      const next = cycle[(cycle.indexOf(prev[id]) + 1) % cycle.length];
      return { ...prev, [id]: next };
    });
    setSaved(false);
  };

  const markAll = (status: Status) => {
    setAttendance(Object.fromEntries(students.map((s) => [s.id, status])));
    setSaved(false);
  };

  const counts = {
    present: Object.values(attendance).filter((v) => v === 'present').length,
    absent: Object.values(attendance).filter((v) => v === 'absent').length,
    late: Object.values(attendance).filter((v) => v === 'late').length,
  };

  const handleSave = async () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const records = students.map(s => ({
      student_id: s.id,
      status: attendance[s.id]
    }));

    const res = await saveAttendance(dateStr, records);

    if (!res.success) {
      showToast("Error saving attendance: " + res.error, false);
    } else {
      setSaved(true);
      if (counts.absent > 0) {
        showToast(`Attendance saved! Real SMS notifications dispatched via Twilio to ${counts.absent} absent students.`);
      } else {
        showToast('Attendance saved successfully!');
      }
    }
  };

  const statusConfig: Record<Status, { label: string; badge: string; dot: string }> = {
    present: { label: 'Present', badge: 'badge-green', dot: 'bg-emerald-400' },
    absent:  { label: 'Absent',  badge: 'badge-red',   dot: 'bg-red-400' },
    late:    { label: 'Late',    badge: 'badge-yellow', dot: 'bg-amber-400' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-3">
          <button id="attendance-report-btn" className="btn-secondary text-sm py-2 px-4">📊 Monthly Report</button>
          <button
            id="save-attendance-btn"
            onClick={handleSave}
            disabled={students.length === 0}
            className="btn-primary text-sm py-2 px-4"
          >
            {saved ? '✅ Saved to DB' : '💾 Save Attendance'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass border border-emerald-500/25 bg-gradient-to-br from-emerald-600/20 to-emerald-900/5 rounded-2xl p-5 text-center">
          <p className="text-4xl font-extrabold text-emerald-400">{counts.present}</p>
          <p className="text-sm text-slate-400 mt-1 font-medium">Present</p>
        </div>
        <div className="glass border border-red-500/25 bg-gradient-to-br from-red-600/20 to-red-900/5 rounded-2xl p-5 text-center">
          <p className="text-4xl font-extrabold text-red-400">{counts.absent}</p>
          <p className="text-sm text-slate-400 mt-1 font-medium">Absent</p>
        </div>
        <div className="glass border border-amber-500/25 bg-gradient-to-br from-amber-600/20 to-amber-900/5 rounded-2xl p-5 text-center">
          <p className="text-4xl font-extrabold text-amber-400">{counts.late}</p>
          <p className="text-sm text-slate-400 mt-1 font-medium">Late</p>
        </div>
      </div>

      {/* Class selector + quick actions */}
      <div className="glass border border-white/[0.08] rounded-2xl p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Class</label>
          <select
            id="attendance-class-select"
            value={classes.includes(selectedClass) ? selectedClass : (classes[0] || '')}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="erp-input text-sm w-28"
            style={{ appearance: 'none' }}
          >
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <button id="mark-all-present" onClick={() => markAll('present')} className="btn-secondary text-xs py-1.5 px-3">✅ All Present</button>
          <button id="mark-all-absent" onClick={() => markAll('absent')} className="text-xs text-red-400 hover:text-red-300 glass border border-red-500/20 rounded-xl px-3 py-1.5 font-semibold transition-colors">❌ All Absent</button>
        </div>
      </div>

      {/* Student attendance list */}
      <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Class {selectedClass} — {students.length} Students</span>
          <span className="text-xs text-slate-400">Click row to cycle status: Present → Absent → Late</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {loading ? (
             <div className="p-8 text-center text-slate-500">Loading student roster...</div>
          ) : students.length === 0 ? (
             <div className="p-8 text-center bg-slate-900/40 text-slate-400 text-sm">
                No students found in Class {selectedClass}. Go to Students tab to add some.
             </div>
          ) : students.map((s, i) => {
            const status = attendance[s.id] || 'present';
            const cfg = statusConfig[status];
            return (
              <div
                key={s.id}
                id={`attendance-row-${s.id}`}
                onClick={() => toggleStatus(s.id)}
                className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.025] transition-colors"
              >
                <span className="text-xs text-slate-500 w-6 text-right">{i + 1}</span>
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {s.first_name[0]}{s.last_name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-slate-500">Roll No: {s.roll_number}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`badge ${cfg.badge} text-xs cursor-pointer select-none`}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info box */}
      {counts.absent > 0 && (
        <div className="glass border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-lg shrink-0">📱</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">Auto SMS will be sent</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Parents of {counts.absent} absent student{counts.absent > 1 ? 's' : ''} will receive an SMS notification automatically when you save.
            </p>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
