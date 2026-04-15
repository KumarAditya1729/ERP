import 'server-only';
import type { Locale } from '@/i18n.config';

const dictionaries = {
  en: () => import('@/locales/en.json').then((m) => m.default),
  hi: () => import('@/locales/hi.json').then((m) => m.default),
  ta: () => import('@/locales/ta.json').then((m) => m.default),
};

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]?.() ?? dictionaries.en();
};
