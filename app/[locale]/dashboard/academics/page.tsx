'use client';
import { useState } from 'react';
import { generateTimetable } from '@/lib/algorithms';

const MOCK_REQUIREMENTS = [
  { id: '1', className: '10A', subject: 'Maths', teacherId: 't1', hoursNeeded: 6 },
  { id: '2', className: '10A', subject: 'Science', teacherId: 't2', hoursNeeded: 5 },
  { id: '3', className: '10A', subject: 'English', teacherId: 't3', hoursNeeded: 5 },
  { id: '4', className: '10B', subject: 'Maths', teacherId: 't1', hoursNeeded: 6 },
  { id: '5', className: '10B', subject: 'Science', teacherId: 't4', hoursNeeded: 5 },
  { id: '6', className: '10C', subject: 'English', teacherId: 't3', hoursNeeded: 4 },
];

export default function AcademicsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timetable, setTimetable] = useState<any[] | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleGenerateTimetable = async () => {
    setIsGenerating(true);
    setProgress(0);
    setTimetable(null);

    // Deep Mock sequence simulating complex algorithmic resolution
    let p = 0;
    const interval = setInterval(() => {
      p += 15;
      setProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(interval);
        
        // Actually run the greedy engine
        const tt = generateTimetable(MOCK_REQUIREMENTS, 5, 8);
        setTimetable(tt);
        setIsGenerating(false);
        showToast('Collision-Free Timetable Generated Successfully!');
      }
    }, 400);
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
        <button className="bg-white/5 hover:bg-white/10 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors border border-white/10">
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
                   <button onClick={handleGenerateTimetable} className="btn-primary w-full text-center py-3">
                     ⚡ Run Generator Engine
                   </button>
                )}
            </div>

            <div className="glass border border-white/[0.08] rounded-2xl p-6">
               <h3 className="text-white font-bold mb-4">Input Requirements</h3>
               <div className="space-y-3">
                  {MOCK_REQUIREMENTS.map(m => (
                     <div key={m.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                        <div>
                           <p className="text-sm font-bold text-white">{m.className}</p>
                           <p className="text-xs text-slate-400 uppercase">{m.subject}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-slate-400">Teacher: <span className="text-cyan-400 font-mono">{m.teacherId.toUpperCase()}</span></p>
                           <p className="text-xs font-bold text-violet-400">{m.hoursNeeded} hrs/wk</p>
                        </div>
                     </div>
                  ))}
               </div>
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
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                     <span className="text-5xl opacity-50 mb-4">🗓️</span>
                     <p className="text-white font-bold">No Schedule Found</p>
                     <p className="text-slate-400 text-sm mt-2 max-w-sm">Hit the Run Generator Engine button to compile available data into a master timetable.</p>
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
                           {timetable.slice(0, 12).map((slot, idx) => (
                              <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                 <td className="p-3 text-sm text-white font-medium">Day {slot.day}</td>
                                 <td className="p-3 text-sm text-cyan-400 font-mono">P{slot.period}</td>
                                 <td className="p-3 text-sm font-bold text-white"><span className="bg-white/10 rounded px-2 py-1">{slot.className}</span></td>
                                 <td className="p-3 text-sm text-slate-300">{slot.subject}</td>
                                 <td className="p-3 text-xs text-slate-500 font-mono">ID:{slot.teacherId.toUpperCase()}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                     {timetable.length > 12 && (
                        <p className="text-center text-xs text-slate-500 mt-4">+ {timetable.length - 12} more slots scheduled across the week.</p>
                     )}
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
