'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getTransportRoutes,
  addTransportRoute,
  updateRouteStatus,
  updateStopStatus,
  updateEnrolledStudents,
  deleteTransportRoute,
} from '@/app/actions/transport';

type Stop = {
  id: string;
  stop_name: string;
  scheduled_time: string;
  status: 'done' | 'current' | 'upcoming';
  sequence_order: number;
};

type Route = {
  id: string;
  name: string;
  driver_name: string;
  bus_number: string;
  capacity: number;
  enrolled_students: number;
  status: 'on-route' | 'at-school' | 'delayed';
  transport_stops: Stop[];
};

const STATUS_CONFIG = {
  'on-route': { label: 'On Route',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  'at-school': { label: 'At School', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
  'delayed':   { label: 'Delayed',   color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400 animate-pulse' },
};

const STOP_STATUS = {
  done:     { color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', icon: '✓' },
  current:  { color: 'bg-amber-500/15 border-amber-500/30 text-amber-400 animate-pulse', icon: '●' },
  upcoming: { color: 'bg-white/[0.04] border-white/10 text-slate-500', icon: '○' },
};

export default function StaffTransportPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    name: '', driver_name: '', bus_number: '', capacity: '40', enrolled_students: '0',
    stops: [{ stop_name: '', scheduled_time: '' }],
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    const res = await getTransportRoutes();
    if (res.success) setRoutes(res.data || []);
    else showToast('Failed to load routes: ' + res.error, false);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);


  const handleStatusChange = async (routeId: string, status: Route['status']) => {
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, status } : r));
    const res = await updateRouteStatus(routeId, status);
    if (!res.success) { showToast('Failed to update status', false); fetchRoutes(); }
    else showToast('Status updated');
  };

  const handleStopStatus = async (stopId: string, routeId: string, status: Stop['status']) => {
    setRoutes(prev => prev.map(r =>
      r.id === routeId
        ? { ...r, transport_stops: r.transport_stops.map(s => s.id === stopId ? { ...s, status } : s) }
        : r
    ));
    const res = await updateStopStatus(stopId, status);
    if (!res.success) { showToast('Failed to update stop', false); fetchRoutes(); }
  };

  const handleEnrolled = async (routeId: string, delta: number) => {
    const res = await updateEnrolledStudents(routeId, delta);
    if (res.success) {
      setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, enrolled_students: (res as any).newCount } : r));
    } else showToast('Failed to update count', false);
  };

  const handleDelete = async (routeId: string) => {
    const res = await deleteTransportRoute(routeId);
    if (res.success) { showToast('Route deleted'); fetchRoutes(); setDeleteConfirm(null); }
    else showToast('Failed to delete: ' + res.error, false);
  };

  const handleAddRoute = async () => {
    if (!form.name || !form.driver_name || !form.bus_number) {
      showToast('Fill all required fields', false); return;
    }
    setSaving(true);
    const filteredStops = form.stops.filter(s => s.stop_name.trim());
    const res = await addTransportRoute({
      name: form.name, driver_name: form.driver_name, bus_number: form.bus_number,
      capacity: parseInt(form.capacity) || 40,
      enrolled_students: parseInt(form.enrolled_students) || 0,
      stops: filteredStops,
    });
    if (res.success) {
      showToast('✅ Route added!');
      setShowAddModal(false);
      setForm({ name: '', driver_name: '', bus_number: '', capacity: '40', enrolled_students: '0', stops: [{ stop_name: '', scheduled_time: '' }] });
      fetchRoutes();
    } else showToast('❌ ' + res.error, false);
    setSaving(false);
  };

  const totalStudents = routes.reduce((a, r) => a + r.enrolled_students, 0);
  const totalCapacity = routes.reduce((a, r) => a + r.capacity, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🚌 Transport Fleet</h1>
          <p className="text-slate-400 text-sm">Live route tracking, driver management & stop progress</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm py-2 px-4">
            + Add Route
          </button>
        </div>
      </div>

      {/* Fleet Stats */}
      {!loading && routes.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Routes', value: routes.length, icon: '🚌', color: 'text-violet-400' },
            { label: 'On Route',     value: routes.filter(r => r.status === 'on-route').length, icon: '🟢', color: 'text-emerald-400' },
            { label: 'Delayed',      value: routes.filter(r => r.status === 'delayed').length, icon: '⚠️', color: 'text-red-400' },
            { label: 'Students',     value: `${totalStudents}/${totalCapacity}`, icon: '👥', color: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4">
              <span className="text-2xl">{s.icon}</span>
              <p className={`text-2xl font-bold mt-2 ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Route Cards */}
      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-3" />
          Loading routes…
        </div>
      ) : routes.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-14 text-center">
          <p className="text-5xl mb-4">🚌</p>
          <p className="text-white font-semibold text-lg">No routes yet</p>
          <p className="text-slate-400 text-sm mt-1">Add a route manually to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {routes.map(route => {
            const statusCfg = STATUS_CONFIG[route.status] || STATUS_CONFIG['at-school'];
            const isExpanded = expandedRoute === route.id;
            const fillPct = Math.round((route.enrolled_students / route.capacity) * 100);
            const currentStop = route.transport_stops.find(s => s.status === 'current');

            return (
              <div key={route.id} className="glass border border-white/[0.08] rounded-2xl overflow-hidden hover:border-violet-500/20 transition-all">
                {/* Route Header */}
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Status dot + name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusCfg.dot}`} />
                        <h3 className="font-bold text-white text-base">{route.name}</h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-400 mt-2">
                        <span>🚍 {route.bus_number}</span>
                        <span>👨‍✈️ {route.driver_name}</span>
                        {currentStop && <span>📍 At: {currentStop.stop_name} · {currentStop.scheduled_time}</span>}
                      </div>

                      {/* Capacity bar */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              fillPct > 90 ? 'bg-red-400' : fillPct > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleEnrolled(route.id, -1)}
                            className="w-6 h-6 rounded-full bg-white/10 text-white text-xs hover:bg-white/20 flex items-center justify-center leading-none"
                          >−</button>
                          <span className="text-xs text-slate-300 font-mono w-14 text-center">
                            {route.enrolled_students}/{route.capacity}
                          </span>
                          <button
                            onClick={() => handleEnrolled(route.id, 1)}
                            disabled={route.enrolled_students >= route.capacity}
                            className="w-6 h-6 rounded-full bg-white/10 text-white text-xs hover:bg-white/20 flex items-center justify-center leading-none disabled:opacity-30"
                          >+</button>
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {/* Live status select */}
                      <select
                        value={route.status}
                        onChange={e => handleStatusChange(route.id, e.target.value as Route['status'])}
                        className="text-xs bg-white/[0.06] border border-white/10 text-white rounded-lg px-2 py-1.5 cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <option value="on-route">🟢 On Route</option>
                        <option value="at-school">🔵 At School</option>
                        <option value="delayed">🔴 Delayed</option>
                      </select>

                      <div className="flex gap-2">
                        {route.transport_stops.length > 0 && (
                          <button
                            onClick={() => setExpandedRoute(isExpanded ? null : route.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-slate-300 hover:bg-white/10"
                          >
                            {isExpanded ? '▲ Hide' : '▼ Stops'} ({route.transport_stops.length})
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirm(route.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stop Progress (expanded) */}
                {isExpanded && route.transport_stops.length > 0 && (
                  <div className="border-t border-white/[0.06] px-5 py-4 bg-white/[0.02]">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Stop Progress</p>
                    <div className="relative">
                      {/* Track line */}
                      <div className="absolute left-3 top-3 bottom-3 w-px bg-white/10" />
                      <div className="space-y-1">
                        {route.transport_stops.map((stop, idx) => {
                          const cfg = STOP_STATUS[stop.status];
                          return (
                            <div key={stop.id} className="flex items-center gap-3 pl-2">
                              {/* Node */}
                              <button
                                onClick={() => {
                                  const statuses: Stop['status'][] = ['done', 'current', 'upcoming'];
                                  const next = statuses[(statuses.indexOf(stop.status) + 1) % 3];
                                  handleStopStatus(stop.id, route.id, next);
                                }}
                                className={`relative z-10 w-5 h-5 rounded-full border text-[10px] flex items-center justify-center font-bold shrink-0 cursor-pointer transition-all hover:scale-110 ${cfg.color}`}
                                title="Click to cycle status"
                              >
                                {cfg.icon}
                              </button>
                              <div className={`flex-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${cfg.color}`}>
                                <span className="font-medium">{stop.stop_name}</span>
                                <span className="text-xs font-mono tabular-nums">{stop.scheduled_time}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-3 pl-7">Click a stop node to cycle: upcoming → current → done</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Route Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass border border-white/[0.12] rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white">Add Bus Route</h2>

            <div className="space-y-3">
              <input className="erp-input" placeholder="Route Name * e.g. Route 5 – Central Zone" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="erp-input" placeholder="Driver Name *" value={form.driver_name}
                onChange={e => setForm({ ...form, driver_name: e.target.value })} />
              <input className="erp-input" placeholder="Bus Number * e.g. DL-01-GA-1234" value={form.bus_number}
                onChange={e => setForm({ ...form, bus_number: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="erp-input" type="number" placeholder="Capacity" value={form.capacity}
                  onChange={e => setForm({ ...form, capacity: e.target.value })} />
                <input className="erp-input" type="number" placeholder="Enrolled students" value={form.enrolled_students}
                  onChange={e => setForm({ ...form, enrolled_students: e.target.value })} />
              </div>
            </div>

            {/* Stops builder */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Stops (optional)</p>
              {form.stops.map((stop, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input className="erp-input flex-1" placeholder={`Stop ${idx + 1} name`}
                    value={stop.stop_name}
                    onChange={e => {
                      const stops = [...form.stops];
                      stops[idx] = { ...stops[idx], stop_name: e.target.value };
                      setForm({ ...form, stops });
                    }} />
                  <input className="erp-input w-24" type="time" value={stop.scheduled_time}
                    onChange={e => {
                      const stops = [...form.stops];
                      stops[idx] = { ...stops[idx], scheduled_time: e.target.value };
                      setForm({ ...form, stops });
                    }} />
                  {idx > 0 && (
                    <button className="text-red-400 hover:text-red-300 text-lg px-1"
                      onClick={() => setForm({ ...form, stops: form.stops.filter((_, i) => i !== idx) })}>×</button>
                  )}
                </div>
              ))}
              <button className="text-xs text-violet-400 hover:text-violet-300 mt-1"
                onClick={() => setForm({ ...form, stops: [...form.stops, { stop_name: '', scheduled_time: '' }] })}>
                + Add Stop
              </button>
            </div>

            {/* Bus Documents Upload */}
            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Bus Documents</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'rc', label: 'Registration (RC)' },
                  { id: 'insurance', label: 'Insurance Policy' },
                  { id: 'puc', label: 'Pollution (PUC)' },
                  { id: 'fitness', label: 'Fitness Cert' },
                  { id: 'permit', label: 'Route Permit' },
                  { id: 'driver', label: 'Driver License' }
                ].map(doc => (
                  <label key={doc.id} className="flex flex-col items-center justify-center p-3 border border-dashed border-white/20 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/50 cursor-pointer transition-all group">
                    <span className="text-lg mb-1 group-hover:scale-110 transition-transform">📄</span>
                    <span className="text-[10px] text-slate-300 font-semibold text-center">{doc.label}</span>
                    <span className="text-[8px] text-slate-500 mt-0.5">Click to upload</span>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => {
                       if(e.target.files && e.target.files[0]) {
                         showToast(`Selected ${e.target.files[0].name} for ${doc.label}`);
                       }
                    }} />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary flex-1 py-2.5">Cancel</button>
              <button onClick={handleAddRoute} disabled={saving} className="btn-primary flex-1 py-2.5">
                {saving ? 'Saving Route...' : 'Save & Add Route'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass border border-red-500/30 rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
            <p className="text-4xl">🗑️</p>
            <h3 className="text-white font-bold text-lg">Delete Route?</h3>
            <p className="text-slate-400 text-sm">This will permanently delete the route and all its stops. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl animate-fade-in ${
          toast.ok
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-red-500/20 text-red-300 border border-red-500/30'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
