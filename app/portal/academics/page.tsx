'use client';
import { useState } from 'react';

const MOCK_CURRENT_CLASSES = [
  { subject: 'Mathematics', teacher: 'Priya Sharma', time: '09:00 AM - 09:45 AM', room: 'Room 201', status: 'completed' },
  { subject: 'Physics', teacher: 'Vikram Singh', time: '09:50 AM - 10:35 AM', room: 'Lab 3', status: 'active' },
  { subject: 'English', teacher: 'Sarah Jenkins', time: '10:50 AM - 11:35 AM', room: 'Room 105', status: 'upcoming' },
];

const MOCK_HOMEWORK = [
  { id: 1, subject: 'Mathematics', title: 'Algebra Practice Set 4', dueDate: 'Tomorrow', status: 'pending' },
  { id: 2, subject: 'Physics', title: 'Kinematics Lab Report', dueDate: 'Friday', status: 'submitted' },
];

export default function PortalAcademicsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Academics Hub</h1>
        <p className="text-slate-400 text-sm mt-0.5">View your daily timetable, assignments, and academic performance.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Timetable */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white flex items-center">
                <span className="text-2xl mr-2">📅</span> Today's Schedule
              </h2>
              <span className="text-sm font-medium text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-full border border-cyan-400/20">
                Tuesday
              </span>
            </div>

            <div className="space-y-4">
              {MOCK_CURRENT_CLASSES.map((cls, idx) => (
                <div 
                  key={idx} 
                  className={`relative p-5 rounded-xl border transition-all ${
                    cls.status === 'active' 
                      ? 'bg-violet-500/10 border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  {cls.status === 'active' && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-violet-500 rounded-l-xl animate-pulse" />
                  )}
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">{cls.subject}</h3>
                      <p className="text-sm text-slate-400">Class Teacher: <span className="text-slate-300">{cls.teacher}</span></p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-cyan-400 mb-1">{cls.time}</div>
                      <div className="text-xs text-slate-500 bg-white/5 inline-block px-2 py-1 rounded">{cls.room}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Homework & Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass border border-white/[0.08] rounded-2xl p-6 bg-gradient-to-br from-indigo-900/20 to-black/40">
            <h2 className="text-lg font-bold text-white flex items-center mb-6">
              <span className="text-xl mr-2">🎯</span> Performance
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1 text-slate-300">
                  <span>Overall Attendance</span>
                  <span className="text-emerald-400 font-bold">94%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[94%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1 text-slate-300">
                  <span>Assignments Completed</span>
                  <span className="text-cyan-400 font-bold">88%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 w-[88%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="glass border border-white/[0.08] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white flex items-center mb-4">
              <span className="text-xl mr-2">📝</span> Active Assignments
            </h2>
            <div className="space-y-3">
              {MOCK_HOMEWORK.map(hw => (
                <div key={hw.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-xs text-cyan-400 uppercase font-semibold">{hw.subject}</p>
                    <p className="text-sm text-white font-medium mt-0.5">{hw.title}</p>
                  </div>
                  <div className="text-right">
                    {hw.status === 'submitted' ? (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">Done</span>
                    ) : (
                      <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20">Due {hw.dueDate}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
