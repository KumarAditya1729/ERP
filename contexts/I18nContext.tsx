'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import en from '@/locales/en.json';
import hi from '@/locales/hi.json';
import ta from '@/locales/ta.json';

type Locale = 'en' | 'hi' | 'ta';

const dictionaries: Record<Locale, any> = { en, hi, ta };
const SUPPORTED_LOCALES: Locale[] = ['en', 'hi', 'ta'];

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const router = useRouter();

  // Derives locale from the URL segment (e.g. /en/dashboard -> 'en')
  const getLocaleFromPath = (): Locale => {
    const segment = pathname?.split('/')[1] as Locale;
    return SUPPORTED_LOCALES.includes(segment) ? segment : 'en';
  };

  const [locale, setLocaleState] = useState<Locale>(getLocaleFromPath);

  // Sync locale state whenever the URL changes (e.g. browser back/forward)
  useEffect(() => {
    setLocaleState(getLocaleFromPath());
  }, [pathname]);

  /**
   * Changes locale by replacing the locale segment in the URL.
   * e.g. /hi/dashboard -> /en/dashboard
   */
  const setLocale = (newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    const segments = pathname?.split('/') || [];
    // Replace the locale segment (index 1 in /[locale]/...)
    if (SUPPORTED_LOCALES.includes(segments[1] as Locale)) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    router.push(segments.join('/'));
  };

  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value = dictionaries[locale];

    for (const k of keys) {
      if (value === undefined) break;
      value = value[k];
    }

    if (typeof value !== 'string') {
      // Fallback to English if key is missing in the chosen language
      let fallback = dictionaries['en'];
      for (const k of keys) {
        if (fallback === undefined) break;
        fallback = fallback[k];
      }
      value = typeof fallback === 'string' ? fallback : key; // Final fallback is the key itself
    }

    // Handle template replacements like {count}
    let stringValue = value as string;
    if (replacements) {
      for (const [rKey, rValue] of Object.entries(replacements)) {
        stringValue = stringValue.replace(`{${rKey}}`, String(rValue));
      }
    }

    return stringValue;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
