'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { generateMonthlyInvoiceForStudent } from '@/app/actions/fees';
import Link from 'next/link';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tenantId = user.app_metadata?.tenant_id;

    const [invRes, stuRes] = await Promise.all([
      supabase.from('fee_invoices').select('*, students(first_name, last_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('students').select('id, first_name, last_name, class_grade, section').eq('tenant_id', tenantId).order('first_name')
    ]);

    if (invRes.data) setInvoices(invRes.data);
    if (stuRes.data) setStudents(stuRes.data);
    setLoading(false);
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsGenerating(true);
    setError('');
    setSuccess('');

    const formData = new FormData(e.currentTarget);
    const studentId = formData.get('student_id') as string;
    
    const res = await generateMonthlyInvoiceForStudent(studentId);
    
    setIsGenerating(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Invoice generated successfully!');
      fetchData();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-sm text-slate-400">Generate and track monthly fee invoices</p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <form onSubmit={handleGenerate} className="glass p-6 rounded-2xl border border-white/[0.08] space-y-4">
            <h2 className="font-bold text-white mb-2">Generate Invoice</h2>
            
            {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
            {success && <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">{success}</div>}

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Select Student *</label>
              <select name="student_id" required className="erp-input w-full text-sm">
                <option value="">-- Select Student --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.class_grade}-{s.section})</option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={isGenerating || loading} className="btn-primary w-full py-2">
              {isGenerating ? 'Generating...' : 'Generate Monthly Invoice'}
            </button>
            
            <p className="text-xs text-slate-500 text-center mt-2">Pulls active fee assignments for this student.</p>
          </form>
        </div>

        <div className="md:col-span-3">
          <div className="glass rounded-2xl border border-white/[0.08] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading invoices...</div>
            ) : invoices.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No invoices found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.02] border-b border-white/[0.08]">
                    <tr>
                      <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Invoice #</th>
                      <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Student</th>
                      <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Month</th>
                      <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Total</th>
                      <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Status</th>
                      <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-mono text-violet-400 text-xs">{inv.invoice_number}</td>
                        <td className="p-4 font-bold text-white">{inv.students?.first_name} {inv.students?.last_name}</td>
                        <td className="p-4 text-slate-300">{inv.billing_month}</td>
                        <td className="p-4 text-emerald-400 font-mono">₹{inv.total_amount.toLocaleString()}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-bold uppercase tracking-wider ${
                            inv.status === 'paid' ? 'text-emerald-400' : inv.status === 'partially_paid' ? 'text-blue-400' : inv.status === 'overdue' ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {inv.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Link href={`/dashboard/fees/invoices/${inv.id}`} className="text-xs text-violet-400 hover:text-white transition-colors bg-violet-500/10 px-3 py-1.5 rounded-lg border border-violet-500/20">
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
