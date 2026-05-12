'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sendNotice } from '@/app/actions/communication';

const channelColors: Record<string, string> = {
  SMS: 'badge-green',
  Email: 'badge-blue',
  'In-App': 'badge-purple',
};

export default function CommunicationPage() {
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all-parents');
  const [channels, setChannels] = useState<string[]>(['SMS', 'In-App']);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<any[]>([]);
  const [audienceCounts, setAudienceCounts] = useState({ students: 0, staff: 0 });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const supabase = createClient();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;
      if (!tenantId) return;

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setNotices(data);
    } catch (err: any) {
      showToast('Failed to load notices: ' + err.message, false);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchNotices();
    // Fetch real audience counts
    async function loadCounts() {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.app_metadata?.tenant_id;
      if (!tenantId) return;

      const [studentsRes, staffRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('role', ['staff', 'teacher', 'admin']),
      ]);
      setAudienceCounts({
        students: studentsRes.count || 0,
        staff: staffRes.count || 0,
      });
    }
    loadCounts();
  }, [fetchNotices, supabase]);

  const quickTargets = [
    { id: 'all-parents', label: 'All Parents', count: audienceCounts.students.toLocaleString(), icon: '👪' },
    { id: 'all-students', label: 'All Students', count: audienceCounts.students.toLocaleString(), icon: '🎓' },
    { id: 'all-staff', label: 'All Staff', count: audienceCounts.staff.toLocaleString(), icon: '👩‍💼' },
  ];

  const toggleChannel = (ch: string) => {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      showToast('Title and message body are required.', false);
      return;
    }
    if (channels.length === 0) {
      showToast('Select at least one channel.', false);
      return;
    }

    setSending(true);
    const res = await sendNotice({ title, body, target, channels });
    setSending(false);

    if (!res.success) {
      showToast('Failed to send: ' + res.error, false);
    } else {
      showToast(`✅ Notice sent to ${res.recipientCount} recipients!`);
      setCompose(false);
      setTitle('');
      setBody('');
      fetchNotices();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Communication Hub</h1>
          <p className="text-slate-400 text-sm mt-0.5">Send notices, alerts and updates to parents and staff</p>
        </div>
        <button id="compose-notice-btn" onClick={() => setCompose(true)} className="btn-primary text-sm py-2 px-4">
          ✉️ Compose Notice
        </button>
      </div>

      {/* Stats — DB-driven */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Notices This Month', value: loading ? '...' : notices.length, icon: '📣', badge: 'badge-purple' },
          { label: 'Active Students', value: audienceCounts.students || '—', icon: '🎓', badge: 'badge-blue' },
          { label: 'Active Staff', value: audienceCounts.staff || '—', icon: '👩‍💼', badge: 'badge-green' },
          { label: 'Channels', value: '3', icon: '📡', badge: 'badge-yellow' },
        ].map((s) => (
          <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 card-hover">
            <span className="text-2xl">{s.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Target Segments */}
      <div className="glass border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white mb-4">Quick Audience Segments</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickTargets.map((t) => (
            <button
              key={t.id}
              id={`target-${t.id}`}
              onClick={() => { setTarget(t.id); setCompose(true); }}
              className="glass border border-white/[0.08] rounded-xl p-4 text-left card-hover hover:border-violet-500/30 transition-all"
            >
              <span className="text-xl">{t.icon}</span>
              <p className="text-xs font-semibold text-white mt-2">{t.label}</p>
              <p className="text-[10px] text-slate-400 font-medium">{t.count} recipients</p>
            </button>
          ))}
        </div>
      </div>

      {/* Compose Modal */}
      {compose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-strong border border-white/[0.12] rounded-3xl p-7 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Compose Notice</h2>
              <button id="close-compose" onClick={() => setCompose(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Subject / Title</label>
                <input id="notice-title" value={title} onChange={(e) => setTitle(e.target.value)} className="erp-input w-full" placeholder="e.g. Holiday Notice – April 17" />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Message Body</label>
                <textarea
                  id="notice-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="erp-input resize-none w-full"
                  rows={4}
                  placeholder="Type your message here…"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Send To</label>
                <select id="notice-target" value={target} onChange={(e) => setTarget(e.target.value)} className="erp-input w-full" style={{ appearance: 'none' }}>
                  {quickTargets.map((t) => <option key={t.id} value={t.id}>{t.label} ({t.count})</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">Send Via</label>
                <div className="flex gap-3">
                  {['SMS', 'Email', 'In-App'].map((ch) => (
                    <button
                      key={ch}
                      id={`channel-${ch}`}
                      onClick={() => toggleChannel(ch)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${channels.includes(ch) ? 'bg-violet-600 border-violet-500 text-white' : 'glass border-white/10 text-slate-400 hover:text-white'}`}
                    >
                      {ch === 'SMS' ? '📱' : ch === 'Email' ? '📧' : '🔔'} {ch}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button id="cancel-compose" onClick={() => setCompose(false)} disabled={sending} className="btn-secondary flex-1 justify-center py-2.5">Cancel</button>
              <button id="send-notice-btn" onClick={handleSend} disabled={sending} className="btn-primary flex-1 justify-center py-2.5">
                {sending ? '⏳ Sending...' : '🚀 Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notice History */}
      <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-bold text-white">Recent Notices</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading notices...</div>
          ) : notices.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-3xl mb-3">📭</p>
              <p className="text-slate-400 font-semibold text-sm">No notices yet</p>
              <p className="text-slate-500 text-xs mt-1">Click &ldquo;Compose Notice&rdquo; to send your first message.</p>
            </div>
          ) : notices.map((n) => (
            <div key={n.id} className="p-5 hover:bg-white/[0.015] transition-colors">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{n.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.raw_content}</p>
                </div>
                <span className="badge badge-green shrink-0">✓ Sent</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="text-[10px] text-slate-500">👥 {n.audience_segment}</span>
                <span className="text-[10px] text-slate-500">📊 {n.target_count} recipients</span>
                <span className="text-[10px] text-slate-500">🕐 {new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <div className="flex gap-1 ml-auto">
                  {Array.isArray(n.channels) && n.channels.map((ch: string) => (
                    <span key={ch} className={`badge ${channelColors[ch] || 'badge-purple'} text-[9px]`}>{ch}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
