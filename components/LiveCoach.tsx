/// <reference types="vite/client" />

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { XIcon, SpeakingIcon, BrainIcon, UserIcon } from './Icons';
import { googleSheetService } from '../services/googleSheetService';
import type { UserProfile } from '../types';

export interface RoleplayScenario {
  id: string;
  category: string;
  subTopic: string;
  description: string;
  tone: string;
  skillTested: string;
  expectedApproach: string;
  difficulty: 'Basic' | 'Moderate' | 'Advanced';
}

const ETIHAD_ROLEPLAY_BANK: RoleplayScenario[] = [
  { id: 'NB001', category: 'New Booking', subTopic: 'First-Time Traveler', description: 'Guest never booked a flight before and is unfamiliar with timelines, rules, or terminology.', tone: 'Curious, unsure', skillTested: 'Education, patience', expectedApproach: 'Use simple language, avoid industry jargon, verify understanding step-by-step.', difficulty: 'Basic' },
  { id: 'NC001', category: 'Name Correction', subTopic: 'Minor Name Spelling Update', description: 'Minor spelling correction request (one character difference) during a high-pressure rush context.', tone: 'Fast-speaking guest with unclear accent', skillTested: 'Active listening, double-confirmation', expectedApproach: 'Slow down the interaction pace, repeat spellings explicitly using the phonetic alphabet.', difficulty: 'Basic' },
  { id: 'FC003', category: 'Flight Change Requests', subTopic: 'Fare Difference Explanation', description: 'Passenger is shocked and combative regarding a large fare difference calculation for an involuntary shift.', tone: 'Indirect complaints, resistant', skillTested: 'Empathy, explanation of complex fare rules', expectedApproach: 'Acknowledge the financial concern clearly, break down the pricing components transparently without becoming defensive.', difficulty: 'Moderate' },
  { id: 'TA003', category: 'Travel Agency Related', subTopic: 'Agency vs Airline Responsibility Clarification', description: 'Third-party agency mismanaged the flight segments and is actively blaming airline systems to the passenger.', tone: 'Guest mixes multiple administrative issues', skillTested: 'Prioritization, controlling the call flow structure', expectedApproach: 'Separate third-party responsibilities clearly from airline control lines, address concerns systematically.', difficulty: 'Advanced' },
  { id: 'AS008', category: 'Ancillary Services', subTopic: 'Bassinet Availability Limitation', description: 'The requested aircraft bassinet positions are fully booked; parent is highly anxious and emotional about a long-haul itinerary.', tone: 'Passenger mixing intense emotional appeal with logic', skillTested: 'Deep empathy, alternative reassurance tracking', expectedApproach: 'Validate the emotional stress of traveling with an infant, pivot immediately to seat buffering or alternative cabin options.', difficulty: 'Moderate' }
];

interface LiveCoachProps {
  onClose: () => void;
  currentUser: UserProfile;
  onImpersonate: (user: UserProfile) => void;
  initialScenario?: string;
  scenarioId?: string;
  onComplete?: (score: number, timeTakenSecs: number) => void;
}

const LiveCoach: React.FC<LiveCoachProps> = ({ onClose, currentUser, onImpersonate, initialScenario, scenarioId, onComplete }) => {
  // Hard Failsafe: Only Coaches, Admins, or Agents can access this view
  if (currentUser.role !== 'coach' && currentUser.role !== 'admin' && currentUser.role !== 'agent') return null;

  const [activeMode, setActiveMode] = useState<'ai' | 'directory'>(currentUser.role === 'agent' ? 'ai' : 'directory');
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  
  // Custom states for Etihad Roleplay Bank selection
  const [selectedScenario, setSelectedScenario] = useState<RoleplayScenario>(() => {
    const targetId = initialScenario || scenarioId;
    if (targetId) {
      const match = ETIHAD_ROLEPLAY_BANK.find(s => s.id === targetId);
      if (match) return match;
    }
    return ETIHAD_ROLEPLAY_BANK[0];
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');

  // Agent Auto-Binding Mission Brief check
  useEffect(() => {
    if (currentUser.role === 'agent') {
      const targetId = initialScenario || scenarioId || currentUser.assignedScenarioId || 'NB001';
      const assigned = ETIHAD_ROLEPLAY_BANK.find(s => s.id === targetId);
      if (assigned) {
        setSelectedScenario(assigned);
      }
    }
  }, [currentUser, initialScenario, scenarioId]);

  const [evaluationReport, setEvaluationReport] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  // Robust session state machine for connection tracking and crash management
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'active' | 'evaluating' | 'completed' | 'crashed'>('idle');
  
  const sessionStatusRef = useRef<'idle' | 'connecting' | 'active' | 'evaluating' | 'completed' | 'crashed'>('idle');
  const transcriptionRef = useRef<string[]>([]);
  const lastSavedLengthRef = useRef<number>(0);

  const updateSessionStatus = (status: 'idle' | 'connecting' | 'active' | 'evaluating' | 'completed' | 'crashed') => {
    setSessionStatus(status);
    sessionStatusRef.current = status;
  };

  const addTranscriptionLine = (line: string) => {
    setTranscription(prev => {
      const updated = [...prev, line];
      transcriptionRef.current = updated;
      return updated;
    });
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const cleanupAudioWorklet = () => {
    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.port.close();
      } catch (e) {
        console.error("Error closing worklet node port:", e);
      }
      try {
        workletNodeRef.current.disconnect();
      } catch (e) {
        console.error("Error disconnecting worklet node:", e);
      }
      workletNodeRef.current = null;
    }
  };

  const fetchStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const users = await googleSheetService.fetchAllUsers();
      const allUsers = Array.isArray(users) ? users : [];
      
      let filtered: UserProfile[] = [];

      if (currentUser.role === 'admin') {
        // Admins see all agents for global oversight
        filtered = allUsers.filter(u => u.role === 'agent');
      } else if (currentUser.role === 'coach') {
        // SECURITY & ACCURACY FIX: 
        // Coaches strictly filter for:
        // 1. Role is 'agent' (student)
        // 2. assignedCoach email matches THIS coach's email
        // 3. Not themselves
        filtered = allUsers.filter(u => 
          u.role === 'agent' && 
          u.assignedCoach === currentUser.email &&
          u.email !== currentUser.email
        );
      }
      
      console.log(`[LiveCoach] Students Fetched for ${currentUser.email}:`, filtered);
      setStudents(filtered);
    } catch (err) {
      console.error("Failed to load students:", err);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (activeMode === 'directory') fetchStudents();
  }, [activeMode, currentUser.email]);

  const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const createBlob = (data: Float32Array): Blob => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      int16[i] = data[i] * 32768;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return {
      data: btoa(binary),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const getSystemInstruction = (scenario: RoleplayScenario) => {
    return `You are simulating an airline guest in an aviation support interaction.
    Category: ${scenario.category}
    Sub-Topic/Issue: ${scenario.subTopic}
    Description of the situation: ${scenario.description}
    Customer's Temperament/Tone: ${scenario.tone}
    Expected Agent Skill / Approach to test: ${scenario.skillTested}
    Expected approach: ${scenario.expectedApproach}
    Difficulty level: ${scenario.difficulty}

    Your goal: Dynamic, high-fidelity customer simulation.
    Wait for the agent to initialize contact, then react naturally matching the passenger tone, mixing emotional/logical cues. Maintain character seamlessly. Do not break role.`;
  };

  const harvestAndSaveTranscriptDirectly = async (currentTranscription: string[]) => {
    if (currentTranscription.length === 0) {
      console.log("[LiveCoach] No transcription logs available to harvest.");
      return;
    }
    // Avoid double-saving the exact same length to prevent duplicate records
    if (currentTranscription.length === lastSavedLengthRef.current) {
      console.log("[LiveCoach] Transcription already harvested and synchronized.");
      return;
    }
    lastSavedLengthRef.current = currentTranscription.length;

    console.log("[LiveCoach] Real-time Transcript Packaging in progress for:", currentUser.id);
    const structuredMessages = currentTranscription.map((line, idx) => {
      const isAgent = line.startsWith('You:');
      const text = line.replace(/^(You:|Coach:)\s*/i, '');
      return {
        sender: isAgent ? 'Agent' : 'Customer',
        text: text,
        timestamp: new Date().toISOString(),
        role: isAgent ? 'agent' : 'customer',
        grade: isAgent ? 'Grade Pending' : 'N/A',
        rationale: isAgent ? 'Monitored conversation utterance.' : 'Scenario roleplay action.'
      };
    });

    try {
      await googleSheetService.saveTranscript(currentUser.id, {
        topic: `Live Roleplay: ${selectedScenario.category} (${selectedScenario.subTopic})`,
        duration: 'Live Audio Session',
        overallScore: 'Saved',
        messages: structuredMessages
      });
      console.log("[LiveCoach] Real-time dialogue log package pushed successfully to Cloud Store.");
    } catch (saveErr) {
      console.error("[LiveCoach] Direct real-time data harvest failed:", saveErr);
    }
  };

  const startSession = async () => {
    if (activeMode !== 'ai') return;
    setIsConnecting(true);
    setEvaluationReport(null);
    setError(null);
    setTranscription([]);
    transcriptionRef.current = [];
    lastSavedLengthRef.current = 0;
    setSessionStartTime(Date.now());
    updateSessionStatus('connecting');

    try {
      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
      
      // Safeguard: Check if environment variable failed to load on Vercel
      if (!API_KEY) {
        console.error("[LiveCoach] FATAL: VITE_GEMINI_API_KEY is missing from the environment.");
        setError("Missing API Key. Ensure VITE_GEMINI_API_KEY is added to your Vercel Environment Variables.");
        setIsConnecting(false);
        updateSessionStatus('idle');
        return;
      }
      
      const ai = new GoogleGenAI({ 
        apiKey: API_KEY,
        apiVersion: 'v1beta'
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Create an inline AudioWorklet processor Blob Url
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const channelData = input[0];
              this.port.postMessage(channelData);
            }
            return true;
          }
        }
        registerProcessor('audio-processor', AudioProcessor);
      `;
      const workletBlob = new globalThis.Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);

      const sessionPromise = ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            setIsConnecting(false);
            updateSessionStatus('active');
            
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            
            try {
              await audioContextRef.current!.audioWorklet.addModule(workletUrl);
              const workletNode = new AudioWorkletNode(audioContextRef.current!, 'audio-processor');
              workletNodeRef.current = workletNode;

              workletNode.port.onmessage = (e) => {
                if (sessionStatusRef.current !== 'active') return;
                const inputData = e.data;
                const pcmBlob = createBlob(inputData);
                
                sessionPromise.then(session => {
                  if (session && sessionStatusRef.current === 'active') {
                    try {
                      session.sendRealtimeInput({ audio: pcmBlob });
                    } catch (sendErr) {
                      console.warn("[LiveCoach] Audio transmission prevented: Socket is already closing or closed.");
                    }
                  }
                }).catch(err => {
                  console.error("[LiveCoach] Microtask session unresolved:", err);
                });
              };

              source.connect(workletNode);
              workletNode.connect(audioContextRef.current!.destination);
              
              URL.revokeObjectURL(workletUrl);
            } catch (err) {
              console.error("AudioWorklet initialization failed", err);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              addTranscriptionLine(`Coach: ${text}`);
            } else if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              addTranscriptionLine(`You: ${text}`);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && sessionStatusRef.current === 'active') {
              setIsSpeaking(true);
              const ctx = outAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(base64Audio), ctx);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live API Error", e);
            setError("Auditory feed terminated unexpectedly (Mic disconnected or network timeout).");
            setIsConnecting(false);
            setIsConnected(false);
            cleanupAudioWorklet();
            
            // Trigger emergency harvesting of transcription logs collected so far
            harvestAndSaveTranscriptDirectly(transcriptionRef.current);
            
            if (transcriptionRef.current.length > 0) {
              updateSessionStatus('crashed');
            } else {
              updateSessionStatus('idle');
            }
          },
          onclose: () => {
            setIsConnected(false);
            setIsConnecting(false);
            cleanupAudioWorklet();
            
            // Trigger emergency harvesting of transcription logs
            harvestAndSaveTranscriptDirectly(transcriptionRef.current);
            
            if (sessionStatusRef.current === 'active') {
              updateSessionStatus('crashed');
              setError("Live stream connection interrupted. Dialogue log saved safely.");
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: { parts: [{ text: getSystemInstruction(selectedScenario) }] },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setError("Mic access denied or API configuration error.");
      setIsConnecting(false);
      updateSessionStatus('idle');
    }
  };

  const endSessionAndCompileEvaluation = async () => {
    // 1. Close current WebSocket and audio tracks
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
    }
    cleanupAudioWorklet();
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (outAudioContextRef.current) outAudioContextRef.current.close().catch(() => {});
    sessionRef.current = null;
    setIsConnected(false);

    const linesToEvaluate = transcriptionRef.current.length > 0 ? transcriptionRef.current : transcription;
    if (linesToEvaluate.length === 0) {
      updateSessionStatus('idle');
      return;
    }

    // Capture and upload dialogue log package immediately before evaluation
    await harvestAndSaveTranscriptDirectly(linesToEvaluate);

    updateSessionStatus('evaluating');
    setIsEvaluating(true);
    setEvaluationReport(null);

    // Modern Phase A: Package transcription messages synchronously
    const structuredMessages = linesToEvaluate.map((line, idx) => {
      const isAgent = line.startsWith('You:');
      const text = line.replace(/^(You:|Coach:)\s*/i, '');
      return {
        sender: isAgent ? 'Agent' : 'Customer',
        text: text,
        timestamp: new Date().toISOString(),
        role: isAgent ? 'agent' : 'customer',
        grade: isAgent ? 'Grade Pending' : 'N/A',
        rationale: isAgent ? 'Monitored conversation utterance.' : 'Scenario roleplay action.'
      };
    });

    try {
      const prompt = `Evaluate this corporate customer support dialogue between an Agent (You) and the simulation Customer (Coach).
      Analyze the Agent's performance strictly across these metrics:
      1. Fluency & Speed
      2. Syntactic & Grammatical Accuracy
      3. Emotional De-escalating Alignment (Empathy Phrasing)
      4. Standardized CEFR Level (A2, B1, B2, C1, C2)
      5. Customer Satisfaction / Saved Index (0-100)

      Conversation Transcript:
      ${linesToEvaluate.join('\n')}

      Format your response strictly using professional Markdown. Organize clearly under each category with specific constructive suggestions. Include a summary tabular block of performance scores at the bottom. Do not output conversational wrap texts.`;

      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt
      });
      
      const reportText = response.text || "Failed to generate evaluation report.";
      setEvaluationReport(reportText);

      // Extract a representative score/level from reportText for the transcripts list
      let parsedScore = 'B2 Proficient';
      if (reportText.includes('C1')) parsedScore = 'C1 Advanced';
      else if (reportText.includes('B1')) parsedScore = 'B1 Intermediate';
      else if (reportText.includes('C2')) parsedScore = 'C2 Mastery';
      else if (reportText.includes('A2')) parsedScore = 'A2 Beginner';

      // Save the captured conversation log securely to the spreadsheet database with proper overallScore
      await googleSheetService.saveTranscript(currentUser.id, {
        topic: `Live Roleplay: ${selectedScenario.category} (${selectedScenario.subTopic})`,
        duration: 'Live Audio Session',
        overallScore: parsedScore,
        messages: structuredMessages
      });

      // Parse score from the evaluation report or map from CEFR Level
      let numericScore = 85;
      const scoreMatch = reportText.match(/(?:Satisfaction|Score|Saved Index|Index|Rating)[\s:]*(\d{1,3})/i);
      if (scoreMatch) {
        const potentialScore = parseInt(scoreMatch[1]);
        if (potentialScore >= 0 && potentialScore <= 100) {
          numericScore = potentialScore;
        }
      } else {
        if (parsedScore.includes('C2')) numericScore = 95;
        else if (parsedScore.includes('C1')) numericScore = 90;
        else if (parsedScore.includes('B2')) numericScore = 80;
        else if (parsedScore.includes('B1')) numericScore = 70;
        else if (parsedScore.includes('A2')) numericScore = 60;
      }

      const elapsedSecs = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 300;

      if (onComplete) {
        onComplete(numericScore, elapsedSecs);
      }

      updateSessionStatus('completed');
    } catch (err) {
      console.error(err);
      setEvaluationReport("Registry alignment error during final scoring computation.");
      updateSessionStatus('completed');
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      cleanupAudioWorklet();
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
      if (outAudioContextRef.current) outAudioContextRef.current.close().catch(() => {});
    };
  }, [activeMode]);

  return (
    <div className="fixed inset-0 z-[100] bg-tp-navy flex flex-col items-center justify-start p-6 md:p-12 animate-fadeIn overflow-hidden">
      <div className="w-full flex justify-between items-center mb-12 relative z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl">
            <SpeakingIcon className="w-8 h-8 text-tp-purple" />
          </div>
          <div className="text-left">
            <h1 className="text-xl font-black text-white uppercase tracking-tighter">Skillence Coach Hub</h1>
            <p className="text-tp-red font-black text-[9px] uppercase tracking-[0.4em]">TP Professional Services</p>
          </div>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
          <button 
            onClick={() => setActiveMode('directory')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMode === 'directory' ? 'bg-tp-red text-white' : 'text-white/50'}`}
          >
            Student Directory
          </button>
          <button 
            onClick={() => setActiveMode('ai')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMode === 'ai' ? 'bg-tp-red text-white' : 'text-white/50'}`}
          >
            AI Practice Session
          </button>
        </div>

        <button 
          onClick={onClose}
          className="p-4 text-white/40 hover:text-white bg-white/5 rounded-full transition-all"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-tp-red/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-tp-purple/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-4xl w-full relative z-10 flex flex-col items-center flex-1 overflow-hidden">
        {activeMode === 'directory' ? (
          <div className="w-full bg-white/5 backdrop-blur-xl rounded-[48px] p-8 md:p-10 border border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-full">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Active Students</h2>
              <div className="px-4 py-2 bg-tp-red text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                {students.length} Agents Assigned
              </div>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar pr-4">
              {isLoadingStudents ? (
                <div className="py-20 text-center animate-pulse text-white/30 uppercase font-black text-xs tracking-[0.3em]">Querying Registry...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {students.map((student) => (
                    <div key={student.id} className="bg-white/5 border border-white/5 rounded-3xl p-6 hover:bg-white/10 transition-all flex justify-between items-center group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-tp-red/10 rounded-2xl flex items-center justify-center text-tp-red group-hover:scale-110 transition-transform">
                          <UserIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-white font-bold text-base leading-tight">{student.name}</p>
                          <span className="text-tp-red font-black text-[10px] uppercase tracking-widest">{student.languageLevel || 'N/A'} Proficiency</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => onImpersonate(student)}
                        className="bg-white text-tp-purple px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tp-red hover:text-white transition-all shadow-xl"
                      >
                        View Profile
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {students.length === 0 && !isLoadingStudents && (
                <div className="py-20 text-center text-white/20 font-black uppercase text-xs tracking-widest">
                  No registered students found in your directory.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`w-full ${sessionStatus === 'idle' && currentUser.role !== 'agent' ? 'max-w-4xl' : 'max-w-2xl'} bg-white/5 backdrop-blur-xl border border-white/10 rounded-[48px] p-8 md:p-10 shadow-2xl flex flex-col items-center`}>
            
            {/* STATE 1: SETUP/IDLE */}
            {sessionStatus === 'idle' && (
              currentUser.role === 'agent' ? (
                /* AGENT VIEW: LOCKED GUIDED MISSION */
                <div className="w-full flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 bg-tp-red/10 rounded-3xl flex items-center justify-center border border-tp-red/20 shadow-inner">
                    <BrainIcon className="w-10 h-10 text-tp-red" />
                  </div>
                  
                  <div>
                    <span className="text-[10px] font-black uppercase text-tp-red tracking-[0.3em]">Assigned Training Mission</span>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-white mt-1">Guided Simulation Brief</h3>
                  </div>

                  <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-left space-y-4 shadow-xl">
                    <div className="flex justify-between items-center pb-3 border-b border-white/10">
                      <div>
                        <span className="text-[10px] uppercase font-black text-white/40 tracking-wider">Mission Segment</span>
                        <p className="text-white font-black text-base uppercase tracking-tight mt-0.5">{selectedScenario.category}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                        selectedScenario.difficulty === 'Basic' ? 'bg-green-500/10 text-green-400' :
                        selectedScenario.difficulty === 'Moderate' ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {selectedScenario.difficulty} Difficulty
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black text-white/40 tracking-wider">Subject Issue / Challenge</span>
                      <p className="text-white font-bold text-sm mt-0.5">{selectedScenario.subTopic}</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black text-white/40 tracking-wider">Briefing Description</span>
                      <p className="text-white/80 text-xs font-semibold leading-relaxed mt-1">{selectedScenario.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[9px] uppercase font-black text-yellow-500 tracking-wider block">Passenger Temperament</span>
                        <p className="text-white font-bold text-xs mt-0.5">{selectedScenario.tone}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[9px] uppercase font-black text-green-400 tracking-wider block">Metric Skill Checked</span>
                        <p className="text-white font-bold text-xs mt-0.5">{selectedScenario.skillTested}</p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-tp-red/10 border border-tp-red/30 p-4 rounded-2xl w-full text-left">
                      <p className="text-tp-red font-bold text-[11px] uppercase tracking-wider">{error}</p>
                    </div>
                  )}

                  <button 
                    onClick={startSession}
                    className="w-full bg-tp-red text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-white hover:text-tp-purple transition-all inline-flex items-center justify-center gap-3 active:scale-95"
                  >
                    <SpeakingIcon className="w-4 h-4" /> Start Live Simulation
                  </button>
                </div>
              ) : (
                /* ADMIN/COACH VIEW: FULL SANDBOX DASHBOARD */
                <div className="w-full flex flex-col items-center space-y-6">
                  <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-left">
                      <span className="text-[10px] font-black uppercase text-tp-red tracking-[0.3em]">Simulation Sandbox</span>
                      <h3 className="text-2xl font-black uppercase tracking-tight text-white mt-1">Roleplay Bank Directory</h3>
                    </div>

                    {/* Integrated Search & Category & Difficulty Filter UI */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        placeholder="Search topics..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-tp-red font-semibold placeholder-white/30"
                      />
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] text-white font-black uppercase tracking-wider cursor-pointer outline-none focus:ring-1 focus:ring-tp-red"
                      >
                        <option value="All">All Categories</option>
                        {Array.from(new Set(ETIHAD_ROLEPLAY_BANK.map(s => s.category))).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <select
                        value={selectedDifficulty}
                        onChange={(e) => setSelectedDifficulty(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] text-white font-black uppercase tracking-wider cursor-pointer outline-none focus:ring-1 focus:ring-tp-red"
                      >
                        <option value="All">All Difficulties</option>
                        <option value="Basic">Basic</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  {/* Scenario Grid Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {ETIHAD_ROLEPLAY_BANK.filter(sc => {
                      const matchesSearch = sc.subTopic.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                            sc.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                            sc.description.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesCategory = selectedCategory === 'All' || sc.category === selectedCategory;
                      const matchesDifficulty = selectedDifficulty === 'All' || sc.difficulty === selectedDifficulty;
                      return matchesSearch && matchesCategory && matchesDifficulty;
                    }).map((sc) => {
                      const isSelected = selectedScenario.id === sc.id;
                      return (
                        <div 
                          key={sc.id}
                          onClick={() => setSelectedScenario(sc)}
                          className={`cursor-pointer text-left p-5 rounded-3xl border transition-all ${
                            isSelected 
                              ? 'bg-tp-red/15 border-tp-red shadow-[0_0_20px_rgba(226,0,26,0.15)]' 
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[9px] font-black uppercase text-tp-red tracking-wider bg-tp-red/10 px-2.5 py-1 rounded">
                              {sc.id}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              sc.difficulty === 'Basic' ? 'bg-green-500/10 text-green-400' :
                              sc.difficulty === 'Moderate' ? 'bg-yellow-500/10 text-yellow-500' :
                              'bg-red-500/10 text-red-400'
                            }`}>
                              {sc.difficulty}
                            </span>
                          </div>
                          <h4 className="text-white font-bold text-sm leading-tight">{sc.category}</h4>
                          <p className="text-white/80 font-semibold text-xs mt-0.5">{sc.subTopic}</p>
                          <p className="text-white/40 text-xs line-clamp-2 mt-2 leading-relaxed font-semibold">{sc.description}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Single Selected Summary View details */}
                  <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-left space-y-4 font-semibold text-xs">
                    <div className="flex justify-between items-center pb-3 border-b border-white/10">
                      <div>
                        <span className="text-[10px] uppercase font-black text-white/40 tracking-wider">Mission Target Brief</span>
                        <p className="text-white font-black text-base uppercase mt-0.5">{selectedScenario.category} ({selectedScenario.subTopic})</p>
                      </div>
                      <span className="text-sm font-black text-tp-red uppercase">{selectedScenario.id}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-black text-white/40 tracking-wider">Briefing Description</span>
                      <p className="text-white/80 text-xs font-semibold leading-relaxed mt-1">{selectedScenario.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[9px] uppercase font-black text-yellow-500 tracking-wider block">Guest Tone / Temperament</span>
                        <p className="text-white font-bold text-xs mt-0.5">{selectedScenario.tone}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[9px] uppercase font-black text-green-400 tracking-wider block">Metric Skill Checked</span>
                        <p className="text-white font-bold text-xs mt-0.5">{selectedScenario.skillTested}</p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-tp-red/10 border border-tp-red/30 p-4 rounded-2xl w-full text-left">
                      <p className="text-tp-red font-bold text-[11px] uppercase tracking-wider">{error}</p>
                    </div>
                  )}

                  <button 
                    onClick={startSession}
                    className="w-full bg-tp-red text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-white hover:text-tp-purple transition-all inline-flex items-center justify-center gap-3 active:scale-95"
                  >
                    <SpeakingIcon className="w-4 h-4" /> Connect Digital Client
                  </button>
                </div>
              )
            )}

            {/* STATE 2: CONNECTING */}
            {sessionStatus === 'connecting' && (
              <div className="py-20 text-center space-y-6">
                <div className="w-16 h-16 border-4 border-white/10 border-t-tp-red rounded-full animate-spin mx-auto"></div>
                <p className="text-white/60 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Opening Live Wave Channel...</p>
                {error && <p className="text-tp-red text-[10px] uppercase font-bold tracking-widest">{error}</p>}
              </div>
            )}

            {/* STATE 3: ACTIVE LIVE SESSION */}
            {sessionStatus === 'active' && (
              <div className="w-full flex flex-col items-center">
                <div className="relative mb-8">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center transition-all duration-500 border-4 border-tp-red shadow-[0_0_80px_rgba(226,0,26,0.35)]">
                    <div className={`absolute inset-0 rounded-full border-2 border-tp-red/30 animate-ping ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
                    <div className="w-24 h-24 md:w-30 md:h-30 bg-white/5 rounded-full flex items-center justify-center relative overflow-hidden">
                        <BrainIcon className="w-12 h-12 text-white animate-pulse" />
                    </div>
                  </div>
                </div>

                {/* Scrollable Dialogue Panel */}
                <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl h-[280px] overflow-y-auto custom-scrollbar flex flex-col space-y-3 text-left">
                  {transcription.length === 0 ? (
                    <p className="text-white/20 italic font-medium text-base my-auto text-center">"The Coach is listening... Greeting incoming client..."</p>
                  ) : (
                    transcription.map((line, i) => (
                      <p key={i} className={`text-base font-bold leading-tight animate-fadeIn ${line.startsWith('You:') ? 'text-tp-red font-black' : 'text-white'}`}>
                        {line}
                      </p>
                    ))
                  )}
                </div>

                <button 
                  onClick={endSessionAndCompileEvaluation}
                  className="w-full bg-tp-red hover:bg-tp-red/80 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all mt-6 shadow-xl"
                >
                  End & Evaluate Dialogue
                </button>
              </div>
            )}

            {/* STATE 4: EVALUATING GENERATOR */}
            {sessionStatus === 'evaluating' && (
              <div className="py-20 text-center space-y-6">
                <div className="w-16 h-16 border-4 border-white/10 border-t-tp-red rounded-full animate-spin mx-auto"></div>
                <p className="text-white/60 text-xs font-black uppercase tracking-[0.3em] animate-pulse">Engineering CEFR Quality Scorecard...</p>
              </div>
            )}

            {/* STATE 5: PERFORMANCE REPORT COMPLETED */}
            {sessionStatus === 'completed' && evaluationReport && (
              <div className="w-full space-y-6 text-left animate-fadeIn">
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div>
                    <span className="text-[10px] font-black uppercase text-tp-red tracking-widest">Quality Assurance Scorecard</span>
                    <h4 className="text-base font-black text-white uppercase tracking-tight mt-0.5">Performance Assessment</h4>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-white overflow-y-auto max-h-[340px] text-xs leading-relaxed custom-scrollbar prose prose-invert font-semibold">
                  <div className="whitespace-pre-wrap">{evaluationReport}</div>
                </div>

                <button 
                  onClick={() => {
                    setEvaluationReport(null);
                    setTranscription([]);
                    transcriptionRef.current = [];
                    lastSavedLengthRef.current = 0;
                    updateSessionStatus('idle');
                  }}
                  className="w-full bg-white text-tp-navy hover:bg-tp-red hover:text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-xl"
                >
                  Start New Roleplay Session
                </button>
              </div>
            )}

            {/* STATE 6: CRASH / ERROR RECOVERY DISCONNECTED STATE */}
            {sessionStatus === 'crashed' && (
              <div className="w-full text-left space-y-6 animate-fadeIn">
                <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl flex flex-col md:flex-row gap-4 items-start">
                  <div className="w-10 h-10 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <XIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">Auditory connection lost</h4>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">
                      Your microphone stream or WebSocket suffered a temporary disconnect. Fortunately, your dialogue log is fully preserved and has been harvested into the Cloud Sheet.
                    </p>
                  </div>
                </div>

                {/* Preserved Conversation Bubbles */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black text-white/50 uppercase tracking-widest pl-1">Preserved Dialogue ({transcription.length} Utterances)</span>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-h-[160px] overflow-y-auto custom-scrollbar space-y-2">
                    {transcription.map((line, idx) => (
                      <p key={idx} className={`text-xs font-bold ${line.startsWith('You:') ? 'text-tp-red font-black' : 'text-white/80'}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={endSessionAndCompileEvaluation}
                    className="bg-tp-red text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white hover:text-tp-purple transition-all shadow-xl text-center"
                  >
                    Compile Scorecard Anyway
                  </button>
                  <button
                    onClick={() => {
                      setTranscription([]);
                      transcriptionRef.current = [];
                      lastSavedLengthRef.current = 0;
                      setError(null);
                      updateSessionStatus('idle');
                    }}
                    className="bg-white/10 text-white/80 hover:bg-white/20 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all text-center"
                  >
                    Return to Sandbox Setup
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default LiveCoach;
