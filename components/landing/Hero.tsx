import Link from 'next/link';

const DashboardPreview = () => (
  <div className="glass rounded-2xl p-5 w-full shadow-2xl glow-violet">
    {/* Top bar */}
    <div className="flex items-center justify-between mb-5">
      <div>
        <p className="text-xs text-slate-400 font-medium">Good morning, Principal</p>
        <h3 className="text-sm font-bold text-white">Delhi Public School</h3>
      </div>
      <span className="badge badge-green flex items-center gap-1.5">
        <span className="ping-dot w-1.5 h-1.5 rounded-full bg-emerald-400 relative inline-block"></span>
        Live
      </span>
    </div>

    {/* KPI Cards */}
    <div className="grid grid-cols-2 gap-3 mb-4">
      {[
        { label: 'Students', value: '2,847', color: 'from-violet-600/30 to-violet-800/10', text: 'text-violet-300' },
        { label: 'Today Attendance', value: '94.2%', color: 'from-cyan-600/30 to-cyan-800/10', text: 'text-cyan-300' },
        { label: 'Fees Collected', value: '₹8.4L', color: 'from-emerald-600/30 to-emerald-800/10', text: 'text-emerald-300' },
        { label: 'Staff On Duty', value: '142', color: 'from-amber-600/30 to-amber-800/10', text: 'text-amber-300' },
      ].map((card) => (
        <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-xl p-3 border border-white/[0.06]`}>
          <p className={`text-lg font-bold ${card.text}`}>{card.value}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{card.label}</p>
        </div>
      ))}
    </div>

    {/* Mini bar chart */}
    <div>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Fee Collections – This Week</p>
      <div className="h-16 flex items-end gap-1">
        {[55, 72, 60, 88, 74, 92, 81].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm"
              style={{
                height: `${h}%`,
                background: i === 5 ? 'linear-gradient(to top, #7C3AED, #a78bfa)' : 'rgba(124,58,237,0.35)',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-slate-600">{d}</span>
        ))}
      </div>
    </div>

    {/* Recent alerts */}
    <div className="mt-4 space-y-2">
      {[
        { icon: '🚌', msg: 'Bus Route 3 arrived at Gate 2', time: '2m ago', color: 'badge-blue' },
        { icon: '💰', msg: 'Fee payment received – Aryan S.', time: '8m ago', color: 'badge-green' },
        { icon: '📋', msg: 'Attendance marked – Class 10A', time: '15m ago', color: 'badge-purple' },
      ].map((a, i) => (
        <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <span className="text-sm">{a.icon}</span>
          <span className="text-[10px] text-slate-300 flex-1 truncate">{a.msg}</span>
          <span className={`badge ${a.color} text-[9px]`}>{a.time}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Background glows */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-700/20 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-[400px] h-[400px] rounded-full bg-cyan-600/15 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left: Text */}
        <div className="animate-slide-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass border border-violet-500/30 rounded-full px-4 py-1.5 mb-8">
            <span className="text-sm">🚀</span>
            <span className="text-xs font-semibold text-violet-300">Now with Live GPS Transport Tracking</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            The School ERP
            <br />
            <span className="gradient-text">Schools Actually</span>
            <br />
            <span className="text-white">Love Using</span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed mb-10 max-w-lg">
            NexSchool AI brings your entire school — students, fees, attendance, transport,
            exams, and staff — into one beautifully designed platform. Built for
            modern schools that refuse to settle for clunky software.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mb-12">
            <Link href="/login" id="hero-get-started" className="btn-primary text-base px-7 py-3">
              Start Free Trial
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
            <a href="#features" id="hero-see-features" className="btn-secondary text-base px-7 py-3">
              Explore Features
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center gap-6">
            {[
              { val: '500+', label: 'Schools' },
              { val: '1M+', label: 'Students' },
              { val: '99.9%', label: 'Uptime' },
              { val: '₹50Cr+', label: 'Fees Processed' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-bold gradient-text">{s.val}</p>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dashboard Preview */}
        <div className="float hidden lg:block">
          <DashboardPreview />
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="text-xs text-slate-400">Scroll to explore</span>
        <div className="w-px h-8 bg-gradient-to-b from-violet-500 to-transparent animate-pulse" />
      </div>
    </section>
  );
}
