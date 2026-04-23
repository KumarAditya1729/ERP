'use client';
import { useState, useEffect, useCallback } from 'react';
import { getTeacherExams, submitExamGrades } from '@/app/actions/academics';
import { getTeacherStudents } from '@/app/actions/students';

const statusCfg: Record<string, { badge: string; label: string; icon: string }> = {
  upcoming: { badge: 'badge-blue', label: 'Upcoming', icon: '📅' },
  ongoing:  { badge: 'badge-yellow', label: 'Ongoing', icon: '⏳' },
  completed:{ badge: 'badge-green', label: 'Completed', icon: '✅' },
};

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Grade entry state
  const [gradingExamId, setGradingExamId] = useState<string | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const result = await getTeacherExams();
    if (result.success && result.data) {
      setExams(result.data);
    } else {
      setExams([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const startGrading = async (exam: any) => {
    setGradingExamId(exam.id);
    setGrades({});
    // Load students for the class assigned to this exam
    const res = await getTeacherStudents('all');
    if (res.success && res.data) {
      // Filter by exam class if specified
      const filtered = exam.classes && exam.classes !== 'All Classes'
        ? res.data.filter((s: any) =>
            s.class_grade === exam.classes ||
            s.class_grade === exam.classes?.replace('Class ', 'Grade ') ||
            s.class_grade === exam.classes?.replace('Grade ', 'Class ')
          )
        : res.data;
      setStudents(filtered);
    }
  };

  const handleSubmitGrades = async (exam: any) => {
    const gradeEntries = Object.entries(grades)
      .filter(([, score]) => score.trim() !== '')
      .map(([student_id, score]) => ({
        exam_id: exam.id,
        student_id,
        score,
        subject: exam.name,
        class_name: exam.classes,
        max_marks: exam.subject_count ? exam.subject_count * 20 : 100,
        tenant_id: '', // server action will inject this
      }));

    if (gradeEntries.length === 0) {
      showToast('Enter at least one grade before submitting.', 'error');
      return;
    }

    setSubmitting(true);
    const res = await submitExamGrades(gradeEntries);
    if (res.success) {
      showToast(`✅ ${gradeEntries.length} grades submitted successfully!`);
      setGradingExamId(null);
      setGrades({});
      setStudents([]);
    } else {
      showToast('Failed: ' + res.error, 'error');
    }
    setSubmitting(false);
  };

  const completedCount = exams.filter(e => e.status === 'completed').length;
  const upcomingCount = exams.filter(e => e.status === 'upcoming').length;
  const ongoingCount = exams.filter(e => e.status === 'ongoing').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border ${toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 'bg-red-950/90 text-red-400 border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Grading & Exams</h1>
          <p className="text-slate-400 text-sm">View exam schedule and submit results for your classes</p>
        </div>
        <button onClick={fetchExams} className="glass border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors">
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      {!loading && exams.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Upcoming', value: upcomingCount, color: 'text-blue-400' },
            { label: 'Ongoing', value: ongoingCount, color: 'text-amber-400' },
            { label: 'Completed', value: completedCount, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Exam List */}
      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading exams…</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-white font-semibold">No exams scheduled yet</p>
          <p className="text-slate-400 text-sm mt-1">Admins schedule exams from the Examinations module.</p>
          <p className="text-xs text-slate-500 mt-3">Once added, exams will appear here for grade entry.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map(exam => {
            const cfg = statusCfg[exam.status] || statusCfg.upcoming;
            const isGrading = gradingExamId === exam.id;
            const isExpanded = expandedExamId === exam.id;

            return (
              <div key={exam.id} className={`glass border rounded-2xl overflow-hidden transition-all ${isGrading ? 'border-violet-500/40' : 'border-white/[0.08] hover:border-violet-500/20'}`}>
                {/* Exam Header */}
                <div
                  className="flex items-start justify-between gap-4 p-5 cursor-pointer"
                  onClick={() => !isGrading && setExpandedExamId(isExpanded ? null : exam.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xl shrink-0">
                      {cfg.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{exam.name}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{exam.classes}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(exam.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(exam.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {exam.subject_count && ` · ${exam.subject_count} subjects`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                    {(exam.status === 'ongoing' || exam.status === 'completed') && !isGrading && (
                      <button
                        onClick={e => { e.stopPropagation(); startGrading(exam); }}
                        className="text-xs font-semibold text-violet-400 hover:text-white bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 px-3 py-1.5 rounded-lg transition-all"
                      >
                        ✏️ Enter Grades
                      </button>
                    )}
                  </div>
                </div>

                {/* Grade Entry Panel */}
                {isGrading && (
                  <div className="border-t border-white/[0.06] bg-black/20 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-white">📝 Enter Marks — {exam.name}</h3>
                      <button
                        onClick={() => { setGradingExamId(null); setGrades({}); setStudents([]); }}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        ✕ Cancel
                      </button>
                    </div>

                    {students.length === 0 ? (
                      <p className="text-slate-400 text-sm text-center py-4">No students found for this class.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto mb-4">
                          {students.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.05]">
                              <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-300 text-xs font-bold shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{s.first_name} {s.last_name}</p>
                                <p className="text-[10px] text-slate-500">{s.class_grade}{s.roll_number ? ` · Roll ${s.roll_number}` : ''}</p>
                              </div>
                              <input
                                type="text"
                                className="w-20 bg-slate-800/80 border border-white/10 focus:border-violet-500 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-center"
                                placeholder={`/100`}
                                value={grades[s.id] || ''}
                                onChange={e => setGrades(prev => ({ ...prev, [s.id]: e.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleSubmitGrades(exam)}
                            disabled={submitting}
                            className="btn-primary text-sm py-2 px-6 disabled:opacity-50 flex items-center gap-2"
                          >
                            {submitting ? (
                              <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Submitting…</>
                            ) : `Submit ${Object.values(grades).filter(v => v).length} Grades`}
                          </button>
                          <button
                            onClick={() => {
                              const filled: Record<string, string> = {};
                              students.forEach(s => { filled[s.id] = '—'; });
                              setGrades(filled);
                            }}
                            className="btn-secondary text-sm py-2 px-4"
                          >
                            Mark All Absent
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
