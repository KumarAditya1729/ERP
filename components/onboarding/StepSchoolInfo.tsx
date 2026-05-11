'use client'
import { useState, useTransition } from 'react';
import { saveSchoolInfo } from '@/app/actions/onboarding';

const BOARD_TYPES = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge IGCSE', 'Other'];

export default function StepSchoolInfo({ onComplete }: { onComplete: () => void }) {
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await saveSchoolInfo(formData);
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
        Tell us about your school
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        This information will appear on reports, fee receipts, and SMS messages.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              School Name *
            </label>
            <input
              name="name"
              className="erp-input"
              placeholder="e.g. Delhi Public School, Sector 45"
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              City *
            </label>
            <input
              name="city"
              className="erp-input"
              placeholder="e.g. New Delhi"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              Board / Curriculum *
            </label>
            <select name="board_type" className="erp-input" required>
              <option value="">Select board...</option>
              {BOARD_TYPES.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              School Address (optional)
            </label>
            <input
              name="address"
              className="erp-input"
              placeholder="Full postal address"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
              School Logo URL (optional)
            </label>
            <input
              name="logo_url"
              type="url"
              className="erp-input"
              placeholder="https://..."
            />
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
