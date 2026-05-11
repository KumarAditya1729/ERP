import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — NexSchool AI',
  description: 'Terms and conditions for using NexSchool AI School ERP platform.',
};

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'legal@nexschool.in';
const COMPANY_NAME = 'NexSchool AI Technologies Pvt. Ltd.';
const EFFECTIVE_DATE = '11 May 2025';

export default function TermsOfServicePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 prose prose-slate">
      <h1>Terms of Service</h1>
      <p className="text-sm text-gray-500">Effective Date: {EFFECTIVE_DATE}</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the NexSchool AI platform operated by{' '}
        {COMPANY_NAME} (&ldquo;Company&rdquo;). By registering a school account, you agree to these Terms on behalf
        of your institution.
      </p>

      <hr />

      <h2>1. Subscription and Payment</h2>
      <ul>
        <li>NexSchool AI is offered on a monthly subscription basis. Pricing is displayed on the website at time of purchase.</li>
        <li>Payments are processed by Razorpay. The Company does not store card or bank details.</li>
        <li>Subscriptions auto-renew monthly unless cancelled at least 7 days before the renewal date.</li>
        <li>All prices are in Indian Rupees (INR) and inclusive of applicable taxes unless stated otherwise.</li>
        <li>Refunds are not provided for partial months of service, except where required by law.</li>
      </ul>

      <h2>2. Service Level Agreement (SLA)</h2>
      <ul>
        <li>The Company targets <strong>99.5% uptime</strong> per calendar month, excluding scheduled maintenance.</li>
        <li>Scheduled maintenance will be communicated at least 24 hours in advance via email.</li>
        <li>In the event of extended downtime (&gt; 4 hours in a month), affected schools may request a pro-rated service credit. Credits are the sole remedy for downtime.</li>
        <li>The Company does not guarantee uninterrupted service. The Platform is provided &ldquo;as is&rdquo; for the current service tier.</li>
      </ul>

      <h2>3. Acceptable Use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Use the Platform to store or transmit unlawful, harassing, or defamatory content</li>
        <li>Attempt to access another school&apos;s data</li>
        <li>Use automated scripts to bulk-extract data beyond export features provided</li>
        <li>Resell, sublicense, or white-label the Platform without written agreement</li>
        <li>Reverse-engineer, decompile, or attempt to derive source code</li>
        <li>Violate any applicable Indian or international law</li>
      </ul>

      <h2>4. Data Ownership</h2>
      <ul>
        <li>The school retains full ownership of all data entered into the Platform (student records, fees, attendance, etc.).</li>
        <li>The Company acts as a data processor only, processing data on the school&apos;s behalf.</li>
        <li>Upon termination, the school may export all data within 30 days. After 30 days, data will be permanently deleted.</li>
      </ul>

      <h2>5. Liability Cap</h2>
      <p>
        To the maximum extent permitted by applicable law, the Company&apos;s total cumulative liability to you
        arising from or related to these Terms or use of the Platform shall not exceed the amount paid by you
        in the <strong>3 months immediately preceding the claim</strong>.
      </p>
      <p>
        The Company shall not be liable for indirect, incidental, special, or consequential damages,
        including loss of data or revenue, arising from your use of or inability to use the Platform.
      </p>

      <h2>6. Termination</h2>
      <ul>
        <li>Either party may terminate with 30 days written notice.</li>
        <li>The Company may immediately suspend or terminate accounts that violate these Terms or Indian law.</li>
        <li>On termination, all licenses granted herein immediately cease.</li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <p>
        All Platform software, design, trademarks, and content are the exclusive property of {COMPANY_NAME}.
        No rights are transferred to you other than the limited license to use the Platform per these Terms.
      </p>

      <h2>8. Governing Law &amp; Jurisdiction</h2>
      <p>
        These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction
        of courts in <strong>New Delhi, India</strong>.
      </p>

      <h2>9. Changes to Terms</h2>
      <p>
        The Company may update these Terms with 14 days&apos; notice by email to the registered school administrator.
        Continued use after the effective date constitutes acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        {COMPANY_NAME}<br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <p className="text-xs text-gray-400 mt-12">
        ⚠️ This is a template document. Review with a qualified Indian law firm before using with real customers.
      </p>
    </main>
  );
}
