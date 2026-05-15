'use client';
import { useState, useRef } from 'react';
import { createExam } from '@/app/actions/academics';

type ScheduleExamModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
};

export default function ScheduleExamModal({ isOpen, onClose, onRefresh }: ScheduleExamModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText('');
    
    const formData = new FormData(e.currentTarget);
    const res = await createExam(formData);

    setLoading(false);

    if (!res || res.error || res.success === false) {
      setErrorText(res?.error || 'Failed to create exam');
    } else {
      if (formRef.current) formRef.current.reset();
      onRefresh();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#080C1A] border border-white/[0.08] shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-violet-900/10 to-transparent">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            📅 Schedule New Exam
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorText && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              {errorText}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Exam Name <span className="text-red-400">*</span></label>
            <input name="name" required className="erp-input w-full text-sm" placeholder="e.g. Mid-Term Examinations 2026" />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Applicable Classes <span className="text-red-400">*</span></label>
            <input name="classes" required className="erp-input w-full text-sm" placeholder="e.g. Class 1 to 10" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Start Date <span className="text-red-400">*</span></label>
              <input name="start_date" type="date" required className="erp-input w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">End Date <span className="text-red-400">*</span></label>
              <input name="end_date" type="date" required className="erp-input w-full text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Number of Subjects</label>
            <input name="subject_count" type="number" defaultValue="5" min="1" max="15" className="erp-input w-full text-sm" />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-6 py-2 text-sm font-bold shadow-lg shadow-violet-500/20">
              {loading ? 'Scheduling...' : 'Schedule Exam'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
