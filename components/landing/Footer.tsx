'use client';
import Link from 'next/link';

export default function Footer() {
  const links = {
    Product: ['Features', 'Pricing', 'Changelog', 'Roadmap'],
    Modules: ['Student SIS', 'Fee Management', 'Transport GPS', 'Examinations', 'HR & Payroll'],
    Company: ['About Us', 'Blog', 'Careers', 'Press Kit'],
    Support: ['Documentation', 'Help Center', 'Status Page', 'Contact Us'],
  };

  return (
    <footer className="border-t border-white/[0.06] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* CTA Banner */}
        <div className="glass border border-violet-500/30 rounded-3xl p-10 mb-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 animated-gradient opacity-10" />
          <div className="relative">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to Modernise Your School?
            </h2>
            <p className="text-slate-400 mb-8 text-lg max-w-xl mx-auto">
              Join 500+ schools already running on NexSchool AI. Start your free 30-day trial today.
              No credit card, no commitment.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/login" id="footer-cta-btn" className="btn-primary text-base px-8 py-3">
                Start Free Trial
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                </svg>
              </Link>
              <a href="tel:+918800000000" className="btn-secondary text-base px-8 py-3">
                📞 Talk to Sales
              </a>
            </div>
          </div>
        </div>

        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo.svg" alt="NexSchool AI Logo" className="w-8 h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="font-bold text-lg text-white">
                NexSchool <span className="gradient-text">AI</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              The modern school management platform built for tomorrow&apos;s institutions.
            </p>
          </div>

          {/* Link groups */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{group}</h4>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors duration-150">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/[0.05] pt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © 2026 NexSchool Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((t) => (
              <a key={t} href="#" className="text-xs text-slate-600 hover:text-slate-300 transition-colors">
                {t}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
