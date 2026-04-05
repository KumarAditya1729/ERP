const testimonials = [
  {
    quote: "NexSchool AI transformed our fee collection process completely. We went from chasing parents for payments to receiving them automatically online. The parent portal is so intuitive that even our non-tech-savvy parents adopted it within a week.",
    name: 'Mrs. Sunita Mehta',
    role: "Principal, St. Xavier's High School, Mumbai",
    avatar: 'SM',
    color: 'from-violet-600 to-purple-700',
    stars: 5,
  },
  {
    quote: "The transport GPS module alone is worth every rupee. Parents used to call us constantly asking 'where is the bus?' Now the app tells them automatically. Our transport complaints dropped by 90% in the first month.",
    name: 'Mr. Rajesh Kumar',
    role: 'Director, Delhi Cambridge School, New Delhi',
    avatar: 'RK',
    color: 'from-cyan-600 to-teal-700',
    stars: 5,
  },
  {
    quote: "We evaluated 6 different ERPs before choosing NexSchool AI. The others looked like software from 2005. NexSchool AI is the only one our teachers actually enjoy using. Attendance marking used to take 10 minutes — now it's 30 seconds.",
    name: 'Dr. Anand Sharma',
    role: 'Chairman, Sharma Group of Schools, Pune',
    avatar: 'AS',
    color: 'from-emerald-600 to-green-700',
    stars: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-violet-700/10 blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <span className="badge badge-yellow text-xs mb-4">Trusted by Schools Nationwide</span>
          <h2 className="text-4xl font-bold text-white">
            What Principals Are <span className="gradient-text">Saying</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="glass card-hover border border-white/[0.08] rounded-2xl p-7 flex flex-col"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-slate-300 text-sm leading-relaxed flex-1 mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>

              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
