'use client';
import { useState } from 'react';
import Script from 'next/script';

interface RazorpayCheckoutProps {
  planId: string;
  planName: string;
  amount: number;
  buttonClass?: string;
  onSuccess?: () => void;
}

export default function RazorpayCheckout({ planId, planName, amount, buttonClass, onSuccess }: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);

  const initializeRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setLoading(true);
    const res = await initializeRazorpay();

    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      setLoading(false);
      return;
    }

    try {
      // 1. Create Order via our Backend API
      const result = await fetch('/api/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, plan: planId }),
      });

      if (!result.ok) throw new Error('Network response was not ok');
      const { order } = await result.json();

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mocked_id', 
        amount: order.amount,
        currency: order.currency,
        name: 'NexSchool AI',
        description: `Upgrade to ${planName} Plan`,
        image: 'https://cdn-icons-png.flaticon.com/512/3227/3227282.png',
        order_id: order.id,
        handler: async function (response: any) {
           // 3. Verify Payment Signature Backend
           const verification = await fetch('/api/razorpay', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 razorpay_order_id: response.razorpay_order_id,
                 razorpay_payment_id: response.razorpay_payment_id,
                 razorpay_signature: response.razorpay_signature,
              })
           });
           
           if (verification.ok) {
              alert(`Success! Upgraded school to ${planName}`);
              if(onSuccess) onSuccess();
           } else {
              alert('Payment Verification Failed!');
           }
        },
        prefill: {
          name: 'School Admin',
          email: 'admin@school.edu.in',
          contact: '9999999999',
        },
        theme: {
          color: '#7c3aed', // Matches EduSync violet-600
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on('payment.failed', function (response: any) {
        console.error(response.error);
        alert(response.error.description);
      });
      paymentObject.open();

    } catch (e: any) {
      alert('Payment Failed to Initiate: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className={buttonClass || 'btn-primary w-full py-3 mt-8 bg-white text-indigo-950 hover:bg-slate-100 font-bold'}
      style={{ opacity: loading ? 0.7 : 1 }}
    >
      {loading ? 'Processing...' : `Upgrade to ${planName} — ₹${amount}`}
    </button>
  );
}
