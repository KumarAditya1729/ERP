'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LibraryPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [tab, setTab] = useState<'inventory' | 'issued'>('inventory');
  const [search, setSearch] = useState('');
  const supabase = createClient();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchBooks() {
      // Deep Mock logic: if we don't have db connection/tenant, return mocked data
      const { data, error } = await supabase.from('library_books').select('*');
      if (data && data.length > 0) {
        setBooks(data);
      } else {
        // Fallback to sample data for demo purposes if DB is empty
        setBooks([
          { id: '1', title: 'Concepts of Physics (Vol 1)', author: 'H.C. Verma', category: 'Science', total_copies: 10, available_copies: 4, location_rack: 'Sci-Rack-A', isbn: '978-8177091878' },
          { id: '2', title: 'Mathematics Grade 10', author: 'R.D. Sharma', category: 'Math', total_copies: 15, available_copies: 15, location_rack: 'Math-Rack-C', isbn: '978-9383182054' },
          { id: '3', title: 'The Merchant of Venice', author: 'William Shakespeare', category: 'Literature', total_copies: 5, available_copies: 1, location_rack: 'Lit-Rack-1', isbn: '978-0198328674' },
          { id: '4', title: 'Macroeconomics', author: 'Sandeep Garg', category: 'Commerce', total_copies: 8, available_copies: 0, location_rack: 'Comm-Rack-B', isbn: '978-9388836467' },
        ]);
      }
      setLoading(false);
    }
    fetchBooks();
  }, [supabase]);

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()));
  const totalBooks = books.reduce((acc, curr) => acc + curr.total_copies, 0);
  const booksAvailable = books.reduce((acc, curr) => acc + curr.available_copies, 0);
  const booksIssued = totalBooks - booksAvailable;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border ${toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/30' : 'bg-red-950/90 text-red-400 border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Library Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track inventory, manage issues, and collect late fines.</p>
        </div>
        <div className="flex gap-2">
            <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors">
              📷 Scan Barcode
            </button>
            <button onClick={() => showToast('Add Book Modal opened. (Deep Mock)')} className="btn-primary text-sm py-2 px-4">
              + Add Book
            </button>
        </div>
      </div>

       {/* Tabs */}
       <div className="flex gap-1 border-b border-white/[0.08] mb-6">
        <button onClick={() => setTab('inventory')} className={`py-2 px-4 text-sm font-semibold transition-colors ${tab === 'inventory' ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
            📚 Book Inventory
        </button>
        <button onClick={() => setTab('issued')} className={`py-2 px-4 text-sm font-semibold transition-colors ${tab === 'issued' ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
            🔄 Issued & Returns
        </button>
      </div>

       {tab === 'inventory' ? (
           <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Volume', value: totalBooks, color: 'text-white' },
                  { label: 'Available on Shelf', value: booksAvailable, color: 'text-emerald-400' },
                  { label: 'Currently Issued', value: booksIssued, color: 'text-blue-400' },
                  { label: 'Overdue Books', value: '2', color: 'text-red-400' },
                ].map(k => (
                  <div key={k.label} className="glass border border-white/[0.08] rounded-2xl p-4">
                    <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{k.label}</p>
                  </div>
                ))}
              </div>

               {/* Table */}
               <div className="glass border border-white/[0.08] rounded-2xl overflow-hidden mt-6">
                <div className="p-4 border-b border-white/[0.08] flex justify-between items-center bg-white/[0.01]">
                    <div className="relative max-w-sm w-full">
                       <input 
                         type="text" 
                         className="erp-input w-full text-sm pl-8" 
                         placeholder="Search by Title or Author..." 
                         value={search}
                         onChange={(e) => setSearch(e.target.value)}
                       />
                       <span className="absolute top-1/2 -translate-y-1/2 left-3 opacity-50">🔍</span>
                    </div>
                </div>
                {loading ? (
                    <div className="p-12 text-center text-slate-500">Loading catalog...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/[0.05] bg-white/[0.02]">
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Book Title</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Author / ISBN</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Availability</th>
                                    <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.05]">
                                {filteredBooks.map(b => (
                                    <tr key={b.id} className="hover:bg-white/[0.02]">
                                        <td className="p-4 font-semibold text-white">{b.title}</td>
                                        <td className="p-4">
                                            <p className="text-sm text-slate-300">{b.author}</p>
                                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{b.isbn}</p>
                                        </td>
                                        <td className="p-4">
                                           <span className="bg-white/5 border border-white/10 px-2 py-1 rounded text-xs text-slate-300">{b.category}</span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-400">{b.location_rack}</td>
                                        <td className="p-4 text-right">
                                            <p className={`font-bold ${b.available_copies > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{b.available_copies} / {b.total_copies}</p>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => showToast('Issue modal opened')} disabled={b.available_copies === 0} className="text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:bg-slate-700 text-white px-3 py-1.5 rounded transition-colors">
                                                Issue Book
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
               </div>
           </>
       ) : (
           <div className="glass border border-white/[0.08] rounded-2xl p-12 text-center mt-6">
              <span className="text-5xl mb-4 block">🔄</span>
              <h2 className="text-white font-bold text-xl mb-2">Issue / Return Desk</h2>
              <p className="text-slate-400 max-w-sm mx-auto mb-6">Scan a student&apos;s ID card or book barcode to instantly issue or return a book. Late fees will be calculated automatically.</p>
              <button onClick={() => showToast('Camera activated')} className="btn-secondary">Activate Scanner</button>
              
              <div className="max-w-md mx-auto text-left mt-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                 <p className="text-sm text-orange-400 font-semibold mb-2">⚠️ Need Attention (Overdue)</p>
                 <div className="flex justify-between items-center text-xs">
                     <div>
                         <p className="text-white">Rahul Verma (Grade 10-A)</p>
                         <p className="text-slate-500">Concepts of Physics &middot; Due: 2 days ago</p>
                     </div>
                     <span className="text-red-400 font-bold">Fine: ₹20</span>
                 </div>
              </div>
           </div>
       )}

    </div>
  );
}
