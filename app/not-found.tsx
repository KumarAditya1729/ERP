import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen w-screen items-center justify-center p-4 bg-[#080C1A]">
      <div className="glass-strong border border-white/10 rounded-3xl p-10 max-w-lg w-full text-center float space-y-6">
        <div className="text-8xl mb-2">🔭</div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">
          404 - Sector Not Found
        </h1>
        <p className="text-slate-400 text-sm">
          The requested system node could not be localized on the current tenant domain.
        </p>
        <Link 
           href="/" 
           className="inline-block mt-4 px-6 py-3 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 rounded-xl transition-all font-semibold"
        >
          Return to Hub
        </Link>
      </div>
    </div>
  );
}
