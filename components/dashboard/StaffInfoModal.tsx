'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type StaffData = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
};

export default function StaffInfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [staff, setStaff] = useState<StaffData[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;
    async function fetchStaff() {
      setLoading(true);
      const { data } = await supabase.from('profiles').select('*').in('role', ['staff', 'admin']);
      if (data) setStaff(data);
      setLoading(false);
    }
    fetchStaff();
  }, [isOpen, supabase]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#080C1A] border border-white/[0.08] shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-violet-900/10 to-transparent">
          <h2 className="text-lg font-bold text-white">Staff Information</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
        </div>
        <div className="p-0 overflow-y-auto overflow-x-hidden flex-1 data-table-container">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/[0.02] border-b border-white/[0.08] sticky top-0 backdrop-blur-md">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Designation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500">Loading staff data...</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-500">No staff found</td></tr>
              ) : staff.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {s.first_name?.[0] || 'S'}{s.last_name?.[0] || ''}
                      </div>
                      <span className="text-sm font-medium text-white">{s.first_name} {s.last_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-300 capitalize">{s.role === 'admin' ? 'Administrator' : 'Teacher'}</span>
                      <span className="text-[10px] text-slate-500">{s.role === 'admin' ? 'Non-Teaching / Operations' : 'Academics'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
