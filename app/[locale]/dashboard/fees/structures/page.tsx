'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createFeeStructure } from '@/app/actions/fees';

export default function FeeStructuresPage() {
  const [structures, setStructures] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
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

    const [structRes, catRes, classRes] = await Promise.all([
      supabase.from('fee_structures').select('*, fee_categories(name), classes(class_grade, section)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('fee_categories').select('*').eq('tenant_id', tenantId).eq('is_active', true),
      supabase.from('classes').select('*').eq('tenant_id', tenantId).order('class_grade')
    ]);

    if (structRes.data) setStructures(structRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (classRes.data) setClasses(classRes.data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const formData = new FormData(e.currentTarget);
    const res = await createFeeStructure(formData);
    
    setIsSubmitting(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Fee structure created successfully!');
      (e.target as HTMLFormElement).reset();
      fetchData();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fee Structures</h1>
        <p className="text-sm text-slate-400">Define how much a category costs for a specific academic year</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl border border-white/[0.08] space-y-4">
            <h2 className="font-bold text-white mb-2">Create Structure</h2>
            
            {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
            {success && <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">{success}</div>}

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Academic Year *</label>
              <input name="academic_year" required defaultValue="2025-2026" className="erp-input w-full text-sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Fee Category *</label>
              <select name="category_id" required className="erp-input w-full text-sm">
                <option value="">-- Select Category --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Amount (₹) *</label>
              <input name="amount" type="number" required min="0" step="0.01" className="erp-input w-full text-sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Due Day (1-28) *</label>
              <input name="due_day" type="number" required min="1" max="28" defaultValue="10" className="erp-input w-full text-sm" />
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2">
              {isSubmitting ? 'Creating...' : '+ Create Structure'}
            </button>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="glass rounded-2xl border border-white/[0.08] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading structures...</div>
            ) : structures.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No structures found.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] border-b border-white/[0.08]">
                  <tr>
                    <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Category</th>
                    <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Year</th>
                    <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Amount</th>
                    <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Due Day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {structures.map(s => (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="p-4 font-bold text-white">{s.fee_categories?.name}</td>
                      <td className="p-4 text-slate-300">{s.academic_year}</td>
                      <td className="p-4 text-emerald-400 font-mono">₹{s.amount.toLocaleString()}</td>
                      <td className="p-4 text-slate-400">{s.due_day}th</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
