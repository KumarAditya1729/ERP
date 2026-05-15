'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createHomeworkAssignment, gradeSubmission, updateAssignmentStatus } from '@/app/actions/academics';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Submission {
  id: string;
  assignment_id: string;
  student_name: string;
  class_name: string;
  status: string; // 'pending' | 'missing' | 'graded'
  score: string | null;
  submitted_at: string | null;
  homework_submission_files?: { id: string; file_name: string; file_url: string; uploaded_at: string }[];
  homework_comments?: { id: string | number; author_role: string; comment_text: string; created_at: string }[];
}

interface Assignment {
  id: string;
  title: string;
  subject: string;
  class_name: string;
  teacher_name: string;
  due_date: string;
  instructions: string;
  status: string; // 'active' | 'review' | 'graded'
  total_students: number;
  submissions?: { id: string; status: string }[];
}

const subjects = ['All', 'Mathematics', 'Science', 'English', 'History', 'Hindi', 'Computer'];

const statusCfg: Record<string, { badge: string; label: string }> = {
  active:  { badge: 'badge-blue',   label: 'Active' },
  review:  { badge: 'badge-yellow', label: 'Needs Review' },
  graded:  { badge: 'badge-green',  label: 'Graded' },
  pending: { badge: 'badge-yellow', label: 'Pending' },
  missing: { badge: 'badge-red',    label: 'Missing' },
};

export default function HomeworkPage() {
  const supabase = createClient();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [subject, setSubject] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'my-classes'>('all');

  // Form State
  const [form, setForm] = useState({
    title: '', subject: 'Mathematics', class_name: '10-A', 
    due_date: '', instructions: ''
  });
  
  // Grade form tracking
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  
  // View submission tracking
  const [viewingSub, setViewingSub] = useState<any>(null);
  const [commentInput, setCommentInput] = useState('');

  // ─── Show toast helper ────────────────────────────────────────────────────
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Fetch assignments with submission counts ──────────────────────────────
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    // Fetch assignments and their related submissions in one query
    const { data, error } = await supabase
      .from('homework_assignments')
      .select('*, submissions:homework_submissions(id, status)')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Failed to load homework: ' + error.message, 'error');
    } else {
      setAssignments(data as any);
      if (data.length > 0 && !selected) setSelected(data[0].id);
    }
    setLoading(false);
  }, [supabase, selected]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // ─── Fetch submissions when selected assignment changes ────────────────────
  useEffect(() => {
    async function loadSubmissions() {
      if (!selected) return;
      const { data } = await supabase
        .from('homework_submissions')
        .select('*, homework_submission_files(*), homework_comments(*)')
        .eq('assignment_id', selected)
        .order('student_name', { ascending: true });
      if (data) setSubmissions(data);
    }
    loadSubmissions();
  }, [selected, supabase]);

  // ─── Publish new assignment ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.title || !form.due_date) {
      showToast('Title and Due Date are required.', 'error');
      return;
    }
    setSaving(true);
    
    // Server action handles tenant and profile logic
    const res = await createHomeworkAssignment(form);

    if (!res.success) {
      showToast('Failed to create assignment: ' + res.error, 'error');
    } else {
      showToast('✅ Assignment published!');
      setShowForm(false);
      setForm({ title: '', subject: 'Mathematics', class_name: '10-A', due_date: '', instructions: '' });
      fetchAssignments();
    }
    setSaving(false);
  };

  // ─── Save grade ──────────────────────────────────────────────────────────
  const saveGrade = async (submissionId: string) => {
    if (!gradeInput) return;
    const res = await gradeSubmission(submissionId, gradeInput);
      
    if (!res.success) {
      showToast('Failed to grade: ' + res.error, 'error');
    } else {
      showToast('✅ Grade saved!');
      setGradingSubId(null);
      setGradeInput('');
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'graded', score: gradeInput } : s));
    }
  };

  // ─── Mark assignments review/graded ──────────────────────────────────────
  const markAssignmentStatus = async (status: string) => {
    if (!selected) return;
    const res = await updateAssignmentStatus(selected, status);
    if (res.success) {
      showToast(`Review State changed to ${status}`);
      setAssignments(prev => prev.map(a => a.id === selected ? { ...a, status } : a));
    }
  };

  const handleTeacherComment = async (subId: string) => {
    if (!commentInput.trim()) return;
    const { error } = await supabase.from('homework_comments').insert({
      tenant_id: (assignments[0] as any)?.tenant_id || '', // fallback
      submission_id: subId,
      author_id: (await supabase.auth.getUser()).data.user?.id,
      author_role: 'teacher',
      comment_text: commentInput
    });
    if (!error) {
       showToast('Comment sent');
       setCommentInput('');
       // Update locally
       setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, homework_comments: [...(s.homework_comments || []), { id: Date.now(), comment_text: commentInput, author_role: 'teacher', created_at: new Date().toISOString() }] } : s));
       if (viewingSub && viewingSub.id === subId) {
          setViewingSub((prev: any) => ({ ...prev, homework_comments: [...(prev.homework_comments || []), { id: Date.now(), comment_text: commentInput, author_role: 'teacher', created_at: new Date().toISOString() }] }));
       }
    } else {
       showToast('Error sending comment', 'error');
    }
  };

  let filtered = subject === 'All' ? assignments : assignments.filter(a => a.subject === subject);
  if (viewMode === 'my-classes') {
    filtered = filtered.filter(a => a.teacher_name === 'Teacher' || a.teacher_name !== 'Admin');
  }
  const selectedHW = assignments.find(a => a.id === selected);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Homework & Assignments</h1>
          <p className="text-slate-400 text-sm mt-0.5">{assignments.length} assignments tracked</p>
        </div>
        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5 mr-auto lg:mx-auto">
          <button onClick={() => setViewMode('all')} className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${viewMode === 'all' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>All Classes</button>
          <button onClick={() => setViewMode('my-classes')} className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${viewMode === 'my-classes' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>My Classes</button>
        </div>
        <button id="create-hw-btn" onClick={() => setShowForm(!showForm)} className="btn-primary text-sm py-2 px-4">
          + Create Assignment
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="glass border border-violet-500/30 rounded-2xl p-6 animate-fade-in">
          <h2 className="text-white font-bold mb-4">📝 New Assignment</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Assignment Title</label>
              <input className="erp-input w-full" placeholder="e.g. Chapter 5 Practice Problems" 
                value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Subject</label>
              <select className="erp-input w-full" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                {subjects.slice(1).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Class & Section</label>
              <select className="erp-input w-full" value={form.class_name} onChange={e => setForm({...form, class_name: e.target.value})}>
                {['8-A','8-B','9-A','9-B','10-A','10-B','11-A','11-B','12-A'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Due Date</label>
              <input type="date" className="erp-input w-full" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Instructions</label>
              <textarea className="erp-input w-full h-20 resize-none" placeholder="Add detailed instructions for students..." 
                value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button id="submit-hw-btn" onClick={handleSubmit} disabled={saving} className="btn-primary text-sm py-2 px-5 disabled:opacity-50 text-white">
              {saving ? 'Publishing...' : 'Publish Assignment'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Assignments', value: assignments.length.toString(), icon: '📋', color: 'border-violet-500/20' },
          { label: 'Pending Review', value: assignments.filter(a => a.status === 'review').length.toString(), icon: '🔍', color: 'border-amber-500/20' },
          { label: 'Avg Submission Rate', value: assignments.length === 0 ? '0%' : Math.round(assignments.reduce((s,a) => s + ((a.submissions?.filter(sub => sub.status !== 'missing').length || 0)/a.total_students)*100, 0) / assignments.length) + '%', icon: '📊', color: 'border-emerald-500/20' },
          { label: 'Fully Graded', value: assignments.filter(a => a.status === 'graded').length.toString(), icon: '✅', color: 'border-cyan-500/20' },
        ].map(k => (
          <div key={k.label} className={`glass border ${k.color} rounded-2xl p-4`}>
            <span className="text-2xl">{k.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Subject Filter */}
      <div className="flex gap-2 flex-wrap">
        {subjects.map(s => (
          <button
            key={s}
            onClick={() => setSubject(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              subject === s ? 'bg-violet-600 text-white border-violet-500' : 'glass border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Main split view */}
      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading homework…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-white font-semibold">No assignments found</p>
          <p className="text-slate-400 text-sm mt-1">Create your first homework assignment.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Assignment List */}
          <div className="lg:col-span-2 glass border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white">Assignments ({filtered.length})</h2>
            </div>
            <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
              {filtered.map(a => {
                const subCount = a.submissions?.filter(s => s.status !== 'missing').length || 0;
                const pct = Math.round((subCount / a.total_students) * 100);
                const cfg = statusCfg[a.status];
                return (
                  <button
                    key={a.id}
                    id={`hw-${a.id}`}
                    onClick={() => setSelected(a.id)}
                    className={`w-full text-left p-4 transition-colors ${selected === a.id ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-white/[0.02]'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{a.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.subject} &middot; Class {a.class_name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Due: {new Date(a.due_date).toLocaleDateString('en-IN')}</p>
                      </div>
                      <span className={`badge ${cfg.badge} text-[10px] shrink-0`}>{cfg.label}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Submissions</span>
                        <span>{subCount}/{a.total_students} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1">
                        <div className="h-1 rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submission Detail */}
          {selectedHW && (
            <div className="lg:col-span-3 glass border border-white/[0.08] rounded-2xl flex flex-col h-full max-h-[600px]">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-white">{selectedHW.title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedHW.subject} &middot; {selectedHW.teacher_name} &middot; Class {selectedHW.class_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {selectedHW.status === 'active' && <button onClick={() => markAssignmentStatus('review')} className="text-xs text-violet-400 hover:text-white transition-colors">Start Review</button>}
                  {selectedHW.status === 'review' && <button onClick={() => markAssignmentStatus('graded')} className="text-xs text-emerald-400 hover:text-white transition-colors">Mark All Graded</button>}
                  <span className={`badge ${statusCfg[selectedHW.status].badge} shadow-lg`}>{statusCfg[selectedHW.status].label}</span>
                </div>
              </div>
              
              <div className="overflow-x-auto flex-1 h-full">
                <table className="data-table w-full">
                  <thead className="sticky top-0 bg-slate-900 z-10 shadow-md">
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Submitted At</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-slate-500 py-8">No submissions generated yet.</td>
                      </tr>
                    ) : submissions.map((s, i) => {
                      const cfg = statusCfg[s.status];
                      const isGrading = gradingSubId === s.id;
                      return (
                        <tr key={s.id}>
                          <td className="font-semibold text-white">{s.student_name}</td>
                          <td><span className="badge badge-purple text-[10px]">{s.class_name}</span></td>
                          <td className="text-xs text-slate-400">{s.submitted_at ? new Date(s.submitted_at).toLocaleString('en-IN', { timeStyle: 'short', dateStyle: 'short' }) : '—'}</td>
                          <td><span className={`badge ${cfg.badge}`}>{cfg.label}</span></td>
                          <td className="font-bold text-white">
                            {isGrading ? (
                              <input autoFocus type="text" className="w-16 bg-slate-800 border border-violet-500 rounded px-1 py-0.5 text-xs outline-none" 
                                placeholder="18/20" value={gradeInput} onChange={e => setGradeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveGrade(s.id)}/>
                            ) : (s.score || '—')}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              {s.status === 'pending' && !isGrading && (
                                <button onClick={() => { setGradingSubId(s.id); setGradeInput(''); }} className="text-xs text-violet-400 hover:text-violet-300 font-medium">✏️ Grade</button>
                              )}
                              {isGrading && (
                                <div className="flex gap-1 border border-white/10 rounded overflow-hidden">
                                  <button onClick={() => saveGrade(s.id)} className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-xs hover:bg-emerald-500 hover:text-white transition-colors">✓</button>
                                  <button onClick={() => setGradingSubId(null)} className="bg-slate-700 text-white px-2 py-0.5 text-xs hover:bg-slate-600 transition-colors">✕</button>
                                </div>
                              )}
                              {s.status === 'graded' && (
                                <button onClick={() => setViewingSub(s)} className="text-xs text-slate-400 hover:text-white font-medium">👁 View</button>
                              )}
                              {s.status === 'pending' && !isGrading && (s.homework_submission_files?.length ?? 0) > 0 && (
                                <button onClick={() => setViewingSub(s)} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">📂 Files ({s.homework_submission_files?.length ?? 0})</button>
                              )}
                              {s.status === 'missing' && (
                                <button onClick={() => showToast('Reminder Sent!', 'success')} className="text-xs text-amber-400 hover:text-amber-300 font-medium">📤 Remind</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View Submission Modal */}
      {viewingSub && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-strong border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
              <div>
                <h3 className="text-lg font-bold text-white">{viewingSub.student_name}&apos;s Submission</h3>
                <p className="text-xs text-slate-400 mt-0.5">Submitted: {new Date(viewingSub.submitted_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setViewingSub(null)} className="text-slate-400 hover:text-white text-xl">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Files */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3">Attached Files</h4>
                {viewingSub.homework_submission_files?.length === 0 ? (
                   <p className="text-xs text-slate-500 italic">No files attached.</p>
                ) : (
                  <div className="space-y-2">
                    {viewingSub.homework_submission_files?.map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">📄</span>
                          <span className="text-sm text-white font-medium">{f.file_name}</span>
                        </div>
                        <a href={f.file_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 hover:text-white px-3 py-1.5 bg-cyan-500/10 rounded-lg transition-colors">Download</a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3">Feedback & Comments</h4>
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 h-64 flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {viewingSub.homework_comments?.map((c: any) => (
                      <div key={c.id} className={`flex flex-col ${c.author_role === 'teacher' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${c.author_role === 'teacher' ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-white/10 text-slate-200 rounded-tl-sm'}`}>
                          {c.comment_text}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">{c.author_role.toUpperCase()} &middot; {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTeacherComment(viewingSub.id)}
                      placeholder="Type feedback here..."
                      className="erp-input flex-1"
                    />
                    <button onClick={() => handleTeacherComment(viewingSub.id)} className="btn-primary px-4 py-2 text-sm">Send</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
