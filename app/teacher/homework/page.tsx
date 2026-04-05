'use client';
import { useState, useEffect, useCallback } from 'react';
import { createHomeworkAssignment, getTeacherHomeworks } from '@/app/actions/academics';

export default function TeacherHomeworkPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({ title: '', subject: '', class_name: 'Grade 1', due_date: '', instructions: '' });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    const result = await getTeacherHomeworks();
    if (result.success && result.data) {
      setAssignments(result.data);
    } else {
      setAssignments([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const handleCreate = async () => {
    if (!form.title || !form.subject || !form.due_date) {
      showToast('Fill in all required fields', false);
      return;
    }
    setSaving(true);
    const result = await createHomeworkAssignment(form);
    if (result.success) {
      showToast('✅ Assignment created!');
      setShowModal(false);
      setForm({ title: '', subject: '', class_name: 'Grade 1', due_date: '', instructions: '' });
      fetchAssignments();
    } else {
      showToast('❌ ' + result.error, false);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Assignments</h1>
          <p className="text-slate-400 text-sm">Create and manage homework for your classes</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm py-2 px-4">+ New Assignment</button>
      </div>

      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center text-slate-400">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-4">📚</p>
          <p className="text-white font-semibold">No assignments yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first assignment for your students.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {assignments.map(a => (
            <div key={a.id} className="glass border border-white/[0.08] rounded-2xl p-5 hover:border-violet-500/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{a.title}</p>
                  <p className="text-sm text-slate-400 mt-1">{a.subject} · {a.class_name} · Due: {a.due_date}</p>
                  {a.instructions && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{a.instructions}</p>}
                </div>
                <span className={`badge shrink-0 ${a.status === 'active' ? 'badge-green' : 'badge-purple'}`}>{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass border border-white/[0.12] rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">New Assignment</h2>
            <input className="erp-input" placeholder="Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              <input className="erp-input" placeholder="Subject *" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
              <select className="erp-input" value={form.class_name} onChange={e => setForm({...form, class_name: e.target.value})}>
                {['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <input className="erp-input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            <textarea className="erp-input resize-none" rows={3} placeholder="Instructions (optional)" value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} />
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl ${toast.ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
