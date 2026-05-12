'use client';
import Image from 'next/image';

import React, { useEffect, useState } from 'react';
import { User, BellRing, AlertTriangle, ArrowRight, LineChart, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getParentAcademics } from '@/app/actions/academics';

export default function ParentProactiveDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [academics, setAcademics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(prof);
        
        const res = await getParentAcademics();
        if (res.success) {
          setAcademics(res.data);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. Header Area */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
            <User className="text-slate-400 w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium tracking-wide">EduParent Portal</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome, {profile?.first_name || 'Parent'}!</h1>
          </div>
        </div>
        <button className="w-12 h-12 rounded-2xl bg-violet-600/20 text-violet-400 flex items-center justify-center border border-violet-500/20 relative">
          <BellRing className="w-6 h-6" />
          <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#090b14]" />
        </button>
      </header>

      {/* 2. Active Student Card */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 p-5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-md">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-emerald-500/10 opacity-50" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-emerald-500/50 flex items-center justify-center text-xl overflow-hidden shrink-0">
               {loading ? '...' : '🎓'}
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">Student:</p>
              <h2 className="text-2xl font-bold text-white">{loading ? 'Loading...' : (academics?.timetable?.[0]?.class_name || 'Your Child')}</h2>
              <p className="text-sm text-slate-300">Active Enrollment</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide">
            Active
          </div>
        </div>
      </div>

      {/* 3. Proactive Alerts Zone */}
      <section className="space-y-4">
        {(academics?.attendance || 100) < 85 && (
          <div className="rounded-3xl border border-red-500/30 bg-red-950/40 p-5 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-red-500 font-bold uppercase tracking-wider text-sm">
                  <AlertTriangle className="w-5 h-5 fill-red-500 border-red-500 text-red-950" />
                  <span>Attendance Alert</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-red-500 text-red-950 flex items-center justify-center font-bold text-sm">!</div>
              </div>
              <p className="text-slate-300 text-sm mb-4">Current Attendance is {academics.attendance}%. Minimum requirement is 85%.</p>
              <div className="flex gap-3">
                <button className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-semibold py-2.5 rounded-xl border border-red-500/30 transition-colors">
                  View History
                </button>
                <button className="flex-1 bg-transparent hover:bg-white/5 text-slate-300 text-sm font-semibold py-2.5 rounded-xl border border-white/10 transition-colors">
                  Contact School
                </button>
              </div>
            </div>
          </div>
        )}

        {(academics?.pendingFees || 0) > 0 && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-950/40 p-5 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-amber-500 font-bold uppercase tracking-wider text-sm">
                  <BellRing className="w-5 h-5 fill-amber-500 text-amber-950" />
                  <span>Fee Warning</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-amber-500 text-amber-950 flex items-center justify-center font-bold text-sm">!</div>
              </div>
              <p className="text-slate-300 text-sm mb-4">Pending Fee Payment: ₹{academics.pendingFees.toLocaleString()}</p>
              <button className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm font-bold py-2.5 px-6 rounded-xl border border-amber-500/50 transition-colors flex items-center gap-2 w-max">
                Pay Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {!academics?.pendingFees && academics?.attendance >= 85 && (
           <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                 <CheckCircle2 className="text-emerald-500 w-6 h-6" />
              </div>
              <p className="text-white font-bold text-sm">All Clear!</p>
              <p className="text-slate-400 text-xs">No pending actions or critical alerts for your child.</p>
           </div>
        )}
      </section>

      <section className="rounded-3xl border border-emerald-500/30 bg-emerald-950/30 p-5 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-emerald-500/10 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Exam Performance</h3>
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 text-xs font-bold">{loading ? '--' : (academics?.examAverage || 0)}%</span>
        </div>
        <p className="text-emerald-400 text-sm mb-4">Average score across all assessments.</p>
        
        {/* Rendering the neon SVG graph line from the mockup */}
        <div className="w-full h-24 mt-2 relative">
           <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <path 
                d="M 0 30 L 10 20 L 20 25 L 30 15 L 40 25 L 50 15 L 60 5 L 70 10 L 80 5 L 90 20 L 100 0" 
                fill="none" 
                stroke="#34d399" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                className="drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              />
              {/* Nodes */}
              <circle cx="0" cy="30" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="10" cy="20" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="20" cy="25" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="30" cy="15" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="40" cy="25" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="50" cy="15" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="60" cy="5" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="70" cy="10" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="80" cy="5" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="90" cy="20" r="1.5" fill="#fff" className="drop-shadow-[0_0_4px_rgba(255,255,255,1)]" />
              <circle cx="100" cy="0" r="2.5" fill="#34d399" className="drop-shadow-[0_0_8px_rgba(52,211,153,1)] border-2 border-white" />
           </svg>
           {/* Week Labels */}
           <div className="absolute -bottom-4 left-0 w-full flex justify-between text-[10px] text-emerald-500/70 font-semibold">
              <span>W1</span><span>W2</span><span>W3</span><span>W4</span><span>W5</span>
              <span>W6</span><span>W7</span><span>W8</span><span>W9</span><span>W10</span>
           </div>
        </div>
      </section>

      {/* 5. Weekly Overview Mini-Grid */}
      <section>
        <h3 className="text-lg font-bold text-white tracking-tight mb-3">Weekly Overview</h3>
        <div className="grid grid-cols-4 gap-3">
          
          <div className="col-span-1 rounded-2xl bg-white/[0.03] border border-emerald-500/20 p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-emerald-400 font-medium mb-1 line-clamp-1">Attendance</span>
            <span className="text-xl font-bold text-white">{loading ? '--' : (academics?.attendance || 100)}%</span>
          </div>
          
          <div className="col-span-1 rounded-2xl bg-white/[0.03] border border-white/10 p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-slate-400 font-medium mb-1 line-clamp-1">Homework</span>
            <span className="text-xl font-bold text-white line-clamp-1">{loading ? '--' : (academics?.assignmentsCompleted || 0)}</span>
          </div>
          
          <div className={`col-span-1 rounded-2xl p-3 flex flex-col items-center justify-center text-center ${ (academics?.pendingFees || 0) > 0 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
            <span className={`text-[10px] font-medium mb-1 line-clamp-1 ${ (academics?.pendingFees || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Fees</span>
            <span className={`text-xs font-bold leading-tight ${ (academics?.pendingFees || 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
               { (academics?.pendingFees || 0) > 0 ? `₹${academics.pendingFees}` : 'Paid' }
            </span>
          </div>

          <div className="col-span-1 rounded-2xl bg-white/[0.03] border border-white/10 p-3 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] text-slate-400 font-medium mb-1 leading-tight">Upcoming</span>
            <span className="text-xs font-bold text-white line-clamp-1">{loading ? '--' : (academics?.timetable?.length || 0)} Classes</span>
          </div>

        </div>
      </section>

    </div>
  );
}
