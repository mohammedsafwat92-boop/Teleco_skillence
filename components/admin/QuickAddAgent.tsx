import React, { useState } from 'react';
import { googleSheetService } from '../../services/googleSheetService';
import { UserPlus, Sparkles, Check, AlertCircle } from 'lucide-react';

interface QuickAddAgentProps {
  onAgentAdded: () => void;
}

export const QuickAddAgent: React.FC<QuickAddAgentProps> = ({ onAgentAdded }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [waveNumber, setWaveNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErrorMessage('Name and Email are required.');
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const success = await googleSheetService.addSingleUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        waveNumber: waveNumber.trim(),
        role: 'agent',
      });

      if (success) {
        setSuccessMessage(`Successfully onboarded Agent "${name.trim()}"!`);
        setName('');
        setEmail('');
        setWaveNumber('');
        onAgentAdded();
      } else {
        setErrorMessage('Failed to onboard agent. Please check your network or spreadsheet connection.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'A critical error occurred while onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="quick-add-agent-container" className="w-full max-w-4xl mx-auto bg-tp-navy/90 backdrop-blur-xl border border-white/10 rounded-[36px] p-8 md:p-10 shadow-2xl relative overflow-hidden transition-all text-white my-6">
      {/* Aesthetic background mesh glow */}
      <div id="quick-add-glow" className="absolute -top-12 -right-12 w-48 h-48 bg-tp-red/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-tp-red font-black uppercase text-[10px] tracking-[0.3em] mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Fast Onboarding
          </div>
          <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Quick Add Agent</h3>
          <p className="text-white/50 text-xs font-semibold leading-relaxed mt-1">
            Instantly enroll a single agent into the spreadsheet and authorize immediate training access.
          </p>
        </div>
        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner flex-shrink-0">
          <UserPlus className="w-6 h-6 text-white/80" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60 block pl-1">Full Name</label>
            <input
              id="quick-add-name-input"
              type="text"
              required
              placeholder="e.g. Salim Al Mansoori"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 text-white placeholder-white/20 border border-white/10 font-bold text-xs uppercase tracking-widest px-5 py-4 rounded-xl outline-none focus:ring-2 focus:ring-tp-red focus:border-transparent shadow-xl transition-all"
            />
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60 block pl-1">Email Address</label>
            <input
              id="quick-add-email-input"
              type="email"
              required
              placeholder="e.g. salim@etihad.ae"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 text-white placeholder-white/20 border border-white/10 font-bold text-xs px-5 py-4 rounded-xl outline-none focus:ring-2 focus:ring-tp-red focus:border-transparent shadow-xl transition-all"
            />
          </div>

          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60 block pl-1">Wave Number (Optional)</label>
            <input
              id="quick-add-wave-input"
              type="text"
              placeholder="e.g. Wave 4B"
              value={waveNumber}
              onChange={(e) => setWaveNumber(e.target.value)}
              className="w-full bg-white/5 text-white placeholder-white/20 border border-white/10 font-bold text-xs uppercase tracking-widest px-5 py-4 rounded-xl outline-none focus:ring-2 focus:ring-tp-red focus:border-transparent shadow-xl transition-all"
            />
          </div>
        </div>

        {/* Messaging Feedback alerts */}
        {successMessage && (
          <div id="quick-add-success-alert" className="bg-green-500/10 border border-green-500/30 p-4 rounded-2xl flex items-start gap-3 w-full animate-fadeIn">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-400 font-bold text-[11px] uppercase tracking-wider">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div id="quick-add-error-alert" className="bg-tp-red/10 border border-tp-red/30 p-4 rounded-2xl flex items-start gap-3 w-full animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-tp-red flex-shrink-0 mt-0.5" />
            <p className="text-tp-red font-bold text-[11px] uppercase tracking-wider">{errorMessage}</p>
          </div>
        )}

        <div className="flex md:justify-end pt-2">
          <button
            id="quick-add-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto bg-tp-red text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-white hover:text-tp-navy transition-all inline-flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Onboarding...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Onboard Agent
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuickAddAgent;
