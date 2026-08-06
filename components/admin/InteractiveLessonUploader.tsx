import React, { useState } from 'react';
import mammoth from 'mammoth';
import { googleSheetService } from '../../services/googleSheetService';
import type { InteractiveLessonData, LessonBlock } from '../../types';
import { Upload, FileText, Music, CheckCircle2, AlertCircle, Loader2, Sparkles, Eye, Trash2 } from 'lucide-react';
import { InteractiveLessonViewer } from '../InteractiveLessonViewer';

interface InteractiveLessonUploaderProps {
  onSuccess?: (lesson: InteractiveLessonData) => void;
}

export const InteractiveLessonUploader: React.FC<InteractiveLessonUploaderProps> = ({ onSuccess }) => {
  const [lessonTitle, setLessonTitle] = useState('');
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [mp3Files, setMp3Files] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLesson, setCreatedLesson] = useState<InteractiveLessonData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleDocxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDocxFile(file);
      if (!lessonTitle) {
        setLessonTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleMp3Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setMp3Files(prev => [...prev, ...filesArray]);
    }
  };

  const removeMp3 = (index: number) => {
    setMp3Files(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndProcess = async () => {
    if (!docxFile) {
      setErrorMessage("Please select a .docx lesson file.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStatusMessage("Starting processing...");

    try {
      // 1. Convert docx & upload audio
      const lessonData = await parseDocxAndBuildLesson(
        docxFile,
        mp3Files,
        lessonTitle || docxFile.name.replace(/\.[^/.]+$/, ""),
        (status) => setStatusMessage(status)
      );

      // 2. Save lesson to Google Sheets backend
      setStatusMessage("5. Saving compiled lesson to Google Sheets...");
      const savedResult = await googleSheetService.saveLesson(
        lessonData.title,
        lessonData
      );

      const finalLessonData: InteractiveLessonData = {
        ...lessonData,
        id: savedResult.id
      };

      setCreatedLesson(finalLessonData);
      setStatusMessage("🎉 Interactive Lesson successfully created and saved!");
      if (onSuccess) onSuccess(finalLessonData);
    } catch (err: any) {
      console.error("Interactive Lesson processing failed:", err);
      setErrorMessage(err?.message || "Failed to parse .docx or upload audio files.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 max-w-4xl mx-auto my-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="w-12 h-12 bg-tp-purple/10 rounded-2xl flex items-center justify-center text-tp-purple font-black">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Interactive Lesson Creator</h2>
          <p className="text-xs font-semibold text-gray-500">
            Upload .docx lessons & MP3 audio files for Cloudflare R2 hosting and Google Sheets storage
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 text-red-800 rounded-2xl flex items-start gap-3 text-xs font-bold">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {createdLesson ? (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-emerald-900">{createdLesson.title} Created!</h3>
          <p className="text-xs text-emerald-700 max-w-md mx-auto">
            Your lesson with {createdLesson.blocks.length} structured blocks ({createdLesson.blocks.filter(b=>b.type==='audio').length} audio tracks, {createdLesson.blocks.filter(b=>b.type==='freetext'||b.type==='smallfreetext').length} free-text entry questions) is live.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <button
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2"
            >
              <Eye className="w-4 h-4" /> {isPreviewOpen ? "Hide Preview" : "Preview Student View"}
            </button>
            <button
              onClick={() => {
                setCreatedLesson(null);
                setDocxFile(null);
                setMp3Files([]);
                setLessonTitle('');
                setStatusMessage(null);
              }}
              className="px-6 py-3 bg-white border border-emerald-300 text-emerald-800 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-emerald-100/50 transition-all"
            >
              Upload Another Lesson
            </button>
          </div>

          {isPreviewOpen && (
            <div className="mt-8 text-left border-t border-emerald-200 pt-6">
              <h4 className="text-xs font-black text-emerald-900 uppercase tracking-widest mb-4">Student Interactive Preview</h4>
              <InteractiveLessonViewer lessonData={createdLesson} currentUser={{ id: 'admin-preview', name: 'Admin Preview' }} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lesson Title */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-2">
              Lesson Title
            </label>
            <input
              type="text"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="e.g., Module 3: Customer Service Free-Text & Listening Practice"
              className="w-full px-5 py-3 rounded-2xl bg-gray-50 border border-gray-200 font-bold text-sm text-gray-900 focus:outline-none focus:border-tp-purple focus:bg-white transition-all"
            />
          </div>

          {/* Docx File Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-2">
              1. Lesson Document (.docx)
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-tp-purple transition-all bg-gray-50/50">
              <input
                type="file"
                accept=".docx"
                onChange={handleDocxChange}
                className="hidden"
                id="docx-input"
              />
              <label htmlFor="docx-input" className="cursor-pointer flex flex-col items-center gap-2">
                <FileText className="w-10 h-10 text-tp-purple" />
                <span className="text-xs font-black text-gray-800">
                  {docxFile ? docxFile.name : "Click to choose .docx lesson file"}
                </span>
                <span className="text-[10px] text-gray-400">
                  Must contain (Space holder for audio file *.mp3) & (Entry: Free Text)
                </span>
              </label>
            </div>
          </div>

          {/* MP3 Audio Files Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-700 mb-2">
              2. Audio Files (.mp3)
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-tp-purple transition-all bg-gray-50/50">
              <input
                type="file"
                accept=".mp3,audio/mpeg,audio/*"
                multiple
                onChange={handleMp3Change}
                className="hidden"
                id="mp3-input"
              />
              <label htmlFor="mp3-input" className="cursor-pointer flex flex-col items-center gap-2">
                <Music className="w-10 h-10 text-tp-red" />
                <span className="text-xs font-black text-gray-800">
                  Click to select matching MP3 audio files
                </span>
                <span className="text-[10px] text-gray-400">
                  Select all MP3s referenced in your document placeholders
                </span>
              </label>
            </div>

            {mp3Files.length > 0 && (
              <div className="mt-4 space-y-2">
                <span className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                  Selected Audio ({mp3Files.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {mp3Files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-100 rounded-xl text-xs font-bold text-gray-800">
                      <div className="flex items-center gap-2 truncate">
                        <Music className="w-4 h-4 text-tp-purple flex-shrink-0" />
                        <span className="truncate">{file.name}</span>
                      </div>
                      <button
                        onClick={() => removeMp3(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status & Submit */}
          {statusMessage && (
            <div className="p-4 bg-tp-purple/5 border border-tp-purple/20 rounded-2xl text-xs font-bold text-tp-purple flex items-center gap-3">
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
              <div>{statusMessage}</div>
            </div>
          )}

          <button
            onClick={handleUploadAndProcess}
            disabled={isProcessing || !docxFile}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
              isProcessing || !docxFile
                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                : "bg-gradient-to-r from-tp-purple to-tp-red text-white hover:opacity-95 shadow-tp-purple/20"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing & Uploading to R2 / Google Sheets...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Process & Save Interactive Lesson
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

async function parseDocxAndBuildLesson(
  docxFile: File,
  mp3Files: File[],
  title: string,
  onProgress: (msg: string) => void
): Promise<InteractiveLessonData> {
  onProgress("1. Reading .docx file with Mammoth parser...");
  
  const arrayBuffer = await docxFile.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  onProgress(`2. Uploading ${mp3Files.length} MP3 audio file(s) to Cloudflare R2...`);

  const audioMap: Record<string, string> = {};

  for (let i = 0; i < mp3Files.length; i++) {
    const file = mp3Files[i];
    onProgress(`2. Uploading audio (${i + 1}/${mp3Files.length}): ${file.name}...`);
    
    let publicUrl = '';
    try {
      onProgress(`2. Preparing audio (${i + 1}/${mp3Files.length}): Reading ${file.name} as base64 buffer...`);
      const base64Data = await fileToBase64(file);

      onProgress(`2. Uploading audio (${i + 1}/${mp3Files.length}): Sending ${file.name} to Cloudflare R2...`);
      const res = await fetch('/api/r2-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'audio/mpeg',
          fileData: base64Data
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.publicUrl) {
          publicUrl = data.publicUrl;
        } else if (data.publicUrl) {
          publicUrl = data.publicUrl;
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.warn(`R2 endpoint upload returned ${res.status} for ${file.name}:`, errorData?.error);
      }
    } catch (e) {
      console.warn(`R2 serverless endpoint failed for ${file.name}, using base64 data URL fallback:`, e);
    }

    if (!publicUrl) {
      publicUrl = await fileToDataUrl(file);
    }

    audioMap[file.name] = publicUrl;
    audioMap[file.name.toLowerCase()] = publicUrl;
    audioMap[`index_${i}`] = publicUrl;
  }

  onProgress("3. Parsing text blocks, audio players, and free-text entry fields...");

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes = Array.from(doc.body.childNodes);

  const blocks: LessonBlock[] = [];
  let questionCounter = 1;
  let audioIndex = 0;

  let currentTextBuffer: string[] = [];

  const flushTextBuffer = () => {
    if (currentTextBuffer.length > 0) {
      blocks.push({
        id: `block_text_${blocks.length}_${Date.now()}`,
        type: 'text',
        content: currentTextBuffer.join('')
      });
      currentTextBuffer = [];
    }
  };

  for (const node of nodes) {
    const textContent = node.textContent || '';
    if (node.nodeType === Node.TEXT_NODE && !textContent.trim()) {
      continue;
    }

    const nodeHtml = (node as Element).outerHTML || textContent || '';

    const audioMatch = textContent.match(/[\(\[]Space holder for audio file\s*([^\]\)]*)[\)\]]/i);
    const smallFreetextMatch = textContent.match(/[\(\[]Entry:\s*Small\s*Free\s*Text[\)\]]/i);
    const freetextMatch = textContent.match(/[\(\[]Entry:\s*(?!Small\s*)Free\s*Text[\)\]]/i);

    if (audioMatch) {
      flushTextBuffer();
      const extractedFilename = audioMatch[1]?.trim() || '';
      let matchedUrl = '';

      if (extractedFilename && audioMap[extractedFilename]) {
        matchedUrl = audioMap[extractedFilename];
      } else if (extractedFilename && audioMap[extractedFilename.toLowerCase()]) {
        matchedUrl = audioMap[extractedFilename.toLowerCase()];
      } else if (audioMap[`index_${audioIndex}`]) {
        matchedUrl = audioMap[`index_${audioIndex}`];
      } else {
        matchedUrl = Object.values(audioMap)[0] || '';
      }

      blocks.push({
        id: `block_audio_${blocks.length}_${Date.now()}`,
        type: 'audio',
        audioUrl: matchedUrl,
        audioFilename: extractedFilename || mp3Files[audioIndex]?.name || `Audio_${audioIndex + 1}.mp3`
      });
      audioIndex++;
    } else if (smallFreetextMatch) {
      flushTextBuffer();
      const tagMatches = textContent.match(/[\(\[]Entry:\s*Small\s*Free\s*Text[\)\]]/gi) || [1];
      const qId = `q_${questionCounter}`;
      blocks.push({
        id: `block_smallfreetext_${blocks.length}_${Date.now()}`,
        type: 'smallfreetext',
        questionId: qId,
        content: nodeHtml,
        label: `Short Free Text Response #${questionCounter}`
      });
      questionCounter += tagMatches.length;
    } else if (freetextMatch) {
      flushTextBuffer();
      const qId = `q_${questionCounter}`;
      blocks.push({
        id: `block_freetext_${blocks.length}_${Date.now()}`,
        type: 'freetext',
        questionId: qId,
        label: `Free Text Response #${questionCounter}`
      });
      questionCounter++;
    } else {
      currentTextBuffer.push(nodeHtml);
    }
  }

  flushTextBuffer();

  return {
    title: title || docxFile.name.replace(/\.[^/.]+$/, ""),
    docxFilename: docxFile.name,
    createdAt: new Date().toISOString(),
    blocks,
    audioFilesMapped: audioMap
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes('base64,') ? result.split('base64,')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(URL.createObjectURL(file));
    reader.readAsDataURL(file);
  });
}
export default InteractiveLessonUploader;
