'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { submitExamGrades } from '@/app/actions/academics';

const supabase = createClient();

const exams = [
  { id: 'E1', name: 'Unit Test 1 – April', classes: 'All Classes', startDate: '2026-04-14', endDate: '2026-04-18', status: 'upcoming', subjects: 5 },
  { id: 'E2', name: 'Mid-Term Examination', classes: 'Class 9–12', startDate: '2026-03-10', endDate: '2026-03-17', status: 'completed', subjects: 6 },
  { id: 'E3', name: 'Pre-Board – Science Stream', classes: 'Class 12 Sci', startDate: '2026-02-20', endDate: '2026-02-28', status: 'completed', subjects: 5 },
];

// Used as fallback UI structure if DB is empty
const initialMarksPattern = [
  { student_id: 'mock1', name: 'Aryan Sharma',   class: '10-A', math: 0, science: 0, english: 0, hindi: 0, social: 0, total: 0, pct: 0 },
  { student_id: 'mock2', name: 'Priya Mehta',    class: '10-A', math: 0, science: 0, english: 0, hindi: 0, social: 0, total: 0, pct: 0 },
  { student_id: 'mock3', name: 'Rahul Verma',    class: '10-A', math: 0, science: 0, english: 0, hindi: 0, social: 0, total: 0, pct: 0 },
];

const gradeFor = (pct: number) => {
  if (pct === 0) return { label: '-', badge: 'glass border border-white/10' };
  if (pct >= 90) return { label: 'A+', badge: 'badge-green' };
  if (pct >= 75) return { label: 'A',  badge: 'badge-blue' };
  if (pct >= 60) return { label: 'B',  badge: 'badge-purple' };
  return { label: 'C', badge: 'badge-yellow' };
};

export default function ExamsPage() {
  const [tab, setTab] = useState<'schedule' | 'marksheet'>('schedule');
  const [selectedExam, setSelectedExam] = useState('E2');
  const [marksData, setMarksData] = useState<any[]>(initialMarksPattern);
  const [loadingDb, setLoadingDb] = useState(true);
  const [showScheduleMock, setShowScheduleMock] = useState(false);
  const [showPDFMock, setShowPDFMock] = useState(false);
  const [mockProgress, setMockProgress] = useState(0);
  const [mockComplete, setMockComplete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    async function fetchMarks() {
      // 1. Fetch Students in 10-A
      const { data: students } = await supabase.from('students').select('id, first_name, last_name, class_name').eq('class_name', '10-A');
      if (!students || students.length === 0) {
        setLoadingDb(false);
        return;
      }

      // 2. Fetch their exam data for E2
      const { data: scores } = await supabase.from('exams_data').select('*').eq('exam_id', selectedExam);
      
      // Pivot data
      const merged = students.map(s => {
        const myScores = (scores || []).filter(x => x.student_id === s.id);
        const mathRow = myScores.find(x => x.subject === 'Math');
        const sciRow = myScores.find(x => x.subject === 'Science');
        const engRow = myScores.find(x => x.subject === 'English');
        const hinRow = myScores.find(x => x.subject === 'Hindi');
        const socRow = myScores.find(x => x.subject === 'Social');

        const math = mathRow ? mathRow.marks_obtained : 0;
        const science = sciRow ? sciRow.marks_obtained : 0;
        const english = engRow ? engRow.marks_obtained : 0;
        const hindi = hinRow ? hinRow.marks_obtained : 0;
        const social = socRow ? socRow.marks_obtained : 0;
        
        const total = math + science + english + hindi + social;
        const pct = myScores.length > 0 ? (total / (myScores.length * 100)) * 100 : 0;

        return {
          student_id: s.id,
          name: `${s.first_name} ${s.last_name}`,
          class: s.class_name,
          math, science, english, hindi, social, total,
          pct: parseFloat(pct.toFixed(1))
        };
      });

      if (merged.length > 0) setMarksData(merged);
      setLoadingDb(false);
    }
    fetchMarks();
  }, [selectedExam]);

  const handleScheduleExam = () => {
     setShowScheduleMock(true);
     setMockProgress(0);
     setMockComplete(false);
     let p = 0;
     const interval = setInterval(() => {
        p += 20;
        setMockProgress(p);
        if (p >= 100) {
           clearInterval(interval);
           setTimeout(() => setMockComplete(true), 500);
        }
     }, 400);
  };

  const handleGeneratePDF = () => {
     setShowPDFMock(true);
     setMockProgress(0);
     setMockComplete(false);
     let p = 0;
     const interval = setInterval(() => {
        p += 10;
        setMockProgress(p);
        if (p >= 100) {
           clearInterval(interval);
           setTimeout(() => setMockComplete(true), 1000);
        }
     }, 200);
  };

  // AI Grader State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);

  const startVoiceInput = () => {
    setRecording(true);
    setTranscript('');
    
    // Simulate real-time speech to text
    const text = "Rahul Verma Math 72, Science 68, English 74, Hindi 81, Social 70. Ananya Singh Math 99, Science 97, English 95, Hindi 96, Social 94.";
    let i = 0;
    const interval = setInterval(() => {
      setTranscript(text.substring(0, i));
      i += 2;
      if (i > text.length) {
        clearInterval(interval);
        setTimeout(() => setRecording(false), 500);
      }
    }, 50);
  };

  const processAITranscript = async () => {
    setProcessing(true);
    
    // Simulate AI parsing JSON
    const extractedData = [
      { student_name: 'Rahul Verma', subject: 'Math', marks: 72 },
      { student_name: 'Rahul Verma', subject: 'Science', marks: 68 },
      { student_name: 'Rahul Verma', subject: 'English', marks: 74 },
      { student_name: 'Ananya Singh', subject: 'Math', marks: 99 },
      { student_name: 'Ananya Singh', subject: 'Science', marks: 97 },
      { student_name: 'Ananya Singh', subject: 'English', marks: 95 }
    ];

    // In a real flow, we map `student_name` to `student_id`. For MVP, we'll map locally to marksData state
    // But since this is Phase 9, let's actually pretend to INSERT into DB if we matched a real student_id.
    const toInsert = [];
    for (const d of extractedData) {
      const match = marksData.find(m => m.name.toLowerCase() === d.student_name.toLowerCase());
      if (match && !match.student_id.startsWith('mock')) {
         toInsert.push({
            student_id: match.student_id,
            exam_id: selectedExam,
            subject: d.subject,
            marks_obtained: d.marks,
            max_marks: 100
         });
      }
    }

    // Attempt actual DB Insert if not mocked
    if (toInsert.length > 0) {
       await submitExamGrades(toInsert);
    }

    // For UI immediate feedback
    setTimeout(() => {
      setMarksData(prev => prev.map(s => {
         if(s.name === 'Rahul Verma') return { ...s, math: 72, science: 68, english: 74, hindi: 81, social: 70, total: 365, pct: 73.0 };
         if(s.name === 'Ananya Singh') return { ...s, math: 99, science: 97, english: 95, hindi: 96, social: 94, total: 481, pct: 96.2 };
         return s;
      }));
      setProcessing(false);
      setAiModalOpen(false);
      setTranscript('');
      showToast('AI Grade extraction completed and saved to database!');
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Examinations</h1>
          <p className="text-slate-400 text-sm mt-0.5">Exam scheduling, mark entry, grades and report card generation</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleScheduleExam} className="btn-secondary text-sm py-2 px-4">📅 Schedule Exam</button>
          <button onClick={handleGeneratePDF} className="btn-primary text-sm py-2 px-4">📄 Generate Report Cards</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Exams This Year', value: '6', icon: '📝' },
          { label: 'Next Exam In', value: '10 days', icon: '📅' },
          { label: 'Class Avg', value: '78.2%', icon: '📊' },
          { label: 'Cards Ready', value: '142', icon: '📄' },
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
          {(['schedule','marksheet'] as const).map((t) => (
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
            {exams.map((e) => (
              <div key={e.id} className={`glass border rounded-2xl p-5 card-hover cursor-pointer ${selectedExam === e.id ? 'border-violet-500/40 bg-violet-500/5' : 'border-white/[0.07]'}`} onClick={() => setSelectedExam(e.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{e.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">📚 {e.classes} · {e.subjects} subjects</p>
                    <p className="text-xs text-slate-500 mt-0.5">🗓️ {e.startDate} → {e.endDate}</p>
                  </div>
                  <span className={`badge ${e.status === 'upcoming' ? 'badge-yellow' : 'badge-green'} shrink-0`}>
                    {e.status === 'upcoming' ? '⏳ Upcoming' : '✓ Completed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'marksheet' && (
          <>
            <div className="px-5 py-3 border-b border-white/[0.06] flex gap-4 items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Showing: <span className="text-white font-semibold">Mid-Term Exam — Class 10-A</span></span>
              </div>
              <button onClick={() => setAiModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:scale-105 transition-transform text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.3)] border border-white/20">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
                 AI Voice Entry
                 <span className="ml-1 w-2 h-2 rounded-full bg-white animate-pulse" />
              </button>
            </div>
            
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
                  </tr>
                </thead>
                <tbody>
                  {marksData.map((s, i) => {
                    const g = gradeFor(s.pct);
                    return (
                      <tr key={i} className={s.pct > 0 ? "bg-emerald-500/[0.02]" : ""}>
                        <td className="font-semibold text-white">{s.name}</td>
                        <td><span className="badge badge-purple text-[10px]">{s.class}</span></td>
                        <td className={s.math >= 35 ? 'text-white' : 'text-slate-500'}>{s.math || '-'}</td>
                        <td className={s.science >= 35 ? 'text-white' : 'text-slate-500'}>{s.science || '-'}</td>
                        <td className={s.english >= 35 ? 'text-white' : 'text-slate-500'}>{s.english || '-'}</td>
                        <td className={s.hindi >= 35 ? 'text-white' : 'text-slate-500'}>{s.hindi || '-'}</td>
                        <td className={s.social >= 35 ? 'text-white' : 'text-slate-500'}>{s.social || '-'}</td>
                        <td className="font-bold text-emerald-400">{s.total || '-'}</td>
                        <td className="font-semibold text-violet-300">{s.pct > 0 ? `${s.pct}%` : '-'}</td>
                        <td><span className={`badge ${g.badge}`}>{g.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* AI Voice Input Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass-strong border border-emerald-500/30 rounded-3xl p-8 w-full max-w-lg shadow-[0_0_50px_rgba(16,185,129,0.15)] relative overflow-hidden">
             
             {/* Radial glow background */}
             <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${recording ? 'opacity-100' : 'opacity-0'}`} />

             <div className="relative z-10 text-center flex flex-col items-center">
                <div className="flex justify-between items-center w-full mb-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="bg-gradient-to-r from-teal-400 to-emerald-400 text-transparent bg-clip-text">NexSchool AI</span> Auto-Grader
                  </h2>
                  <button onClick={() => setAiModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <p className="text-sm text-slate-400 mb-8">Instead of typing hundreds of entries, just read the answer sheet aloud. The AI will parse the student names and subjects instantly.</p>

                <button 
                  onClick={startVoiceInput} 
                  disabled={recording || processing}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 mb-8 ${recording ? 'bg-red-500 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-105 hover:shadow-emerald-500/50 shadow-xl'}`}
                >
                  {recording && <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping" />}
                  <svg className="w-10 h-10 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>

                <div className="w-full h-32 bg-slate-900/50 border border-white/10 rounded-2xl p-4 relative text-left">
                   {!transcript && !recording && <p className="text-slate-500 italic text-sm text-center mt-8">Click mic and say:<br/>&quot;Rahul Verma Math 72, Science 68...&quot;</p>}
                   <p className="text-sm text-emerald-300 font-medium leading-relaxed">{transcript}</p>
                   {recording && <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse align-middle" />}
                </div>

                <div className="w-full flex gap-3 mt-6">
                   <button onClick={() => setAiModalOpen(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 font-semibold text-sm transition-colors">Cancel</button>
                   <button 
                     onClick={processAITranscript} 
                     disabled={!transcript || recording || processing}
                     className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!transcript || recording ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400'}`}
                   >
                     {processing ? 'Processing AI...' : 'Populate Grades'}
                   </button>
                </div>
             </div>

          </div>
        </div>
      )}

      {/* Deep Mock: Exam Schedule */}
      {showScheduleMock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#080C1A]/90 backdrop-blur-md animate-fade-in">
          <div className="glass border border-violet-500/30 rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden">
            <h2 className="text-xl font-bold text-white mb-2">{mockComplete ? 'Draft Initialized!' : 'Generating Schedule...'}</h2>
            {!mockComplete ? (
              <div className="space-y-3 mt-4">
                <p className="text-sm text-slate-400">Verifying teacher availability and optimizing subjects for Class 9-12.</p>
                <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                  <div className="bg-violet-500 h-2 rounded-full transition-all duration-300" style={{ width: `${mockProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-slate-300 mb-4">A preliminary schedule draft has been sent to Admin for review.</p>
                <button onClick={() => setShowScheduleMock(false)} className="btn-primary w-full py-2 text-sm">Close Draft</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deep Mock: Report Card PDF Generation */}
      {showPDFMock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#080C1A]/90 backdrop-blur-md animate-fade-in">
          <div className="glass border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden">
             <div className={`absolute top-0 left-0 h-1 bg-emerald-500 transition-all duration-300`} style={{ width: `${mockProgress}%` }} />
            <h2 className="text-xl font-bold text-white mb-2">{mockComplete ? 'PDFs Compiled!' : 'Compiling Report Cards...'}</h2>
            {!mockComplete ? (
              <div className="space-y-3 mt-4">
                <p className="text-sm text-slate-400">Rendering HTML to PDF template. Calculating aggregates and grade thresholds.</p>
                <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${mockProgress}%` }} />
                </div>
                <p className="text-xs text-emerald-400 font-mono">Generating card {(mockProgress / 10).toFixed(0)} / 10</p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-slate-300 mb-4">Extracted PDF batch. Digital signatures affixed.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowPDFMock(false)} className="btn-primary flex-1 py-2 text-sm">Download ZIP</button>
                  <button onClick={() => setShowPDFMock(false)} className="btn-secondary flex-1 py-2 text-sm">Close</button>
                </div>
              </div>
            )}
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
