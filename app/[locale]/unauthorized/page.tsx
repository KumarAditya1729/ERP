import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#080C1A' }}>
      {/* Background Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass border border-white/[0.08] shadow-2xl rounded-3xl p-10 max-w-lg w-full text-center relative z-10 animate-fade-in">
        <div className="w-20 h-20 bg-red-500/20 text-red-500 flex items-center justify-center rounded-full mx-auto mb-6">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-extrabold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-8">
          You do not have the required permissions or assigned role to view this page. If you believe this is an error, please contact your administrator.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login" className="btn-primary w-full sm:w-auto text-sm px-8 py-3">
            Switch Account
          </Link>
          <Link href="/" className="btn-secondary w-full sm:w-auto text-sm px-8 py-3">
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
