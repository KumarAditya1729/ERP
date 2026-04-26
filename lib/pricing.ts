export type CommercialPlanId = 'starter' | 'growth' | 'enterprise'

export interface CommercialPlan {
  id: CommercialPlanId
  name: string
  icon: string
  tagline: string
  badge?: string
  highlight?: boolean
  priceLabel: string
  periodLabel: string
  monthlyPriceInr: number | null
  studentRangeLabel: string
  registerDescription: string
  marketingFeatures: string[]
  missingFeatures?: string[]
  billingFeatures: string[]
  ctaLabel: string
}

export const COMMERCIAL_PLANS: CommercialPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    icon: '🌱',
    tagline: 'Essential ERP for smaller campuses',
    priceLabel: '₹2,999',
    periodLabel: '/month',
    monthlyPriceInr: 2999,
    studentRangeLabel: 'Up to 300 students',
    registerDescription: 'Best for early-stage or single-campus schools',
    marketingFeatures: [
      'Student Information System',
      'Attendance Tracking',
      'Fee Management',
      'Parent Portal',
      'Email Support',
    ],
    missingFeatures: ['Transport & Hostel', 'Bulk SMS/WhatsApp', 'Custom Integrations'],
    billingFeatures: [
      'Student Information System',
      'Attendance Tracking',
      'Fee Management',
      'Parent Portal',
      'Email Support',
    ],
    ctaLabel: 'Start Free Trial',
  },
  {
    id: 'growth',
    name: 'Growth',
    icon: '🚀',
    tagline: 'Built for schools running at full pace',
    badge: 'Most Popular',
    highlight: true,
    priceLabel: '₹7,999',
    periodLabel: '/month',
    monthlyPriceInr: 7999,
    studentRangeLabel: 'Up to 1,500 students',
    registerDescription: 'For schools that need admissions, transport, and communication in one place',
    marketingFeatures: [
      'Everything in Starter',
      'Admission Pipeline',
      'Transport & Hostel',
      'Homework & Grading',
      'Bulk SMS/WhatsApp',
      'Priority Support',
    ],
    missingFeatures: ['Dedicated Account Manager', 'SLA Guarantee'],
    billingFeatures: [
      'Everything in Starter',
      'Admission Pipeline',
      'Transport & Hostel',
      'Homework & Grading',
      'Bulk SMS/WhatsApp',
      'Priority Support',
    ],
    ctaLabel: 'Choose Growth',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '🏛️',
    tagline: 'Custom rollout for large or multi-branch groups',
    priceLabel: 'Custom',
    periodLabel: '',
    monthlyPriceInr: null,
    studentRangeLabel: 'Unlimited students',
    registerDescription: 'For enterprise groups with deeper onboarding and integration needs',
    marketingFeatures: [
      'Everything in Growth',
      'Custom Integrations',
      'Dedicated Account Manager',
      'On-premise option',
      'SLA Guarantee',
      'Custom Training',
    ],
    billingFeatures: [
      'Everything in Growth',
      'Custom Integrations',
      'Dedicated Account Manager',
      'On-premise option',
      'SLA Guarantee',
      'Custom Training',
    ],
    ctaLabel: 'Build Custom Plan',
  },
]
