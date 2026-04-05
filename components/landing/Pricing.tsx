'use client';
import { useState } from 'react';
import Link from 'next/link';
import RazorpayCheckout from '../RazorpayCheckout';

const plans = [
  {
    name: 'Basic Plan',
    tagline: 'For small/budget schools',
    price: 60,
    interval: '/student/yr',
    students: 'Attendance, Fees & Basic Reports',
    color: 'border-white/10',
    badge: null,
    features: [
      'Student Information System',
      'Daily Attendance (Student)',
      'Fee Management + Razorpay',
      'Basic Reports & Exports',
      'Email Support (48hr)',
    ],
    missing: ['Parent App', 'Transport GPS', 'Exam & Report Cards', 'HR & Payroll', 'Custom Branding'],
    cta: 'Start Free Trial',
    highlight: false,
  },
  {
    name: 'Growth Plan',
    tagline: 'Your Core Product',
    price: 100,
    interval: '/student/yr',
    students: 'Everything you need to run a school',
    color: 'border-violet-500/50',
    badge: '⭐ Most Popular',
    features: [
      'Everything in Basic',
      'Dedicated Parent App',
      'Exam & Report Cards',
      'Homework Module',
      'Transport Module + GPS',
      'Automated Notifications',
      'Priority Support (12hr)',
    ],
    missing: ['AI Predictive Analytics', 'Custom Branding'],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Premium Plan',
    tagline: 'For top schools',
    price: 150,
    interval: '/student/yr',
    students: 'AI & Advanced Automation',
    color: 'border-cyan-500/30',
    badge: null,
    features: [
      'Everything in Growth',
      'AI Voice Grading & Marks',
      'Advanced Predictive Analytics',
      'White-label Custom Branding',
      'Dedicated Account Manager',
      'SLA-backed 24/7 Support',
      'On-premise option available',
    ],
    missing: [],
    cta: 'Contact Sales',
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-28 relative">
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-cyan-700/10 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="badge badge-blue text-xs mb-4">Transparent Scale Pricing</span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5">
            Premium capability,
            <span className="gradient-text"> affordable scale</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            The standard ERP architecture is broken. Stop paying massive flat fees, pay only for the students you serve.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative glass rounded-3xl p-8 border ${plan.color} flex flex-col ${plan.highlight ? 'glow-violet scale-[1.03]' : ''} card-hover`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="badge badge-purple text-xs py-1 px-4 whitespace-nowrap">{plan.badge}</span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-400">{plan.tagline}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <p className="text-4xl font-extrabold gradient-text">
                    ₹{plan.price}
                  </p>
                  <span className="text-slate-400 text-sm mb-1">{plan.interval}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{plan.students}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
                {plan.missing.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.name === 'Growth Plan' ? (
                 <RazorpayCheckout 
                    planId={plan.name.toLowerCase()}
                    planName={plan.name}
                    amount={plan.price}
                    buttonClass={plan.highlight ? 'btn-primary justify-center w-full' : 'btn-secondary justify-center w-full'}
                 />
              ) : (
                <Link
                  href="/login"
                  id={`pricing-cta-${plan.name.toLowerCase()}`}
                  className={plan.highlight ? 'btn-primary justify-center w-full text-center' : 'btn-secondary justify-center w-full text-center'}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-slate-500 text-sm mt-10">
          All prices in INR + GST. Billed annually per student. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
