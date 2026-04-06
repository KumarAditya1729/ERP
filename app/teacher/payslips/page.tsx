'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function TeacherPayslipsPage() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  const showToast = (msg: string) => {
    setToast({ msg, type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const payslips = [
     { month: 'March 2026', present: 24, paid: '₹42,500', status: 'Paid', date: 'Mar 31' },
     { month: 'February 2026', present: 22, paid: '₹42,000', status: 'Paid', date: 'Feb 28' },
     { month: 'January 2026', present: 25, paid: '₹43,100', status: 'Paid', date: 'Jan 31' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
       <Link href="/teacher" className="text-sm font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 mb-4">
         <span>←</span> Back to Hub
       </Link>

       {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border bg-emerald-950/90 text-emerald-400 border-emerald-500/30`}>
          {toast.msg}
        </div>
       )}

      {/* Header */}
      <div className="flex flex-col gap-1">
         <h1 className="text-3xl font-bold text-white">Payslips & Payroll</h1>
         <p className="text-slate-400 text-sm">Securely view and download your monthly salary calculations.</p>
      </div>

      <div className="glass border border-white/10 rounded-2xl p-6">
         <h2 className="text-white font-bold mb-6">Recent Salary Slips</h2>
         
         <div className="space-y-4">
            {payslips.map(ps => (
               <div key={ps.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl gap-4">
                  <div>
                     <p className="text-sm font-bold text-white flex items-center gap-2">
                        {ps.month}
                        <span className="badge badge-green text-[9px]">{ps.status}</span>
                     </p>
                     <p className="text-xs text-slate-400 mt-1">Disbursed on {ps.date} | {ps.present} Days Present</p>
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                     <p className="text-lg font-bold text-emerald-400">{ps.paid}</p>
                     <button onClick={() => showToast('PDF Download initiated')} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs py-2 px-4 rounded transition-colors">
                        PDF
                     </button>
                  </div>
               </div>
            ))}
         </div>

         <div className="mt-6 pt-6 border-t border-white/10 text-center">
             <p className="text-xs text-slate-500 mb-2">Need a detailed tax breakdown (Form 16)?</p>
             <button onClick={() => showToast('Tax Request sent to HR')} className="text-xs text-violet-400 hover:text-white transition-colors">Request from HR</button>
         </div>
      </div>
    </div>
  );
}
