'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LibraryPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [tab, setTab] = useState<'inventory' | 'issued'>('inventory');
  const [search, setSearch] = useState('');
  
  // Modals & Forms
  const [showAddBook, setShowAddBook] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', category: 'Science', copies: 1, location: '' });
  const [scannerActive, setScannerActive] = useState(false);

  const supabase = createClient();

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    async function fetchBooks() {
      const { data, error } = await supabase.from('library_books').select('*');
      if (data) {
        setBooks(data);
      }
      setLoading(false);
    }
    fetchBooks();
  }, [supabase]);

  const handleAddBook = async () => {
    if (!bookForm.title || !bookForm.author) {
      showToast('Title and Author are required', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('library_books')
        .insert({
          title: bookForm.title,
          author: bookForm.author,
          category: bookForm.category,
          total_copies: bookForm.copies,
          available_copies: bookForm.copies,
          location_rack: bookForm.location || 'Unassigned',
          isbn: bookForm.isbn || null,
        })
        .select()
        .single();

      if (error) throw error;
      setBooks(prev => [data, ...prev]);
      setShowAddBook(false);
      showToast('Book added to inventory successfully!');
      setBookForm({ title: '', author: '', isbn: '', category: 'Science', copies: 1, location: '' });
    } catch (err: any) {
      showToast('Failed to add book: ' + err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()));
  const totalBooks = books.reduce((acc, curr) => acc + curr.total_copies, 0);
  const booksAvailable = books.reduce((acc, curr) => acc + curr.available_copies, 0);
  const booksIssued = totalBooks - booksAvailable;

  return (
    <div className="space-y-6 animate-fade-in relative z-10">
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
        <div className="flex gap-3">
            <button onClick={() => setTab('issued')} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              Issue / Return
            </button>
            <button onClick={() => setShowAddBook(true)} className="btn-primary text-sm py-2 px-4 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
              + Add Book
            </button>
        </div>
      </div>

      {/* Add Book Modal */}
      {showAddBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-[#080C1A]/80 backdrop-blur-xl" onClick={() => setShowAddBook(false)}></div>
          
          <div className="relative w-full max-w-xl bg-[#0F1428]/90 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-[0_0_80px_rgba(139,92,246,0.15)] overflow-hidden flex flex-col">
            <div className="flex-none p-6 border-b border-white/[0.04] bg-gradient-to-r from-violet-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-500/20 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(139,92,246,0.3)]">📚</div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Add New Book</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Enter details to catalog a new book in the library.</p>
                  </div>
                </div>
                <button onClick={() => setShowAddBook(false)} className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</button>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Book Title <span className="text-red-400">*</span></label>
                  <input type="text" className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all" placeholder="e.g. Introduction to Algorithms" value={bookForm.title} onChange={e => setBookForm({...bookForm, title: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Author <span className="text-red-400">*</span></label>
                  <input type="text" className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all" placeholder="e.g. Thomas H. Cormen" value={bookForm.author} onChange={e => setBookForm({...bookForm, author: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">ISBN</label>
                  <input type="text" className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all font-mono" placeholder="978-0262033848" value={bookForm.isbn} onChange={e => setBookForm({...bookForm, isbn: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Category</label>
                  <select className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all" value={bookForm.category} onChange={e => setBookForm({...bookForm, category: e.target.value})}>
                    <option value="Science">Science</option>
                    <option value="Math">Math</option>
                    <option value="Literature">Literature</option>
                    <option value="Commerce">Commerce</option>
                    <option value="Arts">Arts</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">Copies</label>
                    <input type="number" min="1" className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500/50 transition-all" value={bookForm.copies} onChange={e => setBookForm({...bookForm, copies: parseInt(e.target.value) || 1})} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">Rack / Location</label>
                    <input type="text" className="w-full bg-[#080C1A]/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500/50 transition-all" placeholder="e.g. A-12" value={bookForm.location} onChange={e => setBookForm({...bookForm, location: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-none p-5 border-t border-white/[0.04] bg-[#080C1A]/50 flex items-center justify-end gap-3">
              <button onClick={() => setShowAddBook(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors">Cancel</button>
              <button onClick={handleAddBook} disabled={isSubmitting || !bookForm.title} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-all disabled:opacity-50 flex items-center gap-2">
                {isSubmitting ? 'Adding...' : 'Add to Catalog'}
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Tabs */}
       <div className="flex gap-1 border-b border-white/[0.08] mb-6">
        <button onClick={() => setTab('inventory')} className={`py-2 px-4 text-sm font-semibold transition-all ${tab === 'inventory' ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
            📚 Book Inventory
        </button>
        <button onClick={() => setTab('issued')} className={`py-2 px-4 text-sm font-semibold transition-all ${tab === 'issued' ? 'text-violet-400 border-b-2 border-violet-500 bg-violet-500/5' : 'text-slate-400 hover:text-white'}`}>
            🔄 Issue / Return Desk
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
                  { label: 'Overdue Books', value: '0', color: 'text-red-400' }, // Requires a join on issue_logs
                ].map(k => (
                  <div key={k.label} className="glass border border-white/[0.08] rounded-2xl p-4 card-hover">
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
                         className="erp-input w-full text-sm pl-9" 
                         placeholder="Search by Title or Author..." 
                         value={search}
                         onChange={(e) => setSearch(e.target.value)}
                       />
                       <span className="absolute top-1/2 -translate-y-1/2 left-3 opacity-50">🔍</span>
                    </div>
                </div>
                {loading ? (
                    <div className="p-12 text-center flex flex-col items-center">
                      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-slate-400 text-sm">Loading catalog...</p>
                    </div>
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
                                    <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-semibold text-white">{b.title}</td>
                                        <td className="p-4">
                                            <p className="text-sm text-slate-300">{b.author}</p>
                                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{b.isbn}</p>
                                        </td>
                                        <td className="p-4">
                                           <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-[10px] font-medium text-slate-300 tracking-wide uppercase">{b.category}</span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-400">{b.location_rack}</td>
                                        <td className="p-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                              <div className={`w-1.5 h-1.5 rounded-full ${b.available_copies > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                              <p className={`font-bold ${b.available_copies > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{b.available_copies} / {b.total_copies}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                              onClick={() => { setTab('issued'); showToast(`Proceed to issue ${b.title}`); }} 
                                              disabled={b.available_copies === 0} 
                                              className="text-xs bg-violet-600/20 text-violet-300 hover:bg-violet-600 hover:text-white border border-violet-500/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:bg-slate-800 disabled:border-transparent disabled:text-slate-500"
                                            >
                                                Issue Book
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredBooks.length === 0 && (
                          <div className="p-12 text-center">
                             <div className="text-4xl mb-3">👻</div>
                             <p className="text-slate-400">No books found matching your search.</p>
                          </div>
                        )}
                    </div>
                )}
               </div>
           </>
       ) : (
           <div className="grid lg:grid-cols-2 gap-6">
             <div className="glass border border-white/[0.08] rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
                {scannerActive ? (
                  <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 animate-fade-in">
                    <div className="relative w-64 h-64 border-2 border-emerald-500/50 rounded-2xl overflow-hidden mb-6">
                      <div className="absolute inset-0 bg-emerald-500/10"></div>
                      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 shadow-[0_0_20px_#34d399] animate-[scan_2s_ease-in-out_infinite]"></div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-30 text-white/50 text-xs">Camera Feed...</div>
                    </div>
                    <p className="text-emerald-400 font-mono text-sm animate-pulse mb-4">Scanning Barcode / ID...</p>
                    <button onClick={() => setScannerActive(false)} className="text-xs text-white/50 hover:text-white underline">Cancel Scan</button>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-white/[0.05] rounded-full flex items-center justify-center text-4xl mb-6 shadow-[0_0_40px_rgba(139,92,246,0.1)]">
                      📷
                    </div>
                    <h2 className="text-white font-bold text-2xl mb-3 tracking-tight">Issue / Return Desk</h2>
                    <p className="text-slate-400 max-w-sm mx-auto mb-8 text-sm leading-relaxed">Scan a student&apos;s ID card or a book&apos;s barcode to instantly process an issue or return. Late fees will calculate automatically.</p>
                    <button onClick={() => setScannerActive(true)} className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                      Activate Scanner
                    </button>
                  </>
                )}
             </div>

             <div className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-2">Recent Activity & Alerts</h3>
                
                <div className="p-5 bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/20 rounded-2xl relative overflow-hidden group cursor-pointer hover:bg-red-500/10 transition-colors">
                   <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                   <div className="flex items-start justify-between">
                     <div>
                       <p className="text-sm text-red-400 font-bold mb-1 flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                         Need Attention (Overdue)
                       </p>
                       <p className="text-white font-medium text-base mt-2">Rahul Verma <span className="text-xs text-slate-400 font-normal ml-1">Grade 10-A</span></p>
                       <p className="text-sm text-slate-400 mt-0.5">Concepts of Physics</p>
                       <p className="text-xs text-red-400/80 mt-2 font-mono">Due: 2 days ago</p>
                     </div>
                     <div className="text-right">
                       <span className="inline-block px-3 py-1 bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/30">Fine: ₹20</span>
                       <button className="block mt-4 text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">Notify Parent</button>
                     </div>
                   </div>
                </div>

                <div className="p-4 glass border border-white/[0.05] rounded-2xl">
                   <div className="flex justify-between items-center text-sm">
                      <div>
                        <p className="text-white font-medium">Issued: The Merchant of Venice</p>
                        <p className="text-xs text-slate-400 mt-0.5">To: Sneha Patil (Grade 9-B)</p>
                      </div>
                      <span className="text-[10px] text-slate-500">10 mins ago</span>
                   </div>
                </div>

                <div className="p-4 glass border border-emerald-500/10 rounded-2xl">
                   <div className="flex justify-between items-center text-sm">
                      <div>
                        <p className="text-emerald-400 font-medium">Returned: Macroeconomics</p>
                        <p className="text-xs text-slate-400 mt-0.5">By: Amit Shah (Grade 12-C) • On time</p>
                      </div>
                      <span className="text-[10px] text-slate-500">1 hr ago</span>
                   </div>
                </div>
             </div>
           </div>
       )}
    </div>
  );
}
