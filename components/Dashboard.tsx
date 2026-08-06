
import React, { useMemo, useState, useEffect } from 'react';
import type { UserProfile, Resource, View, SkillCategory } from '../types';
import { ResourceType } from '../types';
import { getMyLessons } from '../services/progressService';
import { Sparkles, Loader2, ShieldCheck, FileText } from 'lucide-react';
import { 
  TrendingUpIcon, 
  TargetIcon, 
  BrainIcon, 
  CheckCircleIcon,
  ListeningIcon,
  SpeakingIcon,
  ReadingIcon,
  PracticeIcon
} from './Icons';

interface DashboardProps {
  user: UserProfile;
  resources: Resource[];
  onNavigate: (view: View) => void;
  onOpenResource: (resource: Resource) => void;
  initialSkill?: SkillCategory;
}

const Dashboard: React.FC<DashboardProps> = ({ user, resources, onNavigate, onOpenResource, initialSkill }) => {
  const [activeSkill, setActiveSkill] = useState<SkillCategory>(initialSkill || 'All');
  const [myLessons, setMyLessons] = useState<any[]>([]);
  const [isLoadingMyLessons, setIsLoadingMyLessons] = useState<boolean>(true);

  useEffect(() => {
    if (initialSkill) setActiveSkill(initialSkill);
  }, [initialSkill]);

  useEffect(() => {
    const loadShieldedLessons = async () => {
      const uid = user?.id || (user as any)?.uid || user?.email;
      if (!uid) {
        setIsLoadingMyLessons(false);
        return;
      }
      setIsLoadingMyLessons(true);
      try {
        const fetched = await getMyLessons(uid);
        setMyLessons(Array.isArray(fetched) ? fetched : []);
      } catch (err) {
        console.error("Failed to fetch user shielded lessons:", err);
        setMyLessons([]);
      } finally {
        setIsLoadingMyLessons(false);
      }
    };

    loadShieldedLessons();
  }, [user]);

  const GAP_THRESHOLD_NORMALIZED = 80;

  // Mastery Calculation: (Number of Completed Courses / Total Assigned Courses) * 100
  const progressPercent = useMemo(() => {
    if (resources.length === 0) return 0;
    const completedCount = resources.filter(r => r.progress?.status === 'completed').length;
    return Math.round((completedCount / resources.length) * 100);
  }, [resources]);

  const competencyMetrics = useMemo(() => {
    const m = user?.metrics || {};
    const svar = m.svar || {};
    const writex = m.writex || {};

    const fallback = (val: any, fallbackVal: any) => {
      if (val !== undefined && val !== null && val !== '') return Number(val);
      if (fallbackVal !== undefined && fallbackVal !== null && fallbackVal !== '') return Number(fallbackVal);
      return 0;
    };

    return [
      { label: 'Fluency', score: fallback(svar.fluency, m.fluency) },
      { label: 'Vocabulary', score: fallback(svar.vocabulary, m.vocabulary) },
      { label: 'Grammar', score: fallback(writex.grammar, m.grammar || svar.grammar) },
      { label: 'Pronunciation', score: fallback(svar.pronunciation, m.pronunciation) },
      { label: 'Coherence', score: fallback(writex.coherence, m.coherence || svar.coherence) }
    ];
  }, [user]);

  const isMetricsEmpty = useMemo(() => {
    const m = user?.metrics;
    if (!m) return true;
    
    const svar = m.svar || {};
    const writex = m.writex || {};
    
    // Check nested svar
    const svarKeys = Object.keys(svar).filter(k => svar[k as keyof typeof svar] !== undefined && svar[k as keyof typeof svar] !== null && svar[k as keyof typeof svar] !== '');
    // Check nested writex
    const keysWritex = Object.keys(writex).filter(k => writex[k as keyof typeof writex] !== undefined && writex[k as keyof typeof writex] !== null);
    const writexKeys = keysWritex.filter(k => writex[k as keyof typeof writex] !== '');
    
    // Check flat keys
    const flatKeys = ['fluency', 'vocabulary', 'grammar', 'pronunciation', 'coherence'];
    const hasFlat = flatKeys.some(k => m[k] !== undefined && m[k] !== null && m[k] !== '');

    return svarKeys.length === 0 && writexKeys.length === 0 && !hasFlat;
  }, [user]);

  // Tab Logic & Filtering (Case-insensitive matching)
  const { activeCourses, completedCourses } = useMemo(() => {
    const filtered = resources.filter(res => {
      if (activeSkill === 'All') return true;
      return res.tags.some(t => t.toLowerCase() === activeSkill.toLowerCase());
    });

    return {
      activeCourses: filtered.filter(r => r.progress?.status !== 'completed'),
      completedCourses: filtered.filter(r => r.progress?.status === 'completed')
    };
  }, [resources, activeSkill]);

  // Calculate Progress Stats
  const WEEKLY_TARGET = 180;

  const stats = useMemo(() => {
    const now = new Date();
    // Calculate start of current week (Sunday)
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    const nonGeneralResources = resources.filter(r => !(r.tags || []).includes('general'));
    const totalAssigned = nonGeneralResources.length;
    const completedCount = nonGeneralResources.filter(r => r.progress?.status === 'completed').length;

    const weeklyMinutes = nonGeneralResources.reduce((acc, res) => {
      if (res.progress?.status === 'completed' && res.progress.completedAt) {
        const completedDate = new Date(res.progress.completedAt);
        if (completedDate >= startOfWeek) {
          return acc + (parseInt(String(res.duration)) || 15);
        }
      }
      return acc;
    }, 0);

    // Calculate days remaining in the current week (until next Sunday)
    const nextSunday = new Date(startOfWeek);
    nextSunday.setDate(startOfWeek.getDate() + 7);
    const diffTime = nextSunday.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate weekly average score
    const weeklyCompleted = resources.filter(r => 
      r.progress?.status === 'completed' && 
      r.progress.completedAt && 
      new Date(r.progress.completedAt) >= startOfWeek
    );

    const scoredCompleted = weeklyCompleted.filter(r => 
      r.progress?.score !== undefined && 
      r.progress.score !== null && 
      r.progress.score > 0
    );

    const weeklyAverageScore = scoredCompleted.length > 0
      ? Math.round(scoredCompleted.reduce((sum, r) => sum + (r.progress.score || 0), 0) / scoredCompleted.length)
      : 0;

    return {
      weeklyProgress: Math.min(Math.round((weeklyMinutes / WEEKLY_TARGET) * 100), 100),
      weeklyMinutes,
      daysRemaining,
      overallProgress: totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0,
      completedCount,
      totalAssigned,
      weeklyAverageScore
    };
  }, [resources]);

  return (
    <div className="space-y-12 animate-fadeIn pb-20 p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-tp-purple text-white rounded-xl shadow-lg">
              <BrainIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black text-tp-purple uppercase tracking-[0.4em]">Academy Registry</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-tp-purple tracking-tighter leading-none">
            {user.name.split(' ')[0]}'s Hub
          </h1>
          <p className="text-gray-600 font-bold uppercase tracking-[0.2em] text-[10px] mt-5">
            Level: {user.languageLevel} • Roster: {user.rosterId || 'Default'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-6 w-full md:w-auto">
          {/* Weekly Status Section */}
          <div className="bg-white px-8 py-6 rounded-[32px] shadow-md border border-gray-100 w-full md:w-[400px] shadow-tp-purple/5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Weekly Status</h3>
              <span className="text-[10px] font-black text-tp-red uppercase tracking-widest bg-tp-red/5 px-2 py-1 rounded-lg">
                {stats.daysRemaining} Days Left
              </span>
            </div>
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-2xl font-black text-tp-purple">
                  {stats.weeklyMinutes} <span className="text-xs text-gray-400 font-bold">/ 180 MINS</span>
                </p>
                <p className="text-[10px] font-black text-tp-red uppercase tracking-widest mt-1">
                  Weekly Avg Score: {stats.weeklyAverageScore > 0 ? `${stats.weeklyAverageScore}%` : 'N/A'}
                </p>
              </div>
              <span className="text-xs font-black text-tp-purple">{stats.weeklyProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-tp-purple h-full rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${stats.weeklyProgress}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-white p-2 rounded-[24px] shadow-md border border-gray-100 flex flex-wrap gap-1 justify-end ml-auto">
            {['All', 'Listening', 'Speaking', 'Reading', 'Writing'].map((skill) => (
              <button
                key={skill}
                onClick={() => setActiveSkill(skill as SkillCategory)}
                className={`flex items-center gap-2 px-6 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeSkill === skill ? 'bg-tp-purple text-white shadow-lg shadow-tp-purple/20' : 'text-gray-500 hover:text-tp-purple hover:bg-gray-50'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Weekly Target</p>
              <h3 className="text-2xl font-bold text-indigo-600">
                {stats.weeklyMinutes} <span className="text-sm text-gray-400 font-normal">/ 180 mins</span>
              </h3>
            </div>
            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
              {stats.weeklyProgress}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${stats.weeklyProgress}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-sm text-gray-500 font-medium mb-1">Overall Progress</p>
              <h3 className="text-2xl font-bold text-emerald-600">
                {stats.completedCount} <span className="text-sm text-gray-400 font-normal">/ {stats.totalAssigned} Courses</span>
              </h3>
            </div>
            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">
              {stats.overallProgress}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${stats.overallProgress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Sidebar: Metrics */}
        <div className="lg:col-span-4 lg:sticky lg:top-8">
      {/* Competency Metrics Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Competency Metrics
        </h3>
        
        {isMetricsEmpty ? (
          <div className="py-8 text-center flex flex-col items-center justify-center border border-dashed border-gray-100 rounded-xl bg-gray-50/50">
            <span className="text-xl font-black text-gray-400 block mb-1">N/A</span>
            <span className="text-[10px] font-black text-tp-red uppercase tracking-widest">Pending Assessment</span>
          </div>
        ) : (
          <div className="space-y-5">
            {competencyMetrics.map((metric, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                  <span className="text-sm font-bold text-gray-900">{metric.score > 0 ? `${metric.score}%` : 'N/A'}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                      metric.score >= 80 ? 'bg-emerald-500' : 
                      metric.score >= 60 ? 'bg-amber-400' : 
                      metric.score > 0 ? 'bg-rose-500' : 'bg-gray-300'
                    }`}
                    style={{ width: `${metric.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>

        {/* Main Content: Course Grid */}
        <div className="lg:col-span-8 space-y-16">
          {/* Section: Assigned Interactive Lessons (Shielded) */}
          <div className="bg-gradient-to-br from-tp-purple/5 to-tp-red/5 p-8 rounded-[40px] border-2 border-tp-purple/20 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-tp-purple text-white rounded-2xl shadow-md">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-tp-purple tracking-tight uppercase">
                    Assigned Interactive Lessons
                  </h2>
                  <p className="text-xs font-semibold text-gray-500">
                    Shielded content authorized for {user.name}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-tp-purple uppercase tracking-widest bg-white px-3 py-1.5 rounded-full shadow-sm border border-tp-purple/10">
                {myLessons.length} Authorized
              </span>
            </div>

            {isLoadingMyLessons ? (
              <div className="py-12 text-center text-gray-500 font-bold flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-tp-purple animate-spin" />
                <p className="text-xs uppercase tracking-widest">Fetching your authorized lessons...</p>
              </div>
            ) : myLessons.length === 0 ? (
              <div className="py-12 px-6 text-center text-gray-500 font-bold text-xs uppercase tracking-widest border-2 border-dashed border-tp-purple/20 rounded-[30px] bg-white/60">
                You have no assigned lessons at this time.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myLessons.map((lesson, idx) => {
                  const lessonData = lesson.lessonData || lesson;
                  const lessonId = lesson.id || lessonData.id;
                  const title = lessonData.title || lesson.title || 'Interactive Lesson';
                  const docxFilename = lessonData.docxFilename;
                  const audioCount = lessonData.blocks?.filter((b: any) => b.type === 'audio')?.length || 0;
                  const freetextCount = lessonData.blocks?.filter((b: any) => b.type === 'freetext')?.length || 0;

                  return (
                    <div
                      key={lessonId || idx}
                      onClick={() => {
                        const resObj: Resource = {
                          id: lessonId,
                          title: title,
                          url: `interactive:${lessonId}`,
                          type: ResourceType.Practice,
                          tags: ['Interactive', 'DOCX'],
                          level: (user.languageLevel as any) || 'B2',
                          objective: `Interactive practice with ${audioCount} audio tracks and ${freetextCount} free-text questions.`,
                          duration: 20,
                          progress: { status: 'assigned' },
                          ...( { interactiveLesson: lessonData } as any )
                        };
                        onOpenResource(resObj);
                      }}
                      className="bg-white p-8 rounded-[32px] border border-tp-purple/20 shadow-md hover:shadow-2xl hover:border-tp-purple transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-tp-purple uppercase tracking-[0.2em] bg-tp-purple/10 px-3 py-1 rounded-full">
                            Interactive .DOCX
                          </span>
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Shielded
                          </span>
                        </div>
                        <h3 className="font-black text-xl text-gray-900 group-hover:text-tp-purple transition-colors leading-tight">
                          {title}
                        </h3>
                        {docxFilename && (
                          <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> {docxFilename}
                          </p>
                        )}
                      </div>

                      <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-wider">
                          {audioCount > 0 && <span>🎧 {audioCount} Audio</span>}
                          {freetextCount > 0 && <span>✍️ {freetextCount} Written</span>}
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-tp-purple group-hover:translate-x-1 transition-transform flex items-center gap-1">
                          Start Lesson →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Active Assignments */}
          <div>
            <div className="flex items-center justify-between mb-10 px-4">
              <h2 className="text-3xl font-black text-tp-purple tracking-tight uppercase flex items-center gap-4">
                <TargetIcon className="w-7 h-7 text-tp-red" />
                Active Assignments
              </h2>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{activeCourses.length} Modules</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {activeCourses.map((res, idx) => (
                <div 
                  key={`active-course-${res.id || idx}`} 
                  onClick={() => onOpenResource(res)} 
                  className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-md hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between min-h-[240px]"
                >
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <span className="text-[10px] font-black text-tp-red uppercase tracking-[0.2em]">{res.tags[0]}</span>
                      <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${res.progress?.status === 'assigned' ? 'bg-tp-purple text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {res.progress?.status === 'assigned' ? 'MANUAL' : 'AUTO'}
                      </span>
                    </div>
                    <h3 className="font-black text-2xl text-tp-purple group-hover:text-tp-red transition-colors leading-tight">{res.title}</h3>
                  </div>
                  <div className="flex items-center justify-between mt-8 pt-8 border-t border-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{res.type}</span>
                      <span className="text-[9px] font-black text-tp-purple/60 uppercase tracking-widest bg-tp-purple/5 px-2 py-0.5 rounded-md">{res.duration || '10'} mins</span>
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-tp-purple group-hover:translate-x-2 transition-transform">Launch Module →</span>
                  </div>
                </div>
              ))}
              {activeCourses.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-400 font-black uppercase text-xs tracking-widest border-2 border-dashed border-gray-100 rounded-[40px] bg-gray-50/30">
                  No active assignments in this category.
                </div>
              )}
            </div>
          </div>

          {/* Section: Completed History */}
          <div>
            <div className="flex items-center justify-between mb-10 px-4">
              <h2 className="text-3xl font-black text-tp-purple tracking-tight uppercase flex items-center gap-4">
                <CheckCircleIcon className="w-7 h-7 text-green-500" filled />
                Completed History
              </h2>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{completedCourses.length} Mastered</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {completedCourses.map((res, idx) => (
                <div 
                  key={`completed-course-${res.id || idx}`} 
                  onClick={() => onOpenResource(res)} 
                  className="bg-white p-10 rounded-[40px] border-2 border-green-500/20 shadow-md hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group grayscale hover:grayscale-0"
                >
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-green-100 text-green-600 px-4 py-1.5 rounded-xl flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4" filled />
                        <span className="text-[9px] font-black uppercase">Completed</span>
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{res.level}</span>
                    </div>
                    <h3 className="font-black text-xl text-tp-purple leading-tight">{res.title}</h3>
                  </div>
                  <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{res.tags[0]}</span>
                    {res.progress?.score && (
                      <span className="text-[10px] font-black text-green-600 uppercase">Score: {res.progress.score}%</span>
                    )}
                  </div>
                </div>
              ))}
              {completedCourses.length === 0 && (
                <div className="col-span-full py-20 text-center text-gray-400 font-black uppercase text-xs tracking-widest border-2 border-dashed border-gray-100 rounded-[40px] bg-gray-50/30">
                  Registry history is currently empty.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
