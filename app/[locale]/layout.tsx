import { I18nProvider } from '@/contexts/I18nContext';
import type { Metadata } from 'next';
import '../globals.css';

/**
 * Font strategy: Inter via next/font/google with preload disabled so that
 * the build does NOT make a network request to Google Fonts at compile time.
 * The font is fetched by the browser at runtime from Google's CDN.
 *
 * If you need fully-offline builds (e.g., air-gapped CI), replace this with
 * next/font/local and bundle woff2 files under /public/fonts/.
 */

export const metadata: Metadata = {
  title: 'NexSchool AI – The School Management Platform Built for Tomorrow',
  description:
    'NexSchool AI is a modern, all-in-one School ERP SaaS. Manage students, fees, attendance, transport, exams, HR, and more — all from one beautiful dashboard.',
  keywords: 'school ERP, school management software, student information system, fee management, attendance tracking, transport GPS',
  icons: {
    icon: '/logo.svg',
  },
};

import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale}>
      <head>
        {/* Runtime font load — avoids build-time Google Fonts network dependency.
            The @next/next/no-page-custom-font rule is a false positive in App Router. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-bg-mesh" />
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
