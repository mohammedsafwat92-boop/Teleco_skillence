
import React from 'react';
import { DashboardIcon, AdminIcon, XIcon, ExitIcon, SpeakingIcon, ListeningIcon, ReadingIcon, PracticeIcon, BrainIcon, PhoneIcon } from './Icons';
import type { View, Module, UserProfile } from '../types';

interface SidebarProps {
  modules: { [id: string]: Module };
  currentView: View;
  onNavigate: (view: View) => void;
  currentUser: UserProfile | null;
  users: UserProfile[];
  onSwitchUser: (user: UserProfile) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const NavItem: React.FC<{ view: View, currentView: View, onNavigate: (view: View) => void, children: React.ReactNode }> = ({ view, currentView, onNavigate, children }) => {
  const isActive = JSON.stringify(view) === JSON.stringify(currentView);
  return (
    <li className="mb-1.5 px-3">
      <button onClick={() => onNavigate(view)} className={`flex items-center w-full py-3 md:py-2.5 px-4 rounded-xl transition-all duration-200 text-left min-h-[48px] ${isActive ? 'bg-tp-red text-white font-semibold shadow-lg shadow-tp-red/20 translate-x-1' : 'bg-transparent text-white/80 hover:bg-white/10 hover:text-white'}`}>
        {children}
      </button>
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, currentUser, isOpen, onClose, onLogout }) => {
  const isAdmin = currentUser?.role === 'admin';
  const isCoach = currentUser?.role === 'coach';
  
  return (
    <div className={`fixed inset-y-0 left-0 w-72 bg-tp-purple text-white flex flex-col h-full shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="lg:hidden absolute top-4 right-4"><button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full"><XIcon /></button></div>

      <div className="flex flex-col items-center justify-center pt-10 pb-6 border-b border-white/10" onClick={() => onNavigate({ type: 'dashboard' })}>
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl mb-4 cursor-pointer hover:scale-105 transition-transform"><span className="text-tp-purple font-black text-2xl">S</span></div>
        <h1 className="text-sm font-bold tracking-[0.1em] text-white/90 uppercase">Skillence</h1>
        <p className="text-xs text-tp-red font-bold uppercase tracking-[0.2em] mt-1">Egypt</p>
      </div>
      
      <nav className="flex-1 py-8 overflow-y-auto custom-scrollbar">
        <ul className="space-y-1">
          <NavItem view={{ type: 'dashboard' }} currentView={currentView} onNavigate={onNavigate}>
            <DashboardIcon />
            <span className="ml-3">Academy Hub</span>
          </NavItem>
          
          {isAdmin && (
            <>
              <NavItem view={{ type: 'admin' }} currentView={currentView} onNavigate={onNavigate}>
                  <AdminIcon />
                  <span className="ml-3 font-bold">Admin Panel</span>
              </NavItem>
              <NavItem view={{ type: 'live-coach' }} currentView={currentView} onNavigate={onNavigate}>
                <SpeakingIcon className="w-5 h-5" />
                <span className="ml-3">Simulations</span>
              </NavItem>
              <NavItem view={{ type: 'live-ai-coach' }} currentView={currentView} onNavigate={onNavigate}>
                <PhoneIcon className="w-5 h-5" />
                <span className="ml-3">Live AI Coach</span>
              </NavItem>
            </>
          )}

          {isCoach && (
            <>
              <NavItem view={{ type: 'live-coach' }} currentView={currentView} onNavigate={onNavigate}>
                 <AdminIcon className="w-5 h-5" />
                 <span className="ml-3 font-bold">Coach Hub</span>
              </NavItem>
              <NavItem view={{ type: 'live-ai-coach' }} currentView={currentView} onNavigate={onNavigate}>
                <PhoneIcon className="w-5 h-5" />
                <span className="ml-3">Live AI Coach</span>
              </NavItem>
            </>
          )}

          {currentUser?.role === 'agent' && (
            <NavItem view={{ type: 'live-ai-coach' }} currentView={currentView} onNavigate={onNavigate}>
              <PhoneIcon className="w-5 h-5" />
              <span className="ml-3">Live AI Coach</span>
            </NavItem>
          )}
        </ul>

        <div className="mt-10 mb-4 px-6"><h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Core Skills</h2></div>
        <ul className="space-y-1">
            <NavItem view={{ type: 'dashboard', skill: 'Listening' }} currentView={currentView} onNavigate={onNavigate}>
                <ListeningIcon className="w-5 h-5 opacity-80" />
                <span className="ml-3">Listening</span>
            </NavItem>
            <NavItem view={{ type: 'dashboard', skill: 'Speaking' }} currentView={currentView} onNavigate={onNavigate}>
                <SpeakingIcon className="w-5 h-5 opacity-80" />
                <span className="ml-3">Speaking</span>
            </NavItem>
            <NavItem view={{ type: 'dashboard', skill: 'Reading' }} currentView={currentView} onNavigate={onNavigate}>
                <ReadingIcon className="w-5 h-5 opacity-80" />
                <span className="ml-3">Reading</span>
            </NavItem>
            <NavItem view={{ type: 'dashboard', skill: 'Writing' }} currentView={currentView} onNavigate={onNavigate}>
                <PracticeIcon className="w-5 h-5 opacity-80" />
                <span className="ml-3">Writing</span>
            </NavItem>
        </ul>
        
        <div className="mt-auto px-3 pb-4 pt-12">
          <button 
            onClick={onLogout}
            className="flex items-center w-full py-4 px-4 rounded-xl text-white/60 hover:bg-tp-red/10 hover:text-tp-red transition-all text-left"
          >
            <ExitIcon className="w-5 h-5" />
            <span className="ml-3 text-[11px] font-black uppercase tracking-widest">Logout Session</span>
          </button>
        </div>
      </nav>

      <div className="p-6 border-t border-white/5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest leading-tight">Client Specialized Track</p>
              <p className="text-[9px] text-white/30 font-medium mt-1 uppercase tracking-widest">Skillence © 2025</p>
          </div>
      </div>
    </div>
  );
};

export default Sidebar;
