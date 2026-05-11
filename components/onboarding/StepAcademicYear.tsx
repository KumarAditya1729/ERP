'use client'
import { useState, useTransition } from 'react';
import { saveAcademicYear } from '@/app/actions/onboarding';

function getCurrentAcademicYearName() {
  const now = new Date();
  const year = now.getFullYear();
  // Indian academic year: Apr–Mar
  const startYear = now.getMonth() >= 3 ? year : year - 1;
  return `${startYear}–${(startYear + 1).toString().slice(2)}`;
}

export default function StepAcademicYear({ onComplete }: { onComplete: () => void }) {
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const currentYear = getCurrentAcademicYearName();
  const currentApr = `${currentYear.split('–')[0]}-04-01`;
  const nextMar = `${parseInt(currentYear.split('–')[0]) + 1}-03-31`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await saveAcademicYear(formData);
      if (result.success) {
        onComplete();
      } else {
        setError(result.error ?? 'Failed to save');
      }
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        Set up your academic year
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Indian schools typically run April–March. You can add more years later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Academic Year Name *
            </label>
            <input
              name="name"
              className="erp-input"
              defaultValue={currentYear}
              placeholder="e.g. 2025–26"
              required
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Format: 2025–26 or 2025-2026
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Start Date *
            </label>
            <input
              name="start_date"
              type="date"
              className="erp-input"
              defaultValue={currentApr}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              End Date *
            </label>
            <input
              name="end_date"
              type="date"
              className="erp-input"
              defaultValue={nextMar}
              required
            />
          </div>

          <div className="col-span-2 flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <input
              type="checkbox"
              name="is_current"
              id="is_current"
              defaultChecked
              className="w-4 h-4 accent-violet-600"
            />
            <label htmlFor="is_current" className="text-sm cursor-pointer" style={{ color: 'var(--text-primary)' }}>
              This is the current active academic year
            </label>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </form>
    </div>
  );
}
