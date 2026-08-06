
import React, { useState, useRef } from 'react';
import type { UserProfile } from '../../types';
import { shlService } from '../../services/shlService';
import { 
  ClipboardListIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  BrainIcon,
  XIcon,
  PlusIcon,
  LightningIcon
} from '../Icons';

interface FileStatus {
  file: File;
  status: 'staged' | 'processing' | 'success' | 'error';
  message?: string;
}

interface UserUploaderProps {
  currentUser: UserProfile;
  onUserCreated: () => void;
}

const UserUploader: React.FC<UserUploaderProps> = ({ currentUser, onUserCreated }) => {
  const [stagedFiles, setStagedFiles] = useState<FileStatus[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files)
      .filter(f => f.type === 'application/pdf')
      .map(f => ({ file: f, status: 'staged' as const }));
    
    setStagedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processBatch = async () => {
    if (stagedFiles.length === 0 || isProcessingBatch) return;
    
    setIsProcessingBatch(true);

    for (let i = 0; i < stagedFiles.length; i++) {
      const current = stagedFiles[i];
      if (current.status === 'success') continue;

      // Set individual file to processing
      setStagedFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'processing' } : f
      ));

      try {
        const result = await shlService.registerUserFromPDF(
          current.file, 
          currentUser.role === 'coach' ? currentUser.email : undefined
        );
        
        // Mark as success
        setStagedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success', message: `Registered: ${result.registration.userProfile.name}` } : f
        ));
        
        onUserCreated(); // Refresh the parent list
      } catch (err) {
        // Mark as error
        setStagedFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', message: (err as Error).message } : f
        ));
      }
    }
    
    setIsProcessingBatch(false);
  };

  const clearCompleted = () => {
    setStagedFiles(prev => prev.filter(f => f.status !== 'success'));
  };

  const summary = {
    total: stagedFiles.length,
    success: stagedFiles.filter(f => f.status === 'success').length,
    error: stagedFiles.filter(f => f.status === 'error').length,
    pending: stagedFiles.filter(f => f.status === 'staged').length
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-4xl mx-auto pb-12">
      {/* Drop Zone */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessingBatch && fileInputRef.current?.click()}
        className={`border-4 border-dashed rounded-[48px] p-12 md:p-16 text-center transition-all group bg-gray-50/50 cursor-pointer shadow-inner relative overflow-hidden ${
          isDragging ? 'border-tp-red bg-tp-red/5 scale-[0.99]' : 'border-tp-purple/5 hover:border-tp-purple/20 hover:bg-white'
        } ${isProcessingBatch ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className={`w-20 h-20 md:w-24 md:h-24 rounded-[32px] flex items-center justify-center mx-auto mb-8 transition-all shadow-2xl ${
          isDragging ? 'bg-tp-red text-white' : 'bg-tp-purple text-white group-hover:scale-105'
        }`}>
          <BrainIcon className="w-10 h-10 md:w-12 md:h-12" />
        </div>
        <h3 className="text-2xl md:text-3xl font-black text-tp-purple mb-4 uppercase tracking-tighter">
          Candidate Intelligence Hub
        </h3>
        <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto font-medium leading-relaxed">
          Drag & Drop assessment reports here or click to browse. Support for batch recruitment intake.
        </p>
        <div className="bg-tp-navy text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl inline-flex items-center gap-3 group-hover:bg-tp-red transition-colors">
          <PlusIcon className="w-4 h-4" />
          Select Assessment Reports
        </div>
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept=".pdf" 
          multiple
          onChange={(e) => addFiles(e.target.files)} 
          disabled={isProcessingBatch} 
        />
      </div>

      {/* Staging & Status Area */}
      {stagedFiles.length > 0 && (
        <div className="bg-white rounded-[40px] p-8 md:p-10 border border-gray-100 shadow-2xl animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-2">
            <div>
              <h4 className="text-[10px] font-black text-tp-purple uppercase tracking-[0.3em] mb-1">Batch Registry</h4>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                {summary.success} Processed • {summary.pending} Staged • {summary.error} Errors
              </p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              {summary.success > 0 && !isProcessingBatch && (
                <button 
                  onClick={clearCompleted}
                  className="px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-tp-red hover:bg-tp-red/5 transition-all"
                >
                  Clear Finished
                </button>
              )}
              <button 
                onClick={processBatch}
                disabled={isProcessingBatch || summary.success === summary.total}
                className="flex-1 md:flex-none bg-tp-red text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-tp-navy transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isProcessingBatch ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing Ingestion...
                  </>
                ) : (
                  <>
                    <LightningIcon className="w-4 h-4" />
                    Ingest All Staged Files
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {stagedFiles.map((item, idx) => (
              <div 
                key={`${item.file.name}-${idx}`} 
                className={`border rounded-[28px] p-5 flex items-center justify-between group transition-all ${
                  item.status === 'success' ? 'border-green-100 bg-green-50/20' : 
                  item.status === 'error' ? 'border-tp-red/10 bg-tp-red/5' : 
                  'border-gray-50 bg-gray-50/50 hover:border-tp-purple/10 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-5 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                    item.status === 'success' ? 'bg-green-100 text-green-600' :
                    item.status === 'error' ? 'bg-tp-red text-white' :
                    item.status === 'processing' ? 'bg-tp-purple text-white animate-pulse' :
                    'bg-white text-tp-purple/20 border border-gray-100'
                  }`}>
                    {item.status === 'success' ? <CheckCircleIcon filled className="w-5 h-5" /> : 
                     item.status === 'error' ? <ExclamationCircleIcon className="w-5 h-5" /> : 
                     item.status === 'processing' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :
                     <ClipboardListIcon className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-bold text-tp-purple text-sm truncate ${item.status === 'success' ? 'opacity-50' : ''}`}>
                      {item.file.name}
                    </p>
                    <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                      item.status === 'error' ? 'text-tp-red' : 
                      item.status === 'success' ? 'text-green-600' :
                      'text-tp-purple/40'
                    }`}>
                      {item.message || (item.status === 'staged' ? 'Waiting for processing' : item.status)}
                    </p>
                  </div>
                </div>
                
                {!isProcessingBatch && item.status !== 'success' && (
                  <button 
                    onClick={() => removeFile(idx)}
                    className="ml-4 p-2 text-gray-300 hover:text-tp-red transition-all"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserUploader;
