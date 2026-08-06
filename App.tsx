
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import CoachPanel from './components/CoachPanel';
import LessonViewer from './components/LessonViewer';
import Login from './components/Login';
import LiveCoach from './components/LiveCoach';
import { googleSheetService } from './services/googleSheetService';
import { allTrainingModules } from './data/trainingData';
import type { View, UserProfile, Resource } from './types';
import { 
  MenuIcon, 
  UserIcon, 
  BrainIcon, 
  ExitIcon
} from './components/Icons';

const App: React.FC = () => {
  const [view, setView] = useState<View>({ type: 'dashboard' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [originalUser, setOriginalUser] = useState<UserProfile | null>(null);
  const [userPlan, setUserPlan] = useState<Resource[]>([]);
  const [globalUsers, setGlobalUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Normalization logic: Ensures raw database strings are valid JSON objects for the UI
  const normalizeUser = (userData: any): UserProfile => {
    if (!userData) return userData;
    
    let parsedMetrics = userData.metrics;
    if (typeof parsedMetrics === 'string' && parsedMetrics.trim() !== '') {
      try {
        parsedMetrics = JSON.parse(parsedMetrics);
      } catch (e) {
        console.error("Metrics Parsing Error:", e);
        parsedMetrics = {};
      }
    }

    return {
      ...userData,
      metrics: parsedMetrics || {}
    };
  };

  const checkSession = async () => {
    setIsAuthChecking(true);
    const cachedUser = localStorage.getItem('tp_skillence_user_session');
    if (cachedUser) {
      try {
        const user = normalizeUser(JSON.parse(cachedUser));
        setCurrentUser(user);
        await refreshPlan(user.id, user.role);
        if (user.role === 'admin' || user.role === 'coach') {
          loadGlobalUsers();
        }
      } catch (e) {
        localStorage.removeItem('tp_skillence_user_session');
      }
    }
    setIsAuthChecking(false);
    setIsLoading(false);
  };

  const loadGlobalUsers = async () => {
    try {
      const users = await googleSheetService.fetchAllUsers();
      setGlobalUsers(Array.isArray(users) ? users : []);
    } catch (e) {
      setGlobalUsers([]);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const handleLogin = async (user: any) => {
    const normalized = normalizeUser(user);
    setCurrentUser(normalized);
    localStorage.setItem('tp_skillence_user_session', JSON.stringify(normalized));
    await refreshPlan(normalized.id, normalized.role);
    if (normalized.role === 'admin' || normalized.role === 'coach') {
      loadGlobalUsers();
      if (normalized.role === 'coach') setView({ type: 'live-coach' });
    }
  };

  const handleImpersonate = async (targetUser: any) => {
    setIsLoading(true);
    try {
      if (!originalUser && currentUser) {
        setOriginalUser(currentUser);
      }
      const normalized = normalizeUser(targetUser);
      setCurrentUser(normalized);
      // Impersonated view is usually an agent view
      await refreshPlan(normalized.id, normalized.role);
      setView({ type: 'dashboard' });
      setIsSidebarOpen(false);
    } catch (err) {
      alert("Profile switch failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitImpersonation = async () => {
    if (!originalUser) return;
    setIsLoading(true);
    try {
      setCurrentUser(originalUser);
      await refreshPlan(originalUser.id, originalUser.role);
      setOriginalUser(null);
      if (originalUser.role === 'admin') setView({ type: 'admin' });
      else if (originalUser.role === 'coach') setView({ type: 'live-coach' });
      else setView({ type: 'dashboard' });
    } catch (err) {
      alert("Session restore failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshPlan = async (uid?: string, role?: string) => {
    const id = uid || currentUser?.id;
    const r = role || currentUser?.role;
    if (!id) return;
    try {
      const data = await googleSheetService.fetchUserPlan(id, r);
      // Handle both old array format and new object format for backward compatibility
      if (data && data.resources) {
        setUserPlan(data.resources);
      } else {
        setUserPlan(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Refresh Error:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tp_skillence_user_session');
    setCurrentUser(null);
    setOriginalUser(null);
    setUserPlan([]);
    setGlobalUsers([]);
    setView({ type: 'dashboard' });
  };

  const handleNavigate = (newView: View) => {
    setView(newView);
    setIsSidebarOpen(false);
  };

  const renderContent = () => {
    if (isLoading || isAuthChecking) return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-tp-purple animate-pulse">
        <BrainIcon className="w-10 h-10 mb-8" />
        <p className="font-black uppercase tracking-widest text-xs">Syncing Academy Node...</p>
      </div>
    );

    if (!currentUser) return <Login onLoginSuccess={handleLogin} onEnterSandbox={() => {}} />;

    if (view.type === 'admin') {
      return <AdminPanel onUpdateContent={() => refreshPlan(currentUser.id, currentUser.role)} currentUser={currentUser} onImpersonate={handleImpersonate} />;
    }

    if (view.type === 'live-coach') {
      return <CoachPanel onUpdateContent={() => refreshPlan(currentUser.id, currentUser.role)} currentUser={currentUser} onImpersonate={handleImpersonate} />;
    }

    if (view.type === 'live-ai-coach') {
      if (currentUser.role !== 'admin' && currentUser.role !== 'coach' && currentUser.role !== 'agent') {
        setTimeout(() => setView({ type: 'dashboard' }), 0);
        return null;
      }
      return (
        <LiveCoach 
          currentUser={currentUser} 
          onClose={() => setView({ type: 'dashboard' })} 
          onImpersonate={handleImpersonate} 
        />
      );
    }
    
    if (view.type === 'lesson') return (
      <LessonViewer 
        resource={view.resource} 
        uid={currentUser.id} 
        currentUser={currentUser}
        onClose={() => setView({ type: 'dashboard' })} 
        onMasteryAchieved={() => refreshPlan(currentUser.id, currentUser.role)} 
      />
    );

    return (
      <Dashboard 
        user={currentUser} 
        resources={userPlan} 
        onNavigate={handleNavigate} 
        onOpenResource={(res) => setView({ type: 'lesson', resource: res })} 
        initialSkill={view.type === 'dashboard' ? view.skill : undefined}
      />
    );
  };

  return (
    <div className={`flex min-h-screen overflow-hidden ${currentUser ? 'bg-[#FBFBFF]' : 'bg-tp-purple'}`}>
      {currentUser && (
        <Sidebar 
          modules={allTrainingModules} 
          currentView={view} 
          onNavigate={handleNavigate} 
          currentUser={currentUser}
          users={globalUsers} 
          onSwitchUser={handleImpersonate}
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
          onLogout={handleLogout}
        />
      )}

      <main className={`flex-1 overflow-y-auto ${currentUser ? 'relative lg:ml-72 transition-all' : 'w-full'}`}>
        {originalUser && (
          <div className="sticky top-0 z-[60] bg-amber-500 text-white px-6 py-4 shadow-xl flex items-center justify-between animate-fadeIn border-b border-amber-600/20">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <UserIcon className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest">
                Sandbox Mode: Viewing as <span className="underline underline-offset-4 decoration-2">{currentUser?.name}</span>
              </p>
            </div>
            <button 
              onClick={handleExitImpersonation}
              className="bg-tp-navy text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-tp-navy transition-all flex items-center gap-2 shadow-lg"
            >
              <ExitIcon className="w-4 h-4" /> Exit to {originalUser.role === 'admin' ? 'Admin Panel' : 'Coach Hub'}
            </button>
          </div>
        )}

        <div className={`${currentUser ? 'p-4 md:p-12' : ''}`}>
          {currentUser && (
            <div className="flex items-center justify-between lg:hidden mb-12">
              <button onClick={() => setIsSidebarOpen(true)} className="p-5 bg-white shadow-2xl rounded-3xl text-tp-purple"><MenuIcon className="w-6 h-6" /></button>
            </div>
          )}
          <div className={currentUser ? "max-w-7xl mx-auto" : "w-full"}>{renderContent()}</div>
        </div>
      </main>
    </div>
  );
};

export default App;
