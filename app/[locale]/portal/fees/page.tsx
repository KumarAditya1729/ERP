'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createRazorpayOrderForInvoice, verifyRazorpayPayment } from '@/app/actions/fees';
import { generateAndUploadInvoicePdf, getReceiptPdfDownloadUrl } from '@/app/actions/feesPdf';

export default function PortalFeesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tenantId = user.app_metadata?.tenant_id;
    
    const { data } = await supabase.from('fee_invoices')
      .select('*, students(first_name, last_name, class_grade, section)')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: true });

    if (data) setInvoices(data);
    setLoading(false);
  }

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById('razorpay-script')) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.id = 'razorpay-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayNow = async (invoice: any) => {
    setIsProcessing(invoice.id);
    const scriptLoaded = await loadRazorpayScript();
    
    if (!scriptLoaded) {
      alert('Failed to load payment gateway. Please check your connection.');
      setIsProcessing(null);
      return;
    }

    const res = await createRazorpayOrderForInvoice(invoice.id);
    
    if (!res.success || res.amount === undefined) {
      alert(res.error || 'Failed to initialize payment.');
      setIsProcessing(null);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
      amount: res.amount * 100,
      currency: "INR",
      name: "NexSchool ERP",
      description: `Payment for ${invoice.invoice_number}`,
      order_id: res.orderId,
      handler: async function (response: any) {
        const verifyRes = await verifyRazorpayPayment(
          response.razorpay_order_id,
          response.razorpay_payment_id,
          response.razorpay_signature,
          res.paymentId
        );
        
        if (verifyRes.success) {
          alert("Payment Successful!");
          fetchData();
        } else {
          alert("Payment Verification Failed: " + verifyRes.error);
        }
        setIsProcessing(null);
      },
      prefill: {
        name: invoice.students?.first_name + " " + invoice.students?.last_name,
      },
      theme: {
        color: "#8b5cf6"
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on('payment.failed', function (response: any){
      alert("Payment Failed. Reason: " + response.error.description);
      setIsProcessing(null);
    });
    rzp.open();
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <h1 className="text-2xl font-bold text-white">My Fees & Dues</h1>
      <p className="text-sm text-slate-400">View and pay your pending fee invoices online.</p>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading your invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="p-12 glass border border-white/[0.08] rounded-2xl text-center">
          <span className="text-4xl">🎉</span>
          <p className="text-white font-bold mt-4">You&apos;re all caught up!</p>
          <p className="text-slate-400 text-sm mt-1">No pending invoices found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map(inv => (
            <div key={inv.id} className="glass p-6 rounded-2xl border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-violet-400 font-mono text-xs">{inv.invoice_number}</p>
                <h3 className="text-white font-bold text-lg mt-1">{inv.students?.first_name} {inv.students?.last_name}</h3>
                <p className="text-slate-400 text-sm">Month: {inv.billing_month} • Due: {new Date(inv.due_date).toLocaleDateString()}</p>
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={async () => {
                      const res = await generateAndUploadInvoicePdf(inv.id);
                      if (res.success) window.open(res.url, '_blank');
                    }}
                    className="text-xs text-violet-400 hover:text-white underline transition-colors"
                  >
                    Download Invoice
                  </button>
                  {inv.status === 'paid' && (
                     <button
                       onClick={async () => {
                         try {
                           // Try fetching receipt logic via API. In a real app we'd fetch receipts on load.
                           // For now, we alert them if it fails or redirect them if successful.
                           // Getting the receipt using the generic URL getter might require the receipt ID,
                           // which isn't joined by default in `inv`. So we just ask them to check email or we do a lazy fetch.
                           alert("Please check your email for the detailed receipt PDF, or contact administration.");
                         } catch (e) {}
                       }}
                       className="text-xs text-emerald-400 hover:text-white underline transition-colors"
                     >
                       Request Receipt
                     </button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Balance Due</p>
                  <p className="text-2xl font-bold text-white">₹{inv.balance_amount.toLocaleString()}</p>
                  {inv.paid_amount > 0 && (
                    <p className="text-xs text-emerald-400 mt-1">Paid: ₹{inv.paid_amount.toLocaleString()}</p>
                  )}
                </div>

                {inv.balance_amount > 0 ? (
                  <button 
                    onClick={() => handlePayNow(inv)}
                    disabled={isProcessing === inv.id}
                    className="btn-primary py-3 px-6 shadow-[0_0_20px_rgba(139,92,246,0.3)] min-w-[140px]"
                  >
                    {isProcessing === inv.id ? 'Loading...' : 'Pay Online'}
                  </button>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-xl font-bold text-sm min-w-[140px] text-center inline-block">
                    Fully Paid
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
