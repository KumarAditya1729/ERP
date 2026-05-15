'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { recordOfflinePayment } from '@/app/actions/fees';
import { generateAndUploadInvoicePdf, getReceiptPdfDownloadUrl } from '@/app/actions/feesPdf';
import { useParams, useRouter } from 'next/navigation';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const supabase = createClient();
  const invoiceId = params.id as string;

  useEffect(() => {
    if (invoiceId) fetchData();
  }, [invoiceId]);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tenantId = user.app_metadata?.tenant_id;

    const [invRes, itemsRes, payRes] = await Promise.all([
      supabase.from('fee_invoices').select('*, students(*)').eq('id', invoiceId).eq('tenant_id', tenantId).single(),
      supabase.from('fee_invoice_items').select('*, fee_categories(name)').eq('invoice_id', invoiceId).eq('tenant_id', tenantId),
      supabase.from('fee_payments').select('*, fee_receipts(*)').eq('invoice_id', invoiceId).eq('tenant_id', tenantId).order('created_at', { ascending: false })
    ]);

    if (invRes.data) setInvoice(invRes.data);
    if (itemsRes.data) setItems(itemsRes.data);
    if (payRes.data) setPayments(payRes.data);
    setLoading(false);
  }

  async function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const formData = new FormData(e.currentTarget);
    formData.append('invoice_id', invoiceId);
    
    const res = await recordOfflinePayment(formData);
    
    setIsSubmitting(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Payment recorded successfully!');
      (e.target as HTMLFormElement).reset();
      fetchData(); // reload
    }
  }

  if (loading) return <div className="p-12 text-center text-slate-400">Loading invoice details...</div>;
  if (!invoice) return <div className="p-12 text-center text-red-400">Invoice not found.</div>;

  return (
    <div className="space-y-6 animate-fade-in p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-white">
          &larr; Back to Invoices
        </button>
        <button 
          onClick={async () => {
             const res = await generateAndUploadInvoicePdf(invoice.id);
             if (res.success) window.open(res.url, '_blank');
          }} 
          className="text-xs bg-violet-500/20 text-violet-400 border border-violet-500/30 px-3 py-1.5 rounded hover:bg-violet-500/30 transition-colors"
        >
          📄 Download Invoice PDF
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Invoice Summary */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/[0.08]">
            <div className="flex justify-between items-start mb-6 border-b border-white/[0.08] pb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">Invoice</h1>
                <p className="text-violet-400 font-mono">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  invoice.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 
                  invoice.status === 'partially_paid' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {invoice.status.replace('_', ' ')}
                </span>
                <p className="text-xs text-slate-400 mt-2">Issued: {new Date(invoice.issued_at).toLocaleDateString()}</p>
                <p className="text-xs text-slate-400">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Billed To:</p>
              <p className="text-lg font-bold text-white">{invoice.students?.first_name} {invoice.students?.last_name}</p>
              <p className="text-sm text-slate-300">Class: {invoice.students?.class_grade}-{invoice.students?.section}</p>
            </div>

            <table className="w-full text-left text-sm mb-6">
              <thead className="border-b border-white/[0.08]">
                <tr>
                  <th className="pb-2 text-slate-400 font-medium">Description</th>
                  <th className="pb-2 text-slate-400 font-medium text-right">Amount</th>
                  <th className="pb-2 text-slate-400 font-medium text-right">Discount</th>
                  <th className="pb-2 text-slate-400 font-medium text-right">Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="py-3 text-white">{item.description}</td>
                    <td className="py-3 text-right text-slate-300">₹{item.amount.toLocaleString()}</td>
                    <td className="py-3 text-right text-slate-300">₹{item.discount_amount.toLocaleString()}</td>
                    <td className="py-3 text-right font-bold text-white">₹{item.final_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-4 border-t border-white/[0.08]">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>₹{invoice.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Discount</span>
                  <span>-₹{invoice.discount_total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/[0.08]">
                  <span>Total</span>
                  <span>₹{invoice.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Paid</span>
                  <span>-₹{invoice.paid_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-bold text-xl pt-2 border-t border-white/[0.08]">
                  <span>Balance Due</span>
                  <span>₹{invoice.balance_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="glass p-6 rounded-2xl border border-white/[0.08]">
              <h2 className="font-bold text-white mb-4">Payment History</h2>
              <div className="space-y-3">
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <p className="font-bold text-emerald-400">₹{p.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{new Date(p.created_at).toLocaleString()} • {p.payment_method.toUpperCase()}</p>
                      {p.reference_number && <p className="text-xs text-slate-500 font-mono mt-0.5">Ref: {p.reference_number}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded mb-1 inline-block">{p.payment_status}</span>
                      {p.fee_receipts && p.fee_receipts[0] && (
                        <button 
                          onClick={async () => {
                            try {
                               const res = await getReceiptPdfDownloadUrl(p.fee_receipts[0].id, p.fee_receipts[0].receipt_url);
                               if (res.success) window.open(res.url, '_blank');
                            } catch(err) { alert('Receipt not yet generated or available.'); }
                          }}
                          className="text-xs text-violet-400 hover:text-white transition-colors underline font-mono block mt-1"
                        >
                          RCPT: {p.fee_receipts[0].receipt_number}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass p-6 rounded-2xl border border-white/[0.08]">
            <h2 className="font-bold text-white mb-4">Record Offline Payment</h2>
            
            {invoice.balance_amount <= 0 ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                <p className="text-emerald-400 font-bold text-lg">Fully Paid</p>
                <p className="text-slate-400 text-xs mt-1">No balance remaining.</p>
              </div>
            ) : (
              <form onSubmit={handlePayment} className="space-y-4">
                {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
                {success && <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">{success}</div>}
                
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Amount to Collect (₹) *</label>
                  <input name="amount" type="number" max={invoice.balance_amount} required defaultValue={invoice.balance_amount} className="erp-input w-full text-sm font-bold text-emerald-400" />
                  <p className="text-[10px] text-slate-500 mt-1">Max: ₹{invoice.balance_amount}</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Payment Method *</label>
                  <select name="payment_method" required className="erp-input w-full text-sm">
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Reference # (Optional)</label>
                  <input name="reference_number" placeholder="Cheque # / UTR" className="erp-input w-full text-sm" />
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20">
                  {isSubmitting ? 'Processing...' : 'Record Payment'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
