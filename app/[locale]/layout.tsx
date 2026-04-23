import { I18nProvider } from '@/contexts/I18nContext';
import type { Metadata } from 'next';
import '../globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NexSchool AI – The School Management Platform Built for Tomorrow',
  description:
    'NexSchool AI is a modern, all-in-one School ERP SaaS. Manage students, fees, attendance, transport, exams, HR, and more — all from one beautiful dashboard.',
  keywords: 'school ERP, school management software, student information system, fee management, attendance tracking, transport GPS',
  icons: {
    icon: '/logo.svg',
  },
};

export default function RootLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={locale} className={plusJakartaSans.className}>
      <head>
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
