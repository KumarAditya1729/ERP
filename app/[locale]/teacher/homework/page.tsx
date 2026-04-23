'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createHomeworkAssignment } from '@/app/actions/academics';

const CLASS_OPTIONS = [
  'Nursery-A','LKG-A','UKG-A',
  '1-A','1-B','2-A','2-B','3-A','3-B','4-A','4-B',
  '5-A','5-B','6-A','6-B','7-A','7-B','8-A','8-B',
  '9-A','9-B','10-A','10-B','11-A','11-B','11-Science','11-Commerce','12-A','12-Science','12-Commerce'
];
const SUBJECTS = ['Mathematics','Science','English','Hindi','History','Computer','Physics','Chemistry','Biology','Commerce'];

export default function TeacherHomeworkPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'submissions'>('upload');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: '',
    subject: 'Mathematics',
    class_name: '10-A',
    due_date: '',
    instructions: '',
  });

  // Submissions state
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMySubmissions = useCallback(async () => {
    setLoadingSubs(true);
    const { data } = await supabase
      .from('homework_submissions')
      .select('*, homework_assignments(title, class_name, subject, due_date)')
      .order('submitted_at', { ascending: false })
      .limit(30);
    setSubmissions(data || []);
    setLoadingSubs(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'submissions') fetchMySubmissions();
  }, [activeTab, fetchMySubmissions]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 10 * 1024 * 1024) {
      showToast('File too large! Max 10MB allowed.', 'error');
      return;
    }
    setAttachedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.due_date) {
      showToast('Title and Due Date are required.', 'error');
      return;
    }
    setSaving(true);

    try {
      let attachmentPath: string | undefined;

      // Upload file if attached
      if (attachedFile) {
        const ext = attachedFile.name.split('.').pop();
        const path = `homework/${Date.now()}_${form.class_name}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('admissions')
          .upload(path, attachedFile);
        if (upErr) throw new Error('File upload failed: ' + upErr.message);
        attachmentPath = path;
      }

      // Create assignment via server action
      const res = await createHomeworkAssignment({
        ...form,
        ...(attachmentPath ? { attachment_path: attachmentPath } : {}),
      });

      if (!res.success) throw new Error(res.error || 'Failed to create assignment');

      showToast('✅ Assignment dispatched to students!');
      setForm({ title: '', subject: 'Mathematics', class_name: '10-A', due_date: '', instructions: '' });
      setAttachedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      showToast(err.message || 'Something went wrong', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statusCfg: Record<string, string> = {
    pending: 'badge-yellow',
    graded: 'badge-green',
    missing: 'badge-red',
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <Link href="/teacher" className="text-sm font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 mb-4">
        <span>←</span> Back to Hub
      </Link>

      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border ${toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 'bg-red-950/90 text-red-400 border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-white">Homework & Classes</h1>
        <p className="text-slate-400 text-sm">Assign daily tasks or grade submissions from your students.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/10 relative">
        <div
          className="absolute inset-y-1 w-[calc(50%-4px)] bg-white/10 rounded-lg shadow-sm border border-white/10 transition-all duration-300"
          style={{ left: activeTab === 'upload' ? '4px' : 'calc(50%)' }}
        />
        <button onClick={() => setActiveTab('upload')} className={`flex-1 py-2 text-sm font-semibold relative z-10 transition-colors ${activeTab === 'upload' ? 'text-white' : 'text-slate-400'}`}>
          📤 Assign Task
        </button>
        <button onClick={() => setActiveTab('submissions')} className={`flex-1 py-2 text-sm font-semibold relative z-10 transition-colors ${activeTab === 'submissions' ? 'text-white' : 'text-slate-400'}`}>
          📥 Submissions
        </button>
      </div>

      {/* Hidden File Input */}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFileChange} />

      {activeTab === 'upload' ? (
        <form onSubmit={handleSubmit} className="glass border border-white/10 rounded-2xl p-6 space-y-5 shadow-xl shadow-black/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assignment Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Chapter 4 Equations Worksheet"
                className="erp-input w-full"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject</label>
              <select className="erp-input w-full" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Class & Section</label>
              <select className="erp-input w-full" value={form.class_name} onChange={e => setForm({ ...form, class_name: e.target.value })}>
                {CLASS_OPTIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Due Date *</label>
              <input
                type="date"
                required
                className="erp-input w-full"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Instructions</label>
            <textarea
              rows={4}
              placeholder="Solve all 10 questions on page 42. Show intermediate steps."
              className="erp-input w-full resize-none"
              value={form.instructions}
              onChange={e => setForm({ ...form, instructions: e.target.value })}
            />
          </div>

          <div className="pt-4 border-t border-white/10 space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:bg-white/[0.02] hover:border-violet-500/40 transition-all cursor-pointer group"
            >
              {attachedFile ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl">📄</span>
                  <p className="text-sm font-semibold text-emerald-400">{attachedFile.name}</p>
                  <p className="text-xs text-slate-500">{(attachedFile.size / 1024).toFixed(0)} KB — Click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">📎</span>
                  <p className="text-sm font-semibold text-white mt-2">Attach PDF or Image</p>
                  <p className="text-xs text-slate-500">Max file size: 10MB</p>
                </div>
              )}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full py-3.5 text-base shadow-[0_0_15px_rgba(139,92,246,0.3)] disabled:opacity-60"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Dispatching…
                </span>
              ) : 'Dispatch to Students'}
            </button>
          </div>
        </form>
      ) : (
        <div className="glass border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Recent Submissions</h2>
            <button onClick={fetchMySubmissions} className="text-xs text-violet-400 hover:text-violet-300">🔄 Refresh</button>
          </div>
          {loadingSubs ? (
            <div className="p-8 text-center text-slate-500">Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <span className="text-5xl opacity-40 mb-3 block">📥</span>
              <p className="text-white font-bold text-lg mb-1">No submissions yet</p>
              <p className="text-slate-400 text-sm">Submissions will appear here after students turn in their work.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto">
              {submissions.map(s => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {s.student_name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.student_name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.homework_assignments?.title} · {s.homework_assignments?.class_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${statusCfg[s.status] || 'badge-blue'} text-[10px]`}>{s.status}</span>
                    {s.score && <span className="text-xs font-bold text-emerald-400">{s.score}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
