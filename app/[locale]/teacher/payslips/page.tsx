'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getMyPayslips, requestHRDocument } from '@/app/actions/payslips';

function formatCurrency(amount: number) {
  if (!amount) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
}

function generatePayslipPDF(ps: any, profile: any) {
  const content = `
PAYSLIP — ${ps.monthLabel}
================================
Employee: ${profile.name}
Role: ${profile.role?.toUpperCase()}
Month: ${ps.monthLabel}
Days Present: ${ps.daysPresent}
Status: ${ps.status}

EARNINGS
--------
Basic Salary:      ${formatCurrency(Math.round(ps.grossSalary * 0.5))}
HRA:               ${formatCurrency(Math.round(ps.grossSalary * 0.2))}
Transport Allow.:  ${formatCurrency(Math.round(ps.grossSalary * 0.1))}
Special Allow.:    ${formatCurrency(Math.round(ps.grossSalary * 0.2))}
Gross Salary:      ${formatCurrency(ps.grossSalary)}

DEDUCTIONS
----------
PF (12%):          ${formatCurrency(Math.round(ps.grossSalary * 0.06))}
ESI:               ${formatCurrency(Math.round(ps.grossSalary * 0.0075))}
TDS:               ${formatCurrency(Math.round(ps.grossSalary * 0.05))}
Professional Tax:  ₹200
Total Deductions:  ${formatCurrency(ps.grossSalary - ps.netSalary)}

NET SALARY PAYABLE: ${formatCurrency(ps.netSalary)}
================================
This is a computer-generated payslip.
NexSchool AI ERP System
  `;

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Payslip_${ps.monthLabel.replace(' ', '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherPayslipsPage() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    const res = await getMyPayslips();
    if (res.success && res.data) {
      setPayslips(res.data);
      setProfile(res.profile);
    } else {
      showToast(res.error || 'Failed to load payslips', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayslips(); }, [fetchPayslips]);

  const handleRequestHR = async (docType: string) => {
    setRequesting(true);
    const res = await requestHRDocument(docType);
    showToast(res.success ? `✅ ${docType} request sent to HR!` : 'Failed to send request', res.success ? 'success' : 'error');
    setRequesting(false);
  };

  const totalAnnual = payslips.reduce((s, p) => s + (p.netSalary || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
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
        <h1 className="text-3xl font-bold text-white">Payslips & Payroll</h1>
        <p className="text-slate-400 text-sm">Securely view and download your monthly salary calculations.</p>
      </div>

      {loading ? (
        <div className="glass border border-white/10 rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading your payslips…</p>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          {profile && (
            <div className="glass border border-violet-500/20 rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Employee</p>
                <p className="text-white font-bold text-sm mt-1">{profile.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Designation</p>
                <p className="text-white font-bold text-sm mt-1 capitalize">{profile.role}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Monthly CTC</p>
                <p className="text-emerald-400 font-bold text-sm mt-1">{formatCurrency(profile.salary)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">YTD Net Paid</p>
                <p className="text-emerald-400 font-bold text-sm mt-1">{formatCurrency(totalAnnual)}</p>
              </div>
            </div>
          )}

          {/* Payslip List */}
          <div className="glass border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-bold mb-5">Recent Salary Slips</h2>
            <div className="space-y-3">
              {payslips.map(ps => (
                <div key={ps.id} className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer gap-3"
                    onClick={() => setExpandedId(expandedId === ps.id ? null : ps.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg shrink-0">
                        💰
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white flex items-center gap-2">
                          {ps.monthLabel}
                          <span className="badge badge-green text-[9px]">{ps.status}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Disbursed {new Date(ps.processedAt).toLocaleDateString('en-IN')} · {ps.daysPresent} Days Present
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:ml-auto">
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">{formatCurrency(ps.netSalary)}</p>
                        <p className="text-[10px] text-slate-500">Net Take-Home</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); generatePayslipPDF(ps, profile); }}
                        className="bg-white/5 hover:bg-violet-500/20 hover:border-violet-500/30 border border-white/10 text-white text-xs py-2 px-4 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        ⬇ PDF
                      </button>
                      <span className="text-slate-500 text-xs">{expandedId === ps.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded breakdown */}
                  {expandedId === ps.id && (
                    <div className="px-4 pb-4 bg-black/20 grid grid-cols-2 gap-4 text-xs pt-3 border-t border-white/[0.04]">
                      <div>
                        <p className="text-slate-400 font-semibold mb-2 uppercase tracking-wider">Earnings</p>
                        {[
                          ['Basic Salary', Math.round(ps.grossSalary * 0.5)],
                          ['HRA', Math.round(ps.grossSalary * 0.2)],
                          ['Transport Allowance', Math.round(ps.grossSalary * 0.1)],
                          ['Special Allowance', Math.round(ps.grossSalary * 0.2)],
                        ].map(([label, val]) => (
                          <div key={label as string} className="flex justify-between py-0.5">
                            <span className="text-slate-400">{label}</span>
                            <span className="text-white">{formatCurrency(val as number)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-1 border-t border-white/10 mt-1 font-bold">
                          <span className="text-slate-300">Gross</span>
                          <span className="text-emerald-400">{formatCurrency(ps.grossSalary)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold mb-2 uppercase tracking-wider">Deductions</p>
                        {[
                          ['PF (Employee 12%)', Math.round(ps.grossSalary * 0.06)],
                          ['ESI', Math.round(ps.grossSalary * 0.0075)],
                          ['TDS', Math.round(ps.grossSalary * 0.05)],
                          ['Professional Tax', 200],
                        ].map(([label, val]) => (
                          <div key={label as string} className="flex justify-between py-0.5">
                            <span className="text-slate-400">{label}</span>
                            <span className="text-red-400">-{formatCurrency(val as number)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-1 border-t border-white/10 mt-1 font-bold">
                          <span className="text-slate-300">Net Pay</span>
                          <span className="text-emerald-400">{formatCurrency(ps.netSalary)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* HR Request Section */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <p className="text-xs text-slate-500 mb-3 text-center">Need official salary documents?</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Form 16', 'Salary Certificate', 'Employment Letter', 'CTC Breakup'].map(doc => (
                  <button
                    key={doc}
                    onClick={() => handleRequestHR(doc)}
                    disabled={requesting}
                    className="text-xs text-violet-400 hover:text-white bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  >
                    {requesting ? '…' : `Request ${doc}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
