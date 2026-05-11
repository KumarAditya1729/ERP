import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — NexSchool AI',
  description: 'How NexSchool AI collects, uses, and protects your data. DPDP Act 2023 aligned.',
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'privacy@nexschool.in';
const COMPANY_NAME = 'NexSchool AI Technologies Pvt. Ltd.';
const EFFECTIVE_DATE = '11 May 2025';

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-gray-500">Effective Date: {EFFECTIVE_DATE} · Last Updated: {EFFECTIVE_DATE}</p>

      <p>
        {COMPANY_NAME} (&ldquo;NexSchool AI&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the NexSchool AI School ERP
        platform (&ldquo;Platform&rdquo;). This Privacy Policy explains how we collect, use, store, and
        protect personal data in accordance with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong> and
        applicable Indian law.
      </p>

      <hr />

      <h2>1. Who This Policy Applies To</h2>
      <p>This policy applies to:</p>
      <ul>
        <li><strong>School Administrators</strong> who register a school on the Platform.</li>
        <li><strong>Teachers, Staff, and Wardens</strong> who use the Platform under a school account.</li>
        <li><strong>Parents and Guardians</strong> who access the parent portal.</li>
        <li><strong>Students</strong> whose records are managed by their school on the Platform.</li>
      </ul>

      <h2>2. Data We Collect</h2>
      <h3>Account &amp; School Data</h3>
      <ul>
        <li>School name, address, city, contact email</li>
        <li>Admin name, email address, password (hashed — never stored in plaintext)</li>
        <li>Subscription plan, billing records (no card numbers stored — Razorpay handles PCI DSS)</li>
      </ul>
      <h3>Student &amp; Guardian Data</h3>
      <ul>
        <li>Student full name, date of birth, class, section, roll number, admission number</li>
        <li>Guardian name, phone number, email (optional), address (optional)</li>
        <li>Attendance records, exam marks, fee payment status</li>
      </ul>
      <h3>Usage Data</h3>
      <ul>
        <li>Log data, IP address, browser type, pages visited (for security and diagnostics only)</li>
        <li>Error reports sent to Sentry (a third-party error monitoring service)</li>
      </ul>

      <h2>3. Why We Collect Data (Lawful Purpose)</h2>
      <ul>
        <li>To deliver the school management services purchased by the school</li>
        <li>To enable fee collection via Razorpay</li>
        <li>To send attendance SMS alerts and fee reminders via Twilio</li>
        <li>To send transactional emails via Resend</li>
        <li>To monitor platform health and resolve errors</li>
        <li>To comply with legal obligations</li>
      </ul>
      <p>We do <strong>not</strong> sell, rent, or share personal data for advertising purposes.</p>

      <h2>4. Data Ownership</h2>
      <p>
        <strong>The school (tenant) owns all student, guardian, and staff data</strong> entered into the Platform.
        NexSchool AI is a data processor; the school is the data fiduciary under the DPDP Act.
        We process data only on the school&apos;s instructions (the Platform features).
      </p>

      <h2>5. Data Retention</h2>
      <ul>
        <li>Active school data is retained for the duration of the subscription.</li>
        <li>After subscription cancellation, data is retained for <strong>30 days</strong> to allow export.</li>
        <li>After 30 days, data is permanently and irreversibly deleted.</li>
        <li>Backup data may persist in encrypted storage for up to <strong>90 days</strong> before purge.</li>
      </ul>

      <h2>6. Your Rights (DPDP Act 2023)</h2>
      <ul>
        <li><strong>Right to access</strong>: Request a copy of your personal data</li>
        <li><strong>Right to correction</strong>: Request correction of inaccurate data</li>
        <li><strong>Right to erasure</strong>: Request deletion of your personal data</li>
        <li><strong>Right to grievance redressal</strong>: File a complaint with our Data Protection Officer</li>
      </ul>
      <p>To exercise your rights, email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>

      <h2>7. Sub-Processors</h2>
      <table>
        <thead><tr><th>Provider</th><th>Purpose</th><th>Data Shared</th></tr></thead>
        <tbody>
          <tr><td>Supabase (USA)</td><td>Database &amp; authentication</td><td>All platform data</td></tr>
          <tr><td>Vercel (USA)</td><td>Hosting &amp; CDN</td><td>Request logs, IP</td></tr>
          <tr><td>Razorpay (India)</td><td>Payment processing</td><td>Payment metadata</td></tr>
          <tr><td>Twilio (USA)</td><td>SMS notifications</td><td>Phone numbers, SMS content</td></tr>
          <tr><td>Resend (USA)</td><td>Transactional email</td><td>Email address, email content</td></tr>
          <tr><td>Sentry (USA)</td><td>Error monitoring</td><td>Error logs, stack traces</td></tr>
          <tr><td>Upstash (USA)</td><td>Rate limiting / queuing</td><td>Request metadata</td></tr>
          <tr><td>OpenAI (USA)</td><td>AI features (opt-in)</td><td>Query text only</td></tr>
        </tbody>
      </table>

      <h2>8. Security</h2>
      <ul>
        <li>All data encrypted in transit (TLS 1.2+) and at rest (AES-256)</li>
        <li>Multi-tenant isolation via Row Level Security (RLS) in PostgreSQL</li>
        <li>Service role keys never exposed to clients</li>
        <li>Passwords hashed using Supabase Auth (bcrypt)</li>
        <li>Regular security audits and penetration testing planned quarterly</li>
      </ul>

      <h2>9. Cookies</h2>
      <p>
        We use session cookies set by Supabase Auth to maintain your login session.
        These are HTTP-only, secure cookies. We do not use advertising or tracking cookies.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We will notify school administrators by email at least 14 days before material changes take effect.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        Data Protection Officer / Grievance Officer<br />
        {COMPANY_NAME}<br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <p className="text-xs text-gray-400 mt-12">
        ⚠️ This is a template document. Review with a qualified Indian law firm before using with real customers.
      </p>
    </main>
  );
}
