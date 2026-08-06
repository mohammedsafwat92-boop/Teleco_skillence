
import React, { useState } from 'react';
import type { Resource, QuizQuestion, UserProfile } from '../types';
import { geminiService } from '../services/geminiService';
import { googleSheetService } from '../services/googleSheetService';
import { ExitIcon, CheckCircleIcon, ExclamationCircleIcon, BrainIcon, LinkIcon } from './Icons';
import LiveCoach from './LiveCoach';
import InteractiveLessonViewer from './InteractiveLessonViewer';

interface LessonViewerProps {
  resource: Resource;
  uid: string;
  currentUser?: UserProfile;
  onClose: () => void;
  onMasteryAchieved: () => void;
}

const LessonViewer: React.FC<LessonViewerProps> = ({ resource, uid, currentUser, onClose, onMasteryAchieved }) => {
  const [view, setView] = useState<'content' | 'quiz' | 'result'>('content');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [score, setScore] = useState(0);
  const [backendStatus, setBackendStatus] = useState<Resource['progress']['status']>(resource.progress?.status || 'assigned');
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<number | null>(null);

  const isInteractive = Boolean(
    (resource as any).interactiveLesson ||
    (resource as any).lessonDataJSON ||
    resource.type === 'interactive' ||
    (resource.url && resource.url.startsWith('interactive:'))
  );

  const handleInteractiveSubmit = async (submissionId?: string) => {
    try {
      // Record 100% mastery / completion progress in backend
      const response = await googleSheetService.submitProgress(uid, resource.id, true, 100, 0);
      setBackendStatus('completed');
      onMasteryAchieved();
    } catch (err) {
      console.error("Failed to submit interactive lesson completion progress:", err);
      setBackendStatus('completed');
      onMasteryAchieved();
    }
  };
  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('/embed/')) return url;

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2].length === 11) {
      const videoId = match[2];
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
    }
    
    return url;
  };

  const startQuiz = async () => {
    setIsGeneratingQuiz(true);
    setQuizError(null);
    try {
      const questions = await geminiService.generateQuiz(
        resource.title, 
        resource.url,
        resource.type,
        resource.scrapedText,
        resource.level
      );
      
      if (questions.length === 0) {
        setQuizError("Could not generate quiz from this content.");
        return;
      }

      setQuizQuestions(questions);
      setAnswers(new Array(questions.length).fill(-1));
      setQuizStartTime(Date.now());
      setView('quiz');
    } catch (err: any) {
      setQuizError(err?.message || "Assessment engine failed. Check connection.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const submitQuiz = async () => {
    const correctCount = quizQuestions.reduce((acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0), 0);
    const finalScore = Math.round((correctCount / quizQuestions.length) * 100);
    const passed = finalScore >= 60;
    const timeTakenSecs = quizStartTime ? Math.round((Date.now() - quizStartTime) / 1000) : 0;
    
    setScore(finalScore);
    setIsGenerating(true);
    try {
      const response = await googleSheetService.submitQuizResult(uid, resource.id, passed, finalScore, timeTakenSecs);
      setBackendStatus(response.status); 
      if (passed) onMasteryAchieved();
      setView('result');
    } catch (err) {
      console.error("Registry sync failed", err);
      setView('result');
    } finally {
      setIsGenerating(false);
    }
  };

  if (resource.type === 'Simulation') {
    const activeUserProfile: UserProfile = currentUser || {
      id: uid,
      name: 'Agent Training Node',
      role: 'agent',
      languageLevel: 'B2',
      rosterId: ''
    };

    const handleSimulationComplete = async (score: number, timeTaken: number) => {
      try {
        const passed = score >= 60;
        await googleSheetService.submitProgress(uid, resource.id, passed, score, timeTaken);
        onMasteryAchieved();
      } catch (err) {
        console.error("Failed to submit simulation progress:", err);
      }
    };

    return (
      <LiveCoach 
        currentUser={activeUserProfile}
        initialScenario={resource.url}
        scenarioId={resource.url}
        onClose={onClose}
        onImpersonate={() => {}}
        onComplete={handleSimulationComplete}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-tp-navy/95 backdrop-blur-xl flex flex-col animate-fadeIn">
      <header className="flex items-center justify-between px-10 py-6 bg-tp-purple border-b border-white/5">
        <div className="flex items-center">
            <BrainIcon className="w-10 h-10 text-tp-red mr-4" />
            <div>
                <h2 className="text-white font-black text-2xl tracking-tight uppercase leading-none">{resource.title}</h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-white/50 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded inline-block">Dual-Scale Training Node</span>
                  <span className="text-[10px] text-tp-red font-black uppercase tracking-widest bg-tp-red/10 px-2 py-0.5 rounded inline-block border border-tp-red/20">{resource.duration || '10'} mins</span>
                </div>
            </div>
        </div>
        <button onClick={onClose} className="p-4 text-white/40 hover:text-white bg-white/5 rounded-full transition-all"><ExitIcon className="w-7 h-7" /></button>
      </header>

      <div className="flex-1 relative bg-white overflow-hidden">
        {view === 'content' && (
          <div className="w-full h-full flex flex-col overflow-y-auto">
            {isInteractive ? (
              <div className="p-6">
                {/* 2. Wiring "Submit" to "Mastery Check" via onSubmitted callback */}
                <InteractiveLessonViewer 
                  lessonData={(resource as any).interactiveLesson || (resource as any).lessonDataJSON} 
                  currentUser={currentUser || { id: uid, name: 'Agent', role: 'agent', languageLevel: 'B2', rosterId: '' }} 
                  onSubmitted={(submissionId) => handleInteractiveSubmit(submissionId)}
                />
              </div>
            ) : (
              <div className="flex-1 w-full bg-black relative">
                <iframe 
                  src={getEmbedUrl(resource.url)} 
                  className="w-full h-full border-none" 
                  title="Training Module Viewer" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            <div className="px-10 py-8 bg-tp-navy/5 border-t border-gray-100 flex justify-between items-center shadow-lg">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black text-tp-purple uppercase tracking-[0.3em] mb-1">Objective</p>
                <p className="text-sm font-bold text-gray-700 leading-relaxed italic">
                  "{resource.objective || 'Complete visual study to unlock assessment.'}"
                </p>
                {quizError && (
                  <div className="mt-2 flex items-center gap-2 text-tp-red">
                    <ExclamationCircleIcon className="w-4 h-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">{quizError}</p>
                  </div>
                )}
              </div>

              {/* 1. CONDITIONAL BUTTON RENDERING:
                  - Normal lesson (!isInteractive): Render 'Open in New Tab' and 'Mastery Check' buttons.
                  - Interactive lesson (isInteractive): HIDE both buttons entirely.
              */}
              {!isInteractive ? (
                <div className="flex items-center gap-4">
                  <a 
                    href={resource.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-white text-tp-purple border-2 border-tp-purple/20 font-black py-5 px-8 rounded-2xl hover:bg-tp-purple/5 transition-all shadow-lg uppercase tracking-widest text-[11px] flex items-center gap-3"
                  >
                    <LinkIcon className="w-5 h-5" />
                    Open in New Tab
                  </a>
                  <button 
                    onClick={startQuiz}
                    disabled={isGeneratingQuiz || backendStatus === 'completed'}
                    className="bg-tp-red text-white font-black py-5 px-14 rounded-2xl hover:bg-red-700 transition-all shadow-xl uppercase tracking-widest text-[11px] disabled:opacity-50 flex items-center gap-3"
                  >
                    {isGeneratingQuiz && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                    {backendStatus === 'completed' ? 'Certified Complete' : isGeneratingQuiz ? 'Generating Quiz...' : 'Mastery Check'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-black uppercase tracking-widest px-5 py-3 rounded-2xl flex items-center gap-2 ${
                    backendStatus === 'completed'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-tp-purple/10 text-tp-purple border border-tp-purple/20'
                  }`}>
                    {backendStatus === 'completed' ? '✓ Mastery Certified & Completed' : 'Interactive Lesson Mode — Complete & Submit Form Above'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'quiz' && (
          <div className="max-w-4xl mx-auto p-12 overflow-y-auto h-full custom-scrollbar pb-32">
            <div className="mb-12 bg-tp-purple/5 border border-tp-purple/10 p-8 rounded-[32px]">
              <h3 className="text-[10px] font-black text-tp-purple uppercase tracking-[0.4em] mb-3">Validation Instruction</h3>
              <p className="text-lg font-bold text-tp-purple italic leading-snug">
                "<span className="text-tp-red font-black underline">{resource.title}</span> mastery validation in progress."
              </p>
            </div>
            
            <div className="space-y-10">
              {quizQuestions.map((q, i) => (
                <div key={i} className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="w-10 h-10 bg-tp-purple text-white rounded-xl flex items-center justify-center font-black text-sm">{i + 1}</span>
                    <p className="font-bold text-xl text-tp-purple leading-tight">{q.question}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((opt, optIdx) => (
                      <button 
                        key={optIdx}
                        onClick={() => { const n = [...answers]; n[i] = optIdx; setAnswers(n); }}
                        className={`text-left px-8 py-5 rounded-2xl border-2 transition-all font-bold text-sm ${answers[i] === optIdx ? 'border-tp-purple bg-tp-purple text-white shadow-xl scale-[1.02]' : 'border-gray-50 bg-gray-50 hover:border-tp-purple/20 text-gray-600'}`}
                      >
                        <span className="mr-3 opacity-30">{String.fromCharCode(65 + optIdx)}.</span> {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-center mt-12">
                <button 
                  onClick={submitQuiz}
                  disabled={isGenerating || answers.includes(-1)}
                  className="w-full max-w-md bg-tp-purple text-white py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl disabled:opacity-50"
                >
                  Confirm Proficiency
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'result' && (
          <div className="h-full flex items-center justify-center p-8 bg-gray-50/50">
            <div className="bg-white rounded-[48px] p-20 max-w-xl w-full text-center shadow-2xl border border-gray-100">
              <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-10 ${score >= 60 ? 'bg-green-100 text-green-600' : 'bg-tp-red/10 text-tp-red'}`}>
                {score >= 60 ? <CheckCircleIcon className="w-14 h-14" filled /> : <ExclamationCircleIcon className="w-14 h-14" />}
              </div>
              <h2 className="text-4xl font-black text-tp-purple mb-2 uppercase tracking-tight">{score >= 60 ? 'Success' : 'Try Again'}</h2>
              <p className="text-7xl font-black text-tp-purple mb-10 tracking-tighter">{score}%</p>
              <button onClick={onClose} className="w-full bg-tp-navy text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-tp-purple transition-all shadow-xl">Close Module</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LessonViewer;
