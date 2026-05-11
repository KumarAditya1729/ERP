'use client'
import { useState, useTransition } from 'react';
import { saveClassesAndSections } from '@/app/actions/onboarding';

type ClassRow = { name: string; sections: string[] };

const DEFAULT_CLASSES: ClassRow[] = [
  { name: 'Class 1',  sections: ['A', 'B'] },
  { name: 'Class 2',  sections: ['A', 'B'] },
  { name: 'Class 3',  sections: ['A'] },
  { name: 'Class 4',  sections: ['A'] },
  { name: 'Class 5',  sections: ['A'] },
];

export default function StepClassSections({ onComplete }: { onComplete: () => void }) {
  const [classes, setClasses] = useState<ClassRow[]>(DEFAULT_CLASSES);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function addClass() {
    setClasses(prev => [...prev, { name: `Class ${prev.length + 1}`, sections: ['A'] }]);
  }

  function removeClass(i: number) {
    setClasses(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateClassName(i: number, val: string) {
    setClasses(prev => prev.map((c, idx) => idx === i ? { ...c, name: val } : c));
  }

  function updateSections(i: number, val: string) {
    const secs = val.split(',').map(s => s.trim()).filter(Boolean);
    setClasses(prev => prev.map((c, idx) => idx === i ? { ...c, sections: secs } : c));
  }

  async function handleSubmit() {
    setError('');
    if (classes.length === 0) { setError('Add at least one class.'); return; }

    startTransition(async () => {
      const result = await saveClassesAndSections({ classes });
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
        Set up classes &amp; sections
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Enter your school&apos;s classes and their sections. Sections are comma-separated (e.g. A, B, C).
      </p>

      <div className="space-y-3 mb-6">
        {/* Header */}
        <div className="grid grid-cols-12 gap-3 px-1">
          <span className="col-span-5 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Class Name</span>
          <span className="col-span-6 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Sections (comma-separated)</span>
        </div>

        {classes.map((cls, i) => (
          <div key={i} className="grid grid-cols-12 gap-3 items-center">
            <input
              className="erp-input col-span-5"
              value={cls.name}
              onChange={e => updateClassName(i, e.target.value)}
              placeholder="Class name"
            />
            <input
              className="erp-input col-span-6"
              value={cls.sections.join(', ')}
              onChange={e => updateSections(i, e.target.value)}
              placeholder="A, B, C"
            />
            <button
              type="button"
              onClick={() => removeClass(i)}
              className="col-span-1 text-center text-lg"
              style={{ color: '#EF4444', cursor: 'pointer' }}
              title="Remove class"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addClass}
        className="btn-secondary text-sm mb-6"
      >
        + Add Class
      </button>

      {error && (
        <div className="p-3 rounded-lg text-sm mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSubmit} className="btn-primary" disabled={isPending}>
          {isPending ? 'Saving...' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
