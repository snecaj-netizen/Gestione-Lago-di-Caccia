import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { 
  updateUserProfile, 
  subscribeToTransactions, 
  subscribeToUsers, 
  subscribeToSettings 
} from '../services';
import { Transaction, UserProfile, LakeSettings } from '../types';
import { User, Mail, Shield, CheckCircle2, AlertCircle, Lock, Wallet, Target, TrendingUp, Eye, EyeOff, Cake, Calendar, ZoomIn, ZoomOut, RotateCcw, Save, Users as UsersIcon } from 'lucide-react';
import { cn, formatUserName } from '../lib/utils';
import { safeLocalStorage } from '../lib/safeLocalStorage';

export function Profile() {
  const { profile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Users & Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<LakeSettings | null>(null);

  useEffect(() => {
    const unsub1 = subscribeToTransactions(setTransactions);
    const unsub2 = subscribeToUsers(setUsers);
    const unsub3 = subscribeToSettings(setSettings);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  // For Admin / Socio: can view/edit any hunter's profile and set their quota
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'socio';
  const paramUid = searchParams.get('uid');
  const [selectedUid, setSelectedUid] = useState<string>(() => paramUid || profile?.uid || '');

  useEffect(() => {
    if (paramUid && paramUid !== selectedUid) {
      setSelectedUid(paramUid);
    }
  }, [paramUid]);

  const targetUser = isPrivileged && selectedUid && selectedUid !== profile?.uid
    ? (users.find(u => u.uid === selectedUid) || profile)
    : profile;

  const [displayName, setDisplayName] = useState(targetUser?.displayName || '');
  const [email, setEmail] = useState(targetUser?.email || '');
  const [username, setUsername] = useState(targetUser?.username || '');
  const [password, setPassword] = useState(targetUser?.password || '');
  const [birthDate, setBirthDate] = useState(targetUser?.birthDate || '');
  const [seasonalQuota, setSeasonalQuota] = useState<number>(targetUser?.seasonalQuota || 0);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [quotaSaveStatus, setQuotaSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const defaultFontSize = 120;

  const [fontSize, setFontSize] = useState<number>(() => {
    if (user?.uid) {
      const userSpecific = safeLocalStorage.getItem(`lake_font_size_${user.uid}`);
      if (userSpecific) {
        const val = parseInt(userSpecific, 10);
        if (!isNaN(val)) return val;
      }
    }
    if (profile?.fontSize) {
      return profile.fontSize;
    }
    const saved = safeLocalStorage.getItem('lake_font_size');
    return saved ? parseInt(saved, 10) : defaultFontSize;
  });

  // Keep font size in sync with user profile or storage
  useEffect(() => {
    const activeUid = user?.uid || profile?.uid;
    if (activeUid) {
      const userSpecific = safeLocalStorage.getItem(`lake_font_size_${activeUid}`);
      const val = userSpecific 
        ? parseInt(userSpecific, 10) 
        : (profile?.fontSize || (safeLocalStorage.getItem('lake_font_size') ? parseInt(safeLocalStorage.getItem('lake_font_size')!, 10) : defaultFontSize));
      if (!isNaN(val) && val >= 80 && val <= 160) {
        setFontSize(val);
        document.documentElement.style.fontSize = `${(val / 100) * 16}px`;
      }
    }
  }, [user?.uid, profile?.uid, profile?.fontSize]);

  const changeFontSize = (delta: number) => {
    const newSize = Math.min(150, Math.max(85, fontSize + delta));
    setFontSize(newSize);
    safeLocalStorage.setItem('lake_font_size', newSize.toString());
    const activeUid = user?.uid || profile?.uid;
    if (activeUid) {
      safeLocalStorage.setItem(`lake_font_size_${activeUid}`, newSize.toString());
      updateUserProfile(activeUid, { fontSize: newSize } as any).catch(() => {});
    }
    document.documentElement.style.fontSize = `${(newSize / 100) * 16}px`;
  };

  const resetFontSize = () => {
    setFontSize(defaultFontSize);
    safeLocalStorage.setItem('lake_font_size', defaultFontSize.toString());
    const activeUid = user?.uid || profile?.uid;
    if (activeUid) {
      safeLocalStorage.setItem(`lake_font_size_${activeUid}`, defaultFontSize.toString());
      updateUserProfile(activeUid, { fontSize: defaultFontSize } as any).catch(() => {});
    }
    document.documentElement.style.fontSize = `${(defaultFontSize / 100) * 16}px`;
  };

  // Synchronize fields whenever targetUser changes
  useEffect(() => {
    if (targetUser) {
      setDisplayName(targetUser.displayName || '');
      setEmail(targetUser.email || '');
      setUsername(targetUser.username || '');
      setPassword(targetUser.password || '');
      setBirthDate(targetUser.birthDate || '');
      setSeasonalQuota(targetUser.seasonalQuota || 0);
    }
  }, [targetUser]);

  // Quota & Stats calculation: based EXCLUSIVELY on hunter's profile quota
  const hunterStats = React.useMemo(() => {
    if (!targetUser || (targetUser.role !== 'quotista' && !targetUser.seasonalQuota)) return null;

    // Quota comes SOLELY from hunter's profile
    const targetQuota = targetUser.seasonalQuota || 0;

    const paid = transactions
      .filter(t => t.type === 'entrata' && t.payerUid === targetUser.uid)
      .reduce((acc, t) => acc + t.amount, 0);

    const balance = targetQuota - paid;
    const progress = targetQuota > 0 ? (paid / targetQuota) * 100 : 0;

    return { targetQuota, paid, balance, progress };
  }, [targetUser, transactions]);

  const handleSaveQuotaDirect = async (overrideVal?: number) => {
    if (!targetUser) return;
    const quotaVal = typeof overrideVal === 'number' ? overrideVal : (Number(seasonalQuota) || 0);
    setQuotaSaving(true);
    try {
      await updateUserProfile(targetUser.uid, {
        seasonalQuota: quotaVal
      });
      setQuotaSaveStatus('success');
      setTimeout(() => setQuotaSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Quota save error:", error);
      setQuotaSaveStatus('error');
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !displayName.trim()) return;
    
    setStatus('saving');
    try {
      const updates: Partial<UserProfile> = {
        displayName: displayName.trim(),
        email: email.trim(),
        username: username.trim(),
        password: password,
        birthDate: birthDate.trim()
      };

      if (isPrivileged) {
        updates.seasonalQuota = Number(seasonalQuota) || 0;
      }

      await updateUserProfile(targetUser.uid, updates);

      // Update remembered credentials if active and editing own account
      if (targetUser.uid === profile?.uid && safeLocalStorage.getItem('lake_remember_me') === 'true') {
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">
            {targetUser?.uid === profile?.uid ? 'Il Mio Profilo' : `Profilo: ${formatUserName(targetUser?.displayName || '')}`}
          </h1>
          <p className="text-slate-gray font-medium">
            {targetUser?.uid === profile?.uid 
              ? 'Gestisci le tue informazioni personali e controlla la tua quota' 
              : 'Gestisci le informazioni e imposta la quota per questo cacciatore'}
          </p>
        </div>

        {/* Hunter Selector for Admins / Soci */}
        {isPrivileged && (
          <div className="flex items-center gap-2">
            <select
              value={selectedUid}
              onChange={(e) => {
                const uid = e.target.value;
                setSelectedUid(uid);
                if (uid === profile?.uid) {
                  searchParams.delete('uid');
                } else {
                  searchParams.set('uid', uid);
                }
                setSearchParams(searchParams);
              }}
              className="bg-white border-2 border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-lake-green shadow-xs cursor-pointer"
            >
              <option value={profile?.uid}>👤 Il Mio Profilo ({profile?.displayName})</option>
              <optgroup label="Cacciatori Quotisti">
                {users.filter(u => u.isActive && u.role === 'quotista').map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} {u.seasonalQuota ? `(Quota: €${u.seasonalQuota.toLocaleString()})` : '(Nessuna quota)'}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Soci & Amministratori">
                {users.filter(u => u.isActive && (u.role === 'socio' || u.role === 'admin') && u.uid !== profile?.uid).map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName} ({u.role})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}
      </header>

      {/* Target Hunter Switcher Banner */}
      {isPrivileged && targetUser?.uid !== profile?.uid && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-emerald-600 shrink-0" />
            <span>
              Stai visualizzando il profilo di <strong>{targetUser?.displayName}</strong>. Puoi impostare la sua quota direttamente dal box sottostante.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedUid(profile?.uid || '');
              searchParams.delete('uid');
              setSearchParams(searchParams);
            }}
            className="text-[10px] font-bold text-emerald-700 underline hover:text-emerald-900 shrink-0 ml-2"
          >
            Torna al mio profilo
          </button>
        </div>
      )}

      <div className="card-polish !p-0 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-off-white/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-lake-green rounded flex items-center justify-center font-black text-accent-gold text-xl sm:text-2xl border-2 border-accent-gold/20 shadow-lg shrink-0">
              {targetUser?.displayName?.[0]}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-gray leading-none mb-1.5">{targetUser?.displayName}</h2>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className={cn(
                  "text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-widest",
                  targetUser?.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                )}>
                  {targetUser?.isActive ? 'Account Attivo' : 'In Attesa'}
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-400 tracking-widest flex items-center gap-1">
                  <Shield size={10} /> {targetUser?.role === 'socio' ? 'Socio' : targetUser?.role === 'admin' ? 'Amministratore' : 'Quotista'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quota Management Box for Quotisti or when viewing any hunter */}
        {(targetUser?.role === 'quotista' || isPrivileged) && (
          <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-transparent border-b border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-lake-green uppercase tracking-widest flex items-center gap-2 mb-1">
                  <Wallet size={15} /> Quota Individuale Cacciatore
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">
                  {isPrivileged 
                    ? "La quota per singolo cacciatore si imposta qui dal profilo. Tutti i calcoli e le quote giornaliere si basano su questa cifra."
                    : "La tua quota stagionale concordata e gestita nel profilo."}
                </p>
              </div>

              {isPrivileged ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">€</span>
                    <input 
                      type="number"
                      value={seasonalQuota || ''}
                      onChange={(e) => setSeasonalQuota(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 sm:w-32 bg-white border border-slate-300 rounded pl-7 pr-3 py-1.5 text-sm font-black text-slate-900 outline-none focus:border-lake-green shadow-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveQuotaDirect()}
                    disabled={quotaSaving}
                    className="bg-lake-green hover:bg-lake-green/90 text-white px-3 py-1.5 rounded font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={12} />
                    {quotaSaving ? 'Salvataggio...' : 'Salva Quota'}
                  </button>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Quota Fissata</span>
                  <p className="text-xl font-black text-lake-green">€{(targetUser?.seasonalQuota || 0).toLocaleString()}</p>
                </div>
              )}
            </div>

            {quotaSaveStatus === 'success' && (
              <div className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-3 py-1.5 rounded flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 size={13} /> Quota cacciatore salvata nel profilo con successo!
              </div>
            )}
            {quotaSaveStatus === 'error' && (
              <div className="text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-3 py-1.5 rounded flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle size={13} /> Errore durante il salvataggio della quota. Riprova.
              </div>
            )}
          </div>
        )}

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

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Cake size={10} className="text-accent-gold" /> Data di Nascita
              </label>
              <input 
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-lake-green transition-all"
              />
              <p className="text-[9px] text-slate-400 font-medium">Inserisci la tua data di nascita per ricevere gli auguri dal gruppo del Lago!</p>
            </div>

            {/* Font Size Accessibility Setting */}
            <div className="md:col-span-2 border-t border-slate-100 pt-6 mt-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <ZoomIn size={16} className="text-accent-gold" />
                Dimensione Testo & Accessibilità
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Regola la grandezza dei caratteri dell'applicazione per una lettura ottimale su smartphone (Default: <strong>120%</strong>).
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-off-white p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => changeFontSize(-5)}
                    disabled={fontSize <= 85}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl transition-all text-slate-700 active:scale-95 cursor-pointer"
                    title="Riduci font"
                    aria-label="Riduci font"
                  >
                    <ZoomOut size={16} />
                  </button>
                  
                  <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl text-center min-w-[80px] shadow-sm">
                    <span className="text-base font-black text-lake-green">{fontSize}%</span>
                    {fontSize === defaultFontSize && (
                      <span className="block text-[9px] text-accent-gold font-bold uppercase tracking-wider">Default</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => changeFontSize(5)}
                    disabled={fontSize >= 150}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-xl transition-all text-slate-700 active:scale-95 cursor-pointer"
                    title="Ingrandisci font"
                    aria-label="Ingrandisci font"
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetFontSize}
                  className="px-3.5 py-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 active:scale-95 cursor-pointer border border-slate-200"
                  title="Ripristina 120%"
                >
                  <RotateCcw size={14} />
                  Ripristina (120%)
                </button>
              </div>
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
