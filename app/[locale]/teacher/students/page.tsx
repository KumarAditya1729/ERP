'use client';
import { useState, useEffect, useCallback } from 'react';
import { getTeacherStudents } from '@/app/actions/students';

const CLASSES = [
  'all',
  'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12',
  // Also support Grade X format from DB
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
  'Grade 11', 'Grade 12',
];

const DISPLAY_CLASSES = [
  'all', 'Nursery', 'LKG', 'UKG',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12',
];

const avatarColors = [
  'from-violet-600 to-purple-700',
  'from-cyan-600 to-teal-700',
  'from-emerald-600 to-green-700',
  'from-amber-600 to-orange-700',
  'from-pink-600 to-rose-700',
  'from-blue-600 to-indigo-700',
];

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    // Pass 'all' to get all students, then filter on client side to support
    // both 'Class X' and 'Grade X' formats that may exist in DB
    const result = await getTeacherStudents('all');
    if (result.success && result.data) {
      setStudents(result.data);
    } else {
      setStudents([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchSearch = fullName.includes(q) ||
      s.guardian_name?.toLowerCase().includes(q) ||
      s.roll_number?.includes(q);

    // Match both 'Class 6' and 'Grade 6' stored formats
    const matchClass = selectedClass === 'all' ||
      s.class_grade === selectedClass ||
      s.class_grade === selectedClass.replace('Class ', 'Grade ') ||
      s.class_grade === selectedClass.replace('Grade ', 'Class ');

    return matchSearch && matchClass;
  });

  const stats = {
    total: filtered.length,
    active: filtered.filter(s => s.status === 'active').length,
    classes: Array.from(new Set(filtered.map(s => s.class_grade))).length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Student Profiles</h1>
          <p className="text-slate-400 text-sm">Browse and view your assigned student roster</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
            className="glass border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {viewMode === 'grid' ? '☰ Table' : '⊞ Grid'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Students', value: loading ? '…' : stats.total, color: 'text-white' },
          { label: 'Active', value: loading ? '…' : stats.active, color: 'text-emerald-400' },
          { label: 'Classes', value: loading ? '…' : stats.classes, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="erp-input pl-9 text-sm w-full"
            placeholder="Search by name, roll no, guardian…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="erp-input text-sm w-40"
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          {DISPLAY_CLASSES.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All Classes' : c}</option>
          ))}
        </select>
        <button onClick={fetchStudents} className="glass border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors">
          🔄 Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading student roster…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🎓</p>
          <p className="text-white font-semibold">No students found</p>
          <p className="text-slate-400 text-sm mt-1">
            {students.length === 0
              ? 'No students in the database yet. Ask an Admin to add students.'
              : 'Try a different class or search term.'}
          </p>
          {students.length === 0 && (
            <p className="text-xs text-slate-500 mt-3">
              Total in DB: {students.length} · Go to Admin → Students → + New Student
            </p>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((s, i) => (
            <div
              key={s.id}
              className={`glass border rounded-2xl p-5 transition-all cursor-pointer ${expandedId === s.id ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/[0.08] hover:border-violet-500/20'}`}
              onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-slate-400">{s.class_grade}{s.section ? ` · Section ${s.section}` : ''}</p>
                </div>
                <span className={`badge shrink-0 ${s.status === 'active' ? 'badge-green' : 'badge-purple'}`}>
                  {s.status || 'active'}
                </span>
              </div>

              <div className="space-y-1 text-xs text-slate-400">
                {s.roll_number && <p>📋 Roll #{s.roll_number}</p>}
                {s.guardian_name && <p>👨‍👩‍👧 {s.guardian_name}</p>}
                {expandedId === s.id && (
                  <>
                    {s.guardian_phone && <p className="text-slate-300">📞 {s.guardian_phone}</p>}
                    {s.created_at && <p>📅 Enrolled: {new Date(s.created_at).toLocaleDateString('en-IN')}</p>}
                    <div className="mt-3 flex gap-2">
                      <a
                        href={`tel:${s.guardian_phone}`}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 text-center text-xs text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg py-1.5 transition-all"
                      >
                        📞 Call Parent
                      </a>
                      <button
                        onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(s.id); }}
                        className="flex-1 text-center text-xs text-violet-400 hover:text-white bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-lg py-1.5 transition-all"
                      >
                        📋 Copy ID
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Table View
        <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Roll No</th>
                  <th>Guardian</th>
                  <th>Phone</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td className="text-slate-500 text-xs">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                          {s.first_name?.[0]}{s.last_name?.[0]}
                        </div>
                        <span className="text-sm font-semibold text-white">{s.first_name} {s.last_name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-purple text-[10px]">{s.class_grade}{s.section ? `-${s.section}` : ''}</span></td>
                    <td className="text-slate-400 text-xs">{s.roll_number || '—'}</td>
                    <td className="text-slate-300 text-sm">{s.guardian_name || '—'}</td>
                    <td>
                      {s.guardian_phone ? (
                        <a href={`tel:${s.guardian_phone}`} className="text-emerald-400 hover:text-emerald-300 text-xs">
                          {s.guardian_phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td><span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-red'}`}>{s.status || 'active'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Count indicator */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-500 text-center">
          Showing {filtered.length} of {students.length} students
        </p>
      )}
    </div>
  );
}
