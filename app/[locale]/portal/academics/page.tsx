'use client';
import { useState, useEffect } from 'react';
import { getParentAcademics } from '@/app/actions/academics';

export default function PortalAcademicsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getParentAcademics();
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-12 text-center animate-pulse text-violet-400">Loading academics hub...</div>;
  }

  const { timetable = [], homework = [], attendance = 0, assignmentsCompleted = 0 } = data || {};

  return (
    <div className="space-y-8 animate-fade-in pt-4 pb-24">
      {/* Header */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-600/30 to-cyan-600/30 blur-2xl opacity-50 z-0" />
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Academics Hub</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">Your command center for daily schedules, performance, and assignments.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Timetable */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="glass-strong border border-white/[0.08] rounded-3xl p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <h2 className="text-xl font-bold text-white flex items-center">
                <span className="p-2 bg-white/5 rounded-xl mr-3 text-2xl shadow-inner border border-white/10">📅</span>
                Today&apos;s Schedule
              </h2>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 px-4 py-1.5 rounded-full border border-cyan-400/20 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </span>
            </div>

            <div className="space-y-4 relative z-10">
              {timetable.map((cls: any, idx: number) => (
                <div 
                  key={idx} 
                  className={`relative p-6 rounded-2xl border transition-all duration-300 group ${
                    cls.status === 'active' 
                      ? 'bg-gradient-to-r from-violet-500/10 to-transparent border-violet-500/30 shadow-[0_4px_30px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/20' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 hover:shadow-lg'
                  }`}
                >
                  {cls.status === 'active' && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-violet-500 rounded-l-2xl animate-pulse shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
                  )}
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${cls.status === 'active' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/5 text-slate-400 border border-white/10 group-hover:bg-white/10'}`}>
                        {cls.subject.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className={`text-lg font-bold mb-0.5 ${cls.status === 'active' ? 'text-white' : 'text-slate-200 group-hover:text-white transition-colors'}`}>{cls.subject}</h3>
                        <p className="text-xs font-medium text-slate-400">by <span className="text-slate-300">{cls.teacher}</span></p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <div className={`text-sm font-mono font-bold ${cls.status === 'active' ? 'text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]' : 'text-slate-400 group-hover:text-cyan-300 transition-colors'}`}>{cls.time}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-black/40 px-3 py-1 rounded-lg border border-white/5 shadow-inner">{cls.room}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Homework & Stats */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="glass-strong border border-white/[0.08] rounded-3xl p-7 bg-gradient-to-b from-[#0f172a]/80 to-[#080C1A] relative overflow-hidden shadow-2xl">
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <h2 className="text-lg font-bold text-white flex items-center mb-8 relative z-10">
              <span className="p-1.5 bg-emerald-500/20 rounded-lg mr-3 text-xl border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">🎯</span> 
              Performance Metrics
            </h2>
            <div className="space-y-6 relative z-10">
              <div className="group">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className="text-slate-300 group-hover:text-white transition-colors">Overall Attendance</span>
                  <span className="text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">{attendance}%</span>
                </div>
                <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000 ease-out relative" style={{width: `${attendance}%`}}>
                    <div className="absolute inset-0 bg-white/20 w-full h-full transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-1000" />
                  </div>
                </div>
              </div>
              <div className="group">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className="text-slate-300 group-hover:text-white transition-colors">Assignments Completed</span>
                  <span className="text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">{assignmentsCompleted}%</span>
                </div>
                <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-1000 ease-out relative" style={{width: `${assignmentsCompleted}%`}}>
                    <div className="absolute inset-0 bg-white/20 w-full h-full transform -skew-x-12 translate-x-full group-hover:-translate-x-full transition-transform duration-1000" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-strong border border-white/[0.08] rounded-3xl p-7 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-lg font-bold text-white flex items-center">
                <span className="p-1.5 bg-amber-500/20 rounded-lg mr-3 text-xl border border-amber-500/30">📝</span> 
                Active Tasks
              </h2>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">{homework.length} Dues</span>
            </div>
            
            <div className="space-y-3 relative z-10">
              {homework.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/10">
                    <span className="text-2xl opacity-50">✨</span>
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">All caught up!</p>
                  <p className="text-xs text-slate-400">No pending assignments.</p>
                </div>
              ) : (
                homework.map((hw: any) => (
                  <div key={hw.id} className="p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer group">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider mb-1">{hw.subject}</p>
                      <p className="text-sm text-slate-200 group-hover:text-white font-semibold truncate transition-colors">{hw.title}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {hw.status === 'graded' ? (
                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-sm">GRADED</span>
                      ) : hw.status === 'submitted' ? (
                        <span className="text-[10px] font-bold bg-violet-500/10 text-violet-400 px-3 py-1.5 rounded-lg border border-violet-500/20 shadow-sm">DONE</span>
                      ) : (
                        <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/20 shadow-sm whitespace-nowrap">
                          DUE {new Date(hw.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

