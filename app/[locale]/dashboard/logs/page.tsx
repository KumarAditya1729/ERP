'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────
interface LogEntry {
  id: string;
  tenant_id: string;
  user_id: string | null;
  actor_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'SMS_SENT' | 'PAYMENT' | 'ERROR';
  resource_type: string;
  resource_id: string | null;
  resource_label: string | null;
  metadata: Record<string, any>;
  severity: 'info' | 'warn' | 'error' | 'success';
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const ACTION_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  INSERT:    { icon: '✦',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  UPDATE:    { icon: '✎',  color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  DELETE:    { icon: '✕',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  LOGIN:     { icon: '→',  color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
  LOGOUT:    { icon: '←',  color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/20' },
  EXPORT:    { icon: '↓',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  SMS_SENT:  { icon: '✉',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  PAYMENT:   { icon: '₹',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ERROR:     { icon: '⚠',  color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
};

const RESOURCE_LABELS: Record<string, string> = {
  students:               '👨‍🎓 Student',
  fees:                   '💰 Fee',
  attendance:             '📋 Attendance',
  leave_requests:         '🏖️ Leave Request',
  hostel_allocations:     '🏨 Hostel',
  admission_applications: '📄 Admission',
  transport_routes:       '🚌 Transport',
  exams:                  '📝 Exam',
  profiles:               '👤 Profile',
};

const MAX_ENTRIES = 200;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LogStreamPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, inserts: 0, updates: 0, deletes: 0, errors: 0 });

  const bottomRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  pausedRef.current = paused;

  // Load historical logs on mount
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      const ordered = [...data].reverse() as LogEntry[];
      setLogs(ordered);
      updateStats(ordered);
    }
    setLoading(false);
  }, []);

  const updateStats = (entries: LogEntry[]) => {
    setStats({
      total:   entries.length,
      inserts: entries.filter((l) => l.action === 'INSERT').length,
      updates: entries.filter((l) => l.action === 'UPDATE').length,
      deletes: entries.filter((l) => l.action === 'DELETE').length,
      errors:  entries.filter((l) => l.severity === 'error').length,
    });
  };

  // Connect SSE stream
  useEffect(() => {
    fetchHistory();

    const es = new EventSource('/api/logs/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', () => setConnected(true));

    es.addEventListener('log', (e) => {
      if (pausedRef.current) return;
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setLogs((prev) => {
          const next = [...prev, entry].slice(-MAX_ENTRIES);
          updateStats(next);
          return next;
        });
      } catch { /* ignore parse errors */ }
    });

    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, [fetchHistory]);

  // Auto-scroll to bottom unless paused
  useEffect(() => {
    if (!paused) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, paused]);

  // Supabase Realtime as secondary push (belt-and-suspenders)
  useEffect(() => {
    const channel = supabase
      .channel('audit_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        if (pausedRef.current) return;
        const entry = payload.new as LogEntry;
        setLogs((prev) => {
          const next = [...prev, entry].slice(-MAX_ENTRIES);
          updateStats(next);
          return next;
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const clearLogs = () => setLogs([]);

  // Filtered view
  const filtered = logs.filter((l) => {
    const matchesFilter = filter === 'all' || l.action === filter || l.severity === filter || l.resource_type === filter;
    const matchesSearch = !search || [l.actor_name, l.resource_type, l.resource_label, l.action]
      .some((field) => field?.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-5 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          <div>
            <h1 className="text-2xl font-bold text-white">Audit Log Stream</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {connected ? 'Live — streaming all tenant events in real-time' : 'Reconnecting to event stream...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            className={`flex items-center gap-2 text-xs font-bold py-2 px-4 rounded-xl border transition-all ${
              paused
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                : 'glass border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={clearLogs}
            className="glass border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/30 text-xs font-bold py-2 px-4 rounded-xl transition-all"
          >
            🗑 Clear
          </button>
          <button
            onClick={fetchHistory}
            className="glass border border-white/10 text-slate-400 hover:text-white text-xs font-bold py-2 px-4 rounded-xl transition-all"
          >
            ↺ Reload
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: stats.total, color: 'text-white', border: 'border-white/10' },
          { label: 'Inserts', value: stats.inserts, color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'Updates', value: stats.updates, color: 'text-violet-400', border: 'border-violet-500/20' },
          { label: 'Deletes', value: stats.deletes, color: 'text-red-400', border: 'border-red-500/20' },
          { label: 'Errors', value: stats.errors, color: 'text-amber-400', border: 'border-amber-500/20' },
        ].map((s) => (
          <div key={s.label} className={`glass border ${s.border} rounded-xl p-3 text-center`}>
            <p className={`text-xl font-extrabold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search actor, resource, action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="erp-input text-xs py-2 px-3 flex-1 min-w-48"
        />
        <div className="flex flex-wrap gap-1.5">
          {['all', 'INSERT', 'UPDATE', 'DELETE', 'ERROR', 'SMS_SENT', 'PAYMENT'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize border transition-all ${
                filter === f
                  ? 'bg-violet-600 text-white border-violet-500'
                  : 'glass border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div className="glass border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Terminal header bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-black/20">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-[10px] font-mono text-slate-500 ml-2 tracking-widest uppercase">
            nexschool :: audit-log-stream :: tenant-isolated
          </span>
          {paused && (
            <span className="ml-auto text-[10px] text-amber-400 font-bold animate-pulse">⏸ PAUSED</span>
          )}
          {!paused && connected && (
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              LIVE
            </span>
          )}
        </div>

        {/* Scrollable log area */}
        <div className="overflow-y-auto flex-1 max-h-[55vh] font-mono text-xs p-2 space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400">Loading audit history...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full py-20">
              <div className="text-center">
                <p className="text-3xl mb-3">📭</p>
                <p className="text-slate-400 font-sans text-sm font-semibold">No log entries found</p>
                <p className="text-slate-500 font-sans text-xs mt-1">
                  {logs.length === 0
                    ? 'Events will appear here as users interact with the platform.'
                    : 'Try adjusting your filter or search query.'}
                </p>
              </div>
            </div>
          ) : (
            filtered.map((log, i) => {
              const cfg = ACTION_CFG[log.action] ?? ACTION_CFG['INSERT'];
              const resourceLabel = RESOURCE_LABELS[log.resource_type] ?? log.resource_type;
              const isNew = i === filtered.length - 1 && !paused;
              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 px-3 py-2 rounded-lg border transition-all group hover:bg-white/[0.02] ${
                    isNew ? cfg.bg + ' animate-fade-in' : 'border-transparent'
                  }`}
                >
                  {/* Timestamp */}
                  <span className="text-slate-600 shrink-0 tabular-nums w-16">{timeAgo(log.created_at)}</span>

                  {/* Action badge */}
                  <span className={`shrink-0 font-bold w-6 text-center ${cfg.color}`}>{cfg.icon}</span>
                  <span className={`shrink-0 uppercase tracking-widest text-[9px] font-bold py-0.5 px-1.5 rounded border ${cfg.bg} ${cfg.color} w-16 text-center`}>
                    {log.action}
                  </span>

                  {/* Resource */}
                  <span className="text-slate-400 shrink-0">{resourceLabel}</span>

                  {/* Label */}
                  {log.resource_label && (
                    <span className="text-white font-semibold truncate max-w-[160px]">{log.resource_label}</span>
                  )}

                  {/* Actor */}
                  <span className="text-slate-600 ml-auto shrink-0">by {log.actor_name}</span>

                  {/* Full timestamp on hover */}
                  <span className="text-slate-700 shrink-0 hidden group-hover:inline tabular-nums text-[10px]">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer count */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between bg-black/10">
          <span className="text-[10px] text-slate-600 font-mono">
            {filtered.length} / {logs.length} entries shown · max {MAX_ENTRIES} buffered
          </span>
          <span className={`text-[10px] font-mono font-bold ${connected ? 'text-emerald-600' : 'text-red-600'}`}>
            {connected ? '● SSE CONNECTED' : '○ DISCONNECTED'}
          </span>
        </div>
      </div>
    </div>
  );
}
