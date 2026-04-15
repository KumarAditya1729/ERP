'use client';
import { useState, useEffect, useCallback } from 'react';
import { getTeacherStudents } from '@/app/actions/students';

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const result = await getTeacherStudents(selectedClass);
    if (result.success && result.data) {
      setStudents(result.data);
    } else {
      setStudents([]);
    }
    setLoading(false);
  }, [selectedClass]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = students.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    s.guardian_name?.toLowerCase().includes(search.toLowerCase())
  );

  const classes = ['all', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Student Profiles</h1>
          <p className="text-slate-400 text-sm">Browse your assigned student roster</p>
        </div>
        <div className="flex gap-2">
          <input className="erp-input text-sm w-48" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="erp-input text-sm w-36" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            {classes.map(c => <option key={c} value={c}>{c === 'all' ? 'All Classes' : c}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🎓</p>
          <p className="text-white font-semibold">No students found</p>
          <p className="text-slate-400 text-sm mt-1">Try a different class or search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => (
            <div key={s.id} className="glass border border-white/[0.08] rounded-2xl p-5 hover:border-violet-500/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold">
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-slate-400">{s.class_grade} {s.section ? `· ${s.section}` : ''}</p>
                </div>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                {s.guardian_name && <p>👨‍👩‍👧 {s.guardian_name}</p>}
                {s.guardian_phone && <p>📞 {s.guardian_phone}</p>}
                {s.roll_number && <p>📋 Roll #{s.roll_number}</p>}
              </div>
              <div className="mt-3">
                <span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-purple'}`}>{s.status || 'active'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
