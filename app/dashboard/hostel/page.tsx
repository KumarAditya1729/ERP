'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Allocation {
  id: string;
  room_id: string;
  student_name: string;
  bed_number: number;
}

interface Room {
  id: string;
  room_number: string;
  block_name: string;
  room_type: string;
  capacity: number;
  floor_level: number;
  status: string; // 'vacant' | 'partial' | 'full'
  allocations?: Allocation[];
}

const blocks = ['All', 'Block A (Boys)', 'Block B (Boys)', 'Block C (Girls)', 'Block D (Girls)'];

const wardens = [
  { name: 'Mr. Rajesh Kumar', block: 'Block A & B (Boys)', phone: '+91 98100 XXXXX', shift: 'Day (6AM–8PM)' },
  { name: 'Mrs. Sunita Devi', block: 'Block C & D (Girls)', phone: '+91 98200 XXXXX', shift: 'Day (6AM–8PM)' },
  { name: 'Mr. Dharam Singh', block: 'Block A & B (Boys)', phone: '+91 97300 XXXXX', shift: 'Night (8PM–6AM)' },
];

const statusCfg: Record<string, { badge: string; label: string; dot: string }> = {
  full:    { badge: 'badge-red',    label: 'Full',    dot: 'bg-red-400' },
  partial: { badge: 'badge-yellow', label: 'Partial', dot: 'bg-amber-400' },
  vacant:  { badge: 'badge-green',  label: 'Vacant',  dot: 'bg-emerald-400' },
};

export default function HostelPage() {
  const supabase = createClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [block, setBlock] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'rooms' | 'wardens' | 'fees' | 'gatepass'>('rooms');

  // Allocation Form State
  const [allocatingBed, setAllocatingBed] = useState<number | null>(null);
  const [studentNameInput, setStudentNameInput] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const { data: rawData, error } = await supabase
      .from('hostel_rooms')
      .select('*, allocations:hostel_allocations(*)')
      .order('room_number', { ascending: true });

    if (error) {
      showToast('Failed to load rooms: ' + error.message, 'error');
    } else {
      // Dynamic status calculation based on allocations
      const processedRooms = (rawData as any[]).map(r => {
        const occ = r.allocations?.length || 0;
        let s = 'vacant';
        if (occ > 0 && occ < r.capacity) s = 'partial';
        if (occ >= r.capacity) s = 'full';
        return { ...r, status: s };
      });
      setRooms(processedRooms);
      if (processedRooms.length > 0 && !selected) setSelected(processedRooms[0].id);
    }
    setLoading(false);
  }, [supabase, selected]);

  useEffect(() => { fetchRooms(); }, []);

  // ─── Generate Demo Rooms if DB is empty ───────────────────────────────────
  const generateDemoRooms = async () => {
    setSaving(true);
    const { data: p } = await supabase.from('profiles').select('tenant_id').single();
    if (!p) return;
    
    const demoRooms = [
      { tenant_id: p.tenant_id, room_number: 'A-101', block_name: 'Block A (Boys)', room_type: 'Triple', capacity: 3, floor_level: 1, status: 'vacant' },
      { tenant_id: p.tenant_id, room_number: 'A-102', block_name: 'Block A (Boys)', room_type: 'Double', capacity: 2, floor_level: 1, status: 'vacant' },
      { tenant_id: p.tenant_id, room_number: 'B-201', block_name: 'Block B (Boys)', room_type: 'Triple', capacity: 3, floor_level: 2, status: 'vacant' },
      { tenant_id: p.tenant_id, room_number: 'C-301', block_name: 'Block C (Girls)', room_type: 'Triple', capacity: 3, floor_level: 3, status: 'vacant' },
    ];
    await supabase.from('hostel_rooms').insert(demoRooms);
    fetchRooms();
    setSaving(false);
  };

  // ─── Allocate Bed ────────────────────────────────────────────────────────
  const allocateBed = async (roomId: string, bedNumber: number) => {
    if (!studentNameInput.trim()) {
      showToast('Student name is required', 'error');
      return;
    }
    setSaving(true);
    const { data: p } = await supabase.from('profiles').select('tenant_id').single();
    if (!p) return;

    const { error } = await supabase.from('hostel_allocations').insert({
      tenant_id: p.tenant_id,
      room_id: roomId,
      student_name: studentNameInput,
      bed_number: bedNumber
    });

    if (error) {
      showToast('Failed to allocate: ' + error.message, 'error');
    } else {
      showToast('✅ Student allocated to bed!');
      setAllocatingBed(null);
      setStudentNameInput('');
      fetchRooms(); // refresh counts and statuses
    }
    setSaving(false);
  };

  const filtered = block === 'All' ? rooms : rooms.filter(r => r.block_name === block);
  const selectedRoom = rooms.find(r => r.id === selected);
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const totalOccupied = rooms.reduce((s, r) => s + (r.allocations?.length || 0), 0);
  const vacant = rooms.filter(r => r.status === 'vacant').length;
  const full = rooms.filter(r => r.status === 'full').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Hostel Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">{rooms.length} rooms tracked — {totalOccupied}/{totalCapacity} beds occupied</p>
        </div>
        <div className="flex gap-3">
          {rooms.length === 0 && (
            <button id="generate-demo-btn" onClick={generateDemoRooms} disabled={saving} className="btn-secondary text-sm py-2 px-4 shadow-lg shadow-violet-500/20">
              {saving ? 'Generating...' : '✨ Generate Starter Rooms'}
            </button>
          )}
          <button id="hostel-report-btn" className="btn-primary text-sm py-2 px-4">📊 Occupancy Report</button>
        </div>
      </div>

      {rooms.length === 0 && !loading ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center mt-8">
          <p className="text-4xl mb-3">🏨</p>
          <p className="text-white font-semibold">No rooms configured</p>
          <p className="text-slate-400 text-sm mt-1">Click &quot;Generate Starter Rooms&quot; above to initialize the database.</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Beds', value: totalCapacity.toString(), icon: '🛏️', color: 'border-violet-500/20' },
              { label: 'Occupied', value: totalOccupied.toString(), icon: '👤', color: 'border-blue-500/20' },
              { label: 'Vacant Rooms', value: vacant.toString(), icon: '🔓', color: 'border-emerald-500/20' },
              { label: 'Full Rooms', value: full.toString(), icon: '🔒', color: 'border-red-500/20' },
            ].map(k => (
              <div key={k.label} className={`glass border ${k.color} rounded-2xl p-4`}>
                <span className="text-2xl">{k.icon}</span>
                <p className="text-xl font-bold text-white mt-2">{k.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="flex border-b border-white/[0.08]">
              {(['rooms', 'wardens', 'gatepass', 'fees'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} id={`hostel-tab-${t}`}
                  className={`flex-1 py-3.5 text-sm font-semibold capitalize transition-colors ${tab === t ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
                  {t === 'rooms' ? '🏨 Rooms' : t === 'wardens' ? '👮 Wardens' : t === 'gatepass' ? '🎟️ Gate Pass' : '💰 Hostel Fees'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading structures…</p>
              </div>
            ) : tab === 'rooms' && (
              <div className="grid lg:grid-cols-5">
                {/* Block Filter + Room List */}
                <div className="lg:col-span-2 border-r border-white/[0.06]">
                  <div className="p-4 border-b border-white/[0.06]">
                    <select className="erp-input w-full text-sm" value={block} onChange={e => setBlock(e.target.value)}>
                      {blocks.map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
                    {filtered.map(r => {
                      const cfg = statusCfg[r.status];
                      const occList = r.allocations || [];
                      return (
                        <button key={r.id} id={`room-${r.room_number}`} onClick={() => setSelected(r.id)}
                          className={`w-full text-left p-4 transition-colors ${selected === r.id ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-white/[0.02]'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-white">Room {r.room_number}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{r.room_type} &middot; Floor {r.floor_level}</p>
                            </div>
                            <div className="text-right">
                              <span className={`badge ${cfg.badge} text-[10px]`}>{cfg.label}</span>
                              <p className="text-[10px] text-slate-500 mt-1">{occList.length}/{r.capacity} beds</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Room Detail */}
                {selectedRoom && (
                  <div className="lg:col-span-3 p-6 flex flex-col justify-between h-full min-h-[400px]">
                    <div>
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-white font-bold text-xl">Room {selectedRoom.room_number}</h3>
                          <p className="text-slate-400 text-sm">{selectedRoom.block_name} &middot; {selectedRoom.room_type} &middot; Floor {selectedRoom.floor_level}</p>
                        </div>
                        <span className={`badge ${statusCfg[selectedRoom.status].badge} shadow-lg py-1 px-3`}>{statusCfg[selectedRoom.status].label}</span>
                      </div>

                      {/* Bed grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        {Array.from({ length: selectedRoom.capacity }).map((_, i) => {
                          const bedNum = i + 1;
                          const occupant = selectedRoom.allocations?.find(a => a.bed_number === bedNum);
                          const isAllocatingThis = allocatingBed === bedNum;

                          return (
                            <div key={i} className={`rounded-2xl p-4 border text-center transition-all ${occupant ? 'glass border-violet-500/30 bg-violet-500/10' : 'border-dashed border-white/10 hover:border-white/20'}`}>
                              <div className="text-3xl mb-2">{occupant ? '🛏️' : '⚪️'}</div>
                              
                              {occupant ? (
                                <>
                                  <p className="text-sm font-semibold text-white truncate">{occupant.student_name}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Bed {bedNum}</p>
                                </>
                              ) : isAllocatingThis ? (
                                <div className="space-y-2 mt-2">
                                  <input autoFocus type="text" placeholder="Student Name" className="erp-input w-full text-xs py-1.5 px-2" value={studentNameInput} onChange={e => setStudentNameInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && allocateBed(selectedRoom.id, bedNum)} />
                                  <div className="flex gap-1 justify-center">
                                    <button onClick={() => allocateBed(selectedRoom.id, bedNum)} disabled={saving} className="bg-emerald-500/20 text-emerald-400 w-full rounded py-1 hover:bg-emerald-500 hover:text-white transition-colors">✓</button>
                                    <button onClick={() => setAllocatingBed(null)} className="bg-slate-700 text-white w-full rounded py-1 hover:bg-slate-600 transition-colors">✕</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-slate-500">Vacant</p>
                                  <p className="text-[10px] text-slate-600 mt-0.5 mb-2">Bed {bedNum}</p>
                                  <button onClick={() => { setAllocatingBed(bedNum); setStudentNameInput(''); }} className="text-[10px] bg-white/5 hover:bg-white/10 text-white px-3 py-1 rounded-full transition-colors">+ Allocate</button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-6 border-t border-white/[0.06]">
                      <button id="room-history-btn" className="btn-secondary text-sm py-2 px-4 flex-1">📋 Room History</button>
                      <button id="maintenance-btn" className="btn-secondary text-sm py-2 px-4 flex-1">🔧 Maintenance Request</button>
                    </div>
                  </div>
                )}
              </div>
            )}

             {tab === 'wardens' && (
              <div className="p-6 space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  {wardens.map((w, i) => (
                    <div key={i} className="glass border border-white/[0.08] rounded-2xl p-5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold mb-3">
                        {w.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                      </div>
                      <p className="text-white font-semibold">{w.name}</p>
                      <p className="text-xs text-slate-400 mt-1">📍 {w.block}</p>
                      <p className="text-xs text-slate-400 mt-0.5">📞 {w.phone}</p>
                      <p className="text-xs text-slate-400 mt-0.5">⏰ {w.shift}</p>
                      <div className="mt-3 flex gap-2">
                        <button className="text-xs text-violet-400 hover:text-violet-300 font-medium">Edit</button>
                        <button className="text-xs text-slate-400 hover:text-white font-medium">View Log</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'gatepass' && (
               <div className="p-6">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                       <h3 className="text-lg font-bold text-white">Digital Gate Pass Control</h3>
                       <p className="text-sm text-slate-400">Generate secure OTP-verified exit passes for weekend outings and medical leaves.</p>
                    </div>
                    <button onClick={() => showToast('Issue Pass Modal Simulated.')} className="btn-primary text-sm">+ Issue New Pass</button>
                 </div>
                 <div className="grid lg:grid-cols-3 gap-4">
                    {/* Simulator mock data */}
                    <div className="glass border border-violet-500/30 bg-violet-500/5 rounded-2xl p-5">
                       <div className="flex justify-between items-start mb-2">
                          <span className="badge badge-purple uppercase tracking-widest text-[9px]">Active (Out)</span>
                          <span className="text-xs text-slate-400 font-mono">GP-883A</span>
                       </div>
                       <p className="text-white font-bold">Arjun Patel (A-102)</p>
                       <p className="text-xs text-slate-400 mt-1">Medical Leave — Dental Appointment</p>
                       <div className="border-t border-white/10 mt-3 pt-3 flex justify-between items-center">
                          <p className="text-xs text-slate-300">Exp. Return: Today 6 PM</p>
                          <button onClick={() => showToast('Student marked returned.')} className="text-xs text-violet-400 hover:text-violet-300 font-bold bg-white/5 py-1 px-3 rounded">Mark In</button>
                       </div>
                    </div>
                    <div className="glass border border-amber-500/30 bg-amber-500/5 rounded-2xl p-5 border-dashed">
                       <div className="flex justify-between items-start mb-2">
                          <span className="badge badge-yellow uppercase tracking-widest text-[9px]">Pending Approval</span>
                          <span className="text-xs text-slate-400 font-mono">GP-884B</span>
                       </div>
                       <p className="text-white font-bold">Ravi Kumar (B-201)</p>
                       <p className="text-xs text-slate-400 mt-1">Weekend Home Visit</p>
                       <div className="border-t border-white/10 mt-3 pt-3 flex justify-between items-center gap-2">
                          <button onClick={() => showToast('Gate Pass Denied.', 'error')} className="flex-1 text-[10px] text-slate-400 hover:text-white bg-white/5 py-1.5 rounded">Deny</button>
                          <button onClick={() => showToast('OTP Pass Generated & Sent to Parent.')} className="flex-1 text-[10px] text-amber-400 hover:text-amber-300 font-bold bg-amber-500/10 py-1.5 rounded">Approve</button>
                       </div>
                    </div>
                 </div>
               </div>
            )}

            {tab === 'fees' && (
              <div className="p-6">
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Monthly Hostel Fee', value: '₹4,500', note: 'Per student per month', color: 'border-emerald-500/20' },
                    { label: 'Total Collected (Apr)', value: `₹${(totalOccupied * 4500).toLocaleString('en-IN')}`, note: `${totalOccupied} allocated students`, color: 'border-violet-500/20' },
                    { label: 'Pending',  value: '₹22,500', note: '5 students overdue', color: 'border-red-500/20' },
                  ].map(f => (
                    <div key={f.label} className={`glass border ${f.color} rounded-2xl p-5`}>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{f.label}</p>
                      <p className="text-2xl font-extrabold text-white">{f.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{f.note}</p>
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 text-sm">Hostel fee collection is handled via the main <span className="text-violet-400 font-medium">Fee Management</span> module. Hostel charges are auto-added to a student&apos;s invoice when room is allocated.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
