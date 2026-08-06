
import React, { useState, useEffect } from 'react';
import { googleSheetService } from '../services/googleSheetService';
import { BrainIcon, ExclamationCircleIcon, AirlineIcon } from './Icons';
import type { UserProfile } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
  onEnterSandbox: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onEnterSandbox }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConn = async () => {
      const isOnline = await googleSheetService.testConnection();
      setSystemStatus(isOnline ? 'online' : 'offline');
    };
    checkConn();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const user = await googleSheetService.login(email, password);
      // Role routing is handled by the parent (App.tsx) based on user.role
      onLoginSuccess(user);
    } catch (err) {
      const cleanMessage = (err as Error).message.replace('AUTH_FAILED: ', '');
      setError(cleanMessage || "Authentication Failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-tp-purple relative overflow-hidden p-6 bg-gradient-to-br from-tp-purple via-tp-navy to-tp-purple">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-tp-red/10 rounded-full blur-[140px] -mr-80 -mt-80 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-tp-red/5 rounded-full blur-[100px] -ml-40 -mb-40"></div>
      
      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        <div className="text-center mb-10">
          <div className="inline-flex w-20 h-20 bg-white rounded-[24px] items-center justify-center shadow-2xl mb-6">
            <span className="text-tp-purple font-black text-3xl">S</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Skillence Academy</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${
              systemStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 
              systemStatus === 'offline' ? 'bg-tp-red shadow-[0_0_8px_#E2001A]' : 'bg-gray-400'
            }`}></div>
            <p className="text-white/60 font-black text-[9px] uppercase tracking-widest">
              {systemStatus === 'online' ? 'Global Node Online' : systemStatus === 'offline' ? 'Registry Offline' : 'Syncing...'}
            </p>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-[40px] p-10 md:p-12 shadow-2xl border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-tp-red/10 border border-tp-red/20 p-4 rounded-2xl flex items-center gap-3 text-tp-red">
                <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-tp-purple/40 uppercase tracking-widest mb-1.5 block px-1">Enterprise Email</label>
                <input 
                  type="email" 
                  required
                  placeholder="admin@tp-skillence.com"
                  className="w-full bg-tp-purple/5 border-2 border-transparent rounded-2xl px-6 py-4 outline-none focus:border-tp-red focus:bg-white transition-all text-tp-purple font-bold"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-tp-purple/40 uppercase tracking-widest mb-1.5 block px-1">Access Code</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full bg-tp-purple/5 border-2 border-transparent rounded-2xl px-6 py-4 outline-none focus:border-tp-red focus:bg-white transition-all text-tp-purple font-bold"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading || systemStatus === 'offline'}
              className="w-full bg-tp-navy text-white py-5 rounded-[20px] font-black uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-tp-purple hover:-translate-y-0.5 transition-all disabled:opacity-50"
            >
              {isLoading ? "Validating Session..." : "Authorize Portal"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-tp-purple/5 text-center">
            <button 
              onClick={onEnterSandbox}
              className="text-tp-purple/40 hover:text-tp-red font-black uppercase text-[9px] tracking-widest transition-colors"
            >
              Emergency Sandbox Access (Offline)
            </button>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-white/20 text-[8px] font-black uppercase tracking-[0.3em]">
            © 2025 Skillence Egypt • Client Specialized Track
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
