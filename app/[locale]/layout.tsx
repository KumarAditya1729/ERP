import type { Metadata } from 'next';
import '../globals.css';

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
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
