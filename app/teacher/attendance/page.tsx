'use client';
import { useState, useEffect, useCallback } from 'react';
import { saveAttendance } from '@/app/actions/attendance';
import { getTeacherStudents } from '@/app/actions/students';

const CLASSES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

export default function TeacherAttendancePage() {
  const [selectedClass, setSelectedClass] = useState('Grade 1');
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const today = new Date().toISOString().split('T')[0];

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const result = await getTeacherStudents(selectedClass);
    if (result.success && result.data) {
      setStudents(result.data);
      const init: Record<string, string> = {};
      result.data.forEach((s: any) => { init[s.id] = 'present'; });
      setAttendance(init);
    } else {
      setStudents([]);
    }
    setLoading(false);
  }, [selectedClass]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const toggle = (id: string) => {
    setAttendance(prev => ({
      ...prev,
      [id]: prev[id] === 'present' ? 'absent' : 'present'
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const records = Object.entries(attendance).map(([student_id, status]) => ({ student_id, status }));
    const result = await saveAttendance(today, records);
    if (result.success) {
      showToast(`✅ Attendance saved! ${result.absentCount} absent.`);
    } else {
      showToast('❌ Failed: ' + result.error, false);
    }
    setSaving(false);
  };

  const presentCount = Object.values(attendance).filter(v => v === 'present').length;
  const absentCount = Object.values(attendance).filter(v => v === 'absent').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mark Attendance</h1>
          <p className="text-slate-400 text-sm">{today} — Select class and mark each student</p>
        </div>
        <select
          className="erp-input w-auto text-sm"
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: students.length, color: 'text-white' },
          { label: 'Present', value: presentCount, color: 'text-emerald-400' },
          { label: 'Absent', value: absentCount, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Student list */}
      <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading students...</div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No students in {selectedClass} yet. Add students from Admin → Students.</div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {students.map((s, i) => {
              const isPresent = attendance[s.id] === 'present';
              return (
                <div key={s.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-sm font-bold">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{s.first_name} {s.last_name}</p>
                      {s.roll_number && <p className="text-xs text-slate-500">Roll #{s.roll_number}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(s.id)}
                    className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                      isPresent
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    }`}
                  >
                    {isPresent ? '✓ Present' : '✗ Absent'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {students.length > 0 && (
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full justify-center py-3">
          {saving ? 'Saving...' : `Save Attendance (${presentCount} Present, ${absentCount} Absent)`}
        </button>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl ${toast.ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
