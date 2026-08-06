
import React, { useState } from 'react';
import { googleSheetService } from '../../services/googleSheetService';
import { geminiService } from '../../services/geminiService';
import { BrainIcon, LightningIcon, PlusIcon, ClipboardListIcon } from '../Icons';

export default function ResourceUploader({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [uploadMode, setUploadMode] = useState<'single' | 'bulk'>('single');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'loading' | 'success' | 'error' | '' }>({
    message: '',
    type: ''
  });

  const handleSmartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;

    setIsProcessing(true);
    setStatus({ message: "🧠 Analyzing content with Gemini AI...", type: 'loading' });

    try {
      const aiData = await geminiService.enrichResourceMetadata(title, url);
      setStatus({ message: `✅ AI Extracted Skills: ${Array.isArray(aiData.tags) ? aiData.tags.join(', ') : aiData.tags}`, type: 'loading' });

      const isVideo = url.includes('youtube.com') || url.includes('youtu.be');
      const newResource = {
        id: `r-${Date.now()}`,
        title: aiData.title || title,
        url,
        type: isVideo ? 'video' : 'article',
        tags: Array.isArray(aiData.tags) ? aiData.tags : (aiData.tags ? String(aiData.tags).split(',').map(t => t.trim()) : ["general"]),
        level: aiData.level || "ALL",
        objective: aiData.objective || "Learn new concepts.",
        scrapedText: aiData.scrapedText || "",
        duration: Number(aiData.duration) || 10
      };

      await googleSheetService.bulkImportResources([newResource]);
      setStatus({ message: "🎉 Success! Resource added.", type: 'success' });
      setTitle('');
      setUrl('');

      setTimeout(() => {
        setStatus({ message: '', type: '' });
        onUploadComplete();
      }, 3000);

    } catch (error) {
      console.error("Upload Error:", error);
      setStatus({ message: "❌ Failed to add resource. Please try again.", type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsProcessing(true);
    setStatus({ message: "📂 Reading CSV file...", type: 'loading' });

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) throw new Error("CSV file is empty or missing headers");

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const titleIdx = headers.indexOf('title');
      const urlIdx = headers.indexOf('url');

      if (titleIdx === -1 || urlIdx === -1) {
        throw new Error("CSV must have 'Title' and 'URL' headers");
      }

      const rows = lines.slice(1);
      const newResources = [];

      for (let i = 0; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.trim());
        const rowTitle = cols[titleIdx];
        const rowUrl = cols[urlIdx];

        if (!rowTitle || !rowUrl) continue;

        setStatus({ 
          message: `🧠 AI Analyzing row ${i + 1} of ${rows.length}: ${rowTitle}...`, 
          type: 'loading' 
        });

        const aiData = await geminiService.enrichResourceMetadata(rowTitle, rowUrl);
        
        const isVideo = rowUrl.includes('youtube.com') || rowUrl.includes('youtu.be');
        newResources.push({
          id: `r-${Date.now()}-${i}`,
          title: aiData.title || rowTitle,
          url: rowUrl,
          type: isVideo ? 'video' : 'article',
          tags: Array.isArray(aiData.tags) ? aiData.tags : (aiData.tags ? String(aiData.tags).split(',').map(t => t.trim()) : ["general"]),
          level: aiData.level || "ALL",
          objective: aiData.objective || "Learn new concepts.",
          scrapedText: aiData.scrapedText || "",
          duration: Number(aiData.duration) || 10
        });

        // Respect rate limits: 4 second delay between calls
        if (i < rows.length - 1) {
          await new Promise(r => setTimeout(r, 4000));
        }
      }

      setStatus({ message: `🚀 Importing ${newResources.length} resources...`, type: 'loading' });
      await googleSheetService.bulkImportResources(newResources);
      
      setStatus({ message: `🎉 Success! ${newResources.length} resources added.`, type: 'success' });
      setFile(null);

      setTimeout(() => {
        setStatus({ message: '', type: '' });
        onUploadComplete();
      }, 3000);

    } catch (error: any) {
      console.error("Bulk Upload Error:", error);
      setStatus({ message: `❌ Error: ${error.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-[32px] p-8 border border-gray-100 shadow-2xl animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-tp-purple text-white rounded-2xl flex items-center justify-center shadow-lg">
            <BrainIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-tp-purple uppercase tracking-tight">Resource Ingestion</h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Powered by Gemini AI</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setUploadMode('single')}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              uploadMode === 'single' ? 'bg-white text-tp-purple shadow-sm' : 'text-gray-400 hover:text-tp-purple'
            }`}
          >
            Single Entry
          </button>
          <button
            onClick={() => setUploadMode('bulk')}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              uploadMode === 'bulk' ? 'bg-white text-tp-purple shadow-sm' : 'text-gray-400 hover:text-tp-purple'
            }`}
          >
            CSV Upload
          </button>
        </div>
      </div>

      {uploadMode === 'single' ? (
        <form onSubmit={handleSmartUpload} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-tp-purple uppercase tracking-widest ml-1">Resource Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced Customer Service Techniques"
              disabled={isProcessing}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-tp-purple/20 transition-all disabled:opacity-50"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-tp-purple uppercase tracking-widest ml-1">Resource URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              disabled={isProcessing}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-tp-purple/20 transition-all disabled:opacity-50"
              required
            />
          </div>

          {status.message && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-fadeIn ${
              status.type === 'loading' ? 'bg-tp-purple/5 text-tp-purple' :
              status.type === 'success' ? 'bg-green-50 text-green-600' :
              status.type === 'error' ? 'bg-red-50 text-red-600' : ''
            }`}>
              {status.type === 'loading' && <LightningIcon className="w-4 h-4 animate-pulse" />}
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || !title || !url}
            className="w-full bg-tp-purple text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-tp-navy transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                Analyze & Upload
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkUpload} className="space-y-6">
          <div className="space-y-4">
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-[32px] p-12 text-center hover:border-tp-purple/30 transition-all group relative">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <ClipboardListIcon className="w-8 h-8 text-tp-purple" />
                </div>
                <div>
                  <p className="text-sm font-bold text-tp-purple">
                    {file ? file.name : 'Drop CSV file here or click to browse'}
                  </p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">
                    Headers required: Title, URL
                  </p>
                </div>
              </div>
            </div>
          </div>

          {status.message && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-fadeIn ${
              status.type === 'loading' ? 'bg-tp-purple/5 text-tp-purple' :
              status.type === 'success' ? 'bg-green-50 text-green-600' :
              status.type === 'error' ? 'bg-red-50 text-red-600' : ''
            }`}>
              {status.type === 'loading' && <LightningIcon className="w-4 h-4 animate-pulse" />}
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || !file}
            className="w-full bg-tp-purple text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-tp-navy transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing Bulk Upload...
              </>
            ) : (
              <>
                <LightningIcon className="w-4 h-4" />
                Start AI Bulk Import
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

