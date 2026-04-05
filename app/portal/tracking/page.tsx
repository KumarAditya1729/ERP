'use client';
import { useState, useEffect } from 'react';
import { getParentTransportRoute } from '@/app/actions/transport';

export default function ParentTrackingPage() {
  const [eta, setEta] = useState(15);
  const [route, setRoute] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getParentTransportRoute();
      if (res.success && res.data) {
        setRoute(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Locating assigned bus route...</div>;
  }

  if (!route) {
    return <div className="p-12 text-center text-slate-400">No transport route assigned yet.</div>;
  }

  return (
    <div className="p-5 space-y-6 animate-fade-in pt-8 h-[calc(100vh-140px)] flex flex-col">
      
      {/* Header Info */}
      <div className="glass border border-white/[0.08] rounded-3xl p-5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
             <h2 className="text-lg font-bold text-white">{route.name}</h2>
             <p className="text-xs text-slate-400">Driver: {route.driver_name}</p>
          </div>
          <div className="text-right">
             <span className={`badge text-xs ${route.status === 'on-route' ? 'badge-green animate-pulse' : route.status === 'delayed' ? 'badge-red' : 'badge-blue'}`}>
               {route.status === 'on-route' ? '● Live GPS' : route.status.replace('-', ' ').toUpperCase()}
             </span>
             <p className="text-xs text-slate-400 mt-1">Bus {route.bus_number}</p>
          </div>
        </div>
        
        <div className="glass-strong border border-emerald-500/20 bg-emerald-500/10 rounded-2xl p-4 flex items-center justify-between">
           <div>
             <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-1">Your Stop ETA</p>
             <p className="text-2xl font-black text-white">{eta} <span className="text-sm font-medium text-slate-300">mins</span></p>
           </div>
           <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
      </div>

      {/* Map visualization block (Stylized) */}
      <div className="flex-1 glass border border-white/[0.08] rounded-3xl relative overflow-hidden flex flex-col">
         {/* Fake Map BG */}
         <div className="absolute inset-0 bg-[#0c1222] opacity-80 z-0 flex items-center justify-center">
            <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
            <div className="absolute top-[30%] left-[40%] w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.8)] z-10 animate-ping" />
            <div className="absolute top-[30%] left-[40%] w-3 h-3 bg-emerald-500 rounded-full z-10" />
         </div>
         
         <div className="relative z-10 mt-auto bg-gradient-to-t from-[#080C1A] to-transparent p-5 pt-20">
            <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider">Live Journey Timeline</h3>
            <div className="space-y-0">
              {route.transport_stops && route.transport_stops.map((stop: any, i: number) => (
                <div key={stop.id} className="flex gap-4">
                  {/* Timeline track */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full border-2 ${
                      stop.status === 'done' ? 'bg-emerald-500 border-emerald-500' :
                      stop.status === 'current' ? 'bg-[#080C1A] border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' :
                      'bg-[#080C1A] border-slate-600'
                    }`} />
                    {i !== route.transport_stops.length - 1 && (
                      <div className={`w-0.5 h-10 ${stop.status === 'done' ? 'bg-emerald-500/50' : 'bg-slate-700/50'}`} />
                    )}
                  </div>
                  {/* Content */}
                  <div className={`pb-8 -mt-1 ${stop.status === 'upcoming' ? 'opacity-50' : ''}`}>
                    <p className={`text-sm font-bold ${stop.status === 'current' ? 'text-emerald-400' : 'text-white'}`}>{stop.stop_name}</p>
                    <p className="text-[10px] text-slate-400">{stop.scheduled_time}</p>
                  </div>
                </div>
              ))}
            </div>
         </div>
      </div>

    </div>
  );
}
