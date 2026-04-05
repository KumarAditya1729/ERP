'use client';
import { useState } from 'react';

interface PayNowButtonProps {
  feeId: string;
  amount: number;
  title: string;
  studentName: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PayNowButton({ feeId, amount, title, studentName }: PayNowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Create Razorpay order on server
      const res = await fetch('/api/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, plan: title }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      const { order } = data;
      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!keyId || keyId.startsWith('YOUR_')) {
        throw new Error('Payment gateway is not configured. Please contact school admin.');
      }

      // 2. Load Razorpay script dynamically
      await loadRazorpayScript();

      // 3. Open Razorpay Checkout
      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'NexSchool ERP',
        description: `Fee: ${title} — ${studentName}`,
        order_id: order.id,
        handler: async (response: any) => {
          // 4. Verify payment server-side
          const verifyRes = await fetch('/api/razorpay', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            // Payment verified — webhook will update DB status automatically
            alert(`✅ Payment successful! Receipt: ${response.razorpay_payment_id}`);
            window.location.reload();
          } else {
            setError(verifyData.error || 'Payment verification failed');
          }
        },
        prefill: {
          name: studentName,
        },
        theme: {
          color: '#7C3AED',
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      rzp.open();

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      {error && (
        <p className="text-red-400 text-xs mb-2">{error}</p>
      )}
      <button
        onClick={handlePayment}
        disabled={loading}
        className="mt-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold py-2 px-5 rounded-full transition-colors shadow-lg shadow-red-600/30"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </button>
    </div>
  );
}

async function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return; // Already loaded
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}
