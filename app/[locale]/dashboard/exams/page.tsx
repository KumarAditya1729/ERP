'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { submitExamGrades } from '@/app/actions/academics';
import BulkUploader from '@/components/BulkUploader';
import { generateReportCardPDF } from '@/lib/pdfGenerator';
import ScheduleExamModal from '@/components/dashboard/ScheduleExamModal';

const supabase = createClient();

const gradeFor = (pct: number) => {
  if (pct === 0) return { label: '-', badge: 'glass border border-white/10' };
  if (pct >= 90) return { label: 'A+', badge: 'badge-green' };
  if (pct >= 75) return { label: 'A',  badge: 'badge-blue' };
  if (pct >= 60) return { label: 'B',  badge: 'badge-purple' };
  return { label: 'C', badge: 'badge-yellow' };
};

interface Exam {
  id: string;
  name: string;
  classes: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  subject_count?: number;
}

interface StudentMark {
  student_id: string;
  name: string;
  class: string;
  math: number;
  science: number;
  english: number;
  hindi: number;
  social: number;
  total: number;
  pct: number;
}

export default function ExamsPage() {
  const [tab, setTab] = useState<'schedule' | 'marksheet'>('schedule');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string | null>(null);
  const [marksData, setMarksData] = useState<StudentMark[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch real exam schedule from DB
  const fetchExams = useCallback(async () => {
    setLoadingExams(true);
    const { data, error } = await supabase
      .from('exams')
      .select('id, name, classes, start_date, end_date, status, subject_count')
      .order('start_date', { ascending: false });

    if (!error && data && data.length > 0) {
      setExams(data as Exam[]);
      setSelectedExam(data[0].id);
    } else {
      setExams([]);
    }
    setLoadingExams(false);
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  // Fetch real marksheet when selected exam changes
  const fetchMarks = useCallback(async (examId: string) => {
    setLoadingMarks(true);
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, class_name')
      .eq('status', 'active');

    if (!students || students.length === 0) {
      setMarksData([]);
      setLoadingMarks(false);
      return;
    }

    const { data: scores } = await supabase
      .from('exams_data')
      .select('*')
      .eq('exam_id', examId);

    const merged: StudentMark[] = students.map((s) => {
      const myScores = (scores || []).filter((x) => x.student_id === s.id);
      const get = (subj: string) => myScores.find((x) => x.subject === subj)?.marks_obtained ?? 0;
      const math = get('Math'), science = get('Science'), english = get('English'), hindi = get('Hindi'), social = get('Social');
      const total = math + science + english + hindi + social;
      const pct = myScores.length > 0 ? parseFloat(((total / (myScores.length * 100)) * 100).toFixed(1)) : 0;
      return {
        student_id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        class: s.class_name,
        math, science, english, hindi, social, total, pct,
      };
    });

    setMarksData(merged);
    setLoadingMarks(false);
  }, []);

  useEffect(() => {
    if (selectedExam) fetchMarks(selectedExam);
  }, [selectedExam, fetchMarks]);

  // Inline editable marks — save to DB
  const handleMarkChange = (idx: number, subject: keyof StudentMark, val: number) => {
    setMarksData((prev) => {
      const updated = [...prev];
      const row = { ...updated[idx], [subject]: val };
      const total = row.math + row.science + row.english + row.hindi + row.social;
      const filled = [row.math, row.science, row.english, row.hindi, row.social].filter((v) => v > 0).length;
      row.total = total;
      row.pct = filled > 0 ? parseFloat(((total / (filled * 100)) * 100).toFixed(1)) : 0;
      updated[idx] = row;
      return updated;
    });
  };

  const handleSaveMarks = async () => {
    if (!selectedExam) return;
    setSaving(true);
    const toInsert = marksData.flatMap((s) => {
      return ['Math', 'Science', 'English', 'Hindi', 'Social'].map((subj) => ({
        student_id: s.student_id,
        exam_id: selectedExam,
        subject: subj,
        marks_obtained: s[subj.toLowerCase() as keyof StudentMark] as number,
        max_marks: 100,
      }));
    });
    const res = await submitExamGrades(toInsert);
    if (res.success) {
      showToast('✅ Grades saved to database successfully.');
    } else {
      showToast('Failed to save grades: ' + (res as any).error, false);
    }
    setSaving(false);
  };

  const selectedExamObj = exams.find((e) => e.id === selectedExam);

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Examinations</h1>
          <p className="text-slate-400 text-sm mt-0.5">Exam scheduling, mark entry, grades and report card generation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-secondary text-sm py-2 px-4"
          >
            📅 Schedule Exam
          </button>
          <button
            onClick={() => showToast('Select an exam and switch to Mark Sheet Evaluator to print individual report cards.', false)}
            className="btn-primary text-sm py-2 px-4"
          >
            📄 Generate Report Cards
          </button>
        </div>
      </div>

      {/* Stats — derived from live DB data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Exams in DB', value: exams.length.toString(), icon: '📝' },
          { label: 'Upcoming', value: exams.filter((e) => e.status === 'upcoming').length.toString(), icon: '📅' },
          { label: 'Completed', value: exams.filter((e) => e.status === 'completed').length.toString(), icon: '✅' },
          { label: 'Students Tracked', value: marksData.length.toString(), icon: '👨‍🎓' },
        ].map((s) => (
          <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 card-hover">
            <span className="text-2xl">{s.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden relative">
        <div className="flex border-b border-white/[0.08] relative z-10">
          {(['schedule', 'marksheet'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold capitalize transition-colors ${tab === t ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}
            >
              {t === 'schedule' ? '📅 Exam Schedule' : '📊 Mark Sheet Evaluator'}
            </button>
          ))}
        </div>

        {tab === 'schedule' && (
          <div className="p-5 space-y-4">
            {loadingExams ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading exam schedule...</p>
              </div>
            ) : exams.length === 0 ? (
              <div className="relative glass border border-white/[0.08] rounded-3xl p-16 text-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none -z-10"></div>
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center text-5xl mb-6 shadow-[0_0_40px_rgba(139,92,246,0.15)] border border-violet-500/20 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                    📝
                  </div>
                  <h2 className="text-white font-extrabold text-2xl tracking-tight mb-2 drop-shadow-sm">No Exams Scheduled</h2>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
                    Your assessment calendar is currently empty. Start by scheduling a new examination period and defining the subjects.
                  </p>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] flex items-center gap-2"
                  >
                    📅 Schedule First Exam
                  </button>
                </div>
              </div>
            ) : (
              exams.map((e) => (
                <div
                  key={e.id}
                  className={`glass border rounded-2xl p-5 card-hover cursor-pointer ${selectedExam === e.id ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/[0.07]'}`}
                  onClick={() => setSelectedExam(e.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-white">{e.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">📚 {e.classes} · {e.subject_count ?? '—'} subjects</p>
                      <p className="text-xs text-slate-500 mt-0.5">🗓️ {e.start_date} → {e.end_date}</p>
                    </div>
                    <span className={`badge ${e.status === 'upcoming' ? 'badge-yellow' : e.status === 'ongoing' ? 'badge-blue' : 'badge-green'} shrink-0`}>
                      {e.status === 'upcoming' ? '⏳ Upcoming' : e.status === 'ongoing' ? '🔴 Ongoing' : '✓ Completed'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'marksheet' && (
          <>
            <div className="px-5 py-3 border-b border-white/[0.06] flex gap-4 items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">
                  Showing: <span className="text-white font-semibold">{selectedExamObj?.name ?? 'No exam selected'}</span>
                </span>
              </div>
              <button
                onClick={handleSaveMarks}
                disabled={saving || marksData.length === 0}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:scale-105 transition-transform text-white text-xs font-bold py-1.5 px-4 rounded-lg shadow-lg shadow-violet-500/20 border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {saving ? 'Saving...' : '💾 Save All Grades'}
              </button>
            </div>

            {loadingMarks ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading student score data...</p>
              </div>
            ) : marksData.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-white font-semibold">No Students Found</p>
                <p className="text-slate-400 text-sm mt-1">Add active students to your database to begin entering exam grades.</p>
              </div>
            ) : (
              <div className="overflow-x-auto relative">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Math /100</th>
                      <th>Science /100</th>
                      <th>English /100</th>
                      <th>Hindi /100</th>
                      <th>Social /100</th>
                      <th>Total /500</th>
                      <th>%</th>
                      <th>Grade</th>
                      <th>PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marksData.map((s, i) => {
                      const g = gradeFor(s.pct);
                      return (
                        <tr key={s.student_id} className={s.pct > 0 ? 'bg-emerald-500/[0.02]' : ''}>
                          <td className="font-semibold text-white">{s.name}</td>
                          <td><span className="badge badge-purple text-[10px]">{s.class}</span></td>
                          {(['math', 'science', 'english', 'hindi', 'social'] as const).map((subj) => (
                            <td key={subj}>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={s[subj] || ''}
                                onChange={(e) => handleMarkChange(i, subj, parseInt(e.target.value) || 0)}
                                className="w-16 bg-transparent border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-violet-500 transition-colors"
                              />
                            </td>
                          ))}
                          <td className="font-bold text-emerald-400">{s.total || '-'}</td>
                          <td className="font-semibold text-violet-300">{s.pct > 0 ? `${s.pct}%` : '-'}</td>
                          <td><span className={`badge ${g.badge}`}>{g.label}</span></td>
                          <td>
                            <button
                              onClick={() => {
                                const marksArray = [
                                  { subject: 'Math', max_marks: 100, marks_obtained: s.math || 0 },
                                  { subject: 'Science', max_marks: 100, marks_obtained: s.science || 0 },
                                  { subject: 'English', max_marks: 100, marks_obtained: s.english || 0 },
                                  { subject: 'Hindi', max_marks: 100, marks_obtained: s.hindi || 0 },
                                  { subject: 'Social Studies', max_marks: 100, marks_obtained: s.social || 0 }
                                ];
                                generateReportCardPDF(
                                  { first_name: s.name.split(' ')[0] || '', last_name: s.name.split(' ').slice(1).join(' '), class_grade: s.class.split('-')[0], section: s.class.split('-')[1] || 'A', id: s.student_id, roll_number: '' },
                                  selectedExamObj?.name || 'Exam',
                                  marksArray,
                                  'NexSchool ERP'
                                );
                              }}
                              className="text-xs text-slate-400 hover:text-white font-semibold"
                            >
                              ⬇️ Print
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <ScheduleExamModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onRefresh={fetchExams}
      />
    </div>
  );
}
