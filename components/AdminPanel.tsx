import React, { useState, useEffect, useMemo } from 'react';
import { shlService } from '../services/shlService';
import { geminiService } from '../services/geminiService';
import { googleSheetService } from '../services/googleSheetService';
import ResourceUploader from './admin/ResourceUploader';
import UserUploader from './admin/UserUploader';
import QuickAddAgent from './admin/QuickAddAgent';
import InteractiveLessonUploader from './admin/InteractiveLessonUploader';
import LessonAssigner from './admin/LessonAssigner';
import { MetricsDrillDown } from './admin/MetricsDrillDown';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Filter, 
  Download, 
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
  Brain,
  Plus,
  CheckCircle,
  ClipboardList
} from 'lucide-react';
import { ExitIcon } from './Icons';
import type { UserProfile, Resource } from '../types';

interface AdminPanelProps {
  onUpdateContent: () => void;
  currentUser: UserProfile;
  onFileProcessed?: (file: File) => Promise<void>;
  onImpersonate: (user: UserProfile) => void;
}

export const LIVE_COACH_SCENARIOS = [
  { id: 'sim-NB001', title: 'Simulation: First-Time Traveler', type: 'Simulation', url: 'NB001', duration: 15 },
  { id: 'sim-NC001', title: 'Simulation: Minor Name Spelling Update', type: 'Simulation', url: 'NC001', duration: 15 },
  { id: 'sim-FC003', title: 'Simulation: Fare Difference Explanation', type: 'Simulation', url: 'FC003', duration: 15 },
  { id: 'sim-TA003', title: 'Simulation: Agency vs Airline Responsibility Clarification', type: 'Simulation', url: 'TA003', duration: 15 },
  { id: 'sim-AS008', title: 'Simulation: Bassinet Availability Limitation', type: 'Simulation', url: 'AS008', duration: 15 }
];

const AdminPanel: React.FC<AdminPanelProps> = ({ onUpdateContent, currentUser, onFileProcessed, onImpersonate }) => {
  if (currentUser.role !== 'admin' && currentUser.role !== 'coach') return null;

  const [activeTab, setActiveTab] = useState<'onboarding' | 'users' | 'library' | 'content' | 'interactive' | 'assigner'>('users');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [globalResources, setGlobalResources] = useState<Resource[]>([]);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStagnant, setShowStagnant] = useState(false);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>('overall');
  const [weeklyAssignments, setWeeklyAssignments] = useState<Record<number, string[]>>({});
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [targetWeek, setTargetWeek] = useState<number>(1);
  const [activeWave, setActiveWave] = useState<string>('all');
  const [drilldownUser, setDrilldownUser] = useState<UserProfile | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [waveConfigs, setWaveConfigs] = useState<Record<string, any>>({});
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [defaultGoalInput, setDefaultGoalInput] = useState<string>('');
  const [weeklyOverrideInput, setWeeklyOverrideInput] = useState<string>('');

  useEffect(() => {
    if (activeWave !== 'all') {
      const config = waveConfigs[activeWave] || {};
      setDefaultGoalInput(String(config.defaultGoal ?? 180));
      setWeeklyOverrideInput(String(config.currentWeekGoal ?? ''));
    }
  }, [activeWave, waveConfigs]);

  const availableWaves = useMemo(() => {
    if (!userList) return [];
    return Array.from(new Set(userList.map(u => u.waveNumber).filter(Boolean))).sort();
  }, [userList]);

  const availableWeeks = useMemo(() => {
    if (!adminStats?.userStats) return [];
    const weeks = new Set<string>();
    adminStats.userStats.forEach((s: any) => {
      s.weeklyHistory?.forEach((w: any) => weeks.add(w.weekLabel));
    });
    return Array.from(weeks).sort();
  }, [adminStats]);

  const combinedStats = useMemo(() => {
    if (!userList || !adminStats?.userStats) return [];
    
    let activeUsers = userList.filter(u => u.role === 'agent');
    if (activeWave !== 'all') {
      activeUsers = activeUsers.filter(u => u.wave === activeWave || u.waveNumber === activeWave);
    }
    
    return activeUsers
      .map(user => {
        const stats = adminStats.userStats.find((s: any) => s.userId === user.id) || {
          weeklyMinutes: 0,
          overallProgress: 0,
          totalCompleted: 0,
          totalAssigned: 0,
          weeklyHistory: []
        };

        if (selectedWeek !== 'overall' && stats.weeklyHistory) {
          const weekData = stats.weeklyHistory.find((w: any) => w.weekLabel === selectedWeek);
          return {
            ...user,
            ...stats,
            weeklyMinutes: weekData ? weekData.minutes : 0,
            overallProgress: weekData ? weekData.progress : 0,
            totalCompleted: weekData ? weekData.completedCount : 0
          };
        }

        return {
          ...user,
          ...stats
        };
      });
  }, [userList, adminStats, selectedWeek, activeWave]);

  const filteredStats = useMemo(() => {
    return combinedStats.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStagnant = !showStagnant || user.weeklyMinutes === 0;
      return matchesSearch && matchesStagnant;
    });
  }, [combinedStats, searchTerm, showStagnant]);

  const metrics = useMemo(() => {
    const totalAgents = combinedStats.length;
    const totalProgress = combinedStats.reduce((acc, u) => acc + (u.overallProgress || 0), 0);
    const avgProgress = totalAgents > 0 ? Math.round(totalProgress / totalAgents) : 0;
    
    const totalWeeklyProgress = combinedStats.reduce((acc, u) => acc + (u.weeklyProgress || 0), 0);
    const avgWeeklyProgress = totalAgents > 0 ? Math.round(totalWeeklyProgress / totalAgents) : 0;
    const atRisk = combinedStats.filter(u => u.overallProgress < 30).length;
    return { totalAgents, avgProgress, avgWeeklyProgress, atRisk };
  }, [combinedStats]);

  const fetchUsers = async () => {
    if (currentUser.role !== 'admin' && currentUser.role !== 'coach') return;
    setIsProcessing(true);
    try {
      const users = await googleSheetService.fetchAllUsers(currentUser.email, currentUser.role);
      setUserList(Array.isArray(users) ? users : []);
    } catch (err) {
      setUserList([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchResources = async () => {
    try {
      const res = await googleSheetService.fetchUserPlan(currentUser.id, 'admin');
      if (res && res.resources) {
        setGlobalResources(res.resources);
      } else {
        setGlobalResources(Array.isArray(res) ? res : []);
      }
    } catch (e) {
      setGlobalResources([]);
    }
  };

  const loadAdminStats = async () => {
    try {
      const data = await googleSheetService.getAdminStats(currentUser.email, currentUser.role);
      setAdminStats(data);
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  const loadWaveConfigs = async () => {
    try {
      const configs = await googleSheetService.getWaveConfigs();
      setWaveConfigs(configs || {});
    } catch (err) {
      console.error('Error fetching wave configs:', err);
    }
  };

  const loadData = async () => {
    await Promise.all([
      fetchUsers(),
      loadAdminStats(),
      loadWaveConfigs()
    ]);
  };

  const fetchWeeklyAssignments = async () => {
    try {
      const data = await googleSheetService.getWeeklyAssignments();
      setWeeklyAssignments(data);
    } catch (err) {
      console.error('Error fetching weekly assignments:', err);
    }
  };

  const handleBulkAssignRoster = async () => {
    if (!currentUser) return;
    const targetGroup = activeWave === 'all' ? 'EVERY trainee in the system' : `EVERY trainee in ${activeWave}`;
    if (!window.confirm(`This will assign ALL eligible courses to ${targetGroup}. The system will then automatically drip them 3 hours a week based on their cohort start date. Proceed?`)) return;

    setIsBulkAssigning(true);
    try {
      const targetWaveParam = activeWave === 'all' ? undefined : activeWave;
      const selectedWave = activeWave === 'all' ? 'all waves' : 'wave ' + activeWave;
      
      const response = await googleSheetService.bulkAssignRoster(currentUser.id, targetWaveParam);
      
      let msg = "";
      if (response && response.newAssignments !== undefined) {
        if (response.newAssignments === 0 && response.updatedAssignments === 0) {
          msg = `No new assignments were needed for ${selectedWave}. All agents already have matching resources.`;
        } else {
          msg = `Success! Created ${response.newAssignments} new assignments and updated ${response.updatedAssignments} existing ones for ${selectedWave}.`;
        }
      } else {
        msg = `Successfully processed bulk assignment for ${selectedWave}.`;
      }
      
      alert(msg);
      setAssignmentSuccess(msg);
      setTimeout(() => setAssignmentSuccess(null), 8000);
      await loadData();
    } catch (err) {
      alert("Error during bulk curriculum assignment: " + (err as Error).message);
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleManualAssign = async (resourceId: string) => {
    if (!selectedTargetUserId) return;
    setIsProcessing(true);
    try {
      const selectedUser = userList.find(u => u.id === selectedTargetUserId);
      const selectedWave = selectedUser?.wave || selectedUser?.waveNumber || 'All';
      await googleSheetService.assignToWeek(targetWeek, [resourceId], selectedTargetUserId, selectedWave);
      setAssignmentSuccess("Module assigned successfully to student!");
      setTimeout(() => setAssignmentSuccess(null), 5000);
      fetchWeeklyAssignments();
    } catch (err) {
      alert("Failed to manual assign module: " + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignToWeek = async () => {
    if (!selectedTargetUserId || selectedResourceIds.length === 0) return;
    setIsProcessing(true);
    try {
      const selectedUser = userList.find(u => u.id === selectedTargetUserId);
      const selectedWave = selectedUser?.wave || selectedUser?.waveNumber || 'All';
      await googleSheetService.assignToWeek(targetWeek, selectedResourceIds, selectedTargetUserId, selectedWave);
      setAssignmentSuccess(`Successfully assigned ${selectedResourceIds.length} modules to Week ${targetWeek}!`);
      setSelectedResourceIds([]);
      setTimeout(() => setAssignmentSuccess(null), 5000);
      fetchWeeklyAssignments();
    } catch (err) {
      alert("Failed to complete assignment batch: " + (err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredResources = useMemo(() => {
    return globalResources.filter(res => {
      const matchSearch = res.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          res.level.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (res.objective && res.objective.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (res.type && res.type.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSearch;
    });
  }, [globalResources, searchTerm]);

  const getAssignedWeek = (resourceId: string) => {
    for (const [weekNum, ids] of Object.entries(weeklyAssignments)) {
      if (Array.isArray(ids) && ids.includes(resourceId)) return weekNum;
    }
    return null;
  };

  useEffect(() => {
    if (activeTab === 'users' || activeTab === 'library') {
      loadData();
    }
    if (activeTab === 'library') {
      fetchResources();
      fetchWeeklyAssignments();
    }
  }, [activeTab]);

  const exportToCsv = () => {
    if (!filteredStats.length) return;
    const headers = [
      'Name',
      'Email',
      'Role',
      'CEFR Level',
      'Fluency',
      'Vocabulary',
      'Grammar',
      'Pronunciation',
      'Coherence',
      'Assigned Coach'
    ].join(',');

    const rows = filteredStats.map(u => {
      const m = u.metrics || {};
      return [
        `"${u.name}"`,
        `"${u.email}"`,
        u.role, 
        u.languageLevel || 'N/A', 
        m.fluency || 0, 
        m.vocabulary || 0, 
        m.grammar || 0, 
        m.pronunciation || 0, 
        m.coherence || 0, 
        u.assignedCoach || 'Unassigned'
      ].join(',');
    }).join('\n');

    const csvContent = `${headers}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Registry_Export_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  return (
    <div id="admin-panel-container" className="bg-white rounded-[48px] shadow-2xl p-8 md:p-12 max-w-7xl mx-auto border border-gray-100 animate-fadeIn mt-8 mb-20 shadow-tp-purple/5">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-12 gap-8">
        <div>
          <h1 className="text-4xl font-black text-tp-purple flex items-center tracking-tight uppercase">
            <Brain className="mr-5 text-tp-red w-8 h-8" /> Registry Master
          </h1>
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-2 ml-1">Enterprise Console</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {/* Cohort Wave Dropdown Filter */}
          <div className="flex items-center gap-2 bg-tp-purple/5 px-4 py-2 rounded-2xl border border-tp-purple/10">
            <span className="text-[10px] font-black text-tp-purple uppercase tracking-widest">Cohort:</span>
            <select
              value={activeWave}
              onChange={(e) => setActiveWave(e.target.value)}
              className="bg-white text-tp-purple font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-xl border border-tp-purple/10 focus:outline-none focus:ring-2 focus:ring-tp-purple/20 cursor-pointer"
            >
              <option value="all">🌐 All Waves</option>
              {availableWaves.map(wave => (
                <option key={wave} value={wave}>🌊 {wave}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-tp-purple/5 p-1.5 rounded-2xl overflow-x-auto max-w-full shadow-inner border border-tp-purple/10">
          {[
            { id: 'users', label: 'Roster' },
            { id: 'library', label: 'Resource Library' },
            { id: 'interactive', label: 'Interactive .DOCX' },
            { id: 'assigner', label: 'Assign Lessons' },
            { id: 'onboarding', label: 'Onboarding' },
            { id: 'content', label: 'Import' }
          ].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`px-8 py-3.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-tp-purple shadow-md border border-tp-purple/5' : 'text-gray-500 hover:text-tp-purple'}`}
            >
              {tab.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Dual-Mode Target Goal Settings Manager */}
      {activeWave !== 'all' && (
        <div id="goal-settings-card" className="w-full bg-slate-800 text-white rounded-3xl p-6 border border-slate-700 shadow-xl mb-10 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-700/50 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                🎯 Target Goal Settings : Wave {activeWave}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">
                Manage target parameters for this wave group
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3.5 py-1.5 rounded-xl shrink-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Currently Active Goal:</span>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                {waveConfigs[activeWave]?.activeGoal || 180} mins / week
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Permanent Default Goal */}
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Permanent Default Goal</h4>
                <p className="text-[10px] text-slate-500 font-medium tracking-normal mt-1 leading-relaxed">
                  This is the lifetime baseline target parameter for this group. It applies automatically to subsequent weeks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={defaultGoalInput}
                  onChange={(e) => setDefaultGoalInput(e.target.value)}
                  placeholder="180"
                  className="w-[100px] bg-slate-900 text-white font-black text-xs text-center px-3 py-2.5 rounded-xl border border-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  disabled={isSavingGoal}
                  min="0"
                />
                <button
                  onClick={async () => {
                    if (!defaultGoalInput || isNaN(Number(defaultGoalInput))) return;
                    setIsSavingGoal(true);
                    try {
                      const goalNum = Number(defaultGoalInput);
                      const updated = await googleSheetService.setWaveConfig(activeWave, 'default', goalNum);
                      setWaveConfigs(prev => ({
                        ...prev,
                        [activeWave]: updated?.[activeWave] || {
                          ...prev[activeWave],
                          defaultGoal: goalNum,
                          activeGoal: updated?.[activeWave]?.activeGoal || goalNum
                        }
                      }));
                      await loadData();
                    } catch (err) {
                      console.error("Failed to save default wave goal config:", err);
                      alert("Failed to save default goal: " + (err as Error).message);
                    } finally {
                      setIsSavingGoal(false);
                    }
                  }}
                  disabled={isSavingGoal}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer text-center"
                >
                  {isSavingGoal ? 'Saving...' : 'Set for Good'}
                </button>
              </div>
            </div>

            {/* This Week's Override */}
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">This Week's Override</h4>
                <p className="text-[10px] text-slate-500 font-medium tracking-normal mt-1 leading-relaxed">
                  Temporary target that expires on Monday. Enter a custom value or leave empty to clear individual temporary target.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={weeklyOverrideInput}
                  onChange={(e) => setWeeklyOverrideInput(e.target.value)}
                  placeholder="e.g. 240"
                  className="w-[100px] bg-slate-900 text-white font-black text-xs text-center px-3 py-2.5 rounded-xl border border-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/50"
                  disabled={isSavingGoal}
                  min="0"
                />
                <button
                  onClick={async () => {
                    setIsSavingGoal(true);
                    try {
                      const goalNum = weeklyOverrideInput ? Number(weeklyOverrideInput) : 0;
                      const updated = await googleSheetService.setWaveConfig(activeWave, 'weekly', goalNum);
                      setWaveConfigs(prev => ({
                        ...prev,
                        [activeWave]: updated?.[activeWave] || {
                          ...prev[activeWave],
                          currentWeekGoal: goalNum || null,
                          activeGoal: updated?.[activeWave]?.activeGoal || prev[activeWave]?.defaultGoal || 180
                        }
                      }));
                      await loadData();
                    } catch (err) {
                      console.error("Failed to save weekly override config:", err);
                      alert("Failed to save override: " + (err as Error).message);
                    } finally {
                      setIsSavingGoal(false);
                    }
                  }}
                  disabled={isSavingGoal}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-2.5 px-4 rounded-xl transition-all disabled:opacity-50 cursor-pointer text-center"
                >
                  {isSavingGoal ? 'Saving...' : 'Set for This Week'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {assignmentSuccess && (
        <div id="assignment-success-banner" className="mb-10 bg-green-50 border border-green-200 text-green-700 p-6 rounded-[32px] flex items-center gap-5 animate-fadeIn shadow-xl shadow-green-100/50">
          <div className="bg-green-100 p-2.5 rounded-xl">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">{assignmentSuccess}</span>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div id="stat-total-agents" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Agents</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-gray-900">{metrics.totalAgents}</h3>
                <span className="text-xs font-medium text-gray-500">Active</span>
              </div>
            </div>

            <div id="stat-avg-progress" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Avg Progress</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-gray-900">{metrics.avgProgress}%</h3>
                <span className="text-xs font-medium text-emerald-600">Overall</span>
              </div>
            </div>

            <div id="stat-weekly-overview" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-tp-purple/10 rounded-lg text-tp-purple">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Weekly Overview</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-gray-900">{metrics.avgWeeklyProgress}%</h3>
                <span className="text-xs font-medium text-tp-purple">Weekly Avg</span>
              </div>
            </div>

            <div id="stat-agents-risk" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Agents at Risk</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-black text-gray-900">{metrics.atRisk}</h3>
                <span className="text-xs font-medium text-rose-600">Under 30%</span>
              </div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col md:flex-row gap-6 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                id="search-agent-input"
                type="text" 
                placeholder="Search by agent name or email..."
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-tp-purple/20 focus:border-tp-purple transition-all text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <select 
                id="week-select-filter"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="px-4 py-2 bg-white text-tp-purple rounded-lg text-[9px] font-black uppercase tracking-widest outline-none border-none focus:ring-0 cursor-pointer"
              >
                <option value="overall">Overall View</option>
                {availableWeeks.map(week => (
                  <option key={week} value={week}>{week}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button 
                id="filter-show-all-btn"
                onClick={() => setShowStagnant(false)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!showStagnant ? 'bg-tp-purple text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Show All
              </button>
              <button 
                id="filter-show-stagnant-btn"
                onClick={() => setShowStagnant(true)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showStagnant ? 'bg-tp-red text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Show Stagnant
              </button>
            </div>
            <button 
              id="export-csv-btn"
              onClick={exportToCsv}
              className="flex items-center gap-2 bg-tp-navy text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-tp-purple transition-all shadow-lg"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Agent ID</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Cohort/Wave</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                      {selectedWeek === 'overall' ? 'Weekly Mins' : `${selectedWeek} Minutes`}
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {selectedWeek === 'overall' ? 'Overall Progress' : `${selectedWeek} Progress (%)`}
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                      {selectedWeek === 'overall' ? 'Completed' : `${selectedWeek} Completed`}
                    </th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredStats.map((user, idx) => (
                    <tr key={`user-row-${user.id || idx}`} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-tp-purple/10 rounded-xl flex items-center justify-center text-tp-purple font-black text-xs">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-tp-purple transition-colors">{user.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-tp-purple uppercase tracking-widest">
                          {user.wave || 'Pilot/Unassigned'}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold ${user.weeklyMinutes === 0 ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {user.weeklyMinutes}m
                        </span>
                      </td>
                      <td className="px-8 py-6 min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                user.overallProgress >= 80 ? 'bg-emerald-500' : user.overallProgress >= 40 ? 'bg-indigo-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${user.overallProgress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-black text-gray-700 w-10">
                            {user.overallProgress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <p className="text-sm font-bold text-gray-900">{user.totalCompleted}</p>
                        <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">/ {user.totalAssigned}</p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setDrilldownUser(user); setIsDrilldownOpen(true); }}
                            className="p-2 text-gray-400 hover:text-indigo-650 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Audit Metrics"
                          >
                            <Brain className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => onImpersonate(user)}
                            className="p-2 text-gray-400 hover:text-tp-purple hover:bg-tp-purple/5 rounded-lg transition-all"
                            title="View Hub"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => { setSelectedTargetUserId(user.id); setActiveTab('library'); }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Assign Module"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredStats.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-gray-400 font-black uppercase text-xs tracking-widest">No agents found matching your criteria.</p>
              </div>
            )}
          </div>

          <div className="flex justify-center pt-8">
            <button
              id="bulk-assign-roster-btn"
              onClick={handleBulkAssignRoster}
              disabled={isBulkAssigning}
              className="bg-indigo-600 text-white px-10 py-5 rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl font-black uppercase text-xs tracking-widest flex items-center gap-3"
            >
              {isBulkAssigning ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <ClipboardList className="w-5 h-5" />
              )}
              {isBulkAssigning ? 'Processing Roster...' : activeWave === 'all' ? 'Bulk Assign All to Roster' : `Bulk Assign ${activeWave} to Roster`}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'library' && (
        <div className="space-y-10 animate-fadeIn">
          <div className="sticky top-0 bg-tp-purple rounded-[40px] p-10 shadow-2xl flex flex-col gap-8 z-30 border border-white/10 shadow-tp-purple/20">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-3 bg-white/10 rounded-xl text-white">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-white text-[11px] font-black uppercase tracking-[0.2em] mb-1.5">Target Student Selector</p>
                  <p className="text-white/50 text-[10px] font-medium uppercase italic">Assigned modules will sync immediately to their dashboard.</p>
                </div>
              </div>
              <select 
                id="target-student-dropdown"
                value={selectedTargetUserId}
                onChange={(e) => setSelectedTargetUserId(e.target.value)}
                className="w-full lg:w-auto lg:min-w-[400px] bg-white text-tp-purple font-black text-[12px] uppercase tracking-widest px-8 py-5 rounded-2xl outline-none border-2 border-transparent focus:border-tp-red transition-all shadow-xl"
              >
                <option value="">Select an agent from the roster...</option>
                {userList.filter(u => u.role === 'agent').map((u, idx) => (
                  <option key={`student-opt-${u.id || idx}`} value={u.id}>{u.name} — {u.languageLevel}</option>
                ))}
              </select>
            </div>

            {selectedResourceIds.length > 0 && (
              <div className="bg-white/20 p-6 rounded-2xl border border-white/30 flex flex-col md:flex-row items-center justify-between gap-6 animate-fadeIn">
                <div className="flex items-center gap-4">
                  <span className="text-white text-xs font-black uppercase tracking-widest">
                    {selectedResourceIds.length} Resources Selected
                  </span>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="flex items-center gap-2">
                    <label className="text-white text-[10px] font-black uppercase tracking-widest">Target Week:</label>
                    <input 
                      id="target-week-input"
                      type="number" 
                      min="1"
                      value={targetWeek}
                      onChange={(e) => setTargetWeek(parseInt(e.target.value) || 1)}
                      className="w-20 bg-white text-tp-purple font-black px-4 py-2 rounded-xl outline-none"
                    />
                  </div>
                  <button 
                    id="batch-assign-to-week-btn"
                    onClick={handleAssignToWeek}
                    disabled={isProcessing}
                    className="bg-tp-red text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-tp-navy transition-all shadow-lg flex-1 md:flex-none"
                  >
                    {isProcessing ? 'Assigning...' : `Assign to Week ${targetWeek}`}
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
               <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-white/40">
                 <Search className="w-6 h-6" />
               </div>
               <input 
                 id="search-resources-input"
                 type="text"
                 placeholder="Search by module title, tag, or CEFR level..."
                 className="w-full bg-white/10 border border-white/20 rounded-2xl px-14 py-5 text-white text-base outline-none focus:bg-white/20 transition-all placeholder:text-white/30"
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden mb-16">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Select</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Module Title</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">CEFR</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Curriculum Week</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredResources.map((res, idx) => {
                    const assignedWeek = getAssignedWeek(res.id);
                    return (
                      <tr key={`resource-row-${res.id || idx}`} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <input 
                            type="checkbox"
                            checked={selectedResourceIds.includes(res.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedResourceIds(prev => [...prev, res.id]);
                              } else {
                                setSelectedResourceIds(prev => prev.filter(id => id !== res.id));
                              }
                            }}
                            className="w-5 h-5 rounded border-gray-300 text-tp-purple focus:ring-tp-purple cursor-pointer"
                          />
                        </td>
                        <td className="px-8 py-6">
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-tp-purple transition-colors">{res.title}</p>
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest line-clamp-1">{res.objective}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-[11px] font-black text-tp-red uppercase tracking-widest">{res.level}</span>
                        </td>
                        <td className="px-8 py-6">
                          {assignedWeek ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Assigned: Week {assignedWeek}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-xs font-medium">Unassigned</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{res.type}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button 
                            onClick={() => handleManualAssign(res.id)}
                            disabled={isProcessing || !selectedTargetUserId}
                            className={`flex items-center gap-2 bg-tp-navy text-white px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg hover:bg-tp-red disabled:opacity-30 active:scale-95 ml-auto`}
                            title={selectedTargetUserId ? "Assign to selected student" : "Select a student first"}
                          >
                            <Plus className="w-4 h-4" /> Assign
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredResources.length === 0 && (
              <div className="py-24 text-center">
                <p className="text-gray-400 font-black uppercase text-xs tracking-widest">No matching resources found in the library.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'onboarding' && (
        <div className="space-y-6">
          <QuickAddAgent onAgentAdded={fetchUsers} />
          <div className="relative flex py-5 items-center max-w-4xl mx-auto">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink mx-4 text-xs font-black uppercase text-white/40 tracking-widest">or batch ingest pdf reports</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>
          <UserUploader currentUser={currentUser} onUserCreated={fetchUsers} />
        </div>
      )}

      {activeTab === 'interactive' && (
        <div className="space-y-8">
          <InteractiveLessonUploader onSuccess={onUpdateContent} />
          <LessonAssigner currentAdminId={currentUser.id || currentUser.email} />
        </div>
      )}

      {activeTab === 'assigner' && <LessonAssigner currentAdminId={currentUser.id || currentUser.email} />}

      {activeTab === 'content' && <ResourceUploader onUploadComplete={onUpdateContent} />}
      
      <MetricsDrillDown 
        isOpen={isDrilldownOpen}
        onClose={() => { setIsDrilldownOpen(false); setDrilldownUser(null); }}
        user={drilldownUser}
        adminStats={adminStats}
        currentUser={currentUser}
        onRefresh={loadData}
      />
    </div>
  );
};

export default AdminPanel;
