'use client'
import { useState, useTransition } from 'react';
import { completeOnboarding } from '@/app/actions/onboarding';
import { useRouter } from 'next/navigation';

export default function StepComplete() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleComplete() {
    startTransition(async () => {
      await completeOnboarding();
      router.push('/en/dashboard');
    });
  }

  return (
    <div className="text-center py-8">
      {/* Animated check */}
      <div
        className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
        style={{
          background: 'linear-gradient(135deg, #10B981, #059669)',
          boxShadow: '0 0 40px rgba(16,185,129,0.4)',
        }}
      >
        🎉
      </div>

      <h2 className="text-3xl font-bold mb-3 gradient-text">
        Your school is set up!
      </h2>
      <p className="mb-8 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
        NexSchool AI is ready. You can now manage students, fees, attendance, and much more from your dashboard.
      </p>

      {/* Quick-start checklist */}
      <div className="text-left max-w-sm mx-auto mb-8 space-y-3">
        {[
          'School information saved',
          'Academic year configured',
          'Classes and sections created',
          'Students imported (or skip)',
          'Staff invites sent (or skip)',
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: '#10B981', fontWeight: 700 }}>✓</span>
            {item}
          </div>
        ))}
      </div>

      <button
        onClick={handleComplete}
        className="btn-primary px-8 py-3 text-base"
        disabled={isPending}
      >
        {isPending ? 'Opening dashboard...' : '→ Go to Dashboard'}
      </button>

      <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        You can always revisit settings from the Settings module.
      </p>
    </div>
  );
}
