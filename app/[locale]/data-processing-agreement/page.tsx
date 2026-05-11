import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Processing Agreement — NexSchool AI',
  description: 'Data Processing Agreement (DPA) between NexSchool AI and schools using the platform.',
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'dpa@nexschool.in';
const COMPANY_NAME = 'NexSchool AI Technologies Pvt. Ltd.';
const EFFECTIVE_DATE = '11 May 2025';

export default function DataProcessingAgreementPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 prose prose-slate">
      <h1>Data Processing Agreement (DPA)</h1>
      <p className="text-sm text-gray-500">Effective Date: {EFFECTIVE_DATE}</p>

      <div className="bg-amber-50 border border-amber-200 rounded p-4 my-6 not-prose">
        <p className="text-amber-800 text-sm font-medium">
          ⚠️ Legal Template Notice: This DPA is provided as a starting template aligned with the DPDP Act 2023.
          It must be reviewed and approved by a qualified Indian legal counsel before use in binding agreements.
        </p>
      </div>

      <p>
        This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of the Terms of Service between{' '}
        {COMPANY_NAME} (&ldquo;Data Processor&rdquo;) and the school/institution (&ldquo;Data Fiduciary&rdquo;)
        registered on the NexSchool AI platform.
      </p>

      <hr />

      <h2>1. Definitions</h2>
      <ul>
        <li><strong>Personal Data</strong>: Any data relating to an identifiable individual, including student names, guardian phone numbers, attendance, and exam records.</li>
        <li><strong>Data Fiduciary</strong>: The school that determines the purpose and means of processing (as defined under DPDP Act 2023).</li>
        <li><strong>Data Processor</strong>: NexSchool AI, which processes data only on documented instructions from the Data Fiduciary.</li>
        <li><strong>Processing</strong>: Any operation performed on Personal Data, including storage, retrieval, update, and deletion.</li>
      </ul>

      <h2>2. Subject Matter and Nature of Processing</h2>
      <p>
        The Processor provides a cloud-based School ERP platform. Processing activities include:
      </p>
      <ul>
        <li>Storage and management of student enrollment records</li>
        <li>Fee collection and payment tracking</li>
        <li>Attendance recording and reporting</li>
        <li>SMS and email communication to guardians</li>
        <li>Academic result management</li>
        <li>Transport and hostel management</li>
      </ul>

      <h2>3. Duration of Processing</h2>
      <p>
        Processing continues for the duration of the active subscription. Upon termination, Personal Data is
        retained for 30 days to allow export, then permanently deleted. Backup copies are purged within 90 days.
      </p>

      <h2>4. Obligations of the Data Processor</h2>
      <p>NexSchool AI shall:</p>
      <ul>
        <li>Process Personal Data only on documented instructions from the school</li>
        <li>Implement appropriate technical and organisational security measures (encryption, access controls, RLS)</li>
        <li>Ensure persons authorised to process data are bound by confidentiality obligations</li>
        <li>Assist the school in responding to data subject rights requests under DPDP Act 2023</li>
        <li>Notify the school within 72 hours of becoming aware of a Personal Data breach</li>
        <li>Delete or return all Personal Data upon request at end of contract</li>
        <li>Make available all information necessary to demonstrate compliance</li>
      </ul>

      <h2>5. Sub-Processors</h2>
      <p>
        The school grants general authorisation to engage the following sub-processors. The Processor
        will notify the school of any intended changes and give the school an opportunity to object.
      </p>
      <table>
        <thead><tr><th>Sub-Processor</th><th>Location</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>Supabase Inc.</td><td>USA</td><td>Database hosting &amp; authentication</td></tr>
          <tr><td>Vercel Inc.</td><td>USA</td><td>Application hosting &amp; CDN</td></tr>
          <tr><td>Razorpay Software Pvt. Ltd.</td><td>India</td><td>Payment processing</td></tr>
          <tr><td>Twilio Inc.</td><td>USA</td><td>SMS delivery</td></tr>
          <tr><td>Resend Inc.</td><td>USA</td><td>Transactional email delivery</td></tr>
          <tr><td>Sentry Inc.</td><td>USA</td><td>Error monitoring</td></tr>
          <tr><td>Upstash Inc.</td><td>USA</td><td>Rate limiting &amp; job queuing</td></tr>
        </tbody>
      </table>

      <h2>6. Data Security Measures</h2>
      <ul>
        <li>All data encrypted in transit via TLS 1.2+</li>
        <li>All data encrypted at rest via AES-256 (Supabase managed)</li>
        <li>Row Level Security (RLS) enforced at database layer to prevent cross-tenant data access</li>
        <li>Service role keys stored only in server environment variables, never exposed to clients</li>
        <li>Role-Based Access Control (RBAC) enforced at application and database layers</li>
        <li>Automatic session expiry and secure HTTP-only session cookies</li>
      </ul>

      <h2>7. Data Breach Notification</h2>
      <p>
        In the event of a confirmed breach of Personal Data, the Processor shall:
      </p>
      <ol>
        <li>Notify the affected school administrator by email within 72 hours of discovery</li>
        <li>Provide details of the nature of the breach, data categories affected, and likely consequences</li>
        <li>Describe measures taken or proposed to address the breach</li>
        <li>Assist the school in fulfilling its notification obligations to the Data Protection Board of India</li>
      </ol>

      <h2>8. Audit Rights</h2>
      <p>
        The school may request reasonable audit information no more than once per year, provided 30 days&apos;
        written notice is given. The Processor will respond to written questionnaires. Physical on-site
        audits require mutual written agreement.
      </p>

      <h2>9. Data Subject Rights</h2>
      <p>
        If a student, guardian, or staff member contacts the school to exercise their rights under
        DPDP Act 2023, the Processor will assist the school in fulfilling such requests within
        a reasonable timeframe and at the school&apos;s cost if the volume of requests is disproportionate.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        This DPA is governed by Indian law. Disputes shall be resolved in courts of New Delhi, India.
      </p>

      <h2>11. Contact</h2>
      <p>
        DPA Inquiries: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a><br />
        {COMPANY_NAME}
      </p>

      <div className="mt-12 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Download DPA</h3>
        <p className="text-sm text-gray-600 mb-4">
          A PDF version of this DPA for offline signing is available on request.
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with subject &ldquo;DPA Request — [School Name]&rdquo;.
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-8">
        ⚠️ This is a template document prepared for reference purposes only. It does not constitute legal advice.
        NexSchool AI recommends that all schools have this reviewed by qualified legal counsel before treating
        it as a binding agreement.
      </p>
    </main>
  );
}
