import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import PayNowButton from '@/components/portal/PayNowButton';

export default async function PortalFeesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch linked students
  const { data: parentLinks } = await supabaseAdmin
    .from('parent_links')
    .select('student_id')
    .eq('parent_id', user.id);

  const studentIds = parentLinks?.map(l => l.student_id) || [];

  if (studentIds.length === 0) {
    return (
      <div className="p-5 pt-8 text-center animate-fade-in">
        <p className="text-4xl mb-4">💳</p>
        <h2 className="text-white font-bold text-xl mb-2">No student linked</h2>
        <p className="text-slate-400 text-sm">Please ask your school to link a student profile to see pending fees.</p>
      </div>
    );
  }

  // Fetch fees for these students
  const { data: fees } = await supabaseAdmin
    .from('fees')
    .select('*, students(first_name, last_name)')
    .in('student_id', studentIds)
    .order('due_date', { ascending: false });

  const pendingFees = fees?.filter(f => f.status === 'pending') || [];
  const paidFees = fees?.filter(f => f.status === 'paid') || [];

  return (
    <div className="p-5 space-y-6 pt-8 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">Fee Management</h1>
        <span className="badge badge-purple">Session 2026</span>
      </div>

      {pendingFees.length === 0 && paidFees.length === 0 && (
         <div className="glass border border-white/[0.08] rounded-2xl p-6 text-center">
            <p className="text-slate-500 text-sm">No fee records found for the current session.</p>
         </div>
      )}

      {/* Pending Dues */}
      {pendingFees.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Pending Dues</h2>
          {pendingFees.map(fee => (
            <div key={fee.id} className="relative glass border border-red-500/30 bg-gradient-to-r from-red-600/10 to-transparent rounded-2xl p-5 overflow-hidden card-hover">
               <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-red-600/20 to-transparent pointer-events-none" />
               <div className="flex justify-between items-start mb-3">
                 <div>
                   <h3 className="text-lg font-bold text-white">{fee.title}</h3>
                   <p className="text-xs text-slate-400">{fee.students?.first_name} {fee.students?.last_name}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-xl font-extrabold text-red-400">₹{Number(fee.amount).toLocaleString()}</p>
                   <p className="text-[10px] text-slate-500 mt-1">Due: {new Date(fee.due_date).toLocaleDateString()}</p>
                 </div>
               </div>
               <div className="pt-2 border-t border-red-500/20">
                 <PayNowButton feeId={fee.id} amount={Number(fee.amount)} title={fee.title} studentName={`${fee.students?.first_name} ${fee.students?.last_name}`} />
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Paid History */}
      {paidFees.length > 0 && (
        <div className="space-y-4 mt-8">
          <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Payment History</h2>
          <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
            {paidFees.map(fee => (
              <div key={fee.id} className="p-4 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                <div>
                   <h3 className="text-sm font-bold text-white">{fee.title}</h3>
                   <div className="flex items-center gap-2 mt-1">
                     <span className="text-[10px] text-emerald-400">✅ Paid on {new Date(fee.paid_at || fee.created_at).toLocaleDateString()}</span>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-sm font-bold text-slate-300">₹{Number(fee.amount).toLocaleString()}</p>
                   {fee.payment_method && <p className="text-[9px] text-slate-500 uppercase">{fee.payment_method}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
