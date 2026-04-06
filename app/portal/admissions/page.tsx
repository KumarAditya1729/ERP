'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PortalAdmissionsTracker() {
  const supabase = createClient();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{appId: string, docKey: string} | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
         setLoading(false);
         return;
      }
      
      const { data } = await supabase
        .from('admission_applications')
        .select('*')
        .eq('guardian_email', user.email)
        .order('applied_date', { ascending: false });
        
      if (data) setApps(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleUploadClick = (appId: string, docKey: string) => {
    setUploadTarget({ appId, docKey });
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadTarget) return;
    setIsUploading(true);
    const { appId, docKey } = uploadTarget;
    
    try {
       const fileExt = file.name.split('.').pop();
       const fileName = `${appId}/${docKey}_${Date.now()}.${fileExt}`;
       const { error: uploadErr } = await supabase.storage.from('admissions').upload(fileName, file);
       if (uploadErr) throw uploadErr;
       
       const { updateDocFile } = await import('@/app/actions/admissions');
       const res = await updateDocFile(appId, docKey, fileName);
       if (!res.success) throw new Error(res.error);
       
       const mapped = apps.map(a => {
         if (a.id === appId) {
           return {
             ...a,
             docs_status: { ...a.docs_status, [docKey]: true },
             document_files: { ...(a.document_files || {}), [docKey]: fileName }
           };
         }
         return a;
       });
       setApps(mapped);
       alert('Document uploaded successfully!');
    } catch(err: any) {
       alert(`Upload failed: ${err.message}`);
    } finally {
       setIsUploading(false);
       setUploadTarget(null);
       if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
     return <div className="p-10 text-center animate-pulse text-violet-400">Loading your applications...</div>;
  }

  return (
    <div className="p-5 space-y-6 pt-8 animate-fade-in pb-24">
      <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
      
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Admissions Tracker</h1>
        <p className="text-xs text-slate-400">Track application status and securely upload missing documents.</p>
      </div>

      {apps.length === 0 ? (
        <div className="glass border border-white/[0.08] rounded-2xl p-8 text-center mt-5">
           <p className="text-4xl mb-4">📝</p>
           <h2 className="text-white font-bold text-lg">No Applications Found</h2>
           <p className="text-slate-400 text-xs mt-2">We couldn't find any admission forms linked to your email address.</p>
        </div>
      ) : (
        <div className="space-y-5">
           {apps.map((app) => (
             <div key={app.id} className="glass border border-white/[0.08] rounded-2xl overflow-hidden card-hover">
                <div className="p-5 border-b border-white/[0.05]">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-white">{app.student_name}</h3>
                      <p className="text-xs text-slate-400">Applying for {app.applying_class}</p>
                    </div>
                    <span className="badge badge-purple">{app.stage}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/[0.05]">
                    <p className="text-xs font-semibold text-slate-300 mb-3">Document Vault {isUploading ? '(Uploading...)' : ''}</p>
                    <div className="space-y-2">
                    {([
                      { key: 'birth' as const,    label: 'Birth Certificate' },
                      { key: 'marks' as const,    label: 'Previous Marksheet' },
                      { key: 'transfer' as const, label: 'Transfer Certificate' },
                      { key: 'photo' as const,    label: 'Passport Photo' },
                      { key: 'aadhar' as const,   label: 'Aadhar Card' },
                    ]).map(doc => {
                       const filePath = app.document_files?.[doc.key];
                       return (
                         <div key={doc.key} className={`flex items-center justify-between p-3 rounded-xl border text-sm ${filePath ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                            <div className="flex items-center gap-2">
                               <span className={filePath ? "text-emerald-400" : "text-amber-400"}>{filePath ? "✅" : "⏳"}</span>
                               <span className="text-slate-300 text-xs">{doc.label}</span>
                            </div>
                            {!filePath ? (
                               <button onClick={() => handleUploadClick(app.id, doc.key)} disabled={isUploading} className="text-[10px] font-bold text-amber-400 uppercase glass px-3 py-1.5 rounded-lg hover:bg-amber-500/10">Upload</button>
                            ) : (
                               <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Secured</span>
                            )}
                         </div>
                       );
                    })}
                    </div>
                  </div>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
}
