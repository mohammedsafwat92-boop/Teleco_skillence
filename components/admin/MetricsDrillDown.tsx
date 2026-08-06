import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  User, 
  Brain, 
  Award, 
  Terminal, 
  MessageSquare, 
  Activity, 
  Clock, 
  TrendingUp, 
  ShieldAlert,
  Loader
} from 'lucide-react';
import type { UserProfile } from '../../types';
import { googleSheetService } from '../../services/googleSheetService';

interface MetricsDrillDownProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  adminStats: any;
  currentUser?: UserProfile;
  onRefresh?: () => Promise<void> | void;
}

const getMockTranscripts = (level: string) => {
  return [
    {
      id: 't-1',
      topic: 'De-escalating Irate Subscription Double-Charge',
      date: 'June 01, 2026',
      duration: '4:15',
      overallScore: 'B2 Passing',
      messages: [
        { sender: 'Customer', text: "Listen, I am looking at my statement right now and you guys double-charged my card this month! I want a full refund and I want to cancel my account immediately. This is ridiculous!", grade: 'N/A' },
        { sender: 'Agent', text: "I completely understand your frustration, and I am very sorry for any convenience this has caused. Let me look at your account right now and get this sorted out for you immediately. May I please have your email address?", grade: 'High Quality', rationale: 'Strong de-escalation phrasing. High empathy, proactive alignment and polite compliance.' },
        { sender: 'Customer', text: "It is mark.jackson@gmail.com. Last month was fine, but yesterday I got charged twice. This is an enterprise utility account!", grade: 'N/A' },
        { sender: 'Agent', text: "Thank you, Mr. Jackson. I have located your subscription. Yes, I see that two invoices were posted due to an automated billing system update. I have processed a refund of $49.00 for the duplicate charge right now. It will appear on your card in 2-3 business days. I also applied a $10.00 goodwill credit for the mistake.", grade: 'CEFR-C1 Perfect', rationale: 'Excellent professional directness. Precise financial explanations and immediate concrete resolution.' },
        { sender: 'Customer', text: "Oh, well, that's actually very fast. I appreciate you refunding it and adding that billing credit. Will this double-charging happen again?", grade: 'N/A' },
        { sender: 'Agent', text: "Not at all, Mr. Jackson. The alignment issue was resolved manually by our engineering team, and your profile is fully clear now. I have also verified that the next charge will reflect the $10 credit. Is there anything else I can assist you with today?", grade: 'CEFR-B2 Proficient', rationale: 'Direct and grammatically clean. Addressed security of systems clearly.' },
        { sender: 'Customer', text: "No, that's everything. Thank you for your fast help.", grade: 'N/A' }
      ]
    },
    {
      id: 't-2',
      topic: 'Technical Troubleshooting: Enterprise Routing Configuration',
      date: 'May 28, 2026',
      duration: '5:40',
      overallScore: 'B1 Borderline',
      messages: [
        { sender: 'Customer', text: "Yeah, my team is trying to forward our incoming trunk lines to the SIP trunk but the logs are throwing a 403 Forbidden. Can you check my credentials?", grade: 'N/A' },
        { sender: 'Agent', text: "Yes, sure. I will look at that. You can wait a moment while I check the server side?", grade: 'CEFR-A2 Weak Syntax', rationale: 'Phrasing is overly passive and conversational rather than professional contact center format.' },
        { sender: 'Customer', text: "Okay, they are waiting on a client call. Let me know what you find.", grade: 'N/A' },
        { sender: 'Agent', text: "I see your account is active, but the IP whitelist in your security parameters does not match your active gateway router. You should update your security token in the control dashboard. Did you do that?", grade: 'CEFR-B1 Conversational', rationale: 'Technically correct but lacks precise instructional clarity. Use active verbs and polite questions.' },
        { sender: 'Customer', text: "Oh, we switched ISP yesterday. Let me edit that IP registration. One second... okay, it worked!", grade: 'N/A' },
        { sender: 'Agent', text: "That is great. I am happy that it works now. Please call again if something breaks.", grade: 'CEFR-B1 Passing', rationale: 'Friendly closing, but lacks structural corporate branding script.' }
      ]
    }
  ];
};

export const LIVE_COACH_SCENARIOS = [
  { id: 'sim-NB001', title: 'Simulation: First-Time Traveler', type: 'Simulation', url: 'NB001', duration: 15 },
  { id: 'sim-NC001', title: 'Simulation: Minor Name Spelling Update', type: 'Simulation', url: 'NC001', duration: 15 },
  { id: 'sim-FC003', title: 'Simulation: Fare Difference Explanation', type: 'Simulation', url: 'FC003', duration: 15 },
  { id: 'sim-TA003', title: 'Simulation: Agency vs Airline Responsibility Clarification', type: 'Simulation', url: 'TA003', duration: 15 },
  { id: 'sim-AS008', title: 'Simulation: Bassinet Availability Limitation', type: 'Simulation', url: 'AS008', duration: 15 }
];

export const MetricsDrillDown: React.FC<MetricsDrillDownProps> = ({ 
  isOpen, 
  onClose, 
  user, 
  adminStats,
  currentUser,
  onRefresh
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'metrics' | 'transcripts' | 'json'>('metrics');
  const [jsonExpanded, setJsonExpanded] = useState<boolean>(false);
  const [selectedTranscriptIndex, setSelectedTranscriptIndex] = useState<number>(0);
  const [liveTranscripts, setLiveTranscripts] = useState<any[]>([]);
  const [isLoadingTranscripts, setIsLoadingTranscripts] = useState<boolean>(false);

  // States for Assigning AI Simulations
  const [allResources, setAllResources] = useState<any[]>([]);
  const [selectedSimulation, setSelectedSimulation] = useState<string>('');
  const [isAssigningSim, setIsAssigningSim] = useState<boolean>(false);

  // Filter core simulation resources
  const simulations = useMemo(() => {
    return allResources.filter((r: any) => r.type === 'Simulation');
  }, [allResources]);

  // Fetch all resources when drill down opens
  useEffect(() => {
    if (isOpen) {
      googleSheetService.getAllResources()
        .then((res: any) => {
          if (Array.isArray(res)) {
            setAllResources(res);
          }
        })
        .catch((err) => {
          console.error("[MetricsDrillDown] Error fetching global resources:", err);
        });
    }
  }, [isOpen]);

  const handleAssignSimulation = async (agentId: string) => {
    if (!selectedSimulation || !agentId) return;
    setIsAssigningSim(true);
    try {
      const scenario = LIVE_COACH_SCENARIOS.find(s => s.id === selectedSimulation);
      if (!scenario) throw new Error("Scenario not found");
      
      // 1. Silently ensure the scenario exists in the Resources database (Bulk Import handles upserts gracefully)
      await googleSheetService.bulkImportResources([scenario]);
      
      // 2. Assign it to the agent
      await googleSheetService.assignManualResource(agentId, selectedSimulation, currentUser?.id || 'System');
      
      alert("AI Simulation successfully assigned!");
      setSelectedSimulation("");
      // Call loadData() or your refresh function here to update the UI
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to assign simulation:", error);
      alert("Failed to assign simulation.");
    } finally {
      setIsAssigningSim(false);
    }
  };

  // Robust JSON decompression and unpacking utility for compressed spreadsheet columns
  const safeParseJson = (data: any, fallback: any = null) => {
    if (!data) return fallback;
    if (typeof data === 'object') return data;
    try {
      let cleanStr = String(data).trim();
      // Remove extraneous wrapping quotes if present from double-serialization
      if ((cleanStr.startsWith('"') && cleanStr.endsWith('"')) || (cleanStr.startsWith("'") && cleanStr.endsWith("'"))) {
        cleanStr = cleanStr.slice(1, -1);
      }
      return JSON.parse(cleanStr);
    } catch (e) {
      console.warn("[MetricsDrillDown] JSON parse fallback triggered for:", data, e);
      return fallback;
    }
  };

  // Retrieve stats associated with individual user profile
  const userStats = useMemo(() => {
    if (!user || !adminStats?.userStats) return null;
    return adminStats.userStats.find((s: any) => s.userId === user.id) || null;
  }, [adminStats, user]);

  // Clean, unpack, and align SVAR and WriteX variables securely (Vector 3)
  const cleanedMetrics = useMemo(() => {
    const rawMetrics = user?.metrics ? safeParseJson(user.metrics, {}) : {};
    const rawShlData = user?.shlData ? safeParseJson(user.shlData, {}) : {};

    // Retrieve nested indicators
    const svarSource = rawMetrics.svar || rawShlData.metrics || user?.metrics?.svar || {};
    const writexSource = rawMetrics.writex || rawShlData.writex || user?.metrics?.writex || {};

    const cleanIndicator = (val: any, fallback: number) => {
      const num = Number(val);
      return isNaN(num) || num <= 0 ? fallback : Math.min(100, Math.max(0, Math.round(num)));
    };

    return {
      svar: {
        fluency: cleanIndicator(svarSource.fluency, 65),
        vocabulary: cleanIndicator(svarSource.vocabulary, 70),
        grammar: cleanIndicator(svarSource.grammar, 58),
        pronunciation: cleanIndicator(svarSource.pronunciation, 62),
        coherence: cleanIndicator(svarSource.coherence, 68)
      },
      writex: {
        fluency: cleanIndicator(writexSource.fluency, 72),
        vocabulary: cleanIndicator(writexSource.vocabulary, 68),
        grammar: cleanIndicator(writexSource.grammar, 64),
        pronunciation: 0,
        coherence: cleanIndicator(writexSource.coherence, 70)
      }
    };
  }, [user]);

  const svarMetrics = cleanedMetrics.svar;
  const writexMetrics = cleanedMetrics.writex;

  // Synchronize transcripts from backend or mock dataset
  useEffect(() => {
    if (!isOpen || !user?.id) {
      setLiveTranscripts([]);
      return;
    }

    const level = user.languageLevel || 'B1';
    const fallback = getMockTranscripts(level);

    setIsLoadingTranscripts(true);
    googleSheetService.getTranscripts(user.id)
      .then((data) => {
        if (data && data.length > 0) {
          // Parse stringified message list within the columns safely
          const cleansedData = data.map(item => {
            const parsedMsgs = typeof item.messages === 'string'
              ? safeParseJson(item.messages, [])
              : item.messages;
            return {
              ...item,
              messages: Array.isArray(parsedMsgs) ? parsedMsgs : []
            };
          });
          setLiveTranscripts(cleansedData);
        } else {
          setLiveTranscripts(fallback);
        }
      })
      .catch((err) => {
        console.error("Error retrieving active dialog logs:", err);
        setLiveTranscripts(fallback);
      })
      .finally(() => {
        setIsLoadingTranscripts(false);
      });
  }, [isOpen, user?.id, user?.languageLevel]);

  const selectedTranscript = liveTranscripts[selectedTranscriptIndex] || liveTranscripts[0];

  const parsedMessages = useMemo(() => {
    if (!selectedTranscript || !selectedTranscript.messages) return [];
    return selectedTranscript.messages.map((m: any) => {
      // Clean and reconstruct messages seamlessly 
      if (typeof m === 'string') {
        const isAgent = m.startsWith('You:') || m.startsWith('Agent:');
        return {
          sender: isAgent ? 'Agent' : 'Customer',
          text: m.replace(/^(You:|Agent:|Coach:|Customer:)\s*/i, ''),
          grade: 'N/A',
          rationale: ''
        };
      }
      return {
        sender: m.sender || m.role || 'Unknown',
        text: m.text || m.content || '',
        grade: m.grade || 'N/A',
        rationale: m.rationale || ''
      };
    });
  }, [selectedTranscript]);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-tp-navy/60 backdrop-blur-md flex items-center justify-end animate-fadeIn">
      {/* Drawer Outer Dismiss Area */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Core Card Block */}
      <div className="relative w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col animate-slideLeft border-l border-gray-100 rounded-l-[40px] overflow-hidden">
        
        {/* Header Block */}
        <div className="p-8 bg-tp-navy text-white flex justify-between items-center border-b border-white/5 relative">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center text-white">
              <User className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Quality oversight</span>
              <h2 className="text-xl font-black uppercase tracking-tight">{user.name}</h2>
              <div className="flex gap-4 mt-1">
                <span className="text-[10px] font-bold text-tp-red uppercase tracking-widest">{user.languageLevel} Level</span>
                <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">Cohort Wave: {user.wave || 'Unassigned'}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-3 justify-center text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Dynamic Navigation Tabs inside Drawer */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 p-2">
          <button 
            onClick={() => setActiveSubTab('metrics')}
            className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'metrics' ? 'bg-white text-tp-purple shadow-sm border border-gray-100' : 'text-gray-400 hover:text-tp-purple'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Activity className="w-4 h-4" /> Performance Matrix
            </span>
          </button>
          <button 
            onClick={() => setActiveSubTab('transcripts')}
            className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'transcripts' ? 'bg-white text-tp-purple shadow-sm border border-gray-100' : 'text-gray-400 hover:text-tp-purple'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4" /> AI Chat Transcripts & Auditing
            </span>
          </button>
          <button 
            onClick={() => setActiveSubTab('json')}
            className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubTab === 'json' ? 'bg-white text-tp-purple shadow-sm border border-gray-100' : 'text-gray-400 hover:text-tp-purple'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Terminal className="w-4 h-4" /> Diagnostics (JSON Core)
            </span>
          </button>
        </div>

        {/* Content Explorer Section */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          
          {/* TAB 1: PERFORMANCE MATRIX */}
          {activeSubTab === 'metrics' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Stat Highlight Tiles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Roster Learning Speed</p>
                    <p className="text-xl font-black text-tp-purple mt-1">{userStats?.weeklyMinutes || 0}m</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Active this week</p>
                  </div>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Task Completion Rate</p>
                    <p className="text-xl font-black text-tp-purple mt-1">
                      {userStats?.totalCompleted || 0} / {userStats?.totalAssigned || 0}
                    </p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Modules Completed</p>
                  </div>
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">General Progress</p>
                    <p className="text-xl font-black text-tp-purple mt-1">{userStats?.overallProgress || 0}%</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Estimated accuracy</p>
                  </div>
                  <div className="w-10 h-10 bg-tp-red/5 text-tp-red rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Dynamic SVAR/WriteX Split Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                
                {/* SVAR Speech Metrics */}
                <div className="border border-gray-100 rounded-3xl p-6 shadow-sm bg-white">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black uppercase tracking-tighter text-tp-purple text-base flex items-center gap-3">
                      <Brain className="text-tp-red w-5 h-5" /> SVAR Speech Assessment
                    </h3>
                    <span className="text-[9px] font-black text-white bg-tp-purple px-2.5 py-1 rounded-full uppercase tracking-widest">Acoustic Engine</span>
                  </div>

                  <div className="space-y-5">
                    {Object.entries(svarMetrics).map(([key, value]) => {
                      if (key === 'id' || typeof value !== 'number') return null;
                      return (
                        <div key={`svar-${key}`} className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700 capitalize">{key}</span>
                            <span className="text-xs font-black text-tp-purple">{value}%</span>
                          </div>
                          <div className="h-2 bg-gray-50 border border-gray-100/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-tp-purple rounded-full transition-all duration-1000"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* WriteX Writing Metrics */}
                <div className="border border-gray-100 rounded-3xl p-6 shadow-sm bg-white">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black uppercase tracking-tighter text-tp-purple text-base flex items-center gap-3">
                      <Terminal className="text-tp-purple w-5 h-5" /> WriteX Text Assessment
                    </h3>
                    <span className="text-[9px] font-black text-white bg-gray-400 px-2.5 py-1 rounded-full uppercase tracking-widest">Grammar Engine</span>
                  </div>

                  <div className="space-y-5">
                    {Object.entries(writexMetrics).map(([key, value]) => {
                      if (key === 'id' || key === 'pronunciation' || typeof value !== 'number') return null;
                      return (
                        <div key={`writex-${key}`} className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700 capitalize">{key}</span>
                            <span className="text-xs font-black text-tp-purple">{value}%</span>
                          </div>
                          <div className="h-2 bg-gray-50 border border-gray-100/50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-tp-red rounded-full transition-all duration-1000"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* CEFR Benchmark Recommendation */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-6 flex gap-5 items-start mt-4">
                <div className="bg-amber-100 text-amber-800 p-2.5 rounded-2xl flex-shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-gray-800 uppercase tracking-tight text-xs">Quality Assurance Diagnostic Recommendation:</h4>
                  <p className="text-gray-600 text-xs mt-1.5 leading-relaxed">
                    Based on nested SVAR ratings (particularly Fluency: <strong>{svarMetrics.fluency}%</strong> and Grammar: <strong>{svarMetrics.grammar}%</strong>), 
                    this agent has borderline syntax stability under rapid billing scenarios. It is recommended to assign active conversational de-escalation 
                    modules and monitor recent dialogue transcripts.
                  </p>
                </div>
              </div>

              {/* Assign AI Voice Simulation Section */}
              <div id="assign_simulation_section" className="bg-slate-800 text-white border border-slate-700 rounded-3xl p-6 shadow-md mt-6 animate-fadeIn">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="text-blue-400 w-5 h-5 animate-pulse" />
                  <h3 className="font-black text-xs uppercase tracking-wider">Assign AI Voice Simulation</h3>
                </div>
                
                <p className="text-slate-300 text-xs mb-4 leading-relaxed">
                  Assign a customized conversational voice roleplay exercise to this agent. It will be added directly to their learning curriculum and unexpired plan.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                  <div className="flex-1 w-full">
                    <label htmlFor="simulation-select" className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">
                      Choose Active Roleplay Scenario
                    </label>
                    <select
                      id="simulation-select"
                      value={selectedSimulation}
                      onChange={(e) => setSelectedSimulation(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl py-2.5 px-4 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="" className="bg-slate-900 text-slate-400 text-xs">Select scenario...</option>
                      {LIVE_COACH_SCENARIOS.map((sim) => (
                        <option key={sim.id} value={sim.id} className="bg-slate-900 text-white text-xs">
                          {sim.title} (ID: {sim.url})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    id="btn-assign-simulation"
                    onClick={() => {
                      if (user) {
                        handleAssignSimulation(user.id);
                      }
                    }}
                    disabled={isAssigningSim || !selectedSimulation}
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-2.5 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 whitespace-nowrap shadow-md"
                  >
                    {isAssigningSim ? 'Assigning...' : 'Assign Simulation'}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: AUDIT TRANSCRIPTS */}
          {activeSubTab === 'transcripts' && (
            <div className="space-y-8 animate-fadeIn">
              
              {isLoadingTranscripts ? (
                <div className="h-48 w-full flex flex-col gap-3 items-center justify-center text-gray-400">
                  <Loader className="w-8 h-8 animate-spin text-tp-red" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Retrieving live performance database transcripts...</span>
                </div>
              ) : liveTranscripts.length === 0 ? (
                <div className="h-32 w-full flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-3xl text-gray-400">
                  <span className="text-sm font-semibold">No simulation dialogue logs found for this user.</span>
                </div>
              ) : (
                <>
                  {/* Selector Bar */}
                  <div className="flex gap-3 bg-gray-50 border border-gray-100 p-2 rounded-2xl overflow-x-auto">
                    {liveTranscripts.map((t, idx) => (
                      <button
                        key={t.id || `t-${idx}`}
                        onClick={() => setSelectedTranscriptIndex(idx)}
                        className={`flex-1 py-3 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-w-[200px] ${
                          selectedTranscriptIndex === idx ? 'bg-white text-tp-purple shadow-sm border border-gray-200' : 'text-gray-400 hover:text-tp-purple'
                        }`}
                      >
                        {t.topic}
                      </button>
                    ))}
                  </div>

                  {/* Transcript Dialogue Frame */}
                  {selectedTranscript && (
                    <div className="border border-gray-150 rounded-3xl bg-white shadow-md overflow-hidden">
                      <div className="bg-tp-navy/5 border-b border-gray-150 p-5 flex justify-between items-center flex-wrap gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-tp-purple/60">Selected Session Logs ({selectedTranscript.date})</p>
                          <h4 className="text-sm font-black text-tp-purple uppercase tracking-tight mt-0.5">{selectedTranscript.topic}</h4>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[9px] font-black text-tp-purple uppercase tracking-widest">QA Grade: <strong>{selectedTranscript.overallScore}</strong></span>
                          <span className="text-[9px] font-black text-white bg-tp-red px-2.5 py-1 rounded-full uppercase tracking-widest">Duration: {selectedTranscript.duration}</span>
                        </div>
                      </div>

                      <div className="p-6 divide-y divide-gray-100 max-h-[380px] overflow-y-auto custom-scrollbar">
                        {parsedMessages && parsedMessages.map((m: any, mIdx: number) => {
                          const isAgent = m.sender === 'Agent' || m.sender === 'You';
                          return (
                            <div key={`msg-${mIdx}`} className="py-4 first:pt-2 last:pb-2 flex flex-col md:flex-row md:items-start gap-4">
                              <div className="md:w-28 flex-shrink-0">
                                <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                  isAgent ? 'bg-indigo-50 text-indigo-700' : 'bg-tp-red/5 text-tp-red'
                                }`}>
                                  {m.sender}
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-semibold text-gray-800 ${isAgent ? 'pl-2 border-l-2 border-indigo-200' : ''}`}>"{m.text}"</p>
                                {m.grade && m.grade !== 'N/A' && m.grade !== 'Grade Pending' && (
                                  <div className="mt-3 bg-indigo-50/50 hover:bg-indigo-50 transition-colors p-3.5 rounded-2xl border border-indigo-100 flex items-start gap-3">
                                    <Brain className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">QA Evaluator Grade: {m.grade}</p>
                                      {m.rationale && <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">{m.rationale}</p>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

            </div>
          )}

          {/* TAB 3: DIAGNOSTICS (JSON CORE VIEW) */}
          {activeSubTab === 'json' && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-150 flex justify-between items-center">
                <div>
                  <h4 className="font-black text-tp-purple uppercase tracking-tight text-xs">Registry Raw Properties File</h4>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Database variables as indexed in cloud spreadsheet</p>
                </div>
                <button 
                  onClick={() => setJsonExpanded(!jsonExpanded)}
                  className="bg-tp-navy text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-tp-red transition-all shadow-md"
                >
                  {jsonExpanded ? 'Collapse Schema' : 'Expand Schema'}
                </button>
              </div>

              {/* Code Blocks frame */}
              <div className="mt-4 border border-gray-150 rounded-3xl bg-tp-navy text-white p-6 font-mono text-left relative shadow-sm overflow-x-auto max-h-[400px]">
                <div className="absolute top-4 right-4 bg-white/10 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white/60">read-only</div>
                <pre className="text-xs leading-relaxed custom-scrollbar whitespace-pre-wrap">
                  {JSON.stringify(
                    jsonExpanded ? user : {
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      languageLevel: user.languageLevel,
                      role: user.role,
                      wave: user.wave,
                      metrics: {
                        svar: svarMetrics,
                        writex: writexMetrics
                      },
                      assignedCoach: user.assignedCoach || "None"
                    }, 
                    null, 
                    2
                  )}
                </pre>
              </div>

            </div>
          )}

        </div>

        {/* Action Bar inside Drawer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4 justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-tp-purple transition-all"
          >
            Close Detail
          </button>
        </div>

      </div>
    </div>
  );
};
