import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  updateUserProfile, 
  subscribeToTransactions, 
  subscribeToUsers, 
  subscribeToSettings 
} from '../services';
import { Transaction, UserProfile, LakeSettings } from '../types';
import { User, Mail, Shield, CheckCircle2, AlertCircle, Lock, Wallet, Target, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { safeLocalStorage } from '../lib/safeLocalStorage';

export function Profile() {
  const { profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [password, setPassword] = useState(profile?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Synchronize fields whenever profile is loaded or changed
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setEmail(profile.email || '');
      setUsername(profile.username || '');
      setPassword(profile.password || '');
    }
  }, [profile]);

  // Quota Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<LakeSettings | null>(null);

  useEffect(() => {
    if (profile?.role === 'quotista') {
      const unsub1 = subscribeToTransactions(setTransactions);
      const unsub2 = subscribeToUsers(setUsers);
      const unsub3 = subscribeToSettings(setSettings);
      return () => { unsub1(); unsub2(); unsub3(); };
    }
  }, [profile?.role]);

  const hunterStats = React.useMemo(() => {
    if (!profile || profile.role !== 'quotista') return null;

    // Calculate how many hunters per day to divide the quota
    const activeHunters = users.filter(u => u.isActive && u.role === 'quotista');
    const huntersPerDay: Record<number, number> = {};
    activeHunters.forEach(u => {
      (u.assignedDaysOfWeek || []).forEach(dayIdx => {
        if (dayIdx !== 3 && dayIdx !== 6) {
          huntersPerDay[dayIdx] = (huntersPerDay[dayIdx] || 0) + 1;
        }
      });
    });

    let targetQuota = profile.seasonalQuota || 0;
    if (targetQuota === 0) {
      (profile.assignedDaysOfWeek || []).forEach(dayIdx => {
        if (dayIdx === 3 || dayIdx === 6) return;
        const dayTotal = settings?.weekdaySeasonQuotas?.[dayIdx] || 0;
        const participants = huntersPerDay[dayIdx] || 1;
        targetQuota += dayTotal / participants;
      });
    }

    const paid = transactions
      .filter(t => t.type === 'entrata' && t.payerUid === profile.uid)
      .reduce((acc, t) => acc + t.amount, 0);

    const balance = targetQuota - paid;
    const progress = targetQuota > 0 ? (paid / targetQuota) * 100 : 0;

    return { targetQuota, paid, balance, progress };
  }, [profile, users, settings, transactions]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !displayName.trim()) return;
    
    setStatus('saving');
    try {
      await updateUserProfile(profile.uid, { 
        displayName: displayName.trim(),
        email: email.trim(),
        username: username.trim(),
        password: password
      });

      // Update remembered credentials if active
      if (safeLocalStorage.getItem('lake_remember_me') === 'true') {
        if (username.trim()) safeLocalStorage.setItem('lake_username', username.trim());
        if (password) safeLocalStorage.setItem('lake_password', password);
      }

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error("Profile update error:", error);
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-serif text-lake-green">Il Mio Profilo</h1>
        <p className="text-slate-gray font-medium">Gestisci le tue informazioni personali</p>
      </header>

      <div className="card-polish !p-0 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-off-white/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-lake-green rounded flex items-center justify-center font-black text-accent-gold text-xl sm:text-2xl border-2 border-accent-gold/20 shadow-lg shrink-0">
              {profile?.displayName?.[0]}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-gray leading-none mb-1.5">{profile?.displayName}</h2>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className={cn(
                  "text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-widest",
                  profile?.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                )}>
                  {profile?.isActive ? 'Account Attivo' : 'In Attesa'}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 tracking-widest flex items-center gap-1">
                  <Shield size={10} /> {profile?.role === 'socio' ? 'Socio' : profile?.role === 'admin' ? 'Amministratore' : 'Quotista'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {hunterStats && (
          <div className="p-4 sm:p-8 bg-gradient-to-r from-lake-green/5 to-transparent border-b border-slate-100">
            <div className="mb-4">
              <h3 className="text-xs font-black text-lake-green uppercase tracking-widest flex items-center gap-2 mb-1">
                <Wallet size={14} /> Stato Versamenti Quota
              </h3>
              <p className="text-[10px] text-slate-400 font-medium italic">Riepilogo della tua posizione contabile per la stagione corrente.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Quota Totale</span>
                <p className="text-xl font-black text-slate-gray">€{hunterStats.targetQuota.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Totale Versato</span>
                <p className="text-xl font-black text-emerald-600">€{hunterStats.paid.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Saldo Rimanente</span>
                <p className={cn(
                  "text-xl font-black",
                  hunterStats.balance <= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {hunterStats.balance <= 0 ? 'Saldato' : `€${hunterStats.balance.toLocaleString()}`}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avanzamento Pagamento</span>
                <span className="text-[10px] font-black text-lake-green uppercase tracking-widest">{Math.round(hunterStats.progress)}%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className={cn(
                    "h-full transition-all duration-1000",
                    hunterStats.progress >= 100 ? "bg-emerald-500" : "bg-lake-green"
                  )}
                  style={{ width: `${Math.min(100, hunterStats.progress)}%` }}
                />
              </div>
              {hunterStats.balance <= 0 && hunterStats.targetQuota > 0 && (
                <div className="mt-3 flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase tracking-widest">
                  <CheckCircle2 size={14} /> Quota stagionale completata
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleUpdate} className="p-4 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <User size={10} /> Nome Visualizzato
              </label>
              <input 
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-lake-green transition-all"
                placeholder="Inserisci il tuo nome"
              />
              <p className="text-[9px] text-slate-400 font-medium">Questo nome sarà visibile agli altri soci nel calendario.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Mail size={10} /> Indirizzo Email
              </label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-lake-green transition-all"
                placeholder="nome@esempio.com"
              />
              <p className="text-[9px] text-slate-400 font-medium">Usata per comunicazioni importanti.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Shield size={10} /> Nome Utente
              </label>
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-lake-green transition-all"
                placeholder="Il tuo nome utente"
              />
              <p className="text-[9px] text-slate-400 font-medium">Nome usato per accedere al portale.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Lock size={10} /> Password
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 pr-10 text-sm font-semibold text-slate-900 outline-none focus:border-lake-green transition-all"
                  placeholder="La tua password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-lake-green p-1 transition-colors"
                  title={showPassword ? "Nascondi password" : "Mostra password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[9px] text-slate-400 font-medium">Usa una password sicura.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex-1 w-full text-center sm:text-left">
              {status === 'success' && (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 size={14} /> Profilo aggiornato
                </div>
              )}
              {status === 'error' && (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-rose-600 font-bold text-[10px] uppercase tracking-widest">
                  <AlertCircle size={14} /> Errore salvataggio
                </div>
              )}
            </div>
            
            <button 
              type="submit"
              disabled={status === 'saving'}
              className="w-full sm:w-auto bg-lake-green text-accent-gold font-bold text-[0.65rem] uppercase tracking-widest px-8 py-3 rounded shadow-md hover:bg-opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {status === 'saving' ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-amber-50 border-l-4 border-accent-gold p-6 rounded shadow-sm">
        <div className="flex gap-4">
          <ShieldAlert className="text-accent-gold shrink-0" size={24} />
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-1">Nota sulla sicurezza</h4>
            <p className="text-sm text-slate-600 leading-relaxed italic">
              Il tuo ruolo e lo stato di attivazione possono essere modificati solo da Stefano (Admin). 
              Se hai bisogno di cambiare i permessi del tuo account, contatta direttamente la gestione del lago.
              {profile?.role === 'admin' && " In qualità di Amministratore, puoi modificare le credenziali di qualsiasi utente dal pannello Admin."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShieldAlert({ className, size }: { className?: string, size?: number }) {
  return <AlertCircle className={className} size={size} />;
}
