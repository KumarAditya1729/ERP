'use client';
import { useState, useEffect, useCallback } from 'react';
import { getHostelRooms, seedHostelDatabase } from '@/app/actions/hostel';

export default function StaffHostelPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const result = await getHostelRooms();
    if (result.success && result.data) {
      setRooms(result.data);
    } else if (!result.success) {
      showToast('Failed to load rooms: ' + result.error, false);
    }
    setLoading(false);
  }, []);

  const handleSeed = async () => {
    setLoading(true);
    const res = await seedHostelDatabase();
    if (res.success) {
      showToast('✅ Development data generated!');
      fetchRooms();
    } else {
      showToast('❌ Failed: ' + res.error, false);
      setLoading(false);
    }
  };

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const totalOccupied = rooms.reduce((s, r) => s + (r.occupied || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Hostel Room Matrix</h1>
        <p className="text-slate-400 text-sm">Monitor bed allocations and student assignments</p>
      </div>

      {!loading && rooms.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Rooms', value: rooms.length, icon: '🏨' },
            { label: 'Total Capacity', value: totalCapacity, icon: '🛏️' },
            { label: 'Occupied', value: totalOccupied, icon: '👤' },
          ].map(s => (
            <div key={s.label} className="glass border border-white/[0.08] rounded-2xl p-4">
              <span className="text-2xl">{s.icon}</span>
              <p className="text-2xl font-bold text-white mt-2">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center text-slate-400">Loading hostel data...</div>
      ) : rooms.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🏨</p>
          <p className="text-white font-semibold">No hostel rooms configured</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Click below to generate demo rooms.</p>
          <button onClick={handleSeed} className="btn-primary">Generate Demo Rooms</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rooms.map(room => {
            const occupancyPct = room.capacity ? Math.round((room.occupied / room.capacity) * 100) : 0;
            return (
              <div key={room.id} className="glass border border-white/[0.08] rounded-2xl p-5 hover:border-violet-500/30 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white">Room {room.room_number}</p>
                  <span className={`badge ${occupancyPct >= 100 ? 'badge-red' : occupancyPct >= 80 ? 'badge-purple' : 'badge-green'}`}>
                    {occupancyPct >= 100 ? 'Full' : occupancyPct >= 80 ? 'Nearly Full' : 'Available'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-3">{room.type || 'Standard'} · Floor {room.floor || '1'}</p>
                <div className="w-full bg-white/[0.08] rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full transition-all ${occupancyPct >= 100 ? 'bg-red-500' : occupancyPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">{room.occupied || 0} / {room.capacity} beds occupied</p>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl ${toast.ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
