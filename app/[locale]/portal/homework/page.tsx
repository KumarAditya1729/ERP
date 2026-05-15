'use client';
import { useState, useEffect } from 'react';
import { getParentAcademics } from '@/app/actions/academics';
import { useRouter } from 'next/navigation';

export default function PortalHomeworkPage() {
  const [homework, setHomework] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const res = await getParentAcademics();
      if (res.success && res.data) {
        setHomework(res.data.homework || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 animate-pulse">Loading homework...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pt-4 pb-24">
      {/* Header */}
      <div className="relative mb-8">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-600/30 to-cyan-600/30 blur-2xl opacity-50 z-0" />
        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Homework & Assignments</h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">View and submit pending tasks.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {homework.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 py-12 text-center glass border border-white/[0.08] rounded-3xl">
            <span className="text-4xl">✨</span>
            <p className="text-white font-semibold mt-4">No active assignments!</p>
            <p className="text-sm text-slate-400 mt-1">You are all caught up.</p>
          </div>
        ) : (
          homework.map((hw: any) => {
            const isDone = hw.status === 'graded' || hw.status === 'submitted';
            return (
              <div 
                key={hw.id}
                onClick={() => router.push(`/portal/homework/${hw.id}`)}
                className={`glass border rounded-3xl p-6 cursor-pointer transition-all group hover:-translate-y-1 ${isDone ? 'border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5' : 'border-white/[0.08] hover:border-violet-500/40 hover:shadow-[0_8px_30px_rgba(139,92,246,0.15)]'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-md border border-cyan-400/20">
                    {hw.subject}
                  </span>
                  {isDone ? (
                    <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/20">DONE</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-md border border-amber-500/20">PENDING</span>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 group-hover:text-violet-300 transition-colors">{hw.title}</h3>
                
                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Due: <span className="text-slate-200">{new Date(hw.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></span>
                  <span className="text-violet-400 font-medium group-hover:underline">View Details →</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
