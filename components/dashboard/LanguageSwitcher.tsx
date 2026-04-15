'use client';

import { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
    { code: 'ta', label: 'தமிழ்', flag: '🛕' },
  ] as const;

  const current = languages.find((l) => l.code === locale) ?? languages[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 h-9 px-3 glass border border-white/[0.08] rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:border-white/20 transition-all"
        title="Change Language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-sm">{current.flag}</span>
        <span className="hidden sm:inline-block uppercase tracking-wider">{current.code}</span>
        <svg
          className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div
            role="listbox"
            className="absolute right-0 mt-2 w-36 glass-strong border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in origin-top-right"
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                role="option"
                aria-selected={locale === lang.code}
                onClick={() => {
                  setLocale(lang.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left transition-colors ${
                  locale === lang.code
                    ? 'bg-violet-500/20 text-white font-bold'
                    : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                {lang.label}
                {locale === lang.code && (
                  <svg className="w-3 h-3 ml-auto text-violet-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
