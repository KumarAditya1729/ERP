'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: '🌱',
    price: 2999,
    priceLabel: '₹2,999',
    period: '/month',
    students: 'Up to 300 students',
    color: 'emerald',
    features: ['Student Information System', 'Attendance Tracking', 'Fee Management', 'Parent Portal', 'Email Support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    icon: '🚀',
    price: 7999,
    priceLabel: '₹7,999',
    period: '/month',
    students: 'Up to 1,500 students',
    color: 'violet',
    popular: true,
    features: ['Everything in Starter', 'Admission Pipeline', 'Transport & Hostel', 'Homework & Grading', 'Bulk SMS/WhatsApp', 'Priority Support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '🏛️',
    price: 0,
    priceLabel: 'Custom',
    period: '',
    students: 'Unlimited students',
    color: 'amber',
    features: ['Everything in Growth', 'Custom Integrations', 'Dedicated Account Manager', 'On-premise option', 'SLA Guarantee', 'Custom Training'],
  },
];

export default function BillingPage() {
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payLoading, setPayLoading] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const supabase = createClient();

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('tenants')
        .select('id, name, subscription_status, subscription_tier, trial_ends_at, paid_until')
        .eq('id', user.app_metadata?.tenant_id)
        .single();
      setTenant(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const initializeRazorpay = (): Promise<boolean> =>
    new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleSubscribe = async (plan: typeof PLANS[0]) => {
    if (plan.price === 0) {
      window.location.href = 'mailto:sales@nexschool.ai?subject=Enterprise Inquiry';
      return;
    }

    setPayLoading(plan.id);
    const loaded = await initializeRazorpay();
    if (!loaded) { showToast('Failed to load payment gateway. Check your connection.', false); setPayLoading(''); return; }

    try {
      const res = await fetch('/api/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: plan.price, plan: plan.id }),
      });
      const { order, error: orderError } = await res.json();
      if (orderError || !order) throw new Error(orderError || 'Failed to create order');

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'NexSchool AI',
        description: `${plan.name} Plan — Monthly Subscription`,
        image: '/logo.svg',
        order_id: order.id,
        handler: async (response: any) => {
          // Verify + activate subscription
          const verifyRes = await fetch('/api/razorpay', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              tenant_id: tenant?.id,
              plan: plan.id,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            showToast(`🎉 Payment successful! ${plan.name} plan activated.`);
            setTimeout(() => window.location.href = '/dashboard', 2000);
          } else {
            showToast('Payment verification failed: ' + verifyData.error, false);
          }
        },
        prefill: { name: tenant?.name || 'School Admin', email: '' },
        notes: { tenant_id: tenant?.id, plan: plan.id },
        theme: { color: '#7c3aed' },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (e: any) => { showToast('Payment failed: ' + e.error.description, false); });
      rzp.open();
    } catch (e: any) {
      showToast('Error: ' + e.message, false);
    } finally {
      setPayLoading('');
    }
  };

  const daysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86400000))
    : 0;

  const isActive = tenant?.subscription_status === 'active';
  const isPastDue = tenant?.subscription_status === 'past_due';
  const isTrial = tenant?.subscription_status === 'trial';

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#080C1A' }}>
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-700/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-700/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="NexSchool AI" className="w-8 h-8" onError={e => (e.currentTarget.style.display = 'none')} />
          <span className="font-bold text-lg text-white">NexSchool <span className="gradient-text">AI</span></span>
        </Link>
        {isActive && (
          <Link href="/dashboard" className="btn-primary py-2 px-4 text-sm">Go to Dashboard →</Link>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        {/* Status banner */}
        {loading ? null : (
          <div className={`mb-10 p-4 rounded-2xl border text-center ${
            isActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            isPastDue ? 'bg-red-500/10 border-red-500/30 text-red-400' :
            'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {isActive && <p className="font-semibold">✅ You&apos;re on the <span className="capitalize">{tenant?.subscription_tier}</span> plan — active until {new Date(tenant?.paid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
            {isTrial && <p className="font-semibold">⏳ Free trial — <span className="font-bold">{daysLeft} days remaining</span> for <span className="font-bold">{tenant?.name}</span>. Upgrade to keep full access.</p>}
            {isPastDue && <p className="font-semibold">⚠️ Your subscription has lapsed. Renew immediately to restore full access.</p>}
          </div>
        )}

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            {isActive ? 'Manage Your Subscription' : 'Choose Your Plan'}
          </h1>
          <p className="text-slate-400">
            {isActive ? 'Upgrade or change your current plan.' : 'Transparent pricing. Cancel anytime. Your data stays yours.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`glass rounded-2xl p-6 flex flex-col transition-all relative ${
                plan.popular
                  ? 'border-2 border-violet-500/60 shadow-lg shadow-violet-900/30'
                  : 'border border-white/[0.08]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>
                </div>
              )}
              <div className="text-4xl mb-3">{plan.icon}</div>
              <h2 className="text-xl font-bold text-white mb-1">{plan.name}</h2>
              <p className="text-slate-500 text-sm mb-4">{plan.students}</p>
              <div className="mb-6">
                <span className="text-3xl font-bold text-white">{plan.priceLabel}</span>
                <span className="text-slate-400 text-sm">{plan.period}</span>
              </div>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={payLoading === plan.id || (isActive && tenant?.subscription_tier === plan.id)}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  isActive && tenant?.subscription_tier === plan.id
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                    : plan.popular
                    ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/30'
                    : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                }`}
              >
                {payLoading === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Initiating Payment…
                  </span>
                ) : isActive && tenant?.subscription_tier === plan.id ? '✓ Current Plan' :
                   plan.price === 0 ? 'Contact Sales' : `Subscribe — ${plan.priceLabel}/mo`}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center text-xs text-slate-600">
          Payments secured by Razorpay · PCI DSS Compliant · 256-bit encryption · Cancel anytime
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl animate-fade-in ${
          toast.ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
