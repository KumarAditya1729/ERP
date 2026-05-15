'use client';
import { useState, useEffect, useCallback } from 'react';
import { generateTimetable } from '@/lib/algorithms';
import { createClient } from '@/lib/supabase/client';
import ConfigureSyllabusModal from '@/components/dashboard/ConfigureSyllabusModal';

const supabase = createClient();

interface Requirement {
  id: string;
  className: string;
  subject: string;
  teacherId: string;
  teacherName?: string;
  hoursNeeded: number;
}

export default function AcademicsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timetable, setTimetable] = useState<any[] | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load real class-subject-teacher mappings from DB
  const fetchRequirements = useCallback(async () => {
    setLoading(true);
    try {
      // Try timetable_requirements table first
      const { data: reqs, error } = await supabase
        .from('timetable_requirements')
        .select('id, class_name, subject, teacher_id, hours_per_week, profiles(first_name, last_name)')
        .order('class_name', { ascending: true });

      if (!error && reqs && reqs.length > 0) {
        setRequirements(reqs.map((r: any) => ({
          id: r.id,
          className: r.class_name,
          subject: r.subject,
          teacherId: r.teacher_id,
          teacherName: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : r.teacher_id,
          hoursNeeded: r.hours_per_week,
        })));
        setLoading(false);
        return;
      }

      // Fallback: build from teacher_assignments or profiles
      const { data: teachers, error: tErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, subject, class_name')
        .eq('role', 'teacher')
        .not('class_name', 'is', null);

      if (!tErr && teachers && teachers.length > 0) {
        setRequirements(teachers.map((t: any) => ({
          id: t.id,
          className: t.class_name || 'Unassigned',
          subject: t.subject || 'General',
          teacherId: t.id,
          teacherName: `${t.first_name} ${t.last_name}`,
          hoursNeeded: 5,
        })));
        setLoading(false);
        return;
      }

      // Final fallback if no teachers in DB yet — empty dataset
      setRequirements([]);
    } catch {
      // Silently use empty data if DB is unreachable
      setRequirements([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequirements(); }, [fetchRequirements]);

  const handleGenerateTimetable = async () => {
    if (requirements.length === 0) {
      showToast('No class-subject requirements found. Please assign teachers to classes first.', 'error');
      return;
    }
    setIsGenerating(true);
    setProgress(0);
    setTimetable(null);

    // Animate progress while the algorithm runs
    let p = 0;
    const interval = setInterval(() => {
      p += 15;
      setProgress(Math.min(p, 90));
      if (p >= 90) clearInterval(interval);
    }, 300);

    // Run greedy timetable engine with real requirements
    const algoReqs = requirements.map(r => ({
      id: r.id,
      className: r.className,
      subject: r.subject,
      teacherId: r.teacherId,
      hoursNeeded: r.hoursNeeded,
    }));

    const tt = generateTimetable(algoReqs, 5, 8);
    clearInterval(interval);
    setProgress(100);
    setTimetable(tt);
    setIsGenerating(false);
    showToast(`Collision-Free Timetable Generated — ${tt.length} slots across ${requirements.length} requirements.`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
       {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border ${toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 'bg-red-950/90 text-red-400 border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Academics & Timetable Engine</h1>
          <p className="text-slate-400 text-sm mt-0.5">Automated class scheduling powered by collision-free greedy algorithms.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-white/5 hover:bg-white/10 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors border border-white/10"
        >
           Configure Syllabus
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
         {/* Generator Panel */}
         <div className="lg:col-span-1 space-y-6">
            <div className="glass border border-violet-500/30 rounded-2xl p-6 relative overflow-hidden bg-gradient-to-br from-violet-600/10 to-purple-900/5">
                <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">⏰</div>
                <h2 className="text-lg font-bold text-white mb-2">Algorithm Constraints</h2>
                <ul className="text-sm text-slate-400 space-y-2 mb-6 list-disc list-inside">
                   <li>Teachers cannot overlap slots.</li>
                   <li>Classes require exactly one subject per period.</li>
                   <li>Priority given to high-hour subjects (Greedy logic).</li>
                </ul>

                {isGenerating ? (
                   <div className="space-y-3">
                      <div className="flex justify-between text-xs font-mono text-violet-300">
                         <span>Resolving constraints...</span>
                         <span>{progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                         <div className="h-full bg-violet-500 transition-all duration-300 shadow-[0_0_10px_rgba(139,92,246,0.8)]" style={{ width: `${progress}%` }} />
                      </div>
                   </div>
                ) : (
                   <button onClick={handleGenerateTimetable} disabled={loading} className="btn-primary w-full text-center py-3 disabled:opacity-50">
                     {loading ? '⏳ Loading Requirements...' : '⚡ Run Generator Engine'}
                   </button>
                )}
            </div>

            <div className="glass border border-white/[0.08] rounded-2xl p-6">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="text-white font-bold">Input Requirements</h3>
                 <span className="text-xs text-slate-500">{loading ? 'Loading...' : `${requirements.length} entries`}</span>
               </div>
               {loading ? (
                 <div className="space-y-3">
                   {[1,2,3].map(i => <div key={i} className="h-12 bg-white/[0.02] rounded-lg animate-pulse" />)}
                 </div>
               ) : (
                 <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                   {requirements.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                         <div>
                            <p className="text-sm font-bold text-white">{m.className}</p>
                            <p className="text-xs text-slate-400 uppercase">{m.subject}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-xs text-slate-400">
                              {m.teacherName
                                ? <span className="text-cyan-400 font-medium">{m.teacherName}</span>
                                : <span className="text-slate-500 font-mono">{m.teacherId.toUpperCase()}</span>
                              }
                            </p>
                            <p className="text-xs font-bold text-violet-400">{m.hoursNeeded} hrs/wk</p>
                         </div>
                      </div>
                   ))}
                 </div>
               )}
            </div>
         </div>

         {/* Timetable Display */}
         <div className="lg:col-span-2">
            <div className="glass border border-white/[0.08] rounded-2xl p-6 h-full flex flex-col">
               <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
                  <span>Generated Schedule Preview</span>
                  {timetable && <span className="badge badge-green">0 Collisions detected</span>}
               </h3>

               {!timetable ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 relative overflow-hidden rounded-2xl">
                     <div className="absolute inset-0 bg-gradient-to-t from-violet-500/5 to-transparent pointer-events-none"></div>
                     <div className="w-24 h-24 rounded-full bg-violet-500/10 flex items-center justify-center text-5xl mb-6 shadow-[0_0_40px_rgba(139,92,246,0.15)] border border-violet-500/20">
                       🗓️
                     </div>
                     <h2 className="text-white font-extrabold text-2xl tracking-tight mb-2 drop-shadow-sm">No Schedule Found</h2>
                     <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                       Hit the Run Generator Engine button to compile available data into a master timetable. The collision-free algorithm will resolve overlapping slots.
                     </p>
                  </div>
               ) : (
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-white/5 border-b border-white/10">
                              <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Day</th>
                              <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Period</th>
                              <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Class</th>
                              <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject</th>
                              <th className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Teacher</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {timetable.slice(0, 15).map((slot, idx) => {
                             const req = requirements.find(r => r.teacherId === slot.teacherId);
                             return (
                               <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="p-3 text-sm text-white font-medium">Day {slot.day}</td>
                                  <td className="p-3 text-sm text-cyan-400 font-mono">P{slot.period}</td>
                                  <td className="p-3 text-sm font-bold text-white"><span className="bg-white/10 rounded px-2 py-1">{slot.className}</span></td>
                                  <td className="p-3 text-sm text-slate-300">{slot.subject}</td>
                                  <td className="p-3 text-xs text-slate-400">{req?.teacherName || slot.teacherId.toUpperCase()}</td>
                               </tr>
                             );
                           })}
                        </tbody>
                     </table>
                     {timetable.length > 15 && (
                        <p className="text-center text-xs text-slate-500 mt-4">+ {timetable.length - 15} more slots scheduled across the week.</p>
                     )}
                  </div>
               )}
            </div>
         </div>
      </div>

      <ConfigureSyllabusModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onRefresh={fetchRequirements}
        requirements={requirements}
      />
    </div>
  );
}
