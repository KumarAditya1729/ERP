'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function TeacherDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    }
    loadData();
  }, [supabase]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">Teacher Hub</h1>
        <p className="text-slate-400">Welcome back, {profile?.first_name || 'Teacher'}. Access your assigned classes, attendance logs, and grading modules here.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/teacher/students" className="glass border border-white/[0.08] rounded-2xl p-6 hover:border-violet-500/30 transition-colors group block">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">📚</div>
          <h2 className="text-xl font-semibold text-white mb-2">My Classes</h2>
          <p className="text-sm text-slate-400 mb-4">View your assigned subjects and sections for the academic year.</p>
          <div className="btn-secondary w-full text-center text-sm inline-block py-2">View Students</div>
        </Link>

        <Link href="/teacher/exams" className="glass border border-white/[0.08] rounded-2xl p-6 hover:border-emerald-500/30 transition-colors group block">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">📝</div>
          <h2 className="text-xl font-semibold text-white mb-2">Pending Grading</h2>
          <p className="text-sm text-slate-400 mb-4">You have 34 assignments and unit tests awaiting review.</p>
          <div className="btn-primary w-full text-center text-sm bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 inline-block py-2">Grade Now</div>
        </Link>

        <Link href="/teacher/attendance" className="glass border border-white/[0.08] rounded-2xl p-6 hover:border-blue-500/30 transition-colors group block">
          <div className="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">📅</div>
          <h2 className="text-xl font-semibold text-white mb-2">Mark Attendance</h2>
          <p className="text-sm text-slate-400 mb-4">Record daily attendance for your designated section.</p>
          <div className="btn-secondary w-full text-center text-sm inline-block py-2">Open Register</div>
        </Link>
      </div>
    </div>
  );
}
