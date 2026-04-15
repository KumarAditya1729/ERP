'use strict';
import React from 'react';
import Link from 'next/link';
import { Home, Bell, LineChart, Wallet, MessageSquare } from 'lucide-react';

export default function ParentAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080C1A] text-slate-300 md:bg-slate-950 font-sans selection:bg-violet-500/30">
      
      {/* 
        Container constraints simulating a mobile app. 
        On desktop, this centers a phone-sized framing. 
        On true mobile, it takes up the full width natively. 
      */}
      <main className="w-full max-w-md mx-auto bg-[#080C1A] min-h-screen relative pb-24 shadow-2xl shadow-violet-900/10 md:border-x border-white/5">
        
        {/* Decorative Background Glows */}
        <div className="absolute top-0 left-0 w-full h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none translate-x-1/2" />

        {/* Dynamic Page Content */}
        <div className="relative z-10 px-5 pt-8">
          {children}
        </div>

        {/* Fixed Bottom Navigation (App Style) */}
        <nav className="fixed bottom-0 w-full max-w-md bg-[#080C1A]/80 backdrop-blur-xl border-t border-white/[0.08] px-6 py-3 flex items-center justify-between shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.5)] z-50">
          
          <NavItem icon={<Home className="w-5 h-5" />} label="Home" active />
          <NavItem icon={<Bell className="w-5 h-5" />} label="Updates" />
          <NavItem icon={<LineChart className="w-5 h-5" />} label="Grades" />
          <NavItem icon={<Wallet className="w-5 h-5" />} label="Fees" />
          <NavItem icon={<MessageSquare className="w-5 h-5" />} label="Messages" />

        </nav>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <button className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'}`}>
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
      {/* Active Dot indicator */}
      {active && <div className="w-1 h-1 bg-violet-400 rounded-full mt-0.5" />}
    </button>
  );
}
