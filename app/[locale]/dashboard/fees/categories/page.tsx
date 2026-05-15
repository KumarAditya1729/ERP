'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createFeeCategory } from '@/app/actions/fees';

export default function FeeCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const tenantId = user.app_metadata?.tenant_id;
    const { data, error } = await supabase
      .from('fee_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');
      
    if (data) setCategories(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const formData = new FormData(e.currentTarget);
    const res = await createFeeCategory(formData);
    
    setIsSubmitting(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess('Fee category created successfully!');
      (e.target as HTMLFormElement).reset();
      fetchCategories();
    }
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fee Categories</h1>
          <p className="text-sm text-slate-400">Manage master list of fee types (Tuition, Transport, etc.)</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Form */}
        <div className="md:col-span-1">
          <form onSubmit={handleSubmit} className="glass p-6 rounded-2xl border border-white/[0.08] space-y-4">
            <h2 className="font-bold text-white mb-2">Create Category</h2>
            
            {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
            {success && <div className="text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">{success}</div>}

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Category Name *</label>
              <input name="name" required placeholder="e.g., Tuition Fee" className="erp-input w-full text-sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Recurrence *</label>
              <select name="recurrence" className="erp-input w-full text-sm">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="one_time">One-Time</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Description</label>
              <textarea name="description" placeholder="Optional details..." className="erp-input w-full text-sm h-20 resize-none"></textarea>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2">
              {isSubmitting ? 'Creating...' : '+ Create Category'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="md:col-span-2">
          <div className="glass rounded-2xl border border-white/[0.08] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No categories found. Create one to get started.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] border-b border-white/[0.08]">
                  <tr>
                    <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Name</th>
                    <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Recurrence</th>
                    <th className="p-4 font-semibold text-slate-400 uppercase tracking-wider text-xs">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {categories.map(c => (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="p-4">
                        <p className="font-bold text-white">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.description || 'No description'}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs capitalize text-slate-300">
                          {c.recurrence.replace('_', '-')}
                        </span>
                      </td>
                      <td className="p-4">
                        {c.is_active ? (
                          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">Active</span>
                        ) : (
                          <span className="text-xs text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded">Inactive</span>
                        )}
                      </td>
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
