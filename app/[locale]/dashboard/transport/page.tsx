'use client';
import { useState, useEffect } from 'react';
import { getTransportRoutes, getFleetAnalytics, addTransportRoute, broadcastTransportAlert, updateRouteStatus, updateStopStatus } from '@/app/actions/transport';

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
  const [showSOS, setShowSOS] = useState(false);
  
  const [demoProgress, setdemoProgress] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rForm, setRForm] = useState({ name: '', driver_name: '', bus_number: '', capacity: 40 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bForm, setBForm] = useState({ message: '' });

  useEffect(() => {
    async function init() {
      
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
    setdemoProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += 20;
      setdemoProgress(p);
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

  const selectedRoute = routes.find((r) => r.id === selected) || routes[0] || null;
  const stops = selectedRoute?.transport_stops || [];

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

      {/* Route Form Premium Modal */}
      {showRouteForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-[#080C1A]/80 backdrop-blur-xl"
            onClick={() => setShowRouteForm(false)}
          ></div>
          
          {/* Modal Content */}
          <div className="relative w-full max-w-2xl bg-[#0F1428]/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_0_80px_rgba(139,92,246,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex-none p-6 border-b border-white/[0.04] bg-gradient-to-r from-violet-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                    🗺️
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Provision New Route</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Configure fleet details and vehicle documents.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRouteForm(false)}
                  className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-6">
                {/* Fleet Details */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">1</span>
                    Fleet Identification
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1.5 block">Route Name <span className="text-red-400">*</span></label>
                      <input 
                        type="text" 
                        className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all" 
                        placeholder="e.g. Route 5 - EastZone" 
                        value={rForm.name} 
                        onChange={e => setRForm({...rForm, name: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1.5 block">Bus Registration <span className="text-red-400">*</span></label>
                      <input 
                        type="text" 
                        className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all font-mono uppercase" 
                        placeholder="DL-01-XX-0000" 
                        value={rForm.bus_number} 
                        onChange={e => setRForm({...rForm, bus_number: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"></div>

                {/* Operations */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">2</span>
                    Operational Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1.5 block">Assigned Driver</label>
                      <input 
                        type="text" 
                        className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all" 
                        placeholder="e.g. Anil Kumar" 
                        value={rForm.driver_name} 
                        onChange={e => setRForm({...rForm, driver_name: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1.5 block">Seating Capacity</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all" 
                          value={rForm.capacity} 
                          onChange={e => setRForm({...rForm, capacity: parseInt(e.target.value) || 0})} 
                          min="10" max="100"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">seats</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"></div>

                {/* Documents Upload (demo UI) */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs">3</span>
                      Compliance Documents
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">Required</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['RC Book', 'Insurance', 'PUC Cert', 'Driver License'].map((doc) => (
                      <div key={doc} className="relative group cursor-pointer border border-white/[0.08] border-dashed rounded-xl p-4 bg-white/[0.01] hover:bg-white/[0.03] hover:border-violet-500/50 transition-all text-center">
                        <div className="w-8 h-8 mx-auto rounded-full bg-white/[0.05] group-hover:bg-violet-500/20 flex items-center justify-center text-slate-400 group-hover:text-violet-400 transition-colors mb-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        </div>
                        <p className="text-xs text-slate-300 font-medium">{doc}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Upload PDF/JPG</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-none p-5 border-t border-white/[0.04] bg-[#080C1A]/50 flex items-center justify-between">
              <p className="text-xs text-slate-500">Route will be active immediately after provisioning.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowRouteForm(false)} 
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddRoute} 
                  disabled={isSubmitting || !rForm.name || !rForm.bus_number} 
                  className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all disabled:opacity-50 disabled:hover:bg-violet-600 disabled:hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Provisioning...
                    </>
                  ) : 'Provision Route'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Alert Premium Modal */}
      {showBroadcastForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-[#080C1A]/80 backdrop-blur-xl" onClick={() => setShowBroadcastForm(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0F1428]/90 backdrop-blur-2xl border border-red-500/20 rounded-3xl shadow-[0_0_80px_rgba(239,68,68,0.15)] overflow-hidden flex flex-col">
            <div className="flex-none p-6 border-b border-white/[0.04] bg-gradient-to-r from-red-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(239,68,68,0.3)]">📣</div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Broadcast Emergency Alert</h2>
                    <p className="text-xs text-red-400/80 mt-0.5">Will be sent to all parents via SMS immediately.</p>
                  </div>
                </div>
                <button onClick={() => setShowBroadcastForm(false)} className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</button>
              </div>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Alert Message <span className="text-red-400">*</span></label>
                <textarea
                  className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all h-28 resize-none"
                  placeholder="e.g. Bus Route 1 is delayed by 20 minutes due to traffic. New ETA: 9:05 AM."
                  value={bForm.message}
                  onChange={e => setBForm({...bForm, message: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['Route Delay', 'Road Block', 'Emergency Stop'].map(tmpl => (
                  <button key={tmpl} onClick={() => setBForm({message: `🚨 ${tmpl}: Please note there is a ${tmpl.toLowerCase()} affecting the transport route. We will update you shortly.`})} className="text-[10px] text-slate-400 hover:text-red-400 border border-white/[0.08] hover:border-red-500/30 rounded-lg px-2 py-2 transition-all bg-white/[0.01] hover:bg-red-500/5 font-medium">
                    {tmpl}
                  </button>
                ))}
              </div>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400">⚠️ This alert will be sent to parents of all <strong>{routes.reduce((s, r) => s + r.enrolled_students, 0)}</strong> enrolled students across <strong>{routes.length}</strong> routes.</p>
              </div>
            </div>
            <div className="flex-none p-5 border-t border-white/[0.04] bg-[#080C1A]/50 flex items-center justify-end gap-3">
              <button onClick={() => setShowBroadcastForm(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors">Cancel</button>
              <button
                onClick={handleBroadcast}
                disabled={isSubmitting || !bForm.message}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Broadcasting...</>
                ) : '📣 Send Alert to All'}
              </button>
            </div>
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

      {/* Fleet Analytics Panel */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Fuel & Maintenance */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">⛽ Fuel & Maintenance Overview</h2>
          <div className="grid sm:grid-cols-2 gap-4">
             <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 group hover:border-white/10 transition-colors">
               <p className="text-xs text-slate-400 mb-1">Monthly Fuel Exp.</p>
               <p className="text-2xl font-bold text-white">
                 {fleetDocs?.totalFuelSpent > 0 ? `₹${fleetDocs.totalFuelSpent.toLocaleString()}` : '₹0'}
               </p>
               <p className="text-[10px] text-emerald-400 mt-1">Avg KMPL: {fleetDocs?.averageKMPL || '—'} km/l</p>
               <div className="mt-3 pt-3 border-t border-white/[0.04]">
                 <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                   <span>Budget Utilization</span><span className="text-white">{fleetDocs?.totalFuelSpent > 0 ? 'Dynamic' : '0%'}</span>
                 </div>
                 <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                   <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{width: fleetDocs?.totalFuelSpent > 0 ? '20%' : '0%'}}></div>
                 </div>
               </div>
             </div>
             <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-3">Upcoming Services (Next 15 Days)</p>
                {fleetDocs?.maintenance?.length > 0 ? (
                  <div className="space-y-2">
                     {fleetDocs.maintenance.map((m: any) => (
                       <div key={m.id} className="flex justify-between items-center text-xs">
                          <span className="text-white font-medium">{m.transport_routes?.bus_number}</span>
                          <span className="text-slate-400">{m.service_type}</span>
                          <span className="text-amber-400">Due: {new Date(m.next_due_date).toLocaleDateString()}</span>
                       </div>
                     ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-4">
                    <p className="text-[10px] text-slate-500">No scheduled services</p>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Safety Incidents */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5">
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-white">🚨 Safety Log</h2>
             <span className={`badge ${(fleetDocs?.activeAlerts || 0) > 0 ? 'badge-red' : 'badge-green'}`}>
               {fleetDocs?.activeAlerts || 0} Alerts
             </span>
           </div>
           {fleetDocs?.incidents?.length > 0 ? (
             <div className="space-y-3">
               {fleetDocs.incidents.map((inc: any) => (
                 <div key={inc.id} className="text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                    <div className="flex justify-between text-white font-semibold mb-1">
                      <span>{inc.transport_routes?.bus_number}</span>
                      <span className="text-red-400">{inc.incident_type}</span>
                    </div>
                    <p className="text-slate-400">{inc.description}</p>
                    <p className="text-[9px] text-slate-500 mt-1">{new Date(inc.reported_at).toLocaleString()}</p>
                 </div>
               ))}
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-32 text-center">
               <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-2xl mb-3 border border-emerald-500/20">✅</div>
               <p className="text-sm font-semibold text-emerald-400">All Clear</p>
               <p className="text-xs text-slate-500 mt-1">No active safety incidents reported.</p>
             </div>
           )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Route List */}
        <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-bold text-white">Fleet Status</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {routes.length > 0 ? routes.map((r) => {
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
                </button>
              );
            }) : (
              <div className="p-8 text-center">
                <p className="text-xs text-slate-500">No active routes. Click &apos;+ Add Route&apos; to begin.</p>
              </div>
            )}
          </div>
        </div>

        {/* Map Placeholder + Route Detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map demoup */}
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
                 {/* Stops from DB */}
                 {stops.map((s: any, i: number) => {
                    const x = 750 - (i * 150);
                    const y = 220 - (i * 40);
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="8" fill={s.status === 'current' ? '#F59E0B' : s.status === 'done' ? '#10B981' : '#374151'} stroke="white" strokeWidth="2"/>
                        {s.status === 'current' && <circle cx={x} cy={y} r="14" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6"><animate attributeName="r" from="10" to="20" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite"/></circle>}
                      </g>
                    );
                 })}
                 {/* Bus icon (dynamic position) */}
                 {(() => {
                   const currentIdx = stops.findIndex((s: any) => s.status === 'current');
                   const busIdx = currentIdx !== -1 ? currentIdx : 0;
                   const x = 750 - (busIdx * 150) - 13;
                   const y = 220 - (busIdx * 40) - 13;
                   return (
                    <>
                      <rect x={x} y={y} width="26" height="18" rx="4" fill="#7C3AED"/>
                      <text x={x+11} y={y+13} textAnchor="middle" fill="white" fontSize="10">🚌</text>
                    </>
                   );
                 })()}
              </svg>
              {/* Legend */}
              <div className="absolute bottom-3 left-3 glass rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-white mb-1">{selectedRoute?.name || 'Live Tracker'}</p>
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
              <h2 className="text-sm font-bold text-white">{selectedRoute?.name || 'Fleet'} — Stop Timeline</h2>
              <span className={`badge ${statusCfg[selectedRoute?.status || 'at-school']?.badge || 'badge-blue'}`}>{statusCfg[selectedRoute?.status || 'at-school']?.label || 'Ready'}</span>
            </div>
            <div className="space-y-0">
              {stops.length > 0 ? stops.map((s: any, i: number) => (
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
              )) : (
                <div className="py-8 text-center border border-dashed border-white/5 rounded-xl">
                  <p className="text-xs text-slate-500">No stops configured for this route.</p>
                </div>
              )}
            </div>

            {/* Driver + Bus info */}
            {selectedRoute && (
              <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Driver</p>
                  <p className="text-sm font-semibold text-white">{selectedRoute?.driver_name || 'Unassigned'}</p>
                  <p className="text-xs text-slate-400">License: {selectedRoute?.driver_name ? 'Verified' : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Bus</p>
                  <p className="text-sm font-semibold text-white">{selectedRoute?.bus_number || '—'}</p>
                  <p className="text-xs text-slate-400">{selectedRoute?.enrolled_students || 0}/{selectedRoute?.capacity || 0} students</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SOS / Safety panel */}
      <div className="glass border border-white/[0.08] bg-gradient-to-br from-violet-600/5 to-indigo-900/5 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">🛰️ GPS & Fleet Simulation</h2>
            <p className="text-xs text-slate-400 mt-0.5">Control live vehicle telemetry and route progression</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-xl border border-white/5">
               <span className="text-[10px] text-slate-500 font-bold uppercase">Speed</span>
               <span className="text-sm font-bold text-emerald-400">{selectedRoute?.status === 'on-route' ? '42' : '0'} <span className="text-[10px] text-slate-500">km/h</span></span>
            </div>
            <button 
              onClick={async () => {
                const currentIdx = stops.findIndex((s: any) => s.status === 'current');
                const nextIdx = currentIdx === -1 ? 0 : currentIdx + 1;
                if (nextIdx < stops.length) {
                   if (currentIdx !== -1) await updateStopStatus(stops[currentIdx].id, 'done');
                   await updateStopStatus(stops[nextIdx].id, 'current');
                   if (selectedRoute?.status !== 'on-route') await updateRouteStatus(selectedRoute!.id, 'on-route');
                   showToast(`Bus advanced to ${stops[nextIdx].stop_name}`);
                   // Refresh locally
                   setRoutes(prev => prev.map(r => r.id === selected ? { ...r, status: 'on-route', transport_stops: r.transport_stops.map((s: any, idx: number) => idx === nextIdx ? { ...s, status: 'current' } : idx === currentIdx ? { ...s, status: 'done' } : s) } : r));
                } else {
                   showToast('Bus has reached the final stop.');
                   await updateRouteStatus(selectedRoute!.id, 'at-school');
                   setRoutes(prev => prev.map(r => r.id === selected ? { ...r, status: 'at-school' } : r));
                }
              }}
              className="text-xs text-violet-400 font-bold glass border border-violet-500/30 rounded-xl px-4 py-2 hover:bg-violet-500/10 transition-colors"
            >
              ⏭️ Advance to Next Stop
            </button>
            <button id="sos-btn" onClick={handleSOS} className="text-xs text-red-400 font-bold glass border border-red-500/30 rounded-xl px-4 py-2 hover:bg-red-500/10 transition-colors">🆘 SOS Alert</button>
          </div>
        </div>
      </div>


      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
