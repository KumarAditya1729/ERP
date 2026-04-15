'use client';

import Link from 'next/link';
import { ComponentProps } from 'react';
import { useI18n } from '@/contexts/I18nContext';

type LocalizedLinkProps = ComponentProps<typeof Link> & {
  href: string; 
};

export default function LocalizedLink({ href, ...props }: LocalizedLinkProps) {
  const { locale } = useI18n();

  // Protect against absolute URLs or anchor tags
  const isAbsolute = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#');
  
  // Prevent double-prefixing
  const hasLocale = href.startsWith(`/${locale}`) || href === `/${locale}`;

  // Prefix the locale natively so Next.js App Router client-side prefetching works properly
  const localizedHref = (isAbsolute || hasLocale) ? href : `/${locale}${href.startsWith('/') ? href : `/${href}`}`;

  return <Link href={localizedHref} {...props} />;
}
