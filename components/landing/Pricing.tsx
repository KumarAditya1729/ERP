'use client';
import Link from 'next/link';
import { COMMERCIAL_PLANS } from '@/lib/pricing';

export default function Pricing() {
  return (
    <section id="pricing" className="py-28 relative">
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-cyan-700/10 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="badge badge-blue text-xs mb-4">Transparent School Pricing</span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5">
            Plans that fit your
            <span className="gradient-text"> current campus size</span>
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Start with the tier that fits your school today, then upgrade as enrollment and operations grow.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {COMMERCIAL_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative glass rounded-3xl p-8 border ${plan.highlight ? 'border-violet-500/50 glow-violet scale-[1.03]' : 'border-white/10'} flex flex-col card-hover`}
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
                  <p className="text-4xl font-extrabold gradient-text">{plan.priceLabel}</p>
                  {plan.periodLabel && <span className="text-slate-400 text-sm mb-1">{plan.periodLabel}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">{plan.studentRangeLabel}</p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.marketingFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
                {plan.missingFeatures?.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-slate-700 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.monthlyPriceInr === null ? 'mailto:sales@nexschool.ai' : `/register?tier=${plan.id}`}
                className={plan.highlight ? 'btn-primary justify-center w-full text-center' : 'btn-secondary justify-center w-full text-center'}
              >
                {plan.ctaLabel}
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-slate-500 text-sm mt-10">
          All prices in INR + GST. Starter and Growth are billed monthly. Enterprise pricing is custom.
        </p>
      </div>
    </section>
  );
}
