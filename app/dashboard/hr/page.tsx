'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import StaffModal from '@/components/dashboard/StaffModal';

const supabase = createClient();

// Fallback skeleton
const initialStaffPattern = [
  { id: 'T001', name: 'Loading...', role: 'Math Teacher', dept: 'Academics', join: '2019-06-01', salary: 52000, attendance: '96%', leave: 2, status: 'active' },
];

const leaveRequests = [
  { id: 'L1', staff: 'Mrs. Kavita Sharma', type: 'Sick Leave', from: '2026-04-08', to: '2026-04-09', days: 2, reason: 'Medical appointment', status: 'pending' },
  { id: 'L2', staff: 'Mr. Deepak Joshi', type: 'Casual Leave', from: '2026-04-15', to: '2026-04-15', days: 1, reason: 'Personal work', status: 'approved' },
  { id: 'L3', staff: 'Ms. Preethi Nair', type: 'Medical Leave', from: '2026-04-03', to: '2026-04-07', days: 5, reason: 'Surgery recovery', status: 'approved' },
];

const avatarColors = ['from-violet-600 to-purple-700', 'from-cyan-600 to-teal-700', 'from-emerald-600 to-green-700', 'from-amber-600 to-orange-700', 'from-pink-600 to-rose-700', 'from-blue-600 to-indigo-700'];

export default function HRPage() {
  const [tab, setTab] = useState<'staff' | 'leave' | 'payroll'>('staff');
  const [staffData, setStaffData] = useState<any[]>(initialStaffPattern);
  const [leaveStatus, setLeaveStatus] = useState<Record<string, string>>(
    Object.fromEntries(leaveRequests.map((l) => [l.id, l.status]))
  );
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [showPayrollSimulator, setShowPayrollSimulator] = useState(false);
  const [payrollStep, setPayrollStep] = useState(0);
  const [payrollProgress, setPayrollProgress] = useState(0);
  const [payrollComplete, setPayrollComplete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    async function fetchHR() {
      // Fetch authenticated staff
      const { data: profiles } = await supabase.from('profiles').select('*').in('role', ['staff', 'admin']);
      if (profiles && profiles.length > 0) {
        setStaffData(profiles.map((p, i) => ({
           id: p.id.split('-')[0].toUpperCase(),
           name: `${p.first_name || 'Staff'} ${p.last_name || ''}`.trim(),
           role: p.role === 'admin' ? 'Administrator' : 'Teacher',
           dept: p.role === 'admin' ? 'Operations' : 'Academics',
           join: '2024-01-15',
           salary: 45000 + (Math.random() * 20000), // Mock algorithm parameter
           attendance: '95%',
           leave: Math.floor(Math.random() * 4), // Mock for Phase 9
           status: 'active'
        })));
      }
    }
    fetchHR();
  }, []);

  const approve = (id: string) => setLeaveStatus((p) => ({ ...p, [id]: 'approved' }));
  const reject  = (id: string) => setLeaveStatus((p) => ({ ...p, [id]: 'rejected' }));

  const runBulkPayroll = () => {
    setShowPayrollSimulator(true);
    setPayrollStep(0);
    setPayrollProgress(0);
    setPayrollComplete(false);
    
    // Simulate step 1
    setTimeout(() => {
      setPayrollStep(1);
      // Simulate progress counting
      let p = 0;
      const interval = setInterval(() => {
        p += 15;
        if(p > 100) p = 100;
        setPayrollProgress(p);
        if (p === 100) {
           clearInterval(interval);
           setTimeout(() => {
             setPayrollStep(2);
             setTimeout(() => setPayrollComplete(true), 1500);
           }, 800);
        }
      }, 300);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">HR & Payroll</h1>
          <p className="text-slate-400 text-sm mt-0.5">Staff directory, leave management, and monthly payroll</p>
        </div>
        <div className="flex gap-3">
          <button id="add-staff-btn" onClick={() => setIsStaffModalOpen(true)} className="btn-secondary text-sm py-2 px-4">+ Add Staff</button>
          <button id="run-payroll-btn" onClick={runBulkPayroll} className="btn-primary text-sm py-2 px-4">💸 Run Payroll</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: staffData.length.toString(), icon: '👩‍💼' },
          { label: 'On Leave Today', value: '10', icon: '🏖️' },
          { label: 'Pending Leaves', value: '3', icon: '📋' },
          { label: 'Monthly Payroll', value: '₹8.4L', icon: '💰' },
        ].map((s) => (
          <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 card-hover">
            <span className="text-2xl">{s.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="flex border-b border-white/[0.08]">
          {(['staff','leave','payroll'] as const).map((t) => (
            <button key={t} id={`hr-tab-${t}`} onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold capitalize transition-colors ${tab === t ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
              {t === 'staff' ? '👥 Staff Directory' : t === 'leave' ? '📋 Leave Requests' : '💸 Payroll'}
            </button>
          ))}
        </div>

        {tab === 'staff' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Staff Member</th><th>Role</th><th>Dept</th><th>Joined</th><th>Salary</th><th>Attendance</th><th>Leave Bal.</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {staffData.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {s.name.split(' ').slice(-2).map((n: string) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{s.name}</p>
                          <p className="text-[10px] text-slate-500">{s.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-300 text-sm">{s.role}</td>
                    <td><span className="badge badge-purple text-[10px]">{s.dept}</span></td>
                    <td className="text-slate-400 text-xs">{s.join}</td>
                    <td className="font-semibold text-white">₹{s.salary.toLocaleString('en-IN', {maximumFractionDigits: 0})}</td>
                    <td><span className="text-emerald-400 font-semibold">{s.attendance}</span></td>
                    <td className="text-center">
                      <span className={`font-bold ${s.leave > 2 ? 'text-amber-400' : 'text-slate-300'}`}>{12 - s.leave}</span>
                      <span className="text-slate-600 text-xs">/12</span>
                    </td>
                    <td><span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>{s.status === 'active' ? 'Active' : 'On Leave'}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button id={`view-staff-${s.id}`} className="text-xs text-violet-400 hover:text-violet-300 font-medium">View</button>
                        <button id={`payslip-${s.id}`} className="text-xs text-slate-400 hover:text-white">Payslip</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'leave' && (
          <div className="p-5 space-y-4">
            {leaveRequests.map((l) => {
              const status = leaveStatus[l.id];
              return (
                <div key={l.id} className="glass border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">{l.staff}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {l.type} · {l.from} → {l.to} · <span className="font-semibold text-white">{l.days} day{l.days > 1 ? 's' : ''}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{l.reason}&rdquo;</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`badge ${status === 'approved' ? 'badge-green' : status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {status === 'approved' ? '✓ Approved' : status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
                      {status === 'pending' && (
                        <div className="flex gap-2">
                          <button id={`approve-${l.id}`} onClick={() => approve(l.id)} className="text-xs text-emerald-400 glass border border-emerald-500/20 rounded-lg px-3 py-1 font-bold hover:bg-emerald-500/10 transition-colors">✓ Approve</button>
                          <button id={`reject-${l.id}`} onClick={() => reject(l.id)} className="text-xs text-red-400 glass border border-red-500/20 rounded-lg px-3 py-1 font-bold hover:bg-red-500/10 transition-colors">✗ Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'payroll' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">April 2026 — {staffData.length} employees</p>
              <button id="download-payroll-btn" className="text-xs text-violet-400 font-semibold hover:text-violet-300">📥 Download Excel</button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Staff Member</th><th>Gross</th><th>Leave Deduction</th><th>PF (12%)</th><th>Net Payable</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {staffData.map((s, i) => {
                    const deduct = Math.round((s.salary / 26) * s.leave);
                    const pf = Math.round(s.salary * 0.12);
                    const net = s.salary - deduct - pf;
                    return (
                      <tr key={i}>
                        <td className="font-semibold text-white">{s.name}</td>
                        <td>₹{s.salary.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                        <td className={deduct > 0 ? 'text-red-400' : 'text-slate-500'}>{deduct > 0 ? `-₹${deduct.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="text-amber-400">-₹{pf.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                        <td className="font-bold text-white">₹{net.toLocaleString('en-IN', {maximumFractionDigits:0})}</td>
                        <td><span className="badge badge-green">✓ Processed</span></td>
                        <td><button id={`payslip-pay-${i}`} className="text-xs text-violet-400 hover:text-violet-300 font-medium">📄 Payslip</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 glass border border-emerald-500/20 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-slate-300 font-medium">Total Payroll This Month</span>
              <span className="text-xl font-extrabold text-emerald-400">
                ₹{staffData.reduce((s, e) => s + e.salary - Math.round((e.salary/26)*e.leave) - Math.round(e.salary*0.12), 0).toLocaleString('en-IN', {maximumFractionDigits:0})}
              </span>
            </div>
          </div>
        )}
      </div>

      <StaffModal isOpen={isStaffModalOpen} onClose={() => { setIsStaffModalOpen(false); window.location.reload(); }} />
      
      {/* Deep Mock Payroll Simulator */}
      {showPayrollSimulator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#080C1A]/90 backdrop-blur-md animate-fade-in">
          <div className="glass border border-emerald-500/30 rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden shadow-2xl shadow-emerald-900/20">
            <div className={`absolute top-0 left-0 h-1 bg-emerald-500 transition-all duration-300`} style={{ width: `${payrollProgress}%` }} />
            
            <p className="text-5xl mb-4">{payrollComplete ? '🎉' : payrollStep === 0 ? '🏦' : '💸'}</p>
            <h2 className="text-xl font-bold text-white mb-2">
               {payrollComplete ? 'Payroll Dispatched!' : payrollStep === 0 ? 'Authenticating Gateway...' : 'Executing Bulk Transfers...'}
            </h2>
            
            {!payrollComplete ? (
              <div className="space-y-3 mt-5">
                <p className="text-sm text-slate-400">Processing IMPS Node API securely.</p>
                <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${payrollProgress}%` }} />
                </div>
                <p className="text-xs text-emerald-400 font-mono">Transmitting... {payrollProgress}%</p>
              </div>
            ) : (
              <div className="space-y-4 mt-5">
                <p className="text-sm text-slate-300">Successfully dispersed salaries to <span className="font-bold text-white">{staffData.length}</span> employees.</p>
                <p className="text-xs text-slate-500 border border-slate-700 bg-slate-800/50 p-2 rounded-lg font-mono">Txn: IMP{Math.random().toString().substring(2, 10).toUpperCase()}</p>
                <button onClick={() => setShowPayrollSimulator(false)} className="btn-primary w-full py-3 mt-2 text-sm">Close Dashboard</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
