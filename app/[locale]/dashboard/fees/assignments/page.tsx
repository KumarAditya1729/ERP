'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { assignFeeStructureToStudent } from '@/app/actions/fees';

export default function FeeAssignmentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tenantId = user.app_metadata?.tenant_id;

    const [stuRes, structRes] = await Promise.all([
      supabase.from('students').select('id, first_name, last_name, class_grade, section').eq('tenant_id', tenantId).order('first_name'),
      supabase.from('fee_structures').select('*, fee_categories(name)').eq('tenant_id', tenantId).eq('is_active', true)
    ]);

    if (stuRes.data) setStudents(stuRes.data);
    if (structRes.data) setStructures(structRes.data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const formData = new FormData(e.currentTarget);
    const studentId = formData.get('student_id') as string;
    const structureId = formData.get('structure_id') as string;
    
    const res = await assignFeeStructureToStudent(studentId, structureId);
    
    setIsSubmitting(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Fee assigned successfully!');
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Student Fee Assignments</h1>
        <p className="text-sm text-slate-400">Assign specific fee structures to individual students</p>
      </div>

      <div className="max-w-xl">
        <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl border border-white/[0.08] space-y-4">
          <h2 className="font-bold text-white mb-2">Assign Fee</h2>
          
          {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
          {success && <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">{success}</div>}

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Select Student *</label>
            <select name="student_id" required className="erp-input w-full text-sm">
              <option value="">-- Select Student --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.class_grade}-{s.section})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Select Fee Structure *</label>
            <select name="structure_id" required className="erp-input w-full text-sm">
              <option value="">-- Select Structure --</option>
              {structures.map(s => (
                <option key={s.id} value={s.id}>{s.fee_categories?.name} (₹{s.amount.toLocaleString()})</option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={isSubmitting || loading} className="btn-primary w-full py-2">
            {isSubmitting ? 'Assigning...' : 'Assign Fee to Student'}
          </button>
        </form>
      </div>
    </div>
  );
}
