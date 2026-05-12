'use client';
import { useState, useRef, useEffect } from 'react';
import { addStudent, updateStudent } from '@/app/actions/students';

type StudentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  student?: any | null; // Pass a student object if editing, otherwise null for adding
};

export default function StudentModal({ isOpen, onClose, student }: StudentModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (isOpen && formRef.current && student) {
      // Pre-fill form if editing
      const form = formRef.current;
      (form.elements.namedItem('first_name') as HTMLInputElement).value = student.first_name || '';
      (form.elements.namedItem('last_name') as HTMLInputElement).value = student.last_name || '';
      (form.elements.namedItem('class_grade') as HTMLSelectElement).value = student.class_grade || 'Nursery';
      (form.elements.namedItem('section') as HTMLInputElement).value = student.section || 'A';
      (form.elements.namedItem('roll_number') as HTMLInputElement).value = student.roll_number || '';
      (form.elements.namedItem('guardian_name') as HTMLInputElement).value = student.guardian_name || '';
      (form.elements.namedItem('guardian_phone') as HTMLInputElement).value = student.guardian_phone || '';
      (form.elements.namedItem('email') as HTMLInputElement).value = student.email || '';
      (form.elements.namedItem('status') as HTMLSelectElement).value = student.status || 'active';
    } else if (isOpen && formRef.current && !student) {
      formRef.current.reset();
    }
  }, [isOpen, student]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText('');
    
    const formData = new FormData(e.currentTarget);
    let res;

    if (student?.id) {
      res = await updateStudent(student.id, formData);
    } else {
      res = await addStudent(formData);
    }

    setLoading(false);

    if (res?.error) {
      setErrorText(res.error);
    } else {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#080C1A] border border-white/[0.08] shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-violet-900/10 to-transparent">
          <h2 className="text-lg font-bold text-white">
            {student ? 'Edit Student' : 'Add New Student'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorText && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              {errorText}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">First Name</label>
              <input name="first_name" required className="erp-input w-full text-sm" placeholder="e.g. Aryan" />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Last Name</label>
              <input name="last_name" required className="erp-input w-full text-sm" placeholder="e.g. Sharma" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Class</label>
              <select name="class_grade" required className="erp-input w-full text-sm">
                {['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Section</label>
              <input name="section" required className="erp-input w-full text-sm uppercase" placeholder="A" maxLength={1} />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Roll No</label>
              <input name="roll_number" className="erp-input w-full text-sm" placeholder="01" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/[0.04]">
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Guardian Name</label>
              <input name="guardian_name" required className="erp-input w-full text-sm" placeholder="e.g. Rohit Sharma" />
            </div>
            <div>
              <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Phone Number</label>
              <input name="guardian_phone" required className="erp-input w-full text-sm" placeholder="98100-XXXXX" />
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.04]">
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Email Address</label>
            <input name="email" type="email" className="erp-input w-full text-sm" placeholder="guardian@example.com" />
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Enrollment Status</label>
            <select name="status" className="erp-input w-full text-sm text-green-400 font-semibold bg-green-500/5">
              <option value="active">Active Enrolled</option>
              <option value="inactive">Inactive / Suspended</option>
              <option value="alumni">Alumni / Graduated</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 mt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-6 py-2 text-sm font-bold shadow-lg shadow-violet-500/20">
              {loading ? 'Saving...' : (student ? 'Save Changes' : 'Create Student')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
