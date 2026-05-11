'use client'
import { useState, useTransition } from 'react';
import { sendStaffInvites } from '@/app/actions/onboarding';

type InviteRow = { email: string; role: 'teacher' | 'staff' | 'admin' };

export default function StepStaffInvite({ onComplete }: { onComplete: () => void }) {
  const [invites, setInvites] = useState<InviteRow[]>([
    { email: '', role: 'teacher' },
  ]);
  const [results, setResults] = useState<{ email: string; status: 'sent' | 'failed'; error?: string }[]>([]);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function addRow() {
    setInvites(prev => [...prev, { email: '', role: 'teacher' }]);
  }

  function removeRow(i: number) {
    setInvites(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: 'email' | 'role', value: string) {
    setInvites(prev => prev.map((inv, idx) =>
      idx === i ? { ...inv, [field]: value } as InviteRow : inv
    ));
  }

  async function handleSubmit() {
    setError('');
    const valid = invites.filter(inv => inv.email.trim() && inv.email.includes('@'));
    if (valid.length === 0) {
      setError('Add at least one valid email address, or skip this step.');
      return;
    }

    startTransition(async () => {
      const result = await sendStaffInvites({ invites: valid });
      if (result.success) {
        setResults(result.results ?? []);
        setTimeout(onComplete, 2000);
      } else {
        setError(result.error ?? 'Failed to send invites');
      }
    });
  }

  if (results.length > 0) {
    return (
      <div className="text-center py-6">
        <div className="text-5xl mb-4">📨</div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Invites Sent</h3>
        <div className="space-y-2 text-sm mb-6">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{r.email}</span>
              {r.status === 'sent'
                ? <span style={{ color: '#10B981' }}>✓ Invite sent</span>
                : <span style={{ color: '#EF4444' }}>✗ {r.error}</span>
              }
            </div>
          ))}
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Redirecting to next step…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
        Invite your staff
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Staff will receive a login link via email. They can set their own password on first login. You can also add staff later from the HR module.
      </p>

      <div className="space-y-3 mb-6">
        <div className="grid grid-cols-12 gap-3 text-xs font-semibold uppercase px-1 mb-1" style={{ color: 'var(--text-muted)' }}>
          <span className="col-span-7">Email Address</span>
          <span className="col-span-4">Role</span>
        </div>
        {invites.map((inv, i) => (
          <div key={i} className="grid grid-cols-12 gap-3 items-center">
            <input
              className="erp-input col-span-7"
              type="email"
              placeholder="teacher@school.edu.in"
              value={inv.email}
              onChange={e => updateRow(i, 'email', e.target.value)}
            />
            <select
              className="erp-input col-span-4"
              value={inv.role}
              onChange={e => updateRow(i, 'role', e.target.value)}
            >
              <option value="teacher">Teacher</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="col-span-1 text-center text-lg"
              style={{ color: '#EF4444' }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="btn-secondary text-sm mb-6">
        + Add Another
      </button>

      {error && (
        <div className="p-3 rounded-lg text-sm mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <button onClick={onComplete} className="btn-secondary text-sm">
          Skip for now →
        </button>
        <button onClick={handleSubmit} className="btn-primary" disabled={isPending}>
          {isPending ? 'Sending invites...' : 'Send Invites →'}
        </button>
      </div>
    </div>
  );
}
