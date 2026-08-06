
import React, { useState, useCallback, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import type { QuizQuestion, Lesson, Module, View, Quiz, UserProgress, ActivityLog, Resource } from '../types';
import { ResourceType } from '../types';
import { quizzes } from '../data/trainingData';
import { WatchIcon, ReadIcon, ListenIcon, PracticeIcon, WorksheetIcon, LinkIcon, CheckCircleIcon, TrendingUpIcon, ExclamationCircleIcon, BadgeIcon, ChartBarIcon, SpeakingIcon } from './Icons';

interface WorksheetProps {
  modules: { [id: string]: Module };
  view: View;
  onNavigate: (view: View) => void;
  progress: UserProgress;
  onToggleLesson: (lessonTitle: string) => void;
  onQuizComplete: (quizId: string, score: number) => void;
  onOpenLesson: (lesson: Lesson) => void;
  userLevel?: string;
  resource?: Resource; // Added resource prop for objective-driven assessments
}

const LessonCard: React.FC<{
    lesson: Lesson; 
    isCompleted: boolean; 
    onToggle: (title: string) => void;
    onOpen: (lesson: Lesson) => void;
}> = ({ lesson, isCompleted, onToggle, onOpen }) => {
    
    const handleToggleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(lesson.title);
    };

    const handleCardClick = () => {
        onOpen(lesson);
    };

    return (
        <div 
            onClick={handleCardClick}
            className={`glass-card p-5 rounded-2xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-tp-red cursor-pointer min-h-[140px] flex flex-col justify-between ${isCompleted ? 'bg-gray-100' : 'bg-white shadow-lg shadow-tp-purple/5'}`}
        >
             <div>
                 <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                        <h3 className={`font-bold text-lg leading-tight ${isCompleted ? 'text-gray-500 line-through font-medium' : 'text-tp-purple'}`}>
                            {lesson.title}
                        </h3>
                        <div className="flex flex-wrap items-center text-xs font-bold uppercase tracking-widest mt-2 gap-3">
                            <span className={`px-2 py-0.5 rounded whitespace-nowrap ${lesson.isCustom ? 'bg-tp-red/10 text-tp-red border border-tp-red/20' : 'bg-gray-200 text-gray-700'}`}>
                                {lesson.level}
                            </span>
                            {lesson.duration && <span className="flex items-center whitespace-nowrap text-gray-700"><svg className="w-4 h-4 mr-1 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>{lesson.duration}</span>}
                        </div>
                    </div>
                    <button 
                        onClick={handleToggleClick} 
                        className={`ml-4 p-3 rounded-xl transition-all ${isCompleted ? 'bg-green-50 text-green-500 shadow-inner' : 'bg-gray-50 text-gray-500 hover:text-tp-red hover:bg-tp-red/5'}`}
                        aria-label="Toggle Complete"
                    >
                        <CheckCircleIcon filled={isCompleted} />
                    </button>
                </div>
                {lesson.objective && (
                    <p className={`text-sm font-medium italic mt-2 line-clamp-2 ${isCompleted ? 'text-gray-500' : 'text-gray-600'}`}>"{lesson.objective.split('-')[0]}"</p>
                )}
             </div>
             
             <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end items-center">
                 <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${isCompleted ? 'bg-gray-200 text-gray-600' : 'bg-tp-purple/5 text-tp-purple'}`}>
                    <span className="scale-75 mr-1.5 opacity-80">{getResourceTypeIcon(lesson.type)}</span>
                    {lesson.type}
                </div>
             </div>
        </div>
    );
};

const getResourceTypeIcon = (type: ResourceType) => {
    switch(type) {
        case ResourceType.Watch: return <WatchIcon />;
        case ResourceType.Read: return <ReadIcon />;
        case ResourceType.Listen: return <ListenIcon />;
        case ResourceType.Practice: return <PracticeIcon />;
        case ResourceType.Hyperlink: return <LinkIcon />;
        default: return null;
    }
};

const ActivityChart: React.FC<{ history: ActivityLog[] }> = ({ history }) => {
    const days = [];
    const counts = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        const count = history.filter(h => h.date.startsWith(dateStr)).length;
        counts.push(count);
    }

    const maxCount = Math.max(...counts, 5);
    const height = 100;
    const barWidth = 34;
    const gap = 12;

    return (
        <div className="flex flex-col items-center w-full">
            <svg width="100%" height={height + 40} viewBox={`0 0 ${days.length * (barWidth + gap)} ${height + 40}`} preserveAspectRatio="xMidYMid meet">
                {counts.map((count, i) => {
                    const barHeight = (count / maxCount) * height;
                    const x = i * (barWidth + gap);
                    const y = height - barHeight;
                    return (
                        <g key={i} className="group cursor-help">
                            <rect 
                                x={x} 
                                y={y} 
                                width={barWidth} 
                                height={barHeight} 
                                className="fill-tp-purple transition-all group-hover:fill-tp-red" 
                                rx="8"
                            />
                            <text x={x + barWidth / 2} y={height + 25} textAnchor="middle" className="text-xs fill-gray-700 font-bold uppercase">
                                {days[i]}
                            </text>
                            {count > 0 && (
                                <text x={x + barWidth / 2} y={y - 10} textAnchor="middle" className="text-xs fill-tp-purple font-black">
                                    {count}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const PerformanceChart: React.FC<{ history: ActivityLog[] }> = ({ history }) => {
    const quizLogs = history.filter(h => h.type === 'quiz' && h.score !== undefined);
    if (quizLogs.length === 0) return <div className="h-32 flex items-center justify-center text-gray-700 text-sm font-bold uppercase tracking-widest">Awaiting assessment data</div>;

    const data = quizLogs.slice(-10);
    const height = 100;
    const width = 300;
    const padding = 25;
    
    const points = data.map((log, i) => {
        const x = padding + (i / (Math.max(data.length - 1, 1))) * (width - 2 * padding);
        const y = height - padding - ((log.score || 0) / 100) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="flex flex-col items-center w-full">
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" preserveAspectRatio="xMidYMid meet">
                <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#f1f5f9" strokeWidth="2" />
                <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#f1f5f9" strokeWidth="2" />
                <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#f1f5f9" strokeWidth="2" />
                <polyline points={points} fill="none" stroke="#E2001A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm" />
                {data.map((log, i) => {
                    const x = padding + (i / (Math.max(data.length - 1, 1))) * (width - 2 * padding);
                    const y = height - padding - ((log.score || 0) / 100) * (height - 2 * padding);
                    return <circle key={i} cx={x} cy={y} r="5" className="fill-white stroke-tp-purple stroke-[3px]" />;
                })}
            </svg>
            <p className="text-xs font-black uppercase tracking-widest text-gray-700 mt-4">Growth Trajectory</p>
        </div>
    );
};

const DashboardView: React.FC<{
    modules: { [id: string]: Module }, 
    onNavigate: (view: View) => void,
    progress: UserProgress
}> = ({ modules, onNavigate, progress }) => {
    const totalLessons = (Object.values(modules) as Module[]).reduce((acc, mod) => acc + mod.lessons.length, 0);
    const completedLessonsCount = progress.completedLessons.length;
    const completedPercentage = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;
    
    const totalQuizzes = quizzes.length;
    const completedQuizzes = Object.keys(progress.quizScores).length;
    const averageScore = completedQuizzes > 0 
        ? Math.round((Object.values(progress.quizScores) as number[]).reduce((a, b) => a + b, 0) / completedQuizzes)
        : 0;

    const personalPlan: { module: Module, lesson: Lesson }[] = [];
    (Object.values(modules) as Module[]).forEach(mod => {
        mod.lessons.forEach(l => {
            if (l.isCustom && l.assignedTo && !progress.completedLessons.includes(l.title)) {
                personalPlan.push({ module: mod, lesson: l });
            }
        });
    });

    return (
        <div className="space-y-6 md:space-y-10">
            <div>
                <h1 className="text-3xl md:text-4xl font-black text-tp-purple tracking-tight">Agent Hub</h1>
                <div className="flex items-center mt-2">
                    <div className="h-1.5 w-12 bg-tp-red rounded-full mr-3"></div>
                    <p className="text-gray-700 font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] text-xs">Empowering Interaction • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                </div>
            </div>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
                <div className="glass-card p-6 md:p-8 rounded-3xl shadow-xl shadow-tp-purple/5 border border-white/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-tp-purple/5 rounded-bl-full -mr-8 -mt-8 group-hover:bg-tp-red/5 transition-colors"></div>
                    <div className="flex items-center mb-4">
                        <div className="p-3 rounded-2xl bg-tp-purple/5 text-tp-purple">
                            <TrendingUpIcon />
                        </div>
                        <p className="ml-4 text-xs font-bold text-gray-700 uppercase tracking-widest">Progress</p>
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-tp-purple">{completedPercentage}%</p>
                    <p className="text-sm text-gray-600 font-medium mt-1">{completedLessonsCount} Lessons Mastered</p>
                    <div className="w-full h-2 bg-gray-100 rounded-full mt-4 overflow-hidden">
                        <div className="h-full bg-tp-purple transition-all duration-1000" style={{ width: `${completedPercentage}%` }}></div>
                    </div>
                </div>

                <div className="glass-card p-6 md:p-8 rounded-3xl shadow-xl shadow-tp-purple/5 border border-white/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-tp-red/5 rounded-bl-full -mr-8 -mt-8"></div>
                    <div className="flex items-center mb-4">
                        <div className="p-3 rounded-2xl bg-tp-red/5 text-tp-red">
                            <BadgeIcon className="w-6 h-6" />
                        </div>
                        <p className="ml-4 text-xs font-bold text-gray-700 uppercase tracking-widest">Efficiency</p>
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-tp-purple">{averageScore}%</p>
                    <p className="text-sm text-gray-600 font-medium mt-1">Average Proficiency</p>
                </div>

                <div className="glass-card p-6 md:p-8 rounded-3xl shadow-xl shadow-tp-purple/5 border border-white/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-tp-purple/5 rounded-bl-full -mr-8 -mt-8"></div>
                    <div className="flex items-center mb-4">
                        <div className="p-3 rounded-2xl bg-tp-purple/5 text-tp-purple">
                            <WorksheetIcon className="w-6 h-6" />
                        </div>
                        <p className="ml-4 text-xs font-bold text-gray-700 uppercase tracking-widest">Assessments</p>
                    </div>
                    <p className="text-3xl md:text-4xl font-black text-tp-purple">{completedQuizzes}</p>
                    <p className="text-sm text-gray-600 font-medium mt-1">Tests Successfully Taken</p>
                </div>
            </div>

            {/* Specialized Plan Overlay */}
            {personalPlan.length > 0 && (
                <div className="bg-tp-purple rounded-3xl p-6 md:p-8 text-white relative shadow-2xl overflow-hidden shadow-tp-purple/40">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-tp-red/20 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                        <h2 className="text-xl md:text-2xl font-black mb-6 flex items-center">
                            <span className="bg-tp-red text-white p-2 rounded-xl mr-4 shadow-lg"><ExclamationCircleIcon className="text-white" /></span>
                            Targeted Remedial Path
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                            {personalPlan.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => onNavigate({type: 'module', moduleId: item.module.id})}
                                    className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/20 hover:scale-105 transition-all group"
                                >
                                    <div className="text-xs font-black text-tp-red uppercase tracking-[0.2em] mb-2">{item.module.title}</div>
                                    <h3 className="font-bold text-lg mb-4 leading-tight group-hover:text-white transition-colors">{item.lesson.title}</h3>
                                    <div className="text-xs font-black uppercase tracking-widest flex items-center group-hover:translate-x-1 transition-transform">
                                        Action Required <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
                <div className="glass-card p-6 md:p-8 rounded-3xl shadow-xl border border-white/50">
                    <div className="flex items-center mb-6 md:mb-8">
                        <div className="w-1.5 h-6 bg-tp-red rounded-full mr-4"></div>
                        <h2 className="text-xl font-black text-tp-purple">Engagement Pulse</h2>
                    </div>
                    <ActivityChart history={progress.activityHistory || []} />
                </div>
                <div className="glass-card p-6 md:p-8 rounded-3xl shadow-xl border border-white/50">
                    <div className="flex items-center mb-6 md:mb-8">
                        <div className="w-1.5 h-6 bg-tp-purple rounded-full mr-4"></div>
                        <h2 className="text-xl font-black text-tp-purple">Skill Progression</h2>
                    </div>
                    <PerformanceChart history={progress.activityHistory || []} />
                </div>
            </div>

            {/* Modules Grid */}
            <div>
                <div className="flex items-center justify-between mb-8 px-2">
                    <h2 className="text-xl md:text-2xl font-black text-tp-purple">Learning Tracks</h2>
                    <span className="text-xs font-black text-gray-700 uppercase tracking-widest hidden sm:inline">{Object.values(modules).length} Paths Active</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    {Object.values(modules).map((module: Module) => {
                         const modTotal = module.lessons.length;
                         const modCompleted = module.lessons.filter(l => progress.completedLessons.includes(l.title)).length;
                         const modPercent = modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0;
                         const isComplete = modTotal > 0 && modCompleted === modTotal;

                        return (
                        <div 
                            key={module.id} 
                            onClick={() => onNavigate({type: 'module', moduleId: module.id})} 
                            className={`glass-card p-6 md:p-8 rounded-3xl shadow-lg border transition-all cursor-pointer hover:shadow-2xl hover:-translate-y-1 group relative overflow-hidden ${isComplete ? 'border-tp-red/20 bg-tp-red/[0.02]' : 'border-white/50'}`}
                        >
                            <div className="flex items-center relative z-10">
                                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center transition-all ${isComplete ? 'bg-tp-red text-white' : 'bg-tp-purple/5 text-tp-purple group-hover:bg-tp-purple group-hover:text-white'}`}>
                                    {module.icon}
                                </div>
                                <div className="ml-4 md:ml-6 flex-1">
                                    <h3 className="font-black text-lg md:text-xl text-tp-purple truncate">{module.title}</h3>
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">{modCompleted}/{modTotal}</span>
                                        <span className={`text-xs font-black ${isComplete ? 'text-tp-red' : 'text-tp-purple'}`}>{modPercent}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                                        <div className={`h-full transition-all duration-700 ${isComplete ? 'bg-tp-red' : 'bg-tp-purple'}`} style={{ width: `${modPercent}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            </div>
        </div>
    );
};

const ModuleView: React.FC<{
    module: Module;
    progress: UserProgress;
    onToggleLesson: (title: string) => void;
    onNavigate: (view: View) => void;
    onOpenLesson: (lesson: Lesson) => void;
}> = ({ module, progress, onToggleLesson, onNavigate, onOpenLesson }) => {
    const totalLessons = module.lessons.length;
    const completedCount = module.lessons.filter(l => progress.completedLessons.includes(l.title)).length;
    const isComplete = totalLessons > 0 && completedCount === totalLessons;
    const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    const categorizedLessons: Record<string, Lesson[]> = {
        'Strategic Mastery (All)': [],
        'Core Foundations (A1 - A2)': [],
        'Advanced Fluency (B1 - B2)': [],
        'Specialized Professional (C1+)': [],
    };

    module.lessons.forEach(lesson => {
        const lvl = lesson.level.toUpperCase();
        if (lvl.includes('ALL') || lvl.includes('TARGETED')) categorizedLessons['Strategic Mastery (All)'].push(lesson);
        else if (lvl.includes('C1') || lvl.includes('C2')) categorizedLessons['Specialized Professional (C1+)'].push(lesson);
        else if (lvl.includes('B1') || lvl.includes('B2')) categorizedLessons['Advanced Fluency (B1 - B2)'].push(lesson);
        else if (lvl.includes('A1') || lvl.includes('A2')) categorizedLessons['Core Foundations (A1 - A2)'].push(lesson);
        else categorizedLessons['Strategic Mastery (All)'].push(lesson);
    });

    return (
        <div className="max-w-5xl mx-auto pb-10 md:pb-20">
            <div className="flex flex-col md:flex-row items-center md:items-center justify-between mb-8 md:mb-12 gap-6 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-tp-purple text-white rounded-3xl flex items-center justify-center shadow-2xl shadow-tp-purple/30">
                        {module.icon}
                    </div>
                    <div className="md:ml-8 mt-4 md:mt-0">
                        <h1 className="text-3xl md:text-4xl font-black text-tp-purple tracking-tight">{module.title}</h1>
                        <p className="text-gray-700 font-medium mt-1">{module.description}</p>
                    </div>
                </div>
                <div className="text-center md:text-right bg-white p-4 rounded-2xl border border-gray-100 shadow-sm md:bg-transparent md:p-0 md:border-0 md:shadow-none">
                    <div className="text-4xl md:text-5xl font-black text-tp-red drop-shadow-sm">{percent}%</div>
                    <div className="text-xs font-black text-gray-700 uppercase tracking-[0.2em] md:tracking-[0.3em] mt-2">Proficiency</div>
                </div>
            </div>

            {isComplete && (
                <div className="bg-gradient-to-r from-tp-red/5 to-tp-purple/5 border-2 border-tp-red p-6 md:p-8 mb-10 md:mb-12 rounded-3xl flex flex-col md:flex-row items-center justify-between shadow-xl gap-6 text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center">
                        <BadgeIcon className="w-12 h-12 text-tp-red md:mr-6 mb-4 md:mb-0" />
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-tp-purple uppercase tracking-tight">Certification Standard Achieved</h3>
                            <p className="text-gray-700 font-medium">All required coursework for this track is complete.</p>
                        </div>
                    </div>
                </div>
            )}

            {Object.entries(categorizedLessons).map(([category, lessons]) => {
                if (lessons.length === 0) return null;
                return (
                    <div key={category} className="mb-10 md:mb-14">
                        <div className="flex items-center mb-6">
                            <div className="h-0.5 w-8 bg-tp-red rounded-full mr-3"></div>
                            <h3 className="text-xs md:text-sm font-black text-gray-700 uppercase tracking-[0.2em] md:tracking-[0.3em]">{category}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                            {lessons.map((lesson, index) => (
                                <LessonCard 
                                    key={index} 
                                    lesson={lesson} 
                                    isCompleted={progress.completedLessons.includes(lesson.title)}
                                    onToggle={onToggleLesson}
                                    onOpen={onOpenLesson}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const QuizComponent: React.FC<{
    quiz: Quiz; 
    onNavigate: (view: View) => void; 
    modules: { [id: string]: Module };
    onQuizComplete: (id: string, score: number) => void;
    userLevel?: string;
    resource?: Resource; // Added resource to QuizComponent for objective handling
}> = ({ quiz, onNavigate, modules, onQuizComplete, userLevel, resource }) => {
    const [viewState, setViewState] = useState<'start' | 'quiz' | 'results'>('start');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTranscript, setShowTranscript] = useState(false);

    const handleStartQuiz = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Dynamic generation based on resource objective if available, otherwise fallback to quiz id
            const objectiveToUse = resource?.objective || quiz.title;
            const generatedQuestions = await geminiService.generateWorksheetQuestions(objectiveToUse, userLevel);
            setQuestions(generatedQuestions);
            setUserAnswers(new Array(generatedQuestions.length).fill(-1));
            setViewState('quiz');
            setCurrentQuestionIndex(0);
        } catch (err) {
            setError((err as Error).message);
            setViewState('start');
        } finally {
            setIsLoading(false);
        }
    }, [quiz.id, userLevel, resource]);

    useEffect(() => {
      setViewState('start');
      setError(null);
    }, [quiz.id]);
    
    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center">
          <div className="w-16 h-16 border-4 border-tp-red border-t-transparent rounded-full animate-spin mb-8"></div>
          <h2 className="text-xl md:text-2xl font-black text-tp-purple">Calibrating Assessment Engine</h2>
          <p className="text-gray-700 font-bold uppercase tracking-widest text-xs mt-2">Tailoring questions to your profile...</p>
        </div>
    );

    if (viewState === 'start' || error) return (
        <div className="max-w-2xl mx-auto mt-10 md:mt-20 text-center glass-card p-6 md:p-12 rounded-3xl shadow-2xl border border-white/50">
            <div className="mx-auto flex items-center justify-center h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-tp-purple/5 mb-6 md:mb-8 text-tp-purple shadow-inner">
                <WorksheetIcon className="w-10 h-10 md:w-12 md:h-12" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-tp-purple mb-4 tracking-tight uppercase">{quiz.title}</h1>
            
            {/* Displaying specific resource objective in the start screen */}
            {resource?.objective && (
                <div className="bg-tp-red/5 p-4 rounded-2xl mb-6 border border-tp-red/10">
                    <p className="text-[10px] font-black text-tp-red uppercase tracking-widest mb-1">Target Competency</p>
                    <p className="text-sm font-bold text-tp-purple italic leading-relaxed">"{resource.objective}"</p>
                </div>
            )}
            
            <p className="text-sm md:text-base text-gray-700 font-medium mb-8 md:mb-10 leading-relaxed px-4 md:px-10">{quiz.description}</p>
            
            {error && <p className="text-tp-red mb-6 text-xs font-bold uppercase tracking-widest">⚠️ {error}</p>}
            
            <button
                onClick={handleStartQuiz}
                className="w-full sm:w-auto bg-tp-purple text-white font-black py-4 px-12 rounded-2xl hover:bg-tp-navy hover:scale-105 transition-all shadow-xl shadow-tp-purple/20 uppercase tracking-[0.2em] text-sm min-h-[50px]"
            >
                Initiate Test
            </button>
        </div>
    );

    if (viewState === 'quiz' && questions.length > 0) {
        const currentQuestion = questions[currentQuestionIndex];
        const handleAnswerSelect = (optionIndex: number) => {
          const newAnswers = [...userAnswers];
          newAnswers[currentQuestionIndex] = optionIndex;
          setUserAnswers(newAnswers);
        };
        const handleNext = () => {
          setShowTranscript(false);
          if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(currentQuestionIndex + 1);
        };
        const handlePrevious = () => {
          setShowTranscript(false);
          if (currentQuestionIndex > 0) setCurrentQuestionIndex(currentQuestionIndex - 1);
        };
        const handleSubmit = () => {
            const scoreRaw = questions.reduce((s, q, i) => {
                if (q.type === 'speaking') return s + 1;
                return userAnswers[i] === q.correctAnswer ? s + 1 : s;
            }, 0);
            const scorePercent = Math.round((scoreRaw / questions.length) * 100);
            onQuizComplete(quiz.id, scorePercent);
            setViewState('results');
        };

        return (
            <div className="max-w-3xl mx-auto mt-6 md:mt-12 pb-10 md:pb-20">
                {/* Dynamic objective header for explicit context */}
                <div className="mb-8 px-6 py-4 bg-tp-purple/5 border-l-4 border-tp-red rounded-r-2xl">
                    <p className="text-[9px] font-black text-tp-purple uppercase tracking-widest mb-1">Session Objective</p>
                    <p className="text-sm font-bold text-tp-purple italic">{resource?.objective || quiz.title}</p>
                </div>

                <div className="glass-card rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
                    <div className="bg-tp-purple px-6 md:px-10 py-5 md:py-6 flex flex-col sm:flex-row justify-between items-center gap-2">
                        <h2 className="font-black text-white uppercase tracking-widest text-xs md:text-sm">Calibration Session</h2>
                        <span className="text-xs font-black text-tp-red bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest">Q {currentQuestionIndex + 1} / {questions.length}</span>
                    </div>
                    
                    <div className="p-6 md:p-10">
                        {/* Question Specific UI */}
                        {currentQuestion.type === 'listening' && (
                            <div className="mb-6 md:mb-10 p-5 md:p-6 bg-tp-purple/5 rounded-3xl border border-tp-purple/10">
                                <div className="flex items-center mb-4 text-tp-purple font-black uppercase text-xs tracking-widest">
                                    <ListenIcon /> <span className="ml-3">Audio Analysis</span>
                                </div>
                                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                                    <button className="flex-1 bg-tp-purple text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-tp-navy transition-colors flex items-center justify-center min-h-[44px]">
                                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Play Audio
                                    </button>
                                    <button 
                                        onClick={() => setShowTranscript(!showTranscript)}
                                        className="flex-1 bg-white border border-tp-purple/20 py-3 rounded-xl font-bold text-xs uppercase tracking-widest text-tp-purple hover:bg-tp-purple/5 transition-colors min-h-[44px]"
                                    >
                                        {showTranscript ? 'Hide' : 'Show'} Transcript
                                    </button>
                                </div>
                                {showTranscript && (
                                    <div className="mt-6 p-5 bg-white rounded-2xl border border-gray-100 text-sm md:text-base text-gray-700 italic leading-relaxed max-h-40 overflow-y-auto">
                                        "{currentQuestion.context}"
                                    </div>
                                )}
                            </div>
                        )}
                        {currentQuestion.type === 'reading' && (
                            <div className="mb-6 md:mb-10 p-5 md:p-6 bg-tp-purple/5 rounded-3xl border border-tp-purple/10">
                                <div className="flex items-center mb-4 text-tp-purple font-black uppercase text-xs tracking-widest">
                                    <ReadIcon /> <span className="ml-3">Contextual Analysis</span>
                                </div>
                                <div className="p-4 md:p-6 bg-white rounded-2xl border border-gray-100 text-sm md:text-base text-gray-800 leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                                    {currentQuestion.context}
                                </div>
                            </div>
                        )}
                        {currentQuestion.type === 'speaking' && (
                            <div className="mb-6 md:mb-10 p-6 md:p-8 bg-tp-red/5 rounded-3xl border border-tp-red/10">
                                <div className="flex items-center mb-6 text-tp-red font-black uppercase text-xs tracking-widest">
                                    <SpeakingIcon /> <span className="ml-3">Verbal Articulation</span>
                                </div>
                                <p className="text-lg md:text-xl font-bold text-tp-purple mb-6 md:mb-8 leading-tight">{currentQuestion.speakingPrompt}</p>
                                <div className="flex justify-center py-10 md:py-12 bg-white rounded-3xl border-2 border-dashed border-tp-red/20 group hover:border-tp-red transition-colors cursor-pointer">
                                    <button className="flex flex-col items-center text-gray-500 group-hover:text-tp-red transition-colors">
                                        <div className="h-14 w-14 md:h-16 md:w-16 rounded-full border-4 border-current flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <div className="h-5 w-5 bg-current rounded-full animate-pulse"></div>
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">Capture Response</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        <p className="text-xl md:text-2xl font-black text-tp-purple mb-6 md:mb-8 tracking-tight leading-tight">{currentQuestion.question}</p>
                        
                        {currentQuestion.type === 'speaking' ? (
                             <button
                                onClick={() => handleAnswerSelect(0)}
                                className={`w-full text-center py-5 rounded-2xl border-2 font-black uppercase tracking-widest text-xs md:text-sm transition-all min-h-[54px] ${
                                    userAnswers[currentQuestionIndex] === 0
                                    ? 'bg-tp-purple text-white border-tp-purple shadow-xl shadow-tp-purple/20'
                                    : 'bg-white border-gray-100 hover:border-tp-red text-gray-500'
                                }`}
                            >
                                {userAnswers[currentQuestionIndex] === 0 ? "Response Locked" : "Finalize Articulation"}
                            </button>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 md:gap-4">
                                {currentQuestion.options?.map((option, index) => (
                                    <button
                                    key={index}
                                    onClick={() => handleAnswerSelect(index)}
                                    className={`w-full text-left p-4 md:p-6 rounded-2xl border-2 transition-all group min-h-[64px] ${
                                        userAnswers[currentQuestionIndex] === index
                                        ? 'bg-tp-purple text-white border-tp-purple shadow-xl shadow-tp-purple/20'
                                        : 'bg-white border-gray-100 hover:border-tp-purple/20 hover:bg-tp-purple/[0.02] text-gray-700'
                                    }`}
                                    >
                                    <div className="flex items-center">
                                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center mr-4 md:mr-5 text-sm font-black transition-colors flex-shrink-0 ${
                                            userAnswers[currentQuestionIndex] === index ? 'bg-tp-red text-white' : 'bg-gray-200 text-gray-600 group-hover:bg-tp-purple/10 group-hover:text-tp-purple'
                                        }`}>
                                            {String.fromCharCode(65 + index)}
                                        </div>
                                        <span className="font-bold text-base md:text-lg leading-snug">{option}</span>
                                    </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50/50 px-6 md:px-10 py-6 md:py-8 border-t border-gray-100 flex justify-between gap-4">
                        <button 
                            onClick={handlePrevious} 
                            disabled={currentQuestionIndex === 0} 
                            className="px-4 py-3 text-gray-500 font-black uppercase tracking-widest text-xs hover:text-tp-purple disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            Back
                        </button>
                        {currentQuestionIndex === questions.length - 1 ? (
                            <button onClick={handleSubmit} className="flex-1 sm:flex-none bg-tp-red text-white font-black py-3 px-6 md:px-10 rounded-xl hover:bg-red-700 shadow-lg shadow-tp-red/20 uppercase tracking-widest text-xs min-h-[44px]">Execute Submit</button>
                        ) : (
                            <button onClick={handleNext} className="flex-1 sm:flex-none bg-tp-purple text-white font-black py-3 px-6 md:px-10 rounded-xl hover:bg-tp-navy shadow-lg shadow-tp-purple/20 uppercase tracking-widest text-xs min-h-[44px]">Next Phase</button>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    
    if (viewState === 'results') {
      const score = questions.reduce((s, q, i) => {
          if (q.type === 'speaking') return s + 1;
          return userAnswers[i] === q.correctAnswer ? s + 1 : s;
      }, 0);
      const passed = (score / questions.length) >= 0.7;

      return (
        <div className="max-w-xl mx-auto mt-10 md:mt-20 text-center glass-card p-8 md:p-12 rounded-3xl shadow-2xl border border-white/50">
          <div className={`mx-auto flex items-center justify-center h-20 w-20 md:h-24 md:w-24 rounded-3xl mb-8 shadow-inner ${passed ? 'bg-green-100 text-green-600' : 'bg-tp-red/10 text-tp-red'}`}>
            {passed ? <BadgeIcon className="w-10 h-10 md:w-12 md:h-12" /> : <ExclamationCircleIcon className="w-10 h-10 md:w-12 md:h-12" />}
          </div>
          
          <h2 className="text-2xl md:text-3xl font-black text-tp-purple mb-4 tracking-tight uppercase">{passed ? 'Excellence Certified' : 'Maintenance Required'}</h2>
          <p className="text-base md:text-lg text-gray-700 font-medium mb-8 md:mb-10 leading-relaxed">Overall proficiency of <span className="font-black text-tp-purple text-2xl">{Math.round((score/questions.length)*100)}%</span> across dimensions.</p>

          <button onClick={() => onNavigate({type: 'dashboard'})} className="w-full sm:w-auto bg-tp-purple text-white font-black py-4 px-12 rounded-2xl hover:bg-tp-navy shadow-xl shadow-tp-purple/20 uppercase tracking-widest text-sm min-h-[50px]">
            Return to Dashboard
          </button>
        </div>
      );
    }

    return null;
}

const Worksheet: React.FC<WorksheetProps & { userLevel?: string }> = ({ modules, view, onNavigate, progress, onToggleLesson, onQuizComplete, onOpenLesson, userLevel, resource }) => {
    switch(view.type) {
        case 'dashboard':
            return <DashboardView modules={modules} onNavigate={onNavigate} progress={progress} />;
        case 'module':
            const module = modules[view.moduleId];
            return module ? <ModuleView module={module} progress={progress} onToggleLesson={onToggleLesson} onNavigate={onNavigate} onOpenLesson={onOpenLesson} /> : <div className="p-10 text-center text-gray-600 text-lg">Path not found.</div>;
        case 'quiz':
            const quiz = quizzes.find(q => q.id === view.quizId);
            return quiz ? <QuizComponent quiz={quiz} onNavigate={onNavigate} modules={modules} onQuizComplete={onQuizComplete} userLevel={userLevel} resource={resource} /> : <div className="p-10 text-center text-gray-600 text-lg">Assessment not found.</div>;
        default:
            return <div className="p-10 text-center text-gray-600 uppercase font-black tracking-widest text-sm">System ready.</div>
    }
};

export default Worksheet;
