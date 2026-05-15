'use client';
import { useState, useEffect } from 'react';
import { getStudentHomeworkDetails, submitHomeworkFile, addHomeworkComment } from '@/app/actions/homework';
import { createClient } from '@/lib/supabase/client';

export default function HomeworkDetailPage({ params }: { params: { id: string } }) {
  const [assignment, setAssignment] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const res = await getStudentHomeworkDetails(params.id);
      if (res.success && res.data) {
        setAssignment(res.data.assignment);
        setSubmission(res.data.submission);
      }
      setLoading(false);
    }
    load();
  }, [params.id]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (!submission) {
      showToast('No active submission record found.', 'error');
      return;
    }
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast('File size exceeds 5MB limit.', 'error');
      return;
    }

    setUploading(true);
    const fileName = `${submission.id}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('homework_files')
      .upload(fileName, file);

    if (uploadErr) {
      showToast('Upload failed: ' + uploadErr.message, 'error');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('homework_files').getPublicUrl(fileName);

    // Save record via Server Action
    const res = await submitHomeworkFile(submission.id, file.name, urlData.publicUrl, file.type, file.size);
    if (res.success) {
      showToast('File submitted successfully!');
      // Optimistically update
      setSubmission((prev: any) => ({
        ...prev,
        status: 'pending',
        homework_submission_files: [
          ...(prev.homework_submission_files || []),
          { id: Date.now().toString(), file_name: file.name, file_url: urlData.publicUrl, uploaded_at: new Date().toISOString() }
        ]
      }));
    } else {
      showToast('Failed to save file record.', 'error');
    }
    setUploading(false);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !submission) return;
    const res = await addHomeworkComment(submission.id, commentText);
    if (res.success) {
      setSubmission((prev: any) => ({
        ...prev,
        homework_comments: [
          ...(prev.homework_comments || []),
          { id: Date.now().toString(), author_role: 'student', comment_text: commentText, created_at: new Date().toISOString() }
        ]
      }));
      setCommentText('');
    } else {
      showToast('Failed to add comment.', 'error');
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-400 animate-pulse">Loading assignment details...</div>;
  if (!assignment) return <div className="p-12 text-center text-slate-400">Assignment not found.</div>;

  const isGraded = submission?.status === 'graded';

  return (
    <div className="space-y-6 animate-fade-in pt-4 pb-24">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-xl animate-fade-in ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="glass border border-white/[0.08] rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-xs text-violet-400 font-bold uppercase tracking-wider mb-2">{assignment.subject}</p>
            <h1 className="text-2xl font-bold text-white mb-2">{assignment.title}</h1>
            <p className="text-sm text-slate-400">Assigned by <span className="text-white font-medium">{assignment.teacher_name}</span> &middot; Due {new Date(assignment.due_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          {submission && (
            <div className={`px-4 py-2 rounded-xl border ${isGraded ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : submission.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              <span className="text-xs font-bold uppercase tracking-wider">{submission.status}</span>
              {isGraded && <div className="text-xl font-bold text-white mt-1">{submission.score}</div>}
            </div>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-white/5 relative z-10">
          <h3 className="text-sm font-bold text-white mb-3">Instructions</h3>
          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{assignment.instructions || 'No special instructions provided.'}</p>
        </div>
      </div>

      {submission && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Work Section */}
          <div className="glass border border-white/[0.08] rounded-3xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">My Work</h2>
            
            {/* Uploaded Files */}
            <div className="space-y-3 mb-6">
              {submission.homework_submission_files?.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No files uploaded yet.</p>
              ) : (
                submission.homework_submission_files?.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-xl">📄</span>
                      <div className="truncate">
                        <p className="text-sm text-white font-medium truncate">{f.file_name}</p>
                        <p className="text-[10px] text-slate-400">{new Date(f.uploaded_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <a href={f.file_url} target="_blank" rel="noreferrer" className="text-xs text-violet-400 hover:text-white font-medium shrink-0 ml-2 bg-violet-500/10 px-3 py-1.5 rounded-lg">View</a>
                  </div>
                ))
              )}
            </div>

            {/* Upload Button */}
            {!isGraded && (
              <div className="relative">
                <input type="file" id="hw-upload" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={uploading} />
                <div className={`flex items-center justify-center p-4 border-2 border-dashed border-white/10 rounded-xl transition-colors ${uploading ? 'bg-white/5' : 'hover:border-violet-500/50 hover:bg-violet-500/5'}`}>
                  <span className="text-sm font-medium text-violet-400">{uploading ? 'Uploading...' : '+ Upload File (Max 5MB)'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Comments / Feedback Section */}
          <div className="glass border border-white/[0.08] rounded-3xl p-6 flex flex-col h-[400px]">
            <h2 className="text-lg font-bold text-white mb-4">Private Comments</h2>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {submission.homework_comments?.length === 0 ? (
                <div className="text-center text-slate-500 text-sm mt-12">No comments yet.</div>
              ) : (
                submission.homework_comments?.map((c: any) => (
                  <div key={c.id} className={`flex flex-col ${c.author_role === 'student' || c.author_role === 'parent' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl ${c.author_role === 'student' || c.author_role === 'parent' ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-white/10 text-white rounded-tl-sm'}`}>
                      <p className="text-sm">{c.comment_text}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex gap-2">
              <input 
                type="text" 
                value={commentText} 
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a private comment..." 
                className="erp-input flex-1"
              />
              <button onClick={handleAddComment} disabled={!commentText.trim()} className="btn-primary text-sm px-4 text-white">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
