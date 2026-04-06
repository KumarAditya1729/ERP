const modules = [
  {
    icon: '🎓',
    title: 'Student & Admissions Vault',
    desc: 'Complete student sequence from admission to alumni. Secure private storage vaults for parent document uploads backed by cloud infrastructure.',
    color: 'from-violet-600/20 to-violet-800/5',
    border: 'border-violet-500/20',
    glow: 'group-hover:shadow-violet-500/20',
  },
  {
    icon: '📅',
    title: 'Attendance Tracking',
    desc: 'One-click digital roll calls. Auto SMS alerts to parents on absence. Monthly reports in seconds.',
    color: 'from-cyan-600/20 to-cyan-800/5',
    border: 'border-cyan-500/20',
    glow: 'group-hover:shadow-cyan-500/20',
  },
  {
    icon: '💰',
    title: 'Fees & Live Ledger',
    desc: 'Automated invoices, Razorpay online payments, dynamic compound late fees, and instant bulk SMS reminders from standard dashboards.',
    color: 'from-emerald-600/20 to-emerald-800/5',
    border: 'border-emerald-500/20',
    glow: 'group-hover:shadow-emerald-500/20',
  },
  {
    icon: '📚',
    title: 'Academics & Timetable',
    desc: 'Drag-and-drop timetable builder, syllabus tracking, digital homework assignments, and submission portals.',
    color: 'from-blue-600/20 to-blue-800/5',
    border: 'border-blue-500/20',
    glow: 'group-hover:shadow-blue-500/20',
  },
  {
    icon: '📝',
    title: 'Exams & AI Auto-Grader',
    desc: 'Instead of typing, simply dictate marks! Our Voice AI Auto-Grader parses subjects instantly. Compile beautiful branded PDF report cards in bulk.',
    color: 'from-amber-600/20 to-amber-800/5',
    border: 'border-amber-500/20',
    glow: 'group-hover:shadow-amber-500/20',
  },
  {
    icon: '👩‍💼',
    title: 'HR & Bulk Payroll',
    desc: 'Leave approval workflows and an immersive 1-click Bank IMPS Bulk Payroll simulator dispatching salaries instantly.',
    color: 'from-pink-600/20 to-pink-800/5',
    border: 'border-pink-500/20',
    glow: 'group-hover:shadow-pink-500/20',
  },
  {
    icon: '🚌',
    title: 'Transport & GPS',
    desc: 'Live bus tracking on map, proximity alerts to parents, zone-based billing, driver profiles, and route management.',
    color: 'from-orange-600/20 to-orange-800/5',
    border: 'border-orange-500/20',
    glow: 'group-hover:shadow-orange-500/20',
  },
  {
    icon: '📣',
    title: 'Communication Hub',
    desc: 'Broadcast notices via SMS, email, and in-app. Target all parents, a specific class, or an individual student.',
    color: 'from-teal-600/20 to-teal-800/5',
    border: 'border-teal-500/20',
    glow: 'group-hover:shadow-teal-500/20',
  },
  {
    icon: '📊',
    title: 'Analytics & Reports',
    desc: 'Live principal dashboards. Academic trends, financial health, attendance patterns — export to PDF or Excel.',
    color: 'from-indigo-600/20 to-indigo-800/5',
    border: 'border-indigo-500/20',
    glow: 'group-hover:shadow-indigo-500/20',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-28 relative">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-700/8 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="badge badge-purple text-xs mb-4">9 Powerful Modules</span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-5">
            Everything Your School Needs,
            <br />
            <span className="gradient-text">In One Platform</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Ditch the spreadsheets. NexSchool AI integrates every department into a
            single, beautiful command centre — from classroom to cash register.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" id="modules">
          {modules.map((mod) => (
            <div
              key={mod.title}
              className={`group card-hover glass bg-gradient-to-br ${mod.color} border ${mod.border} rounded-2xl p-7 transition-all duration-300 group-hover:shadow-2xl ${mod.glow}`}
            >
              <div className="text-4xl mb-4">{mod.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{mod.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{mod.desc}</p>
            </div>
          ))}
        </div>

        {/* Transport feature highlight */}
        <div className="mt-16 glass border border-orange-500/20 rounded-3xl p-10 bg-gradient-to-br from-orange-600/10 to-amber-800/5">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="badge badge-yellow mb-4">🌟 Flagship Feature</span>
              <h3 className="text-3xl font-bold text-white mb-4">
                Live Transport Tracking
                <br />
                <span className="gradient-text-gold">Parents Love</span>
              </h3>
              <p className="text-slate-400 text-base leading-relaxed mb-6">
                Parents receive real-time notifications when the school bus is 5 minutes away.
                SOS panic button, geofencing alerts, over-speed notifications, and OTP-verified
                student handover — the most comprehensive transport safety system in any ERP.
              </p>
              <div className="flex flex-wrap gap-3">
                {['📍 Live GPS Map','🔔 Proximity Alerts','🔐 OTP Handover','⚡ SOS Button','🛣️ Route Optimization','⚠️ Speed Alerts'].map((f) => (
                  <span key={f} className="badge badge-yellow text-xs py-1 px-3">{f}</span>
                ))}
              </div>
            </div>
            {/* Mini transport UI mockup */}
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Bus Route 3 — Live</span>
                <span className="badge badge-green">On Time</span>
              </div>
              {[
                { stop: 'School Gate', time: '08:05', status: 'arrived', color: 'text-emerald-400' },
                { stop: 'Sector 14 Stop', time: '08:22', status: 'departed', color: 'text-slate-400' },
                { stop: 'Rajpur Crossing', time: '08:38', status: 'next stop', color: 'text-amber-400' },
                { stop: 'Green Park Colony', time: '08:51', status: 'upcoming', color: 'text-slate-600' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.status==='arrived'?'bg-emerald-400':s.status==='departed'?'bg-slate-500':s.status==='next stop'?'bg-amber-400':'bg-slate-700'}`} />
                    {i < 3 && <div className="w-px h-6 bg-white/10 mt-1" />}
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm text-slate-300">{s.stop}</span>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{s.time}</p>
                      <p className={`text-[10px] font-semibold ${s.color}`}>{s.status}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-300 font-semibold">🔔 Parent Alert — Rahul&apos;s bus arrives in 6 min at Rajpur Crossing</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Auto Grader / HR highlight */}
        <div className="mt-10 glass border border-teal-500/20 rounded-3xl p-10 bg-gradient-to-br from-teal-600/10 to-emerald-900/5">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* AI Mock UI */}
            <div className="glass-strong border border-emerald-500/30 rounded-3xl p-6 text-center max-w-sm mx-auto w-full relative overflow-hidden">
               <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl`} />
               <div className="relative z-10 text-center flex flex-col items-center">
                  <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                    <span className="bg-gradient-to-r from-teal-400 to-emerald-400 text-transparent bg-clip-text">Voice AI</span> Grader
                  </h2>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex flex-col items-center justify-center mb-4 border border-emerald-400">
                    <span className="flex gap-1 items-end h-4">
                      <span className="w-1 h-2 bg-white animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-4 bg-white animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-3 bg-white animate-pulse" style={{ animationDelay: '300ms' }} />
                      <span className="w-1 h-2 bg-white animate-pulse" style={{ animationDelay: '450ms' }} />
                    </span>
                  </div>
                  <div className="w-full bg-slate-900/60 rounded-xl p-3 text-left">
                     <p className="text-xs text-emerald-300 font-mono leading-relaxed">&quot;Rahul Verma Math 72, Science 68, English 74...&quot;</p>
                  </div>
               </div>
            </div>
            
            {/* Text details */}
            <div className="order-first lg:order-last">
              <span className="badge badge-green mb-4">✨ New Demo Magic</span>
              <h3 className="text-3xl font-bold text-white mb-4">
                The Pitch Closer:
                <br />
                <span className="gradient-text">Voice AI Grade Extraction</span>
              </h3>
              <p className="text-slate-400 text-base leading-relaxed mb-6">
                Why have teachers type 500 rows of marks? With the new NexSchool Auto Grader, teachers simply tap their microphone on the Exams sheet and read out the marks. 
                Our AI instantly parses the names, subjects, and generates report cards in real-time. Paired with Deep Mocks across HR & Transport to guarantee a WOW factor during demos.
              </p>
              <div className="flex flex-wrap gap-3">
                {['🎙️ Voice-to-Text Parser','📄 Bulk PDF Spawner','💼 IMPS Payroll Sim','🗄️ Supabase Vault Storage'].map((f) => (
                  <span key={f} className="badge badge-green text-xs py-1 px-3">{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
