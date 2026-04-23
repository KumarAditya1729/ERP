'use client';
import Image from 'next/image';
import { useState } from 'react';
import Link from 'next/link';

import LanguageSwitcher from '@/components/dashboard/LanguageSwitcher';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy-900/40 backdrop-blur-md border-b border-white/[0.06] transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-violet-500 rounded-full blur opacity-40 group-hover:opacity-70 transition-opacity"></div>
            <Image src="/logo.svg" alt="NexSchool AI Logo" className="w-9 h-9 object-contain relative z-10" width={120} height={32} priority />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">
            NexSchool <span className="gradient-text">AI</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8 bg-white/[0.02] px-6 py-2 rounded-full border border-white/[0.05]">
          {['Features', 'Pricing', 'Modules', 'About'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA Buttons & Language Switcher */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/login" className="btn-secondary text-sm py-2 px-4 hover:bg-white/[0.08]">
            Sign In
          </Link>
          <Link href="/login" className="btn-primary text-sm py-2 px-4 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]">
            Get Started Free
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button
          id="mobile-menu-btn"
          className="md:hidden text-slate-400 hover:text-white"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden glass-strong border-t border-white/[0.06] px-6 py-4 flex flex-col gap-4">
          {['Features', 'Pricing', 'Modules', 'About'].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-sm font-medium text-slate-300"
              onClick={() => setOpen(false)}
            >
              {item}
            </a>
          ))}
          <Link href="/login" className="btn-primary text-sm justify-center mt-2">
            Get Started Free
          </Link>
        </div>
      )}
    </nav>
  );
}
