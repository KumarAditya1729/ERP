'use client';
import { useState, useEffect, useCallback } from 'react';
import { getTeacherExams } from '@/app/actions/academics';

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Grading & Exams</h1>
        <p className="text-slate-400 text-sm">View exam schedule and submit results for your classes</p>
      </div>

      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center text-slate-400">Loading exams...</div>
      ) : exams.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-white font-semibold">No exams scheduled</p>
          <p className="text-slate-400 text-sm mt-1">Admins schedule exams from the Examinations module.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {exams.map(exam => (
            <div key={exam.id} className="glass border border-white/[0.08] rounded-2xl p-5 hover:border-violet-500/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{exam.subject || exam.title || 'Exam'}</p>
                  <p className="text-sm text-slate-400 mt-1">{exam.class_name || exam.class_grade} · {exam.exam_date || exam.date}</p>
                  {exam.max_marks && <p className="text-xs text-slate-500 mt-1">Max Marks: {exam.max_marks}</p>}
                </div>
                <span className={`badge shrink-0 ${exam.status === 'completed' ? 'badge-green' : exam.status === 'upcoming' ? 'badge-blue' : 'badge-purple'}`}>
                  {exam.status || 'scheduled'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
