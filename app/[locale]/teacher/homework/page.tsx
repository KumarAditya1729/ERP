'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function TeacherHomeworkPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'submissions'>('upload');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Assignment uploaded successfully and parents notified via App!');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
       <Link href="/teacher" className="text-sm font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 mb-4">
         <span>←</span> Back to Hub
       </Link>

       {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border ${toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 'bg-red-950/90 text-red-400 border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
         <h1 className="text-3xl font-bold text-white">Homework & Classes</h1>
         <p className="text-slate-400 text-sm">Assign daily tasks or grade submissions from your students.</p>
      </div>

      {/* Mobile-first tabs */}
      <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/10 relative">
          <div className="absolute inset-y-1 w-[calc(50%-4px)] bg-white/10 rounded-lg shadow-sm border border-white/10 transition-all duration-300" style={{ left: activeTab === 'upload' ? '4px' : 'calc(50%)' }} />
          <button onClick={() => setActiveTab('upload')} className={`flex-1 py-2 text-sm font-semibold relative z-10 transition-colors ${activeTab === 'upload' ? 'text-white' : 'text-slate-400'}`}>📤 Assign Task</button>
          <button onClick={() => setActiveTab('submissions')} className={`flex-1 py-2 text-sm font-semibold relative z-10 transition-colors ${activeTab === 'submissions' ? 'text-white' : 'text-slate-400'}`}>📥 Submissions</button>
      </div>

      {activeTab === 'upload' ? (
        <form onSubmit={handleUpload} className="glass border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl shadow-black/50">
           
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Class</label>
              <select className="erp-input w-full bg-[#111]">
                 <option>Grade 10 - Section A</option>
                 <option>Grade 10 - Section B</option>
                 <option>Grade 12 - Science</option>
              </select>
           </div>

           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assignment Title</label>
              <input type="text" required placeholder="e.g. Chapter 4 Equations Worksheet" className="erp-input w-full bg-[#111]" />
           </div>

           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Instructions</label>
              <textarea required rows={4} placeholder="Solve all 10 questions on page 42. Show intermediate steps." className="erp-input w-full bg-[#111] resize-none" />
           </div>

           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Due Date</label>
              <input type="date" required className="erp-input w-full bg-[#111]" />
           </div>

           <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/[0.02] transition-colors cursor-pointer group">
                  <span className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">📎</span>
                  <p className="text-sm font-semibold text-white mt-2">Attach PDF or Image</p>
                  <p className="text-xs text-slate-500">Max file size: 10MB</p>
              </div>
              <button type="submit" className="btn-primary w-full py-3.5 text-base shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                  Dispatch to Students
              </button>
           </div>
        </form>
      ) : (
         <div className="glass border border-white/10 rounded-2xl p-6 h-[400px] flex flex-col items-center justify-center text-center">
            <span className="text-5xl opacity-40 mb-3 block">📥</span>
            <p className="text-white font-bold text-lg mb-1">No pending submissions</p>
            <p className="text-slate-400 text-sm">All uploaded assignments have been graded for your current classes.</p>
         </div>
      )}
    </div>
  );
}
