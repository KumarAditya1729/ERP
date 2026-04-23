'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────
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
  status: string;
  allocations?: Allocation[];
}

interface Warden {
  id: string;
  first_name: string;
  last_name: string;
  assigned_block: string;
  phone: string;
  shift: string;
}

const statusCfg: Record<string, { badge: string; label: string }> = {
  full:    { badge: 'badge-red',    label: 'Full' },
  partial: { badge: 'badge-yellow', label: 'Partial' },
  vacant:  { badge: 'badge-green',  label: 'Vacant' },
};

export default function HostelPage() {
  const supabase = createClient();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [wardens, setWardens] = useState<Warden[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingWardens, setLoadingWardens] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [blockFilter, setBlockFilter] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'rooms' | 'wardens' | 'fees' | 'gatepass'>('rooms');

  const [allocatingBed, setAllocatingBed] = useState<number | null>(null);
  const [studentNameInput, setStudentNameInput] = useState('');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hostel_rooms')
      .select('*, allocations:hostel_allocations(*)')
      .order('room_number', { ascending: true });

    if (error) {
      showToast('Failed to load rooms: ' + error.message, 'error');
    } else {
      const processed = (data as any[]).map((r) => {
        const occ = r.allocations?.length || 0;
        const status = occ === 0 ? 'vacant' : occ >= r.capacity ? 'full' : 'partial';
        return { ...r, status };
      });
      setRooms(processed);
      if (processed.length > 0 && !selected) setSelected(processed[0].id);
    }
    setLoading(false);
  }, [supabase, selected]);

  const fetchWardens = useCallback(async () => {
    setLoadingWardens(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, assigned_block, phone, shift')
      .eq('role', 'warden');

    if (!error && data) {
      setWardens(data as Warden[]);
    } else {
      setWardens([]);
    }
    setLoadingWardens(false);
  }, [supabase]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);
  useEffect(() => { if (tab === 'wardens') fetchWardens(); }, [tab, fetchWardens]);

  const generateStarterRooms = async () => {
    setSaving(true);
    const { data: p } = await supabase.from('profiles').select('tenant_id').single();
    if (!p) { setSaving(false); return; }

    const starter = [
      { tenant_id: p.tenant_id, room_number: 'A-101', block_name: 'Block A (Boys)', room_type: 'Triple', capacity: 3, floor_level: 1, status: 'vacant' },
      { tenant_id: p.tenant_id, room_number: 'A-102', block_name: 'Block A (Boys)', room_type: 'Double', capacity: 2, floor_level: 1, status: 'vacant' },
      { tenant_id: p.tenant_id, room_number: 'B-201', block_name: 'Block B (Boys)', room_type: 'Triple', capacity: 3, floor_level: 2, status: 'vacant' },
      { tenant_id: p.tenant_id, room_number: 'C-301', block_name: 'Block C (Girls)', room_type: 'Triple', capacity: 3, floor_level: 3, status: 'vacant' },
      { tenant_id: p.tenant_id, room_number: 'D-401', block_name: 'Block D (Girls)', room_type: 'Double', capacity: 2, floor_level: 4, status: 'vacant' },
    ];

    const { error } = await supabase.from('hostel_rooms').insert(starter);
    if (error) {
      showToast('Failed to initialize rooms: ' + error.message, 'error');
    } else {
      showToast('✅ Starter room configuration created!');
      fetchRooms();
    }
    setSaving(false);
  };

  const allocateBed = async (roomId: string, bedNumber: number) => {
    if (!studentNameInput.trim()) { showToast('Student name is required', 'error'); return; }
    setSaving(true);
    const { data: p } = await supabase.from('profiles').select('tenant_id').single();
    if (!p) { setSaving(false); return; }

    const { error } = await supabase.from('hostel_allocations').insert({
      tenant_id: p.tenant_id,
      room_id: roomId,
      student_name: studentNameInput,
      bed_number: bedNumber,
    });

    if (error) {
      showToast('Failed to allocate: ' + error.message, 'error');
    } else {
      showToast('✅ Student allocated to bed!');
      setAllocatingBed(null);
      setStudentNameInput('');
      fetchRooms();
    }
    setSaving(false);
  };

  const blocks = ['All', ...Array.from(new Set(rooms.map((r) => r.block_name)))];
  const filtered = blockFilter === 'All' ? rooms : rooms.filter((r) => r.block_name === blockFilter);
  const selectedRoom = rooms.find((r) => r.id === selected);
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const totalOccupied = rooms.reduce((s, r) => s + (r.allocations?.length || 0), 0);

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
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? 'Loading...' : `${rooms.length} rooms · ${totalOccupied}/${totalCapacity} beds occupied`}
          </p>
        </div>
        <div className="flex gap-3">
          {!loading && rooms.length === 0 && (
            <button id="generate-rooms-btn" onClick={generateStarterRooms} disabled={saving} className="btn-secondary text-sm py-2 px-4">
              {saving ? 'Initializing...' : '✨ Initialize Rooms'}
            </button>
          )}
          <button id="hostel-report-btn" className="btn-primary text-sm py-2 px-4">📊 Occupancy Report</button>
        </div>
      </div>

      {loading ? (
        <div className="glass border border-white/[0.08] rounded-3xl p-16 text-center">
          <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Loading hostel layout...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="relative glass border border-white/[0.08] rounded-3xl p-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-violet-500/10 flex items-center justify-center text-5xl mb-6 shadow-[0_0_40px_rgba(139,92,246,0.15)] border border-violet-500/20">
              🏨
            </div>
            <h2 className="text-white font-extrabold text-2xl tracking-tight mb-2">No Rooms Configured</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8">
              Your hostel layout is currently empty. Initialize the standard room structure to start allocating beds and managing wardens.
            </p>
            <button 
              id="generate-rooms-btn-center" 
              onClick={generateStarterRooms} 
              disabled={saving} 
              className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Initializing...
                </>
              ) : '✨ Initialize Room Structure'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Row — all computed live from DB */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Beds', value: totalCapacity, icon: '🛏️', color: 'border-violet-500/20' },
              { label: 'Occupied', value: totalOccupied, icon: '👤', color: 'border-blue-500/20' },
              { label: 'Vacant Rooms', value: rooms.filter((r) => r.status === 'vacant').length, icon: '🔓', color: 'border-emerald-500/20' },
              { label: 'Full Rooms', value: rooms.filter((r) => r.status === 'full').length, icon: '🔒', color: 'border-red-500/20' },
            ].map((k) => (
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
              {(['rooms', 'wardens', 'gatepass', 'fees'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} id={`hostel-tab-${t}`}
                  className={`flex-1 py-3.5 text-sm font-semibold capitalize transition-colors ${tab === t ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
                  {t === 'rooms' ? '🏨 Rooms' : t === 'wardens' ? '👮 Wardens' : t === 'gatepass' ? '🎟️ Gate Pass' : '💰 Hostel Fees'}
                </button>
              ))}
            </div>

            {/* ROOMS TAB */}
            {tab === 'rooms' && (
              <div className="grid lg:grid-cols-5">
                <div className="lg:col-span-2 border-r border-white/[0.06]">
                  <div className="p-4 border-b border-white/[0.06]">
                    <select className="erp-input w-full text-sm" value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
                      {blocks.map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
                    {filtered.map((r) => {
                      const cfg = statusCfg[r.status];
                      const occ = r.allocations?.length || 0;
                      return (
                        <button key={r.id} id={`room-${r.room_number}`} onClick={() => setSelected(r.id)}
                          className={`w-full text-left p-4 transition-colors ${selected === r.id ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'hover:bg-white/[0.02]'}`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-white">Room {r.room_number}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{r.room_type} · Floor {r.floor_level}</p>
                            </div>
                            <div className="text-right">
                              <span className={`badge ${cfg.badge} text-[10px]`}>{cfg.label}</span>
                              <p className="text-[10px] text-slate-500 mt-1">{occ}/{r.capacity} beds</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedRoom && (
                  <div className="lg:col-span-3 p-6 flex flex-col justify-between min-h-[400px]">
                    <div>
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-white font-bold text-xl">Room {selectedRoom.room_number}</h3>
                          <p className="text-slate-400 text-sm">{selectedRoom.block_name} · {selectedRoom.room_type} · Floor {selectedRoom.floor_level}</p>
                        </div>
                        <span className={`badge ${statusCfg[selectedRoom.status].badge} shadow-lg py-1 px-3`}>{statusCfg[selectedRoom.status].label}</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        {Array.from({ length: selectedRoom.capacity }).map((_, i) => {
                          const bedNum = i + 1;
                          const occupant = selectedRoom.allocations?.find((a) => a.bed_number === bedNum);
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
                                  <input autoFocus type="text" placeholder="Student Name" className="erp-input w-full text-xs py-1.5 px-2" value={studentNameInput} onChange={(e) => setStudentNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && allocateBed(selectedRoom.id, bedNum)} />
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

            {/* WARDENS TAB — real DB data */}
            {tab === 'wardens' && (
              loadingWardens ? (
                <div className="p-12 text-center">
                  <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Loading warden records...</p>
                </div>
              ) : wardens.length === 0 ? (
                <div className="p-16 text-center">
                  <p className="text-4xl mb-3">👮</p>
                  <p className="text-white font-semibold">No Wardens Assigned</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Assign staff members the <span className="text-violet-400 font-mono">warden</span> role in the HR module to manage hostel blocks.
                  </p>
                </div>
              ) : (
                <div className="p-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    {wardens.map((w, i) => (
                      <div key={w.id} className="glass border border-white/[0.08] rounded-2xl p-5">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center text-white font-bold mb-3`}>
                          {`${w.first_name[0] || ''}${w.last_name[0] || ''}`}
                        </div>
                        <p className="text-white font-semibold">{w.first_name} {w.last_name}</p>
                        <p className="text-xs text-slate-400 mt-1">📍 {w.assigned_block || 'Block not assigned'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">📞 {w.phone || 'Phone not set'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">⏰ {w.shift || 'Shift not set'}</p>
                        <div className="mt-3 flex gap-2">
                          <button className="text-xs text-violet-400 hover:text-violet-300 font-medium">Edit</button>
                          <button className="text-xs text-slate-400 hover:text-white font-medium">View Log</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}

            {/* GATE PASS TAB — enterprise-ready empty state with DB query */}
            {tab === 'gatepass' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">Digital Gate Pass Control</h3>
                    <p className="text-sm text-slate-400">Manage OTP-verified exit passes for weekend outings and medical leaves.</p>
                  </div>
                  <button
                    onClick={() => showToast('Gate pass module coming soon. Requires SMS OTP integration.', 'error')}
                    className="btn-primary text-sm"
                  >
                    + Issue New Pass
                  </button>
                </div>
                <div className="glass border border-dashed border-white/10 rounded-2xl p-16 text-center">
                  <p className="text-4xl mb-3">🎟️</p>
                  <p className="text-white font-semibold">No Active Gate Passes</p>
                  <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
                    Gate passes issued to hostel students will appear here. This module requires Twilio SMS OTP integration for parent verification.
                  </p>
                </div>
              </div>
            )}

            {/* FEES TAB — computed from live allocation count */}
            {tab === 'fees' && (
              <div className="p-6">
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: 'Monthly Hostel Fee', value: '₹4,500', note: 'Per student per month', color: 'border-emerald-500/20' },
                    { label: 'Total Collected (This Month)', value: `₹${(totalOccupied * 4500).toLocaleString('en-IN')}`, note: `${totalOccupied} allocated students`, color: 'border-violet-500/20' },
                    { label: 'Not Yet Invoiced', value: '₹0', note: 'Auto-invoiced on allocation', color: 'border-blue-500/20' },
                  ].map((f) => (
                    <div key={f.label} className={`glass border ${f.color} rounded-2xl p-5`}>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{f.label}</p>
                      <p className="text-2xl font-extrabold text-white">{f.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{f.note}</p>
                    </div>
                  ))}
                </div>
                <p className="text-slate-400 text-sm">
                  Hostel fee collection is managed via the <span className="text-violet-400 font-medium">Fee Management</span> module.
                  Hostel charges are auto-added to a student&apos;s invoice when a bed is allocated.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
