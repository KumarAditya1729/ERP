'use client';
import { useState, useEffect, useCallback } from 'react';
import { getTeacherNotices } from '@/app/actions/communication';

export default function TeacherCommunicationPage() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    const result = await getTeacherNotices();
    if (result.success && result.data) {
      setNotices(result.data);
    } else {
      setNotices([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Messages & Notices</h1>
        <p className="text-slate-400 text-sm">School-wide announcements and communications</p>
      </div>

      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center text-slate-400">Loading...</div>
      ) : notices.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">📣</p>
          <p className="text-white font-semibold">No notices yet</p>
          <p className="text-slate-400 text-sm mt-1">Announcements sent by admin will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {notices.map(n => (
            <div key={n.id} className="glass border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{n.title}</p>
                  <p className="text-sm text-slate-400 mt-1">{n.message || n.body}</p>
                  <p className="text-xs text-slate-600 mt-2">{new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                {n.priority === 'high' && <span className="badge badge-red shrink-0">Urgent</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
