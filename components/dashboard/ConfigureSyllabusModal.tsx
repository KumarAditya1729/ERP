'use client';
import { useState, useRef, useEffect } from 'react';
import { addSyllabusRequirement, deleteSyllabusRequirement } from '@/app/actions/academics';
import { createClient } from '@/lib/supabase/client';

type ConfigureSyllabusModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  requirements: any[];
};

export default function ConfigureSyllabusModal({ isOpen, onClose, onRefresh, requirements }: ConfigureSyllabusModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (isOpen) {
      fetchTeachers();
    }
  }, [isOpen]);

  async function fetchTeachers() {
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;
    if (!tenantId) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('role', 'teacher');
    
    if (data) {
      setTeachers(data);
    }
  }

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorText('');
    
    const formData = new FormData(e.currentTarget);
    const res = await addSyllabusRequirement(formData);

    setLoading(false);

    if (res?.error) {
      setErrorText(res.error);
    } else {
      if (formRef.current) formRef.current.reset();
      onRefresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this requirement?')) return;
    const res = await deleteSyllabusRequirement(id);
    if (res?.error) {
      setErrorText(res.error);
    } else {
      onRefresh();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-[#080C1A] border border-white/[0.08] shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-violet-900/10 to-transparent shrink-0">
          <h2 className="text-lg font-bold text-white">Configure Syllabus Requirements</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorText && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              {errorText}
            </div>
          )}
          
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 p-4 border border-white/10 rounded-xl bg-white/[0.02]">
            <h3 className="text-sm font-bold text-white mb-2">Add New Requirement</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Class</label>
                <select name="class_name" required className="erp-input w-full text-sm">
                  {['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Subject</label>
                <input name="subject" required className="erp-input w-full text-sm" placeholder="e.g. Mathematics" />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Teacher</label>
                <select name="teacher_id" required className="erp-input w-full text-sm">
                  <option value="">-- Select --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Hours/Week</label>
                <input name="hours_per_week" type="number" required min="1" max="15" className="erp-input w-full text-sm" placeholder="5" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={loading} className="btn-primary px-6 py-2 text-sm font-bold shadow-lg shadow-violet-500/20">
                {loading ? 'Adding...' : 'Add Requirement'}
              </button>
            </div>
          </form>

          <div>
            <h3 className="text-sm font-bold text-white mb-3">Current Requirements</h3>
            {requirements.length === 0 ? (
              <div className="p-4 bg-white/5 rounded-xl text-sm text-slate-400 text-center">
                No syllabus requirements found.
              </div>
            ) : (
              <div className="space-y-2">
                {requirements.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg border border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">{req.className}</p>
                      <p className="text-xs text-slate-400">{req.subject} • {req.teacherName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-violet-400">{req.hoursNeeded} hrs/wk</span>
                      <button 
                        onClick={() => handleDelete(req.id)}
                        className="text-xs text-red-400 hover:text-red-300 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
