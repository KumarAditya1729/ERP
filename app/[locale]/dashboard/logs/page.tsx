'use client';

import { useState, useEffect } from 'react';
import { getAuditLogs } from '@/app/actions/audit';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [severity, setSeverity] = useState('');
  const [resourceType, setResourceType] = useState('');

  useEffect(() => {
    loadLogs();
  }, [action, severity, resourceType]);

  const loadLogs = async () => {
    setLoading(true);
    const res = await getAuditLogs({ action, severity, resource_type: resourceType, search });
    if (res.logs) {
      setLogs(res.logs);
    }
    setLoading(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'error': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'warn': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'success': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  };

  const getActionColor = (act: string) => {
    switch(act) {
      case 'INSERT': return 'text-emerald-400';
      case 'DELETE': return 'text-red-400';
      case 'UPDATE': return 'text-amber-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit Logs</h1>
          <p className="text-sm text-slate-400 mt-1">System-wide security and activity monitoring</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#0A0F24] border border-white/[0.05] rounded-2xl p-4 flex flex-wrap gap-4 items-end shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Search User/Resource</label>
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-input w-full text-sm" 
            placeholder="Search logs..." 
          />
        </form>
        
        <div className="w-40">
          <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} className="erp-input w-full text-sm">
            <option value="">All Actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="EXPORT">EXPORT</option>
            <option value="SMS_SENT">SMS_SENT</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>

        <div className="w-40">
          <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="erp-input w-full text-sm">
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="success">Success</option>
          </select>
        </div>

        <div className="w-40">
          <label className="block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1.5">Resource</label>
          <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="erp-input w-full text-sm">
            <option value="">All Modules</option>
            <option value="students">Students</option>
            <option value="fees">Fees</option>
            <option value="attendance">Attendance</option>
            <option value="transport_routes">Transport</option>
            <option value="leave_requests">HR Leaves</option>
            <option value="notices">Notices</option>
            <option value="hostel_gate_passes">Hostel</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#0A0F24] border border-white/[0.05] rounded-2xl overflow-hidden shadow-2xl relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0F24]/50 backdrop-blur-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.05]">
                <th className="p-4 text-xs font-bold tracking-wider text-slate-400 uppercase">Timestamp</th>
                <th className="p-4 text-xs font-bold tracking-wider text-slate-400 uppercase">Actor</th>
                <th className="p-4 text-xs font-bold tracking-wider text-slate-400 uppercase">Action</th>
                <th className="p-4 text-xs font-bold tracking-wider text-slate-400 uppercase">Resource</th>
                <th className="p-4 text-xs font-bold tracking-wider text-slate-400 uppercase">Severity</th>
                <th className="p-4 text-xs font-bold tracking-wider text-slate-400 uppercase">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {logs.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No audit logs match your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 text-sm text-slate-300 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-white">{log.actor_name}</div>
                      {log.user && (
                        <div className="text-xs text-slate-500">{log.user.role}</div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`text-sm font-bold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-200 capitalize">{log.resource_type?.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-slate-500">{log.resource_label}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="p-4 max-w-[200px] truncate group-hover:whitespace-normal group-hover:max-w-none transition-all">
                      <code className="text-xs text-slate-400 bg-black/30 px-2 py-1 rounded">
                        {JSON.stringify(log.metadata)}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
