'use client';
import { useState, useEffect } from 'react';
import { getTransportRoutes, seedTransportDatabase, getFleetAnalytics, addTransportRoute, broadcastTransportAlert } from '@/app/actions/transport';

const statusCfg: Record<string, { badge: string; dot: string; label: string }> = {
  'on-route': { badge: 'badge-green', dot: 'bg-emerald-400', label: 'On Route' },
  'at-school': { badge: 'badge-blue', dot: 'bg-blue-400', label: 'At School' },
  'delayed': { badge: 'badge-red', dot: 'bg-red-400', label: 'Delayed' },
};

const stopCfg: Record<string, string> = {
  done: 'bg-emerald-400',
  current: 'bg-amber-400',
  upcoming: 'bg-slate-700',
};

export default function TransportPage() {
  const [routes, setRoutes] = useState<any[]>([]);
  const [fleetDocs, setFleetDocs] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const [showRouteForm, setShowRouteForm] = useState(false);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  
  // Mocks
  const [showSOS, setShowSOS] = useState(false);
  const [showSpeedLog, setShowSpeedLog] = useState(false);
  const [showGeo, setShowGeo] = useState(false);
  const [mockProgress, setMockProgress] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rForm, setRForm] = useState({ name: '', driver_name: '', bus_number: '', capacity: 40 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bForm, setBForm] = useState({ message: '' });

  useEffect(() => {
    async function init() {
      const seedRes = await seedTransportDatabase(); // Auto-seed mock data locally for demo if empty
      if (seedRes && !seedRes.success) {
        setLoadError(seedRes.error || 'Seed failed');
      }
      
      const [res, analyticsRes] = await Promise.all([
        getTransportRoutes(),
        getFleetAnalytics()
      ]);
      if (res.success && res.data) {
        setRoutes(res.data);
        if (res.data.length > 0) setSelected(res.data[0].id);
      } else if (!res.success) {
        setLoadError((prev) => prev ? prev + ' | ' + res.error : (res.error || 'Fetch failed'));
      }
      
      if (analyticsRes.success) {
        setFleetDocs(analyticsRes.data);
      }
      setLoading(false);
    }
    init();
  }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAddRoute = async () => {
    if (!rForm.name || !rForm.bus_number) return showToast('Route name & bus required', false);
    setIsSubmitting(true);
    const payload = { ...rForm, enrolled_students: 0, stops: [{ stop_name: 'School Campus', scheduled_time: '08:00' }] };
    const res = await addTransportRoute(payload);
    if (!res.success) {
      showToast(res.error || 'Failed', false);
    } else {
      showToast('Route provisioned successfully!');
      setRoutes([...routes, res.data]);
      setShowRouteForm(false);
      setRForm({ name: '', driver_name: '', bus_number: '', capacity: 40 });
    }
    setIsSubmitting(false);
  };

  const handleSOS = async () => {
    setShowSOS(true);
    setMockProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += 20;
      setMockProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        broadcastTransportAlert('🚨 SOS EMERGENCY: Fleet vehicle triggered SOS sequence. Dispatching nearest unit and alerting parents. Please check app for live tracker.');
      }
    }, 400);
  };

  const handleBroadcast = async () => {
    if (!bForm.message) return;
    setIsSubmitting(true);
    const res = await broadcastTransportAlert(bForm.message);
    if (!res.success) {
      showToast(res.error || 'Failed', false);
    } else {
      showToast('Broadcast SMS dispatched to all parents!');
      setShowBroadcastForm(false);
      setBForm({ message: '' });
    }
    setIsSubmitting(false);
  };

  const selectedRoute = routes.find((r) => r.id === selected) || null;
  const stops = selectedRoute?.transport_stops || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin glow-violet"></div>
        <p className="text-slate-400 font-semibold tracking-wider animate-pulse">CONNECTING TO FLEET...</p>
      </div>
    );
  }

  if (!selectedRoute) {
    return (
      <div className="p-8 text-center text-white bg-red-500/10 border border-red-500/20 rounded-xl mt-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-bold mb-2">No fleet data found</h2>
        {loadError && (
          <div className="mt-4 p-4 bg-black/40 rounded-lg text-left overflow-auto text-sm text-red-300 font-mono">
            {loadError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative z-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transport & GPS</h1>
          <p className="text-slate-400 text-sm mt-0.5">Live tracking for {routes.length} routes — {routes.reduce((s, r) => s + r.enrolled_students, 0)} students onboard</p>
        </div>
        <div className="flex gap-3">
          <button id="add-route-btn" onClick={() => setShowRouteForm(true)} className="btn-secondary text-sm py-2 px-4">+ Add Route</button>
          <button id="broadcast-alert-btn" onClick={() => setShowBroadcastForm(true)} className="btn-primary text-sm py-2 px-4">📣 Broadcast Alert</button>
        </div>
      </div>

      {/* Route Form Modal */}
      {showRouteForm && (
        <div className="glass border border-violet-500/30 rounded-2xl p-6 mb-6 animate-fade-in">
          <h2 className="text-white font-bold mb-4">🗺️ Provision New Route</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Route Name</label>
              <input type="text" className="erp-input w-full" placeholder="e.g. Route 5 - EastZone" value={rForm.name} onChange={e => setRForm({...rForm, name: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Bus Number</label>
              <input type="text" className="erp-input w-full" placeholder="DL-01-XX-0000" value={rForm.bus_number} onChange={e => setRForm({...rForm, bus_number: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Driver Name</label>
              <input type="text" className="erp-input w-full" placeholder="e.g. Anil" value={rForm.driver_name} onChange={e => setRForm({...rForm, driver_name: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Capacity</label>
              <input type="number" className="erp-input w-full" value={rForm.capacity} onChange={e => setRForm({...rForm, capacity: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
             <button onClick={handleAddRoute} disabled={isSubmitting} className="btn-primary text-sm py-2 px-5 disabled:opacity-50">{isSubmitting ? 'Provisioning...' : 'Add Route'}</button>
             <button onClick={() => setShowRouteForm(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
          </div>
        </div>
      )}

      {/* Broadcast Form Modal */}
      {showBroadcastForm && (
        <div className="glass border border-red-500/30 rounded-2xl p-6 mb-6 animate-fade-in bg-red-900/10">
          <h2 className="text-red-400 font-bold mb-4 flex items-center gap-2">📣 Broadcast Emergency Alert</h2>
          <textarea className="erp-input w-full h-24 mb-4" placeholder="Type your message here. This will be sent to all parents associated with the transport module immediately." value={bForm.message} onChange={e => setBForm({...bForm, message: e.target.value})}></textarea>
          <div className="flex gap-3">
             <button onClick={handleBroadcast} disabled={isSubmitting} className="btn-primary text-sm py-2 px-5 disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}>{isSubmitting ? 'Broadcasting...' : 'Send to All'}</button>
             <button onClick={() => setShowBroadcastForm(false)} className="btn-secondary text-sm py-2 px-4 border-red-500/20 hover:bg-red-500/10 text-red-100">Cancel</button>
          </div>
        </div>
      )}

      {/* Fleet Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Buses', value: routes.length.toString(), icon: '🚌', badge: 'badge-blue' },
          { label: 'On Route Now', value: routes.filter(r => r.status === 'on-route').length.toString(), icon: '📍', badge: 'badge-green' },
          { label: 'Students Onboard', value: routes.reduce((s, r) => s + r.enrolled_students, 0).toString(), icon: '🎓', badge: 'badge-green' },
          { label: 'Delayed Routes', value: routes.filter(r => r.status === 'delayed').length.toString(), icon: '⚠️', badge: 'badge-red' },
        ].map((s) => (
          <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4 card-hover">
            <span className="text-2xl">{s.icon}</span>
            <p className="text-xl font-bold text-white mt-2">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* NEW: Fleet Analytics Panel */}
      {fleetDocs && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Fuel & Maintenance */}
          <div className="glass border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
            <h2 className="text-sm font-bold text-white mb-4">⛽ Fuel & Maintenance Overview</h2>
            <div className="grid sm:grid-cols-2 gap-4">
               <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                 <p className="text-xs text-slate-400 mb-1">Monthly Fuel Exp.</p>
                 <p className="text-2xl font-bold text-white">₹{fleetDocs.totalFuelSpent?.toLocaleString()}</p>
                 <p className="text-[10px] text-emerald-400 mt-1">Avg KMPL: {fleetDocs.averageKMPL} km/l</p>
               </div>
               <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">Upcoming Services (Next 15 Days)</p>
                  <div className="space-y-2">
                     {fleetDocs.maintenance?.map((m: any) => (
                       <div key={m.id} className="flex justify-between items-center text-xs">
                          <span className="text-white font-medium">{m.transport_routes?.bus_number}</span>
                          <span className="text-slate-400">{m.service_type}</span>
                          <span className="text-amber-400">Due: {new Date(m.next_due_date).toLocaleDateString()}</span>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>

          {/* Safety Incidents */}
          <div className="glass border border-white/[0.08] rounded-2xl p-5">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-sm font-bold text-white">🚨 Safety Log</h2>
               <span className="badge badge-red">{fleetDocs.activeAlerts} Alerts</span>
             </div>
             <div className="space-y-3">
               {fleetDocs.incidents?.map((inc: any) => (
                 <div key={inc.id} className="text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex justify-between text-white font-semibold mb-1">
                      <span>{inc.transport_routes?.bus_number}</span>
                      <span className="text-red-400">{inc.incident_type}</span>
                    </div>
                    <p className="text-slate-400">{inc.description}</p>
                    <p className="text-[9px] text-slate-500 mt-1">{new Date(inc.reported_at).toLocaleString()}</p>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Route List */}
        <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-bold text-white">Fleet Status</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {routes.map((r) => {
              const cfg = statusCfg[r.status];
              return (
                <button
                  key={r.id}
                  id={`route-${r.id}`}
                  onClick={() => setSelected(r.id)}
                  className={`w-full text-left p-4 transition-colors ${selected === r.id ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-semibold text-white truncate">{r.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">🚌 {r.bus}</p>
                      <p className="text-xs text-slate-500 mt-0.5">👨‍✈️ {r.driver}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`badge ${cfg?.badge || 'badge-blue'} text-[10px]`}>{cfg?.label || r.status}</span>
                      <p className="text-[10px] text-slate-400 mt-1">{r.enrolled_students}/{r.capacity} seats</p>
                    </div>
                  </div>
                  {r.status === 'on-route' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[10px] text-amber-400">ETA school: 08:45 AM</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Placeholder + Route Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map mockup */}
          <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden" style={{ height: '280px' }}>
            <div className="relative w-full h-full bg-gradient-to-br from-[#0f1f3d] to-[#0a1628] flex items-center justify-center overflow-hidden">
              {/* Grid lines */}
              <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#7C3AED" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
              {/* Road lines */}
              <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 800 280">
                <path d="M 0 140 Q 200 100 400 140 Q 600 180 800 140" stroke="#4B5563" strokeWidth="8" fill="none" strokeLinecap="round"/>
                <path d="M 200 0 Q 280 100 320 140 Q 360 180 380 280" stroke="#4B5563" strokeWidth="6" fill="none" strokeLinecap="round"/>
                <path d="M 500 0 Q 520 80 480 140 Q 440 200 460 280" stroke="#374151" strokeWidth="5" fill="none" strokeLinecap="round"/>
              </svg>
              {/* Bus route path */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 280">
                <path d="M 800 229 Q 600 190 400 140 Q 280 110 150 80" stroke="#7C3AED" strokeWidth="3" fill="none" strokeDasharray="8 4" strokeLinecap="round"/>
                {/* Stops */}
                {[
                  { x: 750, y: 220, done: true },
                  { x: 560, y: 180, done: true },
                  { x: 400, y: 140, done: false, current: true },
                  { x: 260, y: 110, done: false },
                  { x: 140, y: 78, done: false },
                ].map((s, i) => (
                  <g key={i}>
                    <circle cx={s.x} cy={s.y} r="8" fill={s.current ? '#F59E0B' : s.done ? '#10B981' : '#374151'} stroke="white" strokeWidth="2"/>
                    {s.current && <circle cx={s.x} cy={s.y} r="14" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6"><animate attributeName="r" from="10" to="20" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/></circle>}
                  </g>
                ))}
                {/* Bus icon */}
                <rect x="387" y="127" width="26" height="18" rx="4" fill="#7C3AED"/>
                <text x="398" y="140" textAnchor="middle" fill="white" fontSize="10">🚌</text>
              </svg>
              {/* Legend */}
              <div className="absolute bottom-3 left-3 glass rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-white mb-1">Route 1 – North Zone</p>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1 text-[9px] text-emerald-400">● Done</span>
                  <span className="flex items-center gap-1 text-[9px] text-amber-400">● Current</span>
                  <span className="flex items-center gap-1 text-[9px] text-slate-400">● Upcoming</span>
                </div>
              </div>
              <div className="absolute top-3 right-3 glass rounded-xl px-3 py-1.5">
                <span className="text-[10px] text-emerald-400 font-bold">● LIVE</span>
              </div>
            </div>
          </div>

          {/* Route stop timeline */}
          <div className="glass border border-white/[0.08] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">{selectedRoute.name} — Stop Timeline</h2>
              <span className={`badge ${statusCfg[selectedRoute.status]?.badge || 'badge-blue'}`}>{statusCfg[selectedRoute.status]?.label || selectedRoute.status}</span>
            </div>
            <div className="space-y-0">
              {stops.map((s: any, i: number) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${stopCfg[s.status]} ${s.status === 'current' ? 'ring-2 ring-amber-400/40' : ''}`} />
                    {i < stops.length - 1 && <div className={`w-px flex-1 my-1 ${s.status === 'done' ? 'bg-emerald-400/40' : 'bg-white/10'}`} style={{ minHeight: '24px' }} />}
                  </div>
                  <div className="flex-1 flex justify-between pb-3">
                    <div>
                      <p className={`text-sm font-medium ${s.status === 'current' ? 'text-amber-300' : s.status === 'done' ? 'text-slate-300' : 'text-slate-500'}`}>{s.stop_name}</p>
                      {s.status === 'current' && (
                        <p className="text-[10px] text-amber-400 mt-0.5">🚌 Bus is here now</p>
                      )}
                    </div>
                    <p className={`text-xs ${s.status === 'done' ? 'text-emerald-400' : s.status === 'current' ? 'text-amber-400' : 'text-slate-600'}`}>{s.scheduled_time}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Driver + Bus info */}
            <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-4">
               <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Driver</p>
                <p className="text-sm font-semibold text-white">{selectedRoute.driver_name}</p>
                <p className="text-xs text-slate-400">License: DL-****-2019</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Bus</p>
                <p className="text-sm font-semibold text-white">{selectedRoute.bus_number}</p>
                <p className="text-xs text-slate-400">{selectedRoute.enrolled_students}/{selectedRoute.capacity} students</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SOS / Safety panel */}
      <div className="glass border border-red-500/20 bg-gradient-to-br from-red-600/5 to-red-900/5 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">🛡️ Safety Controls</h2>
            <p className="text-xs text-slate-400 mt-0.5">Emergency tools for transport safety management</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button id="sos-btn" onClick={handleSOS} className="text-xs text-red-400 font-bold glass border border-red-500/30 rounded-xl px-4 py-2 hover:bg-red-500/10 transition-colors">🆘 Trigger SOS Alert</button>
            <button id="overspeed-btn" onClick={() => setShowSpeedLog(true)} className="text-xs text-amber-400 font-bold glass border border-amber-500/30 rounded-xl px-4 py-2 hover:bg-amber-500/10 transition-colors">⚡ Speed Alerts Log</button>
            <button id="geofence-btn" onClick={() => setShowGeo(true)} className="text-xs text-violet-400 font-bold glass border border-violet-500/30 rounded-xl px-4 py-2 hover:bg-violet-500/10 transition-colors">📍 Geofence Settings</button>
          </div>
        </div>
      </div>

      {/* Deep Mock: SOS Trigger */}
      {showSOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="glass border border-red-500/50 rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden bg-red-900/20">
            <h2 className="text-3xl font-extrabold text-red-500 mb-2">{mockProgress >= 100 ? 'SOS Dispatched!' : 'Initiating SOS Alert'}</h2>
            {mockProgress < 100 ? (
              <div className="space-y-4 mt-6">
                <p className="text-sm text-red-300">Triangulating last active GPS coordinates and mapping emergency numbers...</p>
                <div className="w-full bg-red-950 rounded-full h-3 mb-2 border border-red-900">
                  <div className="bg-red-500 h-3 rounded-full transition-all duration-300" style={{ width: `${mockProgress}%` }} />
                </div>
              </div>
            ) : (
               <div className="mt-6">
                 <p className="text-red-300 text-sm mb-5">Command verified. Emergency broadcast deployed via SMS to school admins and parents of Route participants.</p>
                 <button onClick={() => setShowSOS(false)} className="bg-red-500 hover:bg-red-600 text-white w-full py-3 rounded-xl font-bold">Acknowledge</button>
               </div>
            )}
          </div>
        </div>
      )}

      {/* Deep Mock: Speed Alerts Log */}
      {showSpeedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#080C1A]/80 backdrop-blur-md animate-fade-in">
          <div className="glass border border-amber-500/30 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold text-white mb-4">⚡ Driver Speed Telemetry Logs</h2>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
               {[
                 { vehicle: 'DL-01-GA-1876', date: 'Today, 08:42 AM', speed: '68 km/h', limit: '50 km/h', zone: 'School Zone 1' },
                 { vehicle: 'DL-01-GA-3321', date: 'Yesterday, 14:15 PM', speed: '72 km/h', limit: '60 km/h', zone: 'Highway Link' }
               ].map((log, i) => (
                 <div key={i} className="p-3 border border-amber-500/20 bg-amber-500/5 rounded-xl flex justify-between items-center">
                    <div>
                       <p className="text-sm font-bold text-amber-400">{log.vehicle}</p>
                       <p className="text-xs text-slate-400">Exceeded {log.limit} limit in {log.zone}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-lg font-mono text-red-400">{log.speed}</p>
                       <p className="text-[10px] text-slate-500">{log.date}</p>
                    </div>
                 </div>
               ))}
               <div className="p-4 text-center border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">No other speed protocol breaches recorded.</div>
            </div>
            <button onClick={() => setShowSpeedLog(false)} className="btn-secondary w-full py-2 mt-4 text-sm">Close Telemetry</button>
          </div>
        </div>
      )}

      {/* Deep Mock: Geofence Builder */}
      {showGeo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#080C1A]/80 backdrop-blur-md animate-fade-in">
          <div className="glass border border-violet-500/30 rounded-2xl w-full max-w-xl overflow-hidden">
             <div className="h-48 bg-slate-800 relative flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")' }} />
                <div className="w-32 h-32 rounded-full border-2 border-violet-400 bg-violet-500/20 absolute animate-pulse"></div>
                <p className="z-10 text-violet-300 font-mono text-sm">[ Map Interface Rendered ]</p>
             </div>
             <div className="p-6">
                <h2 className="text-lg font-bold text-white mb-2">📍 Sector 14 Boundary Configuration</h2>
                <p className="text-sm text-slate-400 mb-4">Adjust the radius to trigger alerts when fleet vehicles enter or exit the designated school zone perimeter.</p>
                <div className="mb-6">
                   <label className="text-xs text-slate-400 mb-1 flex justify-between"><span>Alert Radius</span> <span className="text-violet-400">1.5 km</span></label>
                   <input type="range" min="1" max="10" defaultValue="1.5" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="flex gap-3">
                   <button onClick={() => { setShowGeo(false); showToast('Geofence constraints synced with vehicle modems.'); }} className="btn-primary flex-1 py-2 text-sm">Save Geofence</button>
                   <button onClick={() => setShowGeo(false)} className="btn-secondary flex-1 py-2 text-sm">Cancel</button>
                </div>
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
