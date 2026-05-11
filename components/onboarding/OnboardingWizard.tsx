'use client'
import { useState, useCallback } from 'react';
import StepSchoolInfo from '@/components/onboarding/StepSchoolInfo';
import StepAcademicYear from '@/components/onboarding/StepAcademicYear';
import StepClassSections from '@/components/onboarding/StepClassSections';
import StepCsvImport from '@/components/onboarding/StepCsvImport';
import StepStaffInvite from '@/components/onboarding/StepStaffInvite';
import StepComplete from '@/components/onboarding/StepComplete';

const STEPS = [
  { id: 1, label: 'School Info',     icon: '🏫' },
  { id: 2, label: 'Academic Year',   icon: '📅' },
  { id: 3, label: 'Classes',         icon: '📚' },
  { id: 4, label: 'Import Students', icon: '📊' },
  { id: 5, label: 'Invite Staff',    icon: '👩‍🏫' },
  { id: 6, label: 'Done',            icon: '🎉' },
];

export default function OnboardingWizardClient({
  initialStep,
}: {
  initialStep: number;
}) {
  const [step, setStep] = useState<number>(Math.min(Math.max(initialStep, 1), 6));

  const next = useCallback(() => setStep(s => Math.min(s + 1, 6)), []);
  const goTo = useCallback((s: number) => setStep(s), []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="px-8 py-5 flex items-center gap-4">
        <div className="gradient-text font-bold text-xl">NexSchool AI</div>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Setup Wizard</span>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* ── Step Progress ── */}
        <div className="flex items-center justify-between mb-12 relative">
          {/* Connector line */}
          <div className="absolute top-5 left-0 right-0 h-px" style={{ background: 'rgba(255,255,255,0.08)', zIndex: 0 }} />

          {STEPS.map((s, idx) => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            return (
              <button
                key={s.id}
                onClick={() => s.id < step && goTo(s.id)}
                disabled={s.id >= step}
                className="flex flex-col items-center gap-2 relative z-10 group"
                style={{ cursor: s.id < step ? 'pointer' : 'default' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                  style={{
                    background: isCompleted
                      ? 'linear-gradient(135deg, #10B981, #059669)'
                      : isCurrent
                      ? 'linear-gradient(135deg, #7C3AED, #5B21B6)'
                      : 'rgba(255,255,255,0.06)',
                    border: isCurrent ? '2px solid #a78bfa' : '2px solid transparent',
                    boxShadow: isCurrent ? '0 0 20px rgba(124,58,237,0.4)' : 'none',
                    color: isCompleted || isCurrent ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {isCompleted ? '✓' : s.id}
                </div>
                <span
                  className="text-xs font-medium whitespace-nowrap"
                  style={{ color: isCurrent ? '#c4b5fd' : isCompleted ? '#10B981' : 'var(--text-muted)' }}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Step Content ── */}
        <div className="glass rounded-2xl p-8" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {step === 1 && <StepSchoolInfo onComplete={next} />}
          {step === 2 && <StepAcademicYear onComplete={next} />}
          {step === 3 && <StepClassSections onComplete={next} />}
          {step === 4 && <StepCsvImport onComplete={next} />}
          {step === 5 && <StepStaffInvite onComplete={next} />}
          {step === 6 && <StepComplete />}
        </div>

        {/* ── Step counter ── */}
        <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          Step {step} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
