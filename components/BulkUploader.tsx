'use client';
import { useState, useRef } from 'react';

export default function BulkUploader({ onUploadComplete }: { onUploadComplete: (count: number) => void }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    setError(null);
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('Please upload a valid .csv file');
      return;
    }
    setFile(selectedFile);
  };

  const processAndUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setError('Failed to read file.');
        setIsUploading(false);
        return;
      }

      // Very simple CSV parse logic mapping native row-by-row
      const lines = text.split('\\n').filter(l => l.trim() !== '');
      if (lines.length <= 1) {
        setError('CSV must contain a header row and at least one student row.');
        setIsUploading(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const expected = ['first_name', 'last_name', 'class_grade', 'section', 'emergency_contact'];
      
      const missing = expected.filter(e => !headers.includes(e));
      if (missing.length > 0) {
        setError(`Missing required columns: ${missing.join(', ')}`);
        setIsUploading(false);
        return;
      }

      const payload = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim());
        const obj: any = {};
        headers.forEach((h, idx) => obj[h] = row[idx]);
        payload.push(obj);
      }

      try {
        const res = await fetch('/api/onboarding/bulk-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: payload })
        });
        const data = await res.json();

        if (res.ok) {
          setSuccessCount(data.inserted || payload.length);
          onUploadComplete(data.inserted || payload.length);
          setFile(null);
        } else {
          setError(data.error || 'Failed to bulk import students.');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file locally.');
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full glass border border-white/[0.08] rounded-2xl p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-violet-600/10 blur-3xl rounded-full pointer-events-none" />

      <h3 className="text-lg font-bold text-white mb-2 relative z-10">Bulk Onboarding</h3>
      <p className="text-sm text-slate-400 mb-6 relative z-10">Upload a CSV file to instantly map hundreds of students into NexSchool AI.</p>
      
      {successCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold relative z-10 flex items-center justify-between">
          <span>✓ Successfully imported {successCount} students!</span>
          <button onClick={() => setSuccessCount(0)} className="text-emerald-500 hover:text-emerald-300">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold relative z-10 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      <form 
        className={`relative z-10 w-full rounded-2xl border-2 border-dashed transition-all p-10 flex flex-col items-center justify-center cursor-pointer ${
          dragActive ? 'border-violet-400 bg-violet-500/10 scale-[1.01]' : 'border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          accept=".csv" 
          className="hidden" 
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        />
        
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600/30 to-indigo-600/30 flex items-center justify-center mb-4">
           <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
           </svg>
        </div>
        
        {file ? (
          <div className="text-center">
             <p className="text-emerald-400 font-bold text-lg mb-1">{file.name}</p>
             <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB selected</p>
          </div>
        ) : (
          <div className="text-center">
             <p className="text-white font-bold text-lg mb-1">Drag & Drop your CSV here</p>
             <p className="text-slate-400 text-xs">or click to browse local files</p>
          </div>
        )}
      </form>

      <div className="mt-6 flex items-center justify-between relative z-10">
         <a href="/template.csv" download className="text-xs text-violet-400 hover:text-violet-300 font-medium tracking-wide">
           ↓ Download CSV Template
         </a>
         
         <button 
           onClick={processAndUpload}
           disabled={!file || isUploading}
           className={`px-8 py-2.5 rounded-full font-bold text-sm transition-all ${
             !file || isUploading 
               ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
               : 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-600/20 hover:scale-105'
           }`}
         >
           {isUploading ? (
             <span className="flex items-center gap-2">
               <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
               </svg>
               Importing...
             </span>
           ) : 'Import Students'}
         </button>
      </div>
    </div>
  );
}
