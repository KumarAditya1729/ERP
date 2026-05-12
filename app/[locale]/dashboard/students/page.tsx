'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import BulkUploader from '@/components/BulkUploader';
import StudentModal from '@/components/dashboard/StudentModal';

const avatarColors = ['from-violet-600 to-purple-700', 'from-cyan-600 to-teal-700', 'from-emerald-600 to-green-700', 'from-amber-600 to-orange-700', 'from-pink-600 to-rose-700', 'from-blue-600 to-indigo-700'];

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  // Parent Link State
  const [linkModal, setLinkModal] = useState<{ student: any } | null>(null);
  const [parents, setParents] = useState<any[]>([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [linking, setLinking] = useState(false);

  const supabase = createClient();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // useCallback prevents infinite loop — function reference is stable
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;
      if (!tenantId) return;

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setStudents(data);
    } catch (err: any) {
      showToast('Failed to load students: ' + err.message, false);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const openLinkModal = async (student: any) => {
    // Load all parent-role profiles for this tenant
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.app_metadata?.tenant_id;
    if (!tenantId) return;

    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('tenant_id', tenantId)
      .eq('role', 'parent');
    setParents(data || []);
    setSelectedParentId('');
    setLinkModal({ student });
  };

  const handleLinkParent = async () => {
    if (!selectedParentId || !linkModal) return;
    setLinking(true);
    const { data: { user } } = await supabase.auth.getUser();
    const profile = await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single();
    const tenantId = profile.data?.tenant_id;

    const { error } = await supabase.from('parent_links').upsert({
      parent_id: selectedParentId,
      student_id: linkModal.student.id,
      tenant_id: tenantId,
    }, { onConflict: 'parent_id,student_id' });

    if (error) {
      showToast('❌ Failed to link: ' + error.message, false);
    } else {
      showToast('✅ Parent linked successfully!');
      setLinkModal(null);
    }
    setLinking(false);
  };



  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchSearch = fullName.includes(q) || s.guardian_name?.toLowerCase().includes(q);
    const matchClass = classFilter === 'all' || s.class_grade === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Student Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">Powered by real-time Supabase Database</p>
        </div>
        <div className="flex gap-3">
          <button id="add-student-btn" onClick={() => { setEditingStudent(null); setIsModalOpen(true); }} className="btn-primary text-sm py-2 px-4">+ New Student</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Enrolled', value: loading ? '...' : students.length, icon: '🎓', badge: 'badge-purple' },
          { label: 'Active Status', value: loading ? '...' : students.filter(s=>s.status === 'active').length, icon: '✨', badge: 'badge-green' },
          { label: 'Absent Today', value: '0', icon: '⚠️', badge: 'badge-red' }, // Requires daily attendance join
          { label: 'Transport Users', value: loading ? '...' : students.filter(s => s.route_id).length.toString(), icon: '🚌', badge: 'badge-blue' },
        ].map((s) => (
          <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 card-hover">
            <span className="text-2xl">{s.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass border border-white/[0.08] rounded-2xl p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="student-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-input pl-10 text-sm"
            placeholder="Search by name, guardian…"
          />
        </div>
        <select
          id="class-filter"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="erp-input text-sm w-40"
          style={{ appearance: 'none' }}
        >
          <option value="all">All Classes</option>
          {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((c) => (
            <option key={c} value={c.length <= 2 && !isNaN(Number(c)) ? `Class ${c}` : c}>{c.length <= 2 && !isNaN(Number(c)) ? `Class ${c}` : c}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400">{filtered.length} results</span>
      </div>

      <BulkUploader onUploadComplete={() => fetchStudents()} />

      {/* Table */}
      <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-8 text-center text-slate-500">Loading DB records...</div>
          ) : students.length === 0 ? (
             <div className="p-8 text-center bg-slate-900/40">
                <p className="text-lg font-bold text-white mb-2">No Students Found</p>
                <p className="text-slate-400 text-sm">Your school database is currently empty. Click &quot;+ New Student&quot; or upload a CSV to get started.</p>
             </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>ID</th>
                  <th>Class</th>
                  <th>Guardian</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                          {s.first_name[0]}{s.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{s.first_name} {s.last_name}</p>
                          <p className="text-[10px] text-slate-500">Added: {new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-purple text-[10px]">{s.id.slice(0, 8)}</span></td>
                    <td>
                      <span className="text-sm text-slate-200">
                        {s.class_grade}<span className="text-slate-500">-{s.section}</span>
                      </span>
                      <span className="text-xs text-slate-500 ml-1">Roll {s.roll_number}</span>
                    </td>
                    <td className="text-sm text-slate-300">{s.guardian_name}</td>
                    <td className="text-sm text-slate-400">{s.guardian_phone}</td>
                    <td>
                      <span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        {s.status}
                      </span>
                    </td>
                     <td>
                       <div className="flex gap-2">
                         <button className="text-xs text-violet-400 hover:text-violet-300 font-medium">View</button>
                         <button onClick={() => { setEditingStudent(s); setIsModalOpen(true); }} className="text-xs text-slate-400 hover:text-white">Edit</button>
                         <button onClick={() => openLinkModal(s)} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">Link Parent</button>
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <StudentModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); fetchStudents(); }} 
        student={editingStudent} 
      />

      {/* Parent Link Modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass border border-white/[0.12] rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-white">🔗 Link Parent to Student</h2>
            <p className="text-sm text-slate-400">Linking parent to: <span className="text-white font-semibold">{linkModal.student.first_name} {linkModal.student.last_name}</span></p>
            {parents.length === 0 ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300">
                No parent accounts found. Ask parents to register with the &apos;Parent&apos; role first.
              </div>
            ) : (
              <select className="erp-input" value={selectedParentId} onChange={e => setSelectedParentId(e.target.value)}>
                <option value="">-- Select a Parent --</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.email})</option>
                ))}
              </select>
            )}
            <div className="flex gap-3">
              <button onClick={() => setLinkModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleLinkParent} disabled={linking || !selectedParentId} className="btn-primary flex-1">
                {linking ? 'Linking...' : 'Link Parent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
