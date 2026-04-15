'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import StaffModal from '@/components/dashboard/StaffModal';

const supabase = createClient();

const avatarColors = [
  'from-violet-600 to-purple-700',
  'from-cyan-600 to-teal-700',
  'from-emerald-600 to-green-700',
  'from-amber-600 to-orange-700',
  'from-pink-600 to-rose-700',
  'from-blue-600 to-indigo-700',
];

interface StaffMember {
  id: string;
  display_id: string;
  name: string;
  role: string;
  dept: string;
  email: string;
  joined: string;
  salary: number;
  status: 'active' | 'on_leave';
}

interface LeaveRequest {
  id: string;
  staff_name: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function HRPage() {
  const [tab, setTab] = useState<'staff' | 'leave' | 'payroll'>('staff');
  const [staffData, setStaffData] = useState<StaffMember[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeave, setLoadingLeave] = useState(true);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [runningPayroll, setRunningPayroll] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, email, created_at, salary, status')
      .in('role', ['staff', 'admin', 'teacher']);

    if (!error && profiles) {
      setStaffData(
        profiles.map((p, i) => ({
          id: p.id,
          display_id: p.id.split('-')[0].toUpperCase(),
          name: `${p.first_name || '—'} ${p.last_name || ''}`.trim(),
          role: p.role === 'admin' ? 'Administrator' : p.role === 'teacher' ? 'Teacher' : 'Staff',
          dept: p.role === 'admin' ? 'Operations' : 'Academics',
          email: p.email || '—',
          joined: p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—',
          salary: Number(p.salary) || 0,
          status: p.status === 'on_leave' ? 'on_leave' : 'active',
        }))
      );
    }
    setLoading(false);
  }, []);

  const fetchLeaveRequests = useCallback(async () => {
    setLoadingLeave(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, staff_name, leave_type, from_date, to_date, days, reason, status')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setLeaveRequests(data as LeaveRequest[]);
    } else {
      setLeaveRequests([]);
    }
    setLoadingLeave(false);
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchLeaveRequests();
  }, [fetchStaff, fetchLeaveRequests]);

  const updateLeaveStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status })
      .eq('id', id);

    if (error) {
      showToast('Failed to update leave status.', false);
    } else {
      showToast(status === 'approved' ? '✅ Leave approved.' : '✅ Leave rejected.');
      setLeaveRequests((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    }
  };

  const runBulkPayroll = async () => {
    if (staffData.length === 0) {
      showToast('No staff records to process payroll.', false);
      return;
    }
    setRunningPayroll(true);
    // In production, this would call your bank API / payroll provider.
    // For now, we mark all profiles as payroll_processed for current month.
    const monthKey = new Date().toISOString().slice(0, 7); // e.g. "2026-04"
    const { error } = await supabase
      .from('payroll_runs')
      .upsert({ month: monthKey, processed_count: staffData.length, total_amount: totalPayroll, status: 'processed' });

    if (error) {
      showToast('Failed to record payroll run: ' + error.message, false);
    } else {
      showToast(`🎉 Payroll processed for ${staffData.length} employees — ₹${totalPayroll.toLocaleString('en-IN')}`);
    }
    setRunningPayroll(false);
  };

  const totalPayroll = staffData.reduce((sum, s) => {
    const pf = Math.round(s.salary * 0.12);
    return sum + s.salary - pf;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">HR &amp; Payroll</h1>
          <p className="text-slate-400 text-sm mt-0.5">Staff directory, leave management, and monthly payroll</p>
        </div>
        <div className="flex gap-3">
          <button id="add-staff-btn" onClick={() => setIsStaffModalOpen(true)} className="btn-secondary text-sm py-2 px-4">+ Add Staff</button>
          <button id="run-payroll-btn" onClick={runBulkPayroll} disabled={runningPayroll || loading} className="btn-primary text-sm py-2 px-4 disabled:opacity-60">
            {runningPayroll ? '⏳ Processing...' : '💸 Run Payroll'}
          </button>
        </div>
      </div>

      {/* KPI Row — live DB counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: staffData.length.toString(), icon: '👩‍💼' },
          { label: 'On Leave', value: staffData.filter((s) => s.status === 'on_leave').length.toString(), icon: '🏖️' },
          { label: 'Pending Leaves', value: leaveRequests.filter((l) => l.status === 'pending').length.toString(), icon: '📋' },
          { label: 'Monthly Net Payroll', value: `₹${(totalPayroll / 100000).toFixed(1)}L`, icon: '💰' },
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
          {(['staff', 'leave', 'payroll'] as const).map((t) => (
            <button key={t} id={`hr-tab-${t}`} onClick={() => setTab(t)}
              className={`flex-1 py-3.5 text-sm font-semibold capitalize transition-colors ${tab === t ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
              {t === 'staff' ? '👥 Staff Directory' : t === 'leave' ? '📋 Leave Requests' : '💸 Payroll'}
            </button>
          ))}
        </div>

        {/* STAFF TAB */}
        {tab === 'staff' && (
          loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading staff directory...</p>
            </div>
          ) : staffData.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-4xl mb-3">👤</p>
              <p className="text-white font-semibold">No Staff Records Found</p>
              <p className="text-slate-400 text-sm mt-1">Add your first staff member using the &ldquo;+ Add Staff&rdquo; button.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Staff Member</th><th>Role</th><th>Dept</th><th>Email</th><th>Joined</th><th>Gross Salary</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {staffData.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {s.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{s.name}</p>
                            <p className="text-[10px] text-slate-500">{s.display_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-300 text-sm">{s.role}</td>
                      <td><span className="badge badge-purple text-[10px]">{s.dept}</span></td>
                      <td className="text-slate-400 text-xs">{s.email}</td>
                      <td className="text-slate-400 text-xs">{s.joined}</td>
                      <td className="font-semibold text-white">
                        {s.salary > 0 ? `₹${s.salary.toLocaleString('en-IN')}` : <span className="text-slate-500 text-xs">Not set</span>}
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
          )
        )}

        {/* LEAVE TAB */}
        {tab === 'leave' && (
          loadingLeave ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading leave requests...</p>
            </div>
          ) : leaveRequests.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-white font-semibold">No Leave Requests</p>
              <p className="text-slate-400 text-sm mt-1">Leave requests submitted by staff will appear here for approval.</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {leaveRequests.map((l) => (
                <div key={l.id} className="glass border border-white/[0.08] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-white">{l.staff_name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {l.leave_type} · {l.from_date} → {l.to_date} · <span className="font-semibold text-white">{l.days} day{l.days > 1 ? 's' : ''}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{l.reason}&rdquo;</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`badge ${l.status === 'approved' ? 'badge-green' : l.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                        {l.status === 'approved' ? '✓ Approved' : l.status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                      </span>
                      {l.status === 'pending' && (
                        <div className="flex gap-2">
                          <button id={`approve-${l.id}`} onClick={() => updateLeaveStatus(l.id, 'approved')} className="text-xs text-emerald-400 glass border border-emerald-500/20 rounded-lg px-3 py-1 font-bold hover:bg-emerald-500/10 transition-colors">✓ Approve</button>
                          <button id={`reject-${l.id}`} onClick={() => updateLeaveStatus(l.id, 'rejected')} className="text-xs text-red-400 glass border border-red-500/20 rounded-lg px-3 py-1 font-bold hover:bg-red-500/10 transition-colors">✗ Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* PAYROLL TAB */}
        {tab === 'payroll' && (
          loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Loading payroll data...</p>
            </div>
          ) : staffData.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-4xl mb-3">💸</p>
              <p className="text-white font-semibold">No Payroll Data</p>
              <p className="text-slate-400 text-sm mt-1">Add staff members with salary information to process payroll.</p>
            </div>
          ) : (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-400">{new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })} — {staffData.length} employees</p>
                <button id="download-payroll-btn" className="text-xs text-violet-400 font-semibold hover:text-violet-300">📥 Download Excel</button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Staff Member</th><th>Gross</th><th>PF (12%)</th><th>Net Payable</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {staffData.map((s, i) => {
                      const pf = Math.round(s.salary * 0.12);
                      const net = s.salary - pf;
                      const hasSalary = s.salary > 0;
                      return (
                        <tr key={s.id}>
                          <td className="font-semibold text-white">{s.name}</td>
                          <td>{hasSalary ? `₹${s.salary.toLocaleString('en-IN')}` : <span className="text-slate-500 text-xs">Salary not set</span>}</td>
                          <td className="text-amber-400">{hasSalary ? `-₹${pf.toLocaleString('en-IN')}` : '—'}</td>
                          <td className="font-bold text-white">{hasSalary ? `₹${net.toLocaleString('en-IN')}` : '—'}</td>
                          <td><span className={`badge ${hasSalary ? 'badge-green' : 'badge-yellow'}`}>{hasSalary ? '✓ Ready' : '⚠ Incomplete'}</span></td>
                          <td><button id={`payslip-pay-${i}`} className="text-xs text-violet-400 hover:text-violet-300 font-medium">📄 Payslip</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 glass border border-emerald-500/20 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-slate-300 font-medium">Total Net Payroll This Month</span>
                <span className="text-xl font-extrabold text-emerald-400">₹{totalPayroll.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )
        )}
      </div>

      <StaffModal isOpen={isStaffModalOpen} onClose={() => { setIsStaffModalOpen(false); fetchStaff(); }} />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
