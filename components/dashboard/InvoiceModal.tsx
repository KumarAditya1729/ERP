'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createInvoice } from '@/app/actions/fees';

type InvoiceModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function InvoiceModal({ isOpen, onClose }: InvoiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      // Load active students to populate dropdown
      supabase.from('students').select('id, first_name, last_name, class_grade').eq('status', 'active').then(({ data }) => {
        if (data) setStudents(data);
      });
    }
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText('');
    
    const formData = new FormData(e.currentTarget);
    const res = await createInvoice(formData);

    setLoading(false);

    if (res?.error) {
      setErrorText(res.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#080C1A] border border-white/[0.08] shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-emerald-900/10 to-transparent">
          <h2 className="text-lg font-bold text-white">Generate Invoice</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorText && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              {errorText}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Select Student</label>
            <select name="student_id" required className="erp-input w-full text-sm">
              <option value="">-- Choose an active student --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} (Class {s.class_grade})</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Fee Title / Description</label>
              <input name="title" required className="erp-input w-full text-sm" placeholder="e.g. Term 1 Tuition + Transport" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Amount (₹)</label>
              <input name="amount" type="number" required className="erp-input w-full text-sm" placeholder="12500" />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Due Date</label>
              <input name="due_date" type="date" required className="erp-input w-full text-sm" />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 mt-2 flex justify-end gap-3 border-t border-white/[0.04]">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-6 py-2 text-sm font-bold shadow-lg shadow-emerald-500/20" style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
              {loading ? 'Generating...' : 'Generate & Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
