'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createApplication, advanceStage as advanceStageAction, updateDocs } from '@/app/actions/admissions';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DocsStatus {
  birth: boolean;
  marks: boolean;
  transfer: boolean;
  photo: boolean;
  aadhar: boolean;
}

interface Application {
  id: string;
  student_name: string;
  date_of_birth: string;
  applying_class: string;
  category: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  previous_school: string | null;
  previous_grade: string | null;
  stage: string;
  docs_status: DocsStatus;
  applied_date: string;
  interview_date: string | null;
  notes: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PIPELINE = ['Applied', 'Documents Verified', 'Interview Scheduled', 'Offer Letter', 'Enrolled', 'Rejected'] as const;
type Stage = typeof PIPELINE[number];

const STAGE_CFG: Record<string, { badge: string; color: string }> = {
  'Applied':               { badge: 'badge-blue',   color: 'bg-blue-500' },
  'Documents Verified':    { badge: 'badge-yellow',  color: 'bg-amber-500' },
  'Interview Scheduled':   { badge: 'badge-purple',  color: 'bg-violet-500' },
  'Offer Letter':          { badge: 'badge-green',   color: 'bg-emerald-500' },
  'Enrolled':              { badge: 'badge-green',   color: 'bg-cyan-500' },
  'Rejected':              { badge: 'badge-red',     color: 'bg-red-500' },
};

const NEXT_STAGE: Record<string, string> = {
  'Applied': 'Documents Verified',
  'Documents Verified': 'Interview Scheduled',
  'Interview Scheduled': 'Offer Letter',
  'Offer Letter': 'Enrolled',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdmissionsPage() {
  const supabase = createClient();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    student_name: '', date_of_birth: '', applying_class: 'Class 6',
    category: 'General', guardian_name: '', guardian_phone: '',
    guardian_email: '', previous_school: '', previous_grade: '',
    docs: { birth: false, marks: false, transfer: false, photo: false, aadhar: false },
  });

  // ─── Show toast helper ────────────────────────────────────────────────────
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Fetch all applications for this tenant ───────────────────────────────
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admission_applications')
      .select('*')
      .order('applied_date', { ascending: false });

    if (error) {
      showToast('Failed to load applications: ' + error.message, 'error');
    } else {
      setApplications(data as Application[]);
      if (data.length > 0 && !selected) setSelected(data[0].id);
    }
    setLoading(false);
  }, [supabase, selected]);

  useEffect(() => { fetchApplications(); }, []);

  // ─── Submit new application ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.student_name || !form.date_of_birth || !form.guardian_name || !form.guardian_phone) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    setSaving(true);
    const formData = new FormData();
    formData.append('student_name', form.student_name);
    formData.append('date_of_birth', form.date_of_birth);
    formData.append('applying_class', form.applying_class);
    formData.append('category', form.category);
    formData.append('guardian_name', form.guardian_name);
    formData.append('guardian_phone', form.guardian_phone);
    if (form.guardian_email) formData.append('guardian_email', form.guardian_email);
    if (form.previous_school) formData.append('previous_school', form.previous_school);
    if (form.previous_grade) formData.append('previous_grade', form.previous_grade);
    
    const res = await createApplication(formData, form.docs);

    if (!res.success) {
      showToast('Failed to submit: ' + res.error, 'error');
    } else {
      showToast('✅ Application submitted successfully!');
      setShowForm(false);
      setForm({ student_name: '', date_of_birth: '', applying_class: 'Class 6', category: 'General', guardian_name: '', guardian_phone: '', guardian_email: '', previous_school: '', previous_grade: '', docs: { birth: false, marks: false, transfer: false, photo: false, aadhar: false } });
      fetchApplications();
    }
    setSaving(false);
  };

  // ─── Advance stage ────────────────────────────────────────────────────────
  const advanceStage = async (appId: string, currentStage: string) => {
    const nextStage = NEXT_STAGE[currentStage];
    if (!nextStage) return;
    setSaving(true);
    const res = await advanceStageAction(appId, nextStage);
    if (!res.success) {
      showToast('Failed to advance stage: ' + res.error, 'error');
    } else {
      showToast(`✅ Moved to "${nextStage}"`);
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: nextStage } : a));
    }
    setSaving(false);
  };

  // ─── Enroll student (final stage) ────────────────────────────────────────
  const enrollStudent = async (appId: string) => {
    setSaving(true);
    const res = await advanceStageAction(appId, 'Enrolled');
    if (!res.success) {
      showToast('Enrollment failed: ' + res.error, 'error');
    } else {
      showToast('🎉 Student enrolled successfully!');
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: 'Enrolled' } : a));
    }
    setSaving(false);
  };

  // ─── Reject application ───────────────────────────────────────────────────
  const rejectApplication = async (appId: string) => {
    if (!confirm('Are you sure you want to reject this application?')) return;
    setSaving(true);
    const res = await advanceStageAction(appId, 'Rejected');
    if (!res.success) {
      showToast('Failed to reject: ' + res.error, 'error');
    } else {
      showToast('Application rejected.', 'error');
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, stage: 'Rejected' } : a));
    }
    setSaving(false);
  };

  // ─── Toggle doc status ────────────────────────────────────────────────────
  const toggleDoc = async (appId: string, docKey: keyof DocsStatus, current: boolean) => {
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    const updatedDocs = { ...app.docs_status, [docKey]: !current };
    const res = await updateDocs(appId, updatedDocs);
    if (res.success) {
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, docs_status: updatedDocs } : a));
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────
  const filtered = filter === 'All' ? applications : applications.filter(a => a.stage === filter);
  const selectedApp = applications.find(a => a.id === selected);

  // ─── Render ───────────────────────────────────────────────────────────────
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
          <h1 className="text-2xl font-bold text-white">Admission Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">Session 2026&ndash;27 &middot; {applications.length} applications</p>
        </div>
        <div className="flex gap-3">
          <button id="new-application-btn" onClick={() => setShowForm(!showForm)} className="btn-secondary text-sm py-2 px-4">+ New Application</button>
          <button id="refresh-applications-btn" onClick={fetchApplications} className="btn-secondary text-sm py-2 px-4">🔄 Refresh</button>
        </div>
      </div>

      {/* New Application Form */}
      {showForm && (
        <div className="glass border border-violet-500/30 rounded-2xl p-6 animate-fade-in">
          <h2 className="text-white font-bold mb-4">📋 New Admission Application</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Student Full Name *', field: 'student_name', type: 'text', placeholder: 'e.g. Aarav Kumar' },
              { label: 'Date of Birth *', field: 'date_of_birth', type: 'date', placeholder: '' },
              { label: 'Guardian Name *', field: 'guardian_name', type: 'text', placeholder: 'Parent / Guardian' },
              { label: 'Guardian Phone *', field: 'guardian_phone', type: 'tel', placeholder: '+91 XXXXX XXXXX' },
              { label: 'Guardian Email', field: 'guardian_email', type: 'email', placeholder: 'email@example.com' },
              { label: 'Previous School', field: 'previous_school', type: 'text', placeholder: 'Previous school name' },
              { label: 'Last Class % / CGPA', field: 'previous_grade', type: 'text', placeholder: '85% or 8.5 CGPA' },
            ].map(f => (
              <div key={f.field}>
                <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                <input type={f.type} className="erp-input w-full" placeholder={f.placeholder}
                  value={(form as any)[f.field]}
                  onChange={e => setForm(prev => ({ ...prev, [f.field]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Applying for Class</label>
              <select className="erp-input w-full" value={form.applying_class} onChange={e => setForm(p => ({ ...p, applying_class: e.target.value }))}>
                {['Class 5','Class 6','Class 7','Class 8','Class 9','Class 10','Class 11','Class 12'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Category</label>
              <select className="erp-input w-full" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {['General','OBC','SC','ST','EWS'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-400 mb-2">Documents Received</p>
            <div className="flex gap-5 flex-wrap">
              {(Object.keys(form.docs) as (keyof typeof form.docs)[]).map(key => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer capitalize">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-violet-600"
                    checked={form.docs[key]}
                    onChange={() => setForm(p => ({ ...p, docs: { ...p.docs, [key]: !p.docs[key] } }))} />
                  {key === 'birth' ? 'Birth Cert.' : key === 'marks' ? 'Marksheet' : key === 'transfer' ? 'Transfer Cert.' : key === 'photo' ? 'Photo' : 'Aadhar'}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button id="submit-application-btn" onClick={handleSubmit} disabled={saving} className="btn-primary text-sm py-2 px-5 disabled:opacity-50">
              {saving ? 'Submitting…' : 'Submit Application'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          </div>
        </div>
      )}

      {/* Pipeline KPI Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {PIPELINE.map(stage => {
          const count = applications.filter(a => a.stage === stage).length;
          const cfg = STAGE_CFG[stage];
          return (
            <button key={stage} id={`filter-${stage.replace(/\s+/g,'-')}`}
              onClick={() => setFilter(filter === stage ? 'All' : stage)}
              className={`glass border rounded-2xl p-3 text-center transition-all card-hover ${filter === stage ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/[0.08]'}`}>
              <p className="text-xl font-extrabold text-white">{count}</p>
              <p className="text-[10px] text-slate-400 mt-1 leading-tight">{stage}</p>
              <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-2 ${cfg.color}`} />
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading applications…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-white font-semibold">No applications yet</p>
          <p className="text-slate-400 text-sm mt-1">Click &quot;+ New Application&quot; to add the first one.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm py-2 px-5 mt-4">+ New Application</button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-5 gap-5">
          {/* Application List */}
          <div className="lg:col-span-2 glass border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white">Applications ({filtered.length})</h2>
            </div>
            <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
              {filtered.map(a => {
                const cfg = STAGE_CFG[a.stage];
                const docsComplete = Object.values(a.docs_status).every(Boolean);
                return (
                  <button key={a.id} id={`app-${a.id}`} onClick={() => setSelected(a.id)}
                    className={`w-full text-left p-4 transition-colors ${selected === a.id ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-white/[0.02]'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{a.student_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.applying_class} · {a.guardian_name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(a.applied_date).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`badge ${cfg.badge} text-[10px]`}>{a.stage}</span>
                        <p className={`text-[10px] mt-1 ${docsComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {docsComplete ? '📁 Docs Complete' : '⚠️ Docs Pending'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Application Detail */}
          {selectedApp && (
            <div className="lg:col-span-3 glass border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">{selectedApp.student_name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Applied {new Date(selectedApp.applied_date).toLocaleDateString('en-IN')}</p>
                </div>
                <span className={`badge ${STAGE_CFG[selectedApp.stage].badge}`}>{selectedApp.stage}</span>
              </div>
              <div className="p-5 space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Applying For', value: selectedApp.applying_class },
                    { label: 'Date of Birth', value: new Date(selectedApp.date_of_birth).toLocaleDateString('en-IN') },
                    { label: 'Category', value: selectedApp.category },
                    { label: 'Guardian', value: selectedApp.guardian_name },
                    { label: 'Phone', value: selectedApp.guardian_phone },
                    { label: 'Previous Grade', value: selectedApp.previous_grade || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Live Document Checklist (clickable) */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Document Checklist <span className="text-violet-400 font-normal normal-case">(click to toggle)</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'birth' as const,    label: 'Birth Certificate' },
                      { key: 'marks' as const,    label: 'Previous Marksheet' },
                      { key: 'transfer' as const, label: 'Transfer Certificate' },
                      { key: 'photo' as const,    label: 'Passport Photo' },
                      { key: 'aadhar' as const,   label: 'Aadhar Card' },
                    ]).map(doc => {
                      const received = selectedApp.docs_status[doc.key];
                      return (
                        <button key={doc.key} id={`doc-${doc.key}`}
                          onClick={() => toggleDoc(selectedApp.id, doc.key, received)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${received ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10' : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'}`}>
                          <span className={`text-sm ${received ? 'text-emerald-400' : 'text-red-400'}`}>{received ? '✅' : '❌'}</span>
                          <span className="text-xs text-slate-300">{doc.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pipeline Progress */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pipeline Progress</p>
                  <div className="flex items-center gap-1">
                    {PIPELINE.filter(s => s !== 'Rejected').map((stage, i, arr) => {
                      const currentIdx = PIPELINE.indexOf(selectedApp.stage as Stage);
                      const stageIdx   = PIPELINE.indexOf(stage as Stage);
                      const done    = currentIdx > stageIdx;
                      const current = selectedApp.stage === stage;
                      return (
                        <div key={stage} className="flex items-center flex-1">
                          <div className={`w-full text-center p-1.5 rounded-lg text-[9px] font-semibold transition-colors ${current ? 'bg-violet-600 text-white' : done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-600'}`}>
                            {stage.split(' ')[0]}
                          </div>
                          {i < arr.length - 1 && <div className={`h-px w-2 shrink-0 ${done ? 'bg-emerald-400' : 'bg-white/10'}`} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 flex-wrap pt-1">
                  {NEXT_STAGE[selectedApp.stage] && (
                    <button id="advance-stage-btn" onClick={() => advanceStage(selectedApp.id, selectedApp.stage)} disabled={saving}
                      className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
                      → Move to &quot;{NEXT_STAGE[selectedApp.stage]}&quot;
                    </button>
                  )}
                  {selectedApp.stage === 'Offer Letter' && (
                    <button id="enroll-btn" onClick={() => enrollStudent(selectedApp.id)} disabled={saving}
                      className="btn-primary text-sm py-2 px-4 disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}>
                      ✅ Enroll Student
                    </button>
                  )}
                  {selectedApp.stage !== 'Enrolled' && selectedApp.stage !== 'Rejected' && (
                    <button id="reject-btn" onClick={() => rejectApplication(selectedApp.id)} disabled={saving}
                      className="text-xs text-red-400 hover:text-red-300 glass border border-red-500/20 rounded-xl px-3 py-2 font-medium disabled:opacity-50">
                      🚫 Reject
                    </button>
                  )}
                  {selectedApp.stage === 'Enrolled' && (
                    <span className="badge badge-green text-sm px-4 py-2">🎓 Student Enrolled</span>
                  )}
                  {selectedApp.stage === 'Rejected' && (
                    <span className="badge badge-red text-sm px-4 py-2">🚫 Application Rejected</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
