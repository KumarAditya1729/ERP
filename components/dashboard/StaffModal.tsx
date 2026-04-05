'use client';
import { useState } from 'react';
import { addStaff } from '@/app/actions/hr';

type StaffModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function StaffModal({ isOpen, onClose }: StaffModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText('');
    
    const formData = new FormData(e.currentTarget);
    const res = await addStaff(formData);

    setLoading(false);

    if (res?.error) {
      setErrorText(res.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#080C1A] border border-white/[0.08] shadow-2xl rounded-2xl w-full max-w-[450px] overflow-hidden animate-slide-up">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-violet-900/10 to-transparent">
          <h2 className="text-lg font-bold text-white">Add New Staff Member</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorText && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              {errorText}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">First Name</label>
              <input name="first_name" required className="erp-input w-full text-sm" placeholder="e.g. Ramesh" />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Last Name</label>
              <input name="last_name" required className="erp-input w-full text-sm" placeholder="e.g. Kumar" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Work Email (Required for login)</label>
            <input name="email" required type="email" className="erp-input w-full text-sm" placeholder="ramesh@school.com" />
            <p className="text-[10px] text-slate-500 mt-1 mt-1 font-mono">Password defaults to: password123</p>
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">System Role</label>
            <select name="role" required className="erp-input w-full text-sm">
              <option value="teacher">Teacher (Academics)</option>
              <option value="admin">Admin (Operations)</option>
            </select>
          </div>

          <div className="pt-4 mt-2 flex justify-end gap-3 border-t border-white/[0.04]">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-6 py-2 text-sm font-bold shadow-lg shadow-violet-500/20">
              {loading ? 'Adding...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
