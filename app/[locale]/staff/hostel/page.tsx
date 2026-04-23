'use client';
import { useState, useEffect, useCallback } from 'react';
import { getHostelRooms, seedHostelDatabase, addHostelRoom } from '@/app/actions/hostel';

export default function StaffHostelPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    room_number: '', block_name: 'Block A', room_type: 'Standard', capacity: '2', floor_level: '1'
  });

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

  const handleAddRoom = async () => {
    if (!form.room_number) {
      showToast('Room number is required', false);
      return;
    }
    setSaving(true);
    const res = await addHostelRoom({
      room_number: form.room_number,
      block_name: form.block_name,
      room_type: form.room_type,
      capacity: parseInt(form.capacity) || 2,
      floor_level: parseInt(form.floor_level) || 1
    });
    
    if (res.success) {
      showToast('✅ Room added successfully!');
      setShowAddModal(false);
      setForm({ room_number: '', block_name: 'Block A', room_type: 'Standard', capacity: '2', floor_level: '1' });
      fetchRooms();
    } else {
      showToast('❌ ' + res.error, false);
    }
    setSaving(false);
  };

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const totalOccupied = rooms.reduce((s, r) => s + (r.occupied || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in pt-4 pb-20">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 relative">
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-pink-600/20 to-purple-600/20 blur-2xl opacity-50 z-0 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 tracking-tight flex items-center">
            <span className="mr-3 text-3xl">🏨</span> Hostel Matrix
          </h1>
          <p className="text-slate-400 text-sm mt-1">Monitor bed allocations, room vacancies, and student assignments</p>
        </div>
        <div className="relative z-10 flex gap-3">
          {rooms.length === 0 && !loading && (
            <button onClick={handleSeed} className="btn-secondary text-sm py-2 px-4 shadow-lg shadow-black/20">
              🌱 Load Demo Rooms
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all shadow-lg shadow-pink-500/20">
            + Add Room
          </button>
        </div>
      </div>

      {!loading && rooms.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
          {[
            { label: 'Total Rooms', value: rooms.length, icon: '🏢', color: 'text-violet-400', bg: 'bg-violet-500/10' },
            { label: 'Total Capacity', value: totalCapacity, icon: '🛏️', color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Occupied Beds', value: `${totalOccupied} / ${totalCapacity}`, icon: '👥', color: 'text-pink-400', bg: 'bg-pink-500/10' },
          ].map(s => (
            <div key={s.label} className="glass-strong border border-white/[0.08] rounded-2xl p-5 flex items-center gap-4 hover:border-white/20 transition-all group">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${s.bg} border border-white/5 group-hover:scale-110 transition-transform`}>
                {s.icon}
              </div>
              <div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="glass-strong border border-white/[0.08] rounded-3xl p-16 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-pink-400 font-semibold">Loading Matrix...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="glass-strong border border-white/[0.08] rounded-3xl p-16 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-600/5 to-purple-600/5 opacity-50 transition-opacity group-hover:opacity-100" />
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-5xl mb-6 shadow-xl shadow-pink-500/10 group-hover:scale-110 transition-transform">
              🏨
            </div>
            <p className="text-2xl font-bold text-white mb-2">No rooms configured</p>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-8">Your hostel matrix is currently empty. You can add rooms manually or generate demo data to get started.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowAddModal(true)} className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg shadow-pink-500/20">
                Add Room Manually
              </button>
              <button onClick={handleSeed} className="btn-secondary py-2.5 px-6 text-sm">
                Generate Demo
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 relative z-10">
          {rooms.map(room => {
            const occupancyPct = room.capacity ? Math.round((room.occupied / room.capacity) * 100) : 0;
            const isFull = occupancyPct >= 100;
            const isNearFull = occupancyPct >= 80 && !isFull;
            
            return (
              <div key={room.id} className="glass border border-white/[0.08] rounded-2xl p-6 hover:border-pink-500/30 hover:bg-white/[0.03] transition-all group shadow-lg shadow-black/20 relative overflow-hidden">
                {isFull && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 blur-xl rounded-full pointer-events-none" />}
                {!isFull && <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-xl rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />}
                
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shadow-inner">
                      🚪
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg leading-none mb-1">Room {room.room_number}</p>
                      <p className="text-xs text-slate-400 font-semibold">{room.block_name || 'Main Block'} · Floor {room.floor_level || '1'}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${
                    isFull ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                    isNearFull ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {room.room_type || 'Standard'}
                  </span>
                </div>
                
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Occupancy</span>
                    <span className={isFull ? 'text-red-400' : 'text-emerald-400'}>{room.occupied || 0} / {room.capacity} Beds</span>
                  </div>
                  <div className="w-full bg-black/40 border border-white/5 rounded-full h-2 overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${isFull ? 'bg-red-500' : isNearFull ? 'bg-amber-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                      style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Room Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-strong border border-white/[0.12] rounded-3xl p-7 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">🚪</span> Add New Room
              </h2>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">✕</button>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Room Number *</label>
                <input className="erp-input w-full" placeholder="e.g. 101" value={form.room_number} onChange={e => setForm({...form, room_number: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Block</label>
                  <input className="erp-input w-full" placeholder="e.g. Block A" value={form.block_name} onChange={e => setForm({...form, block_name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Floor Level</label>
                  <input className="erp-input w-full" type="number" placeholder="e.g. 1" value={form.floor_level} onChange={e => setForm({...form, floor_level: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Room Type</label>
                  <select className="erp-input w-full cursor-pointer appearance-none" value={form.room_type} onChange={e => setForm({...form, room_type: e.target.value})}>
                    <option value="Standard">Standard</option>
                    <option value="Deluxe">Deluxe</option>
                    <option value="Premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Bed Capacity</label>
                  <input className="erp-input w-full" type="number" placeholder="e.g. 2" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
                </div>
              </div>

              <div className="pt-4">
                <button onClick={handleAddRoom} disabled={saving} className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold w-full py-3 rounded-xl transition-all shadow-lg shadow-pink-500/25">
                  {saving ? 'Creating Room...' : 'Create Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-xl animate-fade-in ${toast.ok ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
