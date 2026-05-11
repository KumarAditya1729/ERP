import { getOnboardingState } from '@/app/actions/onboarding';
import { redirect } from 'next/navigation';
import OnboardingWizardClient from '@/components/onboarding/OnboardingWizard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'School Setup — NexSchool AI',
  description: 'Complete your school setup to start using NexSchool AI.',
};

export default async function OnboardingPage() {
  const { step, completed } = await getOnboardingState();

  // If onboarding is already done, redirect to dashboard
  if (completed) {
    redirect('/en/dashboard');
  }

  return <OnboardingWizardClient initialStep={step} />;
}
