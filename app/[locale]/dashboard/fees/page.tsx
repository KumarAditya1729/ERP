'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { calculateCompoundLateFees } from '@/lib/algorithms';
import { sendFeeReminders } from '@/app/actions/fees';
import InvoiceModal from '@/components/dashboard/InvoiceModal';

const statusCfg = {
  paid:    { badge: 'badge-green', label: 'Paid' },
  pending: { badge: 'badge-yellow', label: 'Pending' },
  overdue: { badge: 'badge-red', label: 'Overdue' },
};

export default function FeesPage() {
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [tab, setTab] = useState<'transactions' | 'structure'>('transactions');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveToast, setLiveToast] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isReminding, setIsReminding] = useState(false);
  
  // Modal state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  
  const supabase = createClient();

  const [feeStructure, setFeeStructure] = useState<any[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(true);

  const fetchFeeStructure = useCallback(async () => {
    setLoadingStructure(true);
    const { data } = await supabase.from('fee_structures').select('*');
    if (data && data.length > 0) {
      setFeeStructure(data.map(f => ({
        class: f.class_group,
        tuition: Number(f.tuition_fee),
        transport: Number(f.transport_fee),
        activity: Number(f.activity_fee),
        hostel: Number(f.hostel_fee)
      })));
    }
    setLoadingStructure(false);
  }, [supabase]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('fees').select('*, students(first_name, last_name, class_grade, section)').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setTransactions(data);
    } catch (err: any) {
      showToast('Failed to load fee records: ' + err.message, false);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFees();
    fetchFeeStructure();

    // Supabase Realtime subscription for live fee updates
    const channel = supabase.channel('live_fees_ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fees' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          fetchFees();
          setLiveToast('Ledger updated dynamically in real-time.');
          setTimeout(() => setLiveToast(null), 3000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchFees, fetchFeeStructure, supabase]);

  const handleBulkRemind = async () => {
     setIsReminding(true);
     const pendingIds = transactions.filter(t => t.status !== 'paid').map(t => t.id);
     if (pendingIds.length === 0) {
        showToast('No pending invoices to remind.', false);
        setIsReminding(false);
        return;
     }
     const res = await sendFeeReminders(pendingIds);
     if (res.success) {
        showToast(`📤 SMS dispatched to ${res.count} parents via Notice Board!`);
     } else {
        showToast('Failed to dispatch SMS', false);
     }
     setIsReminding(false);
  };

  const handleSingleRemind = async (invoiceId: string, studentName: string) => {
     setIsReminding(true);
     const res = await sendFeeReminders([invoiceId]);
     if (res.success) {
        showToast(`📤 Automated SMS Reminder sent to ${studentName}'s guardian!`);
     } else {
        showToast('Failed to dispatch SMS', false);
     }
     setIsReminding(false);
  };

  const filtered = filter === 'all' ? transactions : transactions.filter((t: any) => t.status === filter);

  const totalCollected = transactions.filter((t) => t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const totalPending   = transactions.filter((t) => t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const totalOverdue   = transactions.filter((t) => t.status === 'overdue').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Fee Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">April 2026 — Track invoices and monitor DB revenue</p>
        </div>
        <div className="flex gap-3">
          <button id="send-reminders-btn" onClick={handleBulkRemind} disabled={isReminding} className="btn-secondary text-sm py-2 px-4 disabled:opacity-50">📤 Remind All Pending</button>
          <button id="new-invoice-btn" onClick={() => setIsInvoiceModalOpen(true)} className="btn-primary text-sm py-2 px-4">+ Generate Invoice</button>
        </div>
      </div>

      {/* Realtime Action Toast */}
      {liveToast && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl flex items-center justify-between text-sm animate-fade-in shadow-lg shadow-emerald-500/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <strong>Live Sync Active:</strong> {liveToast}
          </div>
        </div>
      )}

      {/* Revenue summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass border border-emerald-500/25 bg-gradient-to-br from-emerald-600/20 to-emerald-900/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Collected</span>
            <span className="badge badge-green">✓ This Month</span>
          </div>
          <p className="text-3xl font-extrabold text-white">₹{(totalCollected / 1000).toFixed(1)}k</p>
          <p className="text-xs text-slate-500 mt-1">{transactions.filter((t) => t.status === 'paid').length} invoices paid</p>
        </div>
        <div className="glass border border-amber-500/25 bg-gradient-to-br from-amber-600/20 to-amber-900/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pending</span>
            <span className="badge badge-yellow">⏳ Awaiting</span>
          </div>
          <p className="text-3xl font-extrabold text-white">₹{(totalPending / 1000).toFixed(1)}k</p>
          <p className="text-xs text-slate-500 mt-1">{transactions.filter((t) => t.status === 'pending').length} invoices pending</p>
        </div>
        <div className="glass border border-red-500/25 bg-gradient-to-br from-red-600/20 to-red-900/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Overdue</span>
            <span className="badge badge-red">⚠️ Action Needed</span>
          </div>
          <p className="text-3xl font-extrabold text-white">₹{(totalOverdue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-slate-500 mt-1">{transactions.filter((t) => t.status === 'overdue').length} invoices overdue</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="flex border-b border-white/[0.08]">
          <button
            id="tab-transactions"
            onClick={() => setTab('transactions')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === 'transactions' ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}
          >
            Transactions
          </button>
          <button
            id="tab-fee-structure"
            onClick={() => setTab('structure')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === 'structure' ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}
          >
            Fee Structure
          </button>
        </div>

        {tab === 'transactions' && (
          <>
            {/* Filter pills */}
            <div className="px-5 py-3 flex gap-2 border-b border-white/[0.06]">
              {(['all', 'paid', 'pending', 'overdue'] as const).map((f) => (
                <button
                  key={f}
                  id={`fee-filter-${f}`}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all border ${
                    filter === f
                      ? 'bg-violet-600 text-white border-violet-500'
                      : 'glass border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? `All (${transactions.length})` : f}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
             {loading ? (
                 <div className="p-8 text-center text-slate-500">Loading invoice records...</div>
             ) : transactions.length === 0 ? (
                 <div className="p-8 text-center bg-slate-900/40">
                    <p className="text-lg font-bold text-white mb-2">No Invoices Found</p>
                    <p className="text-slate-400 text-sm">Create an invoice or trigger the seed script.</p>
                 </div>
             ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Fee Type</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const s = statusCfg[t.status as keyof typeof statusCfg];
                    const calcResult = t.status !== 'paid' 
                      ? calculateCompoundLateFees(t.amount, t.due_date) 
                      : { totalAmount: t.amount, latePenalty: 0, daysLate: 0 };
                    return (
                      <tr key={t.id}>
                        <td><span className="text-xs font-mono text-violet-400">{t.invoice_number}</span></td>
                        <td className="font-semibold text-white">{t.students?.first_name} {t.students?.last_name}</td>
                        <td><span className="badge badge-purple text-[10px]">{t.students?.class_grade}-{t.students?.section}</span></td>
                        <td className="text-slate-400">{t.title}</td>
                        <td className="font-bold text-white">
                          ₹{calcResult.totalAmount.toLocaleString('en-IN')}
                          {calcResult.latePenalty > 0 && (
                            <span className="block text-[9px] text-red-400 font-normal mt-0.5">
                              Includes ₹{calcResult.latePenalty.toLocaleString('en-IN')} penalty ({calcResult.daysLate} days late)
                            </span>
                          )}
                        </td>
                        <td className="text-slate-400 text-xs">{new Date(t.due_date).toLocaleDateString()}</td>
                        <td className="text-slate-400">{t.payment_method || '—'}</td>
                        <td><span className={`badge ${s?.badge}`}>{s?.label}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button id={`receipt-${t.id}`} className="text-xs text-violet-400 hover:text-violet-300 font-medium">
                              📄 Receipt
                            </button>
                            {t.status !== 'paid' && (
                              <button id={`remind-${t.id}`} onClick={() => handleSingleRemind(t.id, t.students?.first_name)} disabled={isReminding} className="text-xs text-amber-400 hover:text-amber-300 font-medium disabled:opacity-50">
                                📤 Remind
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
             )}
            </div>
          </>
        )}

        {tab === 'structure' && (
          <div className="p-6">
            <p className="text-sm text-slate-400 mb-5">Monthly fee structure per student. All amounts in ₹.</p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class Group</th>
                    <th>Tuition Fee</th>
                    <th>Transport</th>
                    <th>Activity</th>
                    <th>Hostel</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {feeStructure.map((f) => (
                    <tr key={f.class}>
                      <td className="font-semibold text-white">{f.class}</td>
                      <td>₹{f.tuition.toLocaleString('en-IN')}</td>
                      <td>₹{f.transport.toLocaleString('en-IN')}</td>
                      <td>₹{f.activity.toLocaleString('en-IN')}</td>
                      <td>₹{f.hostel.toLocaleString('en-IN')}</td>
                      <td className="font-bold text-violet-400">
                        ₹{(f.tuition + f.transport + f.activity + f.hostel).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button id="edit-fee-structure-btn" className="btn-secondary text-sm py-2 px-4 mt-5">✏️ Edit Fee Structure</button>
          </div>
        )}
      </div>

      <InvoiceModal isOpen={isInvoiceModalOpen} onClose={() => { setIsInvoiceModalOpen(false); fetchFees(); }} />
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
