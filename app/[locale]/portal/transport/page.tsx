import { getParentTransportRoute } from '@/app/actions/transport';
import { LiveTransportMap } from '../../dashboard/transport/LiveMap';
import { requireAuth } from '@/lib/auth-guard';
import { redirect } from 'next/navigation';

export default async function ParentTransportPortal() {
  const { user, tenantId, error: authErr } = await requireAuth(['parent', 'student']);
  if (authErr || !tenantId) return redirect('/login');

  const res = await getParentTransportRoute();
  
  if (!res.success || !res.data) {
    return (
      <div className="p-6">
        <div className="glass border border-white/[0.08] rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🚌</div>
          <h2 className="text-lg font-bold text-white">Transport Not Assigned</h2>
          <p className="text-sm text-slate-400 mt-2">Your child is currently not assigned to any active transport route. Please contact the school administration if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  const route = res.data;
  const stops = route.transport_stops || [];
  
  // Try to find the vehicle to pass to LiveMap if it's there
  // (In a real scenario, the vehicle might be linked to the route)

  return (
    <div className="space-y-6 animate-fade-in relative z-10 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Live Transport Tracker</h1>
        <p className="text-slate-400 text-sm mt-0.5">Track your child&apos;s assigned bus and view upcoming stops</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Route Details */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Assigned Route</p>
              <h2 className="text-lg font-bold text-white">{route.name}</h2>
            </div>
            <span className={`badge ${route.status === 'delayed' ? 'badge-red' : route.status === 'on-route' ? 'badge-green' : 'badge-blue'}`}>
              {route.status === 'delayed' ? 'Delayed' : route.status === 'on-route' ? 'On Route' : 'At School'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.05]">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Bus Number</p>
              <p className="text-sm font-semibold text-white">{route.bus_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Driver Name</p>
              <p className="text-sm font-semibold text-white">{route.driver_name || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Live Map */}
        <div className="lg:col-span-2 glass border border-white/[0.08] rounded-2xl overflow-hidden p-1 min-h-[300px]">
          <LiveTransportMap tenantId={tenantId} />
        </div>
      </div>

      {/* Stop Timeline */}
      <div className="glass border border-white/[0.08] rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white mb-4">Route Schedule & ETA</h2>
        <div className="space-y-0">
          {stops.map((s: any, i: number) => {
            const isDone = s.status === 'done';
            const isCurrent = s.status === 'current';
            return (
              <div key={i} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${isDone ? 'bg-emerald-400' : isCurrent ? 'bg-amber-400 ring-2 ring-amber-400/40' : 'bg-slate-700'}`} />
                  {i < stops.length - 1 && <div className={`w-px flex-1 my-1 ${isDone ? 'bg-emerald-400/40' : 'bg-white/10'}`} style={{ minHeight: '24px' }} />}
                </div>
                <div className="flex-1 flex justify-between pb-3">
                  <div>
                    <p className={`text-sm font-medium ${isCurrent ? 'text-amber-300' : isDone ? 'text-slate-300' : 'text-slate-500'}`}>{s.stop_name}</p>
                    {isCurrent && (
                      <p className="text-[10px] text-amber-400 mt-0.5">🚌 Approaching stop now</p>
                    )}
                  </div>
                  <p className={`text-xs ${isDone ? 'text-emerald-400' : isCurrent ? 'text-amber-400' : 'text-slate-600'}`}>
                    Scheduled: {s.scheduled_time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
