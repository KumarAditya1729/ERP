import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import PayNowButton from '@/components/portal/PayNowButton';

export default async function ParentPortalDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();

  // Fetch students linked to this parent via the parent_links table (RBAC-safe)
  const { data: parentLinks } = await supabaseAdmin
    .from('parent_links')
    .select('student_id')
    .eq('parent_id', user.id);

  const studentIds = parentLinks?.map(l => l.student_id) || [];

  let child = null;
  if (studentIds.length > 0) {
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('*')
      .in('id', studentIds)
      .limit(1);
    child = students?.[0] || null;
  }

  if (!child) {
    // No student linked — show clear instructions
    return (
      <div className="p-5 pt-8 text-center">
        <p className="text-4xl mb-4">👋</p>
        <h2 className="text-white font-bold text-xl mb-2">No student linked yet</h2>
        <p className="text-slate-400 text-sm">Please contact your school admin to link a student to your account.</p>
        <div className="mt-6 glass border border-amber-500/20 rounded-xl p-4 text-left max-w-sm mx-auto">
          <p className="text-amber-400 text-xs font-semibold mb-1">👨‍💼 For Admins</p>
          <p className="text-slate-400 text-xs">Go to Dashboard → Students → Click &quot;Link Parent&quot; on any student row.</p>
        </div>
      </div>
    );
  }

  // Fetch notices
  const { data: notices } = await supabaseAdmin.from('notices')
       .select('*')
       .eq('tenant_id', profile?.tenant_id || '')
       .order('created_at', { ascending: false })
       .limit(2);

  // Fetch pending fees for this child
  const { data: fees } = await supabaseAdmin.from('fees')
       .select('*')
       .eq('student_id', child.id)
       .eq('status', 'pending')
       .limit(2);

  // Fetch attendance counts for linked child
  const { data: attendance } = await supabaseAdmin.from('attendance')
       .select('status')
       .eq('student_id', child.id);

  const totalDays = Math.max(attendance?.length || 0, 1);
  const presentDays = attendance?.filter((a: any) => a.status === 'present').length || 0;
  const attendancePercentage = totalDays > 1 ? Math.round((presentDays / totalDays) * 100) : 0;


  return (
    <div className="p-5 space-y-6 animate-fade-in pt-8">
      
      {/* Student Profile Overview */}
      <div className="glass border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden card-hover">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-violet-600/30 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-xl shadow-violet-500/30 border-2 border-white/10">
            {child.first_name[0]}{child.last_name[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{child.first_name} {child.last_name}</h2>
            <div className="flex gap-2 items-center mt-1">
              <span className="badge badge-purple text-[10px]">Class {child.class_grade}-{child.section}</span>
              <span className="text-xs text-slate-400">Roll: {child.roll_number}</span>
            </div>
            <p className="text-[10px] text-emerald-400 mt-1.5 font-medium flex items-center gap-1">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
               In Campus
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Attendance Ring */}
        <div className="glass border border-white/[0.08] rounded-2xl p-5 flex flex-col items-center justify-center text-center">
           <div className="relative w-20 h-20 flex items-center justify-center mb-3">
             <svg className="absolute inset-0 w-full h-full transform -rotate-90">
               <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
               <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray="226" strokeDashoffset={226 - (226 * attendancePercentage) / 100} className="text-emerald-400 transition-all duration-1000 ease-out" />
             </svg>
             <span className="text-xl font-bold text-white relative z-10">{attendancePercentage}%</span>
           </div>
           <p className="text-xs font-semibold text-slate-300">Attendance</p>
           <p className="text-[10px] text-slate-500 mt-0.5">{presentDays}/{totalDays} Days</p>
        </div>

        {/* Next Exam */}
        <div className="glass border border-amber-500/20 bg-gradient-to-br from-amber-600/10 to-transparent rounded-2xl p-5 flex flex-col justify-center">
           <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
               <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
             </svg>
           </span>
           <p className="text-lg font-bold text-white">Mathematics</p>
           <p className="text-xs font-semibold text-amber-400 mt-1">Mid-Term II</p>
           <p className="text-[10px] text-slate-400 mt-0.5">Apr 24, 9:00 AM</p>
        </div>
      </div>

      {/* Pending Fees Alert */}
      {fees && fees.length > 0 && (
        <div className="relative glass border border-red-500/30 bg-gradient-to-r from-red-600/10 to-transparent rounded-2xl p-5 overflow-hidden">
           <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-red-600/20 to-transparent pointer-events-none" />
           <div className="flex items-start gap-4">
             <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-1">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
             </div>
             <div>
               <h3 className="text-sm font-bold text-red-400">Payment Due</h3>
               <p className="text-xs text-slate-300 mt-1">
                 ₹{Number(fees[0].amount).toLocaleString()} due for {fees[0].title}. Please pay by {new Date(fees[0].due_date).toLocaleDateString()} to avoid late fines.
               </p>
                <PayNowButton
                  feeId={fees[0].id}
                  amount={Number(fees[0].amount)}
                  title={fees[0].title}
                  studentName={`${child.first_name} ${child.last_name}`}
                />
             </div>
           </div>
        </div>
      )}

      {/* School Notices */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Recent Notices</h3>
          <button className="text-[10px] text-violet-400 font-semibold hover:text-white">View All →</button>
        </div>
        <div className="space-y-3">
          {notices && notices.length > 0 ? notices.map((n) => (
            <div key={n.id} className="glass border border-white/[0.08] rounded-2xl p-4 card-hover">
               <div className="flex justify-between items-start mb-2">
                 <h4 className="text-xs font-bold text-white">{n.title}</h4>
                 <span className="text-[9px] text-slate-500 whitespace-nowrap ml-2">{new Date(n.created_at).toLocaleDateString()}</span>
               </div>
               <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{n.raw_content}</p>
            </div>
          )) : (
            <div className="glass border border-white/[0.08] rounded-2xl p-6 text-center">
               <p className="text-xs text-slate-500">No notices at the moment.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
