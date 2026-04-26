'use client';
import Image from 'next/image';

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { registerSchool } from '@/app/actions/register'
import { COMMERCIAL_PLANS, type CommercialPlanId } from '@/lib/pricing'

function RegisterForm() {
  const searchParams = useSearchParams()
  const errorMsg = searchParams?.get('error')
  const requestedTier = searchParams?.get('tier')
  const initialTier = COMMERCIAL_PLANS.some((plan) => plan.id === requestedTier) ? (requestedTier as CommercialPlanId) : 'growth'
  const [tier, setTier] = useState<CommercialPlanId>(initialTier)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)

  return (
    <div className="w-full max-w-2xl relative">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
          <Image src="/logo.svg" alt="NexSchool AI" className="w-10 h-10 object-contain" width={120} height={32} priority />
          <span className="font-bold text-2xl text-white">NexSchool <span className="gradient-text">AI</span></span>
        </Link>
        <h1 className="text-3xl font-bold text-white mb-1">Register Your School</h1>
        <p className="text-slate-400 text-sm">Each school gets its own isolated, secure workspace</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 justify-center">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step >= s ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-500'
            }`}>{s}</div>
            {s < 2 && <div className={`w-16 h-0.5 transition-all ${step > s ? 'bg-violet-600' : 'bg-white/10'}`} />}
          </div>
        ))}
        <span className="text-xs text-slate-400 ml-2">{step === 1 ? 'School Info' : 'Admin Account'}</span>
      </div>

      {errorMsg && (
        <div className="glass bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm text-center font-medium animate-fade-in">
          ⚠️ {errorMsg}
        </div>
      )}

      <form
        action={registerSchool}
        onSubmit={() => setLoading(true)}
        className="space-y-6"
      >
        {/* Step 1 — School Details */}
        <div className={step === 1 ? 'block' : 'hidden'}>
          <div className="glass border border-white/[0.08] rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-white mb-4">🏫 School Information</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">School / Institution Name</label>
              <input name="school_name" type="text" className="erp-input" placeholder="e.g., Delhi Public School" required />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">City</label>
              <input name="city" type="text" className="erp-input" placeholder="e.g., New Delhi" required />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Subscription Plan</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {COMMERCIAL_PLANS.map((plan) => (
                  <label
                    key={plan.id}
                    className={`relative cursor-pointer border rounded-xl p-4 transition-all ${
                      tier === plan.id
                        ? plan.id === 'starter'
                          ? 'bg-emerald-500/10 border-emerald-500'
                          : plan.id === 'growth'
                          ? 'bg-violet-500/10 border-violet-500'
                          : 'bg-amber-500/10 border-amber-500'
                        : 'border-white/10 hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value={plan.id}
                      checked={tier === plan.id}
                      onChange={() => setTier(plan.id)}
                      className="sr-only"
                    />
                    <p className="text-xl mb-1">{plan.icon}</p>
                    <p className="font-semibold text-white text-sm">{plan.name}</p>
                    <p className="text-xs text-slate-400">{plan.studentRangeLabel}</p>
                    <p className="text-xs text-slate-500 mt-1">{plan.registerDescription}</p>
                    <p className="text-xs font-bold text-violet-400 mt-2">{plan.priceLabel}{plan.periodLabel}</p>
                    {tier === plan.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {tier === 'enterprise' && (
              <div className="space-y-4 border-t border-white/[0.08] pt-5">
                <div>
                  <p className="text-sm font-semibold text-white">Custom Plan Details</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Share your deployment scope now. We&apos;ll prefill billing with these details so your school can pay the custom amount directly after signup.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Estimated Students</label>
                    <input
                      name="estimated_students"
                      type="number"
                      min={1}
                      className="erp-input"
                      placeholder="e.g., 3200"
                      required={tier === 'enterprise'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Branches / Campuses</label>
                    <input
                      name="branch_count"
                      type="number"
                      min={1}
                      className="erp-input"
                      placeholder="e.g., 3"
                      required={tier === 'enterprise'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Billing Email</label>
                    <input
                      name="billing_email"
                      type="email"
                      className="erp-input"
                      placeholder="accounts@myschool.edu.in"
                      required={tier === 'enterprise'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Contact Phone</label>
                    <input
                      name="contact_phone"
                      type="tel"
                      className="erp-input"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Custom Monthly Amount (INR)</label>
                  <input
                    name="custom_monthly_amount"
                    type="number"
                    min={1000}
                    step={1}
                    className="erp-input"
                    placeholder="e.g., 24999"
                    required={tier === 'enterprise'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Requirements</label>
                  <textarea
                    name="custom_requirements"
                    rows={4}
                    className="erp-input min-h-[120px] resize-y"
                    placeholder="Mention rollout timeline, custom integrations, transport GPS scale, parent app needs, reporting requirements, or deployment constraints."
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-primary w-full justify-center py-3 text-base mt-4"
          >
            Continue to Admin Account →
          </button>
        </div>

        {/* Step 2 — Admin Account */}
        <div className={step === 2 ? 'block' : 'hidden'}>
          <div className="glass border border-white/[0.08] rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setStep(1)} className="text-slate-400 hover:text-white text-sm">← Back</button>
              <h2 className="text-lg font-semibold text-white">👤 Admin Account</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">First Name</label>
                <input name="first_name" type="text" className="erp-input" placeholder="Raj" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Last Name</label>
                <input name="last_name" type="text" className="erp-input" placeholder="Sharma" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Work Email</label>
              <input name="email" type="email" className="erp-input" placeholder="principal@myschool.edu.in" required />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Password</label>
              <input name="password" type="password" className="erp-input" placeholder="Min. 8 characters" required minLength={8} />
              <p className="text-xs text-slate-500 mt-1.5">We check your password against known data breaches for your security.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3 text-base mt-4"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Setting up your school…
              </span>
            ) : (
              <>🏫 Create School Workspace</>
            )}
          </button>
        </div>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already registered?{' '}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">Sign in instead</Link>
      </p>

      <p className="text-center text-xs text-slate-600 mt-4">
        By registering you agree to our Terms of Service. Your data is encrypted and isolated per school.
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden" style={{ background: '#080C1A' }}>
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-700/15 blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-700/10 blur-[120px] pointer-events-none" />
      <Suspense fallback={<div className="text-emerald-500 relative z-10 font-bold">Loading…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  )
}
