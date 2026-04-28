import React, { useState, useEffect } from 'react';
import { subscribeToUsers, updateUserProfile, subscribeToSettings, updateSettings, addUserManually, deleteUser, subscribeToHuntingTimes, addHuntingTime, deleteHuntingTime, updateHuntingTime } from '../services';
import { UserProfile, LakeSettings, HuntingTime } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Shield, UserCheck, UserX, Trash2, Mail, ShieldAlert, MapPin, Calendar, Save, UserPlus, X, Wallet, Plus, Clock, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function AdminPanel() {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<LakeSettings | null>(null);
  const [huntingTimes, setHuntingTimes] = useState<HuntingTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [newTime, setNewTime] = useState<Omit<HuntingTime, 'id'>>({
    startDate: '',
    endDate: '',
    startTime: '06:00',
    endTime: '19:00'
  });
  const [mapsLink, setMapsLink] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [userCreatedStatus, setUserCreatedStatus] = useState<'idle' | 'success'>('idle');
  const [extractError, setExtractError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState<Omit<UserProfile, 'uid' | 'isActive'>>({
    displayName: '',
    email: '',
    username: '',
    password: '',
    role: 'quotista',
    assignedDaysOfWeek: []
  });

  useEffect(() => {
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubSettings = subscribeToSettings((data) => {
      setSettings(data);
      setLoading(false);
    });
    const unsubHuntingTimes = subscribeToHuntingTimes(setHuntingTimes);

    return () => {
      unsubUsers();
      unsubSettings();
      unsubHuntingTimes();
    };
  }, []);

  const toggleActive = async (user: UserProfile) => {
    await updateUserProfile(user.uid, { isActive: !user.isActive });
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    const uid = userToDelete.uid;
    console.log("Deleting user with UID:", uid);
    
    if (uid === currentUser?.uid) {
      alert("Non puoi eliminare il tuo stesso account.");
      setShowDeleteConfirm(false);
      return;
    }

    try {
      await deleteUser(uid);
      console.log("User successfully deleted from Firestore");
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      // Small feedback
      alert("Utente eliminato correttamente.");
    } catch (error) {
      console.error("Delete error:", error);
      alert("Errore durante l'eliminazione dell'utente. Verifica i permessi o la connessione.");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.displayName.trim() || !newUser.email.trim()) return;
    await addUserManually({
      displayName: newUser.displayName.trim(),
      email: newUser.email.trim(),
      username: newUser.username?.trim() || newUser.email.trim(),
      password: newUser.password?.trim() || '',
      role: newUser.role,
      isActive: true,
      assignedDaysOfWeek: newUser.assignedDaysOfWeek
    });
    setUserCreatedStatus('success');
    setTimeout(() => {
      setShowAddModal(false);
      setUserCreatedStatus('idle');
      setNewUser({ displayName: '', email: '', username: '', password: '', role: 'quotista', assignedDaysOfWeek: [] });
    }, 2000);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser.displayName.trim() || !editingUser.email.trim()) return;
    await updateUserProfile(editingUser.uid, {
      displayName: editingUser.displayName.trim(),
      email: editingUser.email.trim(),
      username: editingUser.username?.trim(),
      password: editingUser.password?.trim(),
      role: editingUser.role,
      assignedDaysOfWeek: editingUser.assignedDaysOfWeek
    });
    setShowEditModal(false);
    setEditingUser(null);
  };

  const changeRole = async (user: UserProfile, role: UserProfile['role']) => {
    await updateUserProfile(user.uid, { role });
  };

  const toggleDay = (currentDays: number[], dayIdx: number) => {
    if (currentDays.includes(dayIdx)) {
      return currentDays.filter(d => d !== dayIdx);
    } else {
      return [...currentDays, dayIdx].sort();
    }
  };

  const changeRecurringDay = async (user: UserProfile, dayIdx: number) => {
    const newDays = toggleDay(user.assignedDaysOfWeek || [], dayIdx);
    await updateUserProfile(user.uid, { assignedDaysOfWeek: newDays });
  };

  const extractCoords = () => {
    if (!mapsLink) return;
    setExtractError(false);
    // Regex matches @lat,lng format commonly found in Google Maps URLs
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = mapsLink.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (settings) {
        setSettings({ ...settings, latitude: lat, longitude: lng });
        setMapsLink('');
      }
    } else {
      setExtractError(true);
      setTimeout(() => setExtractError(false), 5000);
    }
  };

  const handleSettingsUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings) return;
    setSaveStatus('saving');
    const formData = new FormData(e.currentTarget);
    const updates = {
      latitude: parseFloat(formData.get('latitude') as string),
      longitude: parseFloat(formData.get('longitude') as string),
      seasonStart: formData.get('seasonStart') as string,
      seasonEnd: formData.get('seasonEnd') as string
    };
    try {
      await updateSettings(updates);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    }
  };

  const itDays = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <ShieldAlert size={64} className="text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900">Accesso Negato</h1>
        <p className="text-slate-500">Solo Stefano può accedere a questa sezione.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Pannello di Controllo</h1>
          <p className="text-slate-gray font-medium">Gestione utenti, permessi e attivazioni account</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="card-polish flex flex-col gap-2">
          <span className="text-[0.6rem] font-bold text-slate-gray uppercase tracking-widest leading-none">Utenti</span>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tighter">{users.length}</p>
        </div>
        <div className="card-polish flex flex-col gap-2">
          <span className="text-[0.6rem] font-bold text-lake-green uppercase tracking-widest leading-none">Soci</span>
          <p className="text-2xl sm:text-3xl font-bold text-lake-green tracking-tighter">
            {users.filter(u => u.role === 'socio' && u.isActive).length}
          </p>
        </div>
        <div className="card-polish flex flex-col gap-2">
          <span className="text-[0.6rem] font-bold text-accent-gold uppercase tracking-widest leading-none">Quotisti</span>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tighter">
            {users.filter(u => u.role === 'quotista' && u.isActive).length}
          </p>
        </div>
        <div className="card-polish flex flex-col gap-2">
          <span className="text-[0.6rem] font-bold text-rose-500 uppercase tracking-widest leading-none">Inattivi</span>
          <p className="text-2xl sm:text-3xl font-bold text-rose-700 tracking-tighter">
            {users.filter(u => !u.isActive).length}
          </p>
        </div>
      </div>

      <section className="card-polish !p-0 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-off-white/50">
          <h2 className="text-sm font-bold text-slate-gray uppercase tracking-widest mb-0.5">Gestione Utenti</h2>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Gestisci ruoli, attivazioni e giornate fisse.</p>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[320px]">
            <thead className="bg-off-white border-b border-slate-100">
              <tr className="text-[0.6rem] sm:text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-3 sm:px-6 py-3">Utente</th>
                <th className="px-3 sm:px-6 py-3 text-center hidden sm:table-cell">Stato</th>
                <th className="px-3 sm:px-6 py-3">Ruolo</th>
                <th className="px-3 sm:px-6 py-3 hidden md:table-cell">Giorno Fisso</th>
                <th className="px-3 sm:px-6 py-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-10 text-center text-slate-300 italic font-medium">Caricamento utenti...</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.uid || user.email} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-100 rounded flex items-center justify-center font-bold text-slate-400 text-[10px] sm:text-xs border border-slate-200 shrink-0">
                        {user.displayName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-none mb-0.5 truncate max-w-[80px] sm:max-w-none">{user.displayName}</p>
                        <p className="text-[9px] text-slate-400 font-medium tracking-tight truncate hidden sm:block">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-center whitespace-nowrap hidden sm:table-cell">
                    <span className={cn(
                      "text-[8px] sm:text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border",
                      user.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                    )}>
                      {user.isActive ? 'Attivo' : 'Attesa'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                    <select 
                      disabled={user.uid === currentUser?.uid}
                      value={user.role}
                      onChange={(e) => changeRole(user, e.target.value as any)}
                      className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase text-slate-gray focus:border-lake-green outline-none disabled:opacity-50"
                    >
                      <option value="quotista">Quotista</option>
                      <option value="socio">Socio</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-3 sm:px-6 py-3 whitespace-nowrap hidden md:table-cell">
                    <div className="flex gap-1">
                      {itDays.map((day, idx) => (
                        <button
                          key={day}
                          onClick={() => changeRecurringDay(user, idx)}
                          className={cn(
                            "w-5 h-5 rounded-full text-[8px] font-black flex items-center justify-center transition-all",
                            (user.assignedDaysOfWeek || []).includes(idx)
                              ? "bg-lake-green text-white shadow-sm"
                              : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                          )}
                          title={day}
                        >
                          {day[0]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        disabled={user.uid === currentUser?.uid}
                        onClick={() => toggleActive(user)}
                        className={cn(
                          "text-[8px] sm:text-[9px] font-bold uppercase px-2 py-1 rounded transition-all active:scale-95 disabled:opacity-50",
                          user.isActive 
                            ? "text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100" 
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        )}
                      >
                        {user.isActive ? (
                          <span className="hidden sm:inline">Blocca</span>
                        ) : (
                          <span className="hidden sm:inline">Attiva</span>
                        )}
                        {user.isActive ? (
                          <span className="sm:hidden">OFF</span>
                        ) : (
                          <span className="sm:hidden">ON</span>
                        )}
                      </button>
                      <button 
                         disabled={user.uid === currentUser?.uid}
                         onClick={() => {
                           setUserToDelete(user);
                           setShowDeleteConfirm(true);
                         }}
                         className="p-1 text-slate-300 hover:text-rose-600"
                      >
                        <Trash2 size={12} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                      <button 
                         onClick={() => {
                           setEditingUser(user);
                           setShowEditModal(true);
                         }}
                         className="p-1 text-slate-300 hover:text-lake-green"
                      >
                         <Save size={12} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {settings && (
        <section className="card-polish !border-t-lake-green">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-lake-green" />
              <h2 className="text-lg font-bold text-slate-gray uppercase tracking-widest">Configurazione Lago & Stagione</h2>
            </div>
            {saveStatus === 'success' && (
              <span className="text-[0.6rem] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded border border-emerald-100 flex items-center gap-1">
                <Shield size={10} /> IMPOSTAZIONI SALVATE CON SUCCESSO
              </span>
            )}
          </div>

          <div className="mb-8 p-4 bg-off-white rounded border border-slate-100">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest block mb-2">Estrai da Google Maps</label>
          <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text"
                placeholder="Incolla qui il link di Google Maps..."
                value={mapsLink}
                onChange={(e) => setMapsLink(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-sm font-medium text-slate-gray outline-none focus:border-lake-green"
              />
              <button 
                onClick={extractCoords}
                className="bg-slate-700 text-white font-black text-[0.6rem] uppercase tracking-widest px-4 py-3 sm:py-2 rounded shadow hover:bg-slate-800 transition-all whitespace-nowrap"
              >
                Estrai Coordinate
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic font-medium">Incolla l'URL completo di Google Maps per aggiornare automaticamente Latitudine e Longitudine.</p>
            {extractError && (
              <p className="text-[10px] text-rose-500 mt-1 font-bold">Link non valido. Assicurati che contenga le coordinate (es. @45.123,9.123).</p>
            )}
          </div>
          
          <form onSubmit={handleSettingsUpdate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <MapPin size={10} /> Latitudine
              </label>
              <input 
                name="latitude"
                type="number"
                step="any"
                defaultValue={settings.latitude}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <MapPin size={10} /> Longitudine
              </label>
              <input 
                name="longitude"
                type="number"
                step="any"
                defaultValue={settings.longitude}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={10} /> Inizio Stagione
              </label>
              <input 
                name="seasonStart"
                type="date"
                defaultValue={settings.seasonStart}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={10} /> Fine Stagione
              </label>
              <input 
                name="seasonEnd"
                type="date"
                defaultValue={settings.seasonEnd}
                className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
              />
            </div>
            <div className="lg:col-start-3 md:col-start-2">
              <button 
                type="submit"
                disabled={saveStatus === 'saving'}
                className="w-full bg-lake-green text-accent-gold font-black text-[0.6rem] uppercase tracking-widest py-3 rounded shadow hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={14} /> {saveStatus === 'saving' ? 'Salvataggio...' : 'Salva Impostazioni'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Hunting Times Management Section */}
      <section className="card-polish !border-t-accent-gold">
        <div className="flex items-center gap-2 mb-6">
          <Clock size={18} className="text-accent-gold" />
          <h2 className="text-lg font-bold text-slate-gray uppercase tracking-widest">Orari e Periodi di Caccia</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Add Form */}
          <div className="p-5 bg-off-white/50 rounded-lg border border-slate-100 h-fit">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
              {editingTimeId ? 'Modifica Periodo' : 'Aggiungi Nuovo Periodo'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Data Inizio</label>
                <input 
                  type="date"
                  value={newTime.startDate}
                  onChange={(e) => setNewTime({...newTime, startDate: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-lake-green"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Data Fine</label>
                <input 
                  type="date"
                  value={newTime.endDate}
                  onChange={(e) => setNewTime({...newTime, endDate: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-lake-green"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Orario Inizio</label>
                <input 
                  type="time"
                  value={newTime.startTime}
                  onChange={(e) => setNewTime({...newTime, startTime: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-lake-green"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Orario Fine</label>
                <input 
                  type="time"
                  value={newTime.endTime}
                  onChange={(e) => setNewTime({...newTime, endTime: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-lake-green"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={async () => {
                  if (!newTime.startDate || !newTime.endDate || !newTime.startTime || !newTime.endTime) return;
                  if (editingTimeId) {
                    await updateHuntingTime(editingTimeId, newTime);
                    setEditingTimeId(null);
                  } else {
                    await addHuntingTime(newTime);
                  }
                  setNewTime({ startDate: '', endDate: '', startTime: '06:00', endTime: '19:00' });
                }}
                className="flex-1 bg-lake-green text-white font-black text-[0.6rem] uppercase tracking-widest py-3 rounded shadow hover:bg-opacity-95 transition-all flex items-center justify-center gap-2"
              >
                {editingTimeId ? <Save size={14} /> : <Plus size={14} />} {editingTimeId ? 'Aggiorna' : 'Salva'}
              </button>
              {editingTimeId && (
                <button 
                  onClick={() => {
                    setEditingTimeId(null);
                    setNewTime({ startDate: '', endDate: '', startTime: '06:00', endTime: '19:00' });
                  }}
                  className="bg-slate-200 text-slate-600 px-4 rounded shadow hover:bg-slate-300 transition-all font-black text-[0.6rem] uppercase tracking-widest"
                >
                  Annulla
                </button>
              )}
            </div>
          </div>

          {/* List Table */}
          <div className="overflow-x-auto scrollbar-hide border border-slate-100 rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-slate-100">
                <tr className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-4 py-2">Periodo</th>
                  <th className="px-4 py-2">Orario</th>
                  <th className="px-4 py-2 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {huntingTimes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[10px] text-slate-300 italic font-medium">Nessun periodo configurato.</td>
                  </tr>
                ) : huntingTimes.map((time) => (
                  <tr key={time.id} className={cn("hover:bg-slate-50 transition-colors", editingTimeId === time.id && "bg-emerald-50/50")}>
                    <td className="px-4 py-1.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-900">
                          {format(new Date(time.startDate), 'dd MMM', { locale: it })} - {format(new Date(time.endDate), 'dd MMM', { locale: it })}
                        </span>
                        <span className="text-[8px] font-medium text-slate-400 uppercase tracking-tight">{format(new Date(time.startDate), 'yyyy')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-1.5 whitespace-nowrap">
                      <span className="text-xs font-black text-lake-green bg-emerald-50 px-2 py-1 rounded">
                        {time.startTime} - {time.endTime}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-right flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingTimeId(time.id);
                          setNewTime({
                            startDate: time.startDate,
                            endDate: time.endDate,
                            startTime: time.startTime,
                            endTime: time.endTime
                          });
                        }}
                        className="p-1 text-slate-400 hover:text-lake-green transition-colors"
                        title="Modifica"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteHuntingTime(time.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                        title="Elimina"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent-gold text-lake-green rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-4 border-white"
      >
        <Plus size={32} />
      </button>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-10 max-w-md w-full shadow-2xl border-t-8 border-accent-gold relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={24} />
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-off-white p-3 rounded border border-slate-100 text-lake-green">
                  <UserPlus size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-lake-green leading-none mb-1">Nuovo Utente</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Inserimento manuale socio/quotista</p>
                </div>
              </div>

              <form onSubmit={handleAddUser} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
                  <input 
                    required
                    type="text"
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                    className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                    placeholder="Es. Roberto Rossi"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Email</label>
                  <input 
                    required
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                    placeholder="roberto.rossi@email.it"
                  />
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Nome Utente</label>
                      <input 
                        type="text"
                        value={newUser.username}
                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                        className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                        placeholder="Nome utente per login"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Password</label>
                      <input 
                        type="text"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                        placeholder="Password"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Ruolo Predefinito</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                    className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green appearance-none"
                  >
                    <option value="quotista">Quotista</option>
                    <option value="socio">Socio</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Giornate Venatorie Fisse</label>
                  <div className="grid grid-cols-7 gap-1">
                    {itDays.map((day, idx) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setNewUser({ ...newUser, assignedDaysOfWeek: toggleDay(newUser.assignedDaysOfWeek, idx) })}
                        className={cn(
                          "py-3 rounded text-[10px] font-black uppercase transition-all border",
                          newUser.assignedDaysOfWeek.includes(idx)
                            ? "bg-lake-green text-white border-lake-green shadow-md scale-105"
                            : "bg-off-white text-slate-400 border-slate-100 hover:border-lake-green/30"
                        )}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 italic">Clicca per selezionare uno o più giorni fissi.</p>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  {userCreatedStatus === 'success' && (
                    <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded p-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2 mb-2">
                      <UserCheck size={14} /> Utente inserito con successo!
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        setUserCreatedStatus('idle');
                      }}
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[0.6rem] uppercase tracking-widest rounded transition-all"
                    >
                      Annulla
                    </button>
                    <button 
                      disabled={userCreatedStatus === 'success'}
                      type="submit"
                      className={cn(
                        "flex-1 py-4 font-black text-[0.6rem] uppercase tracking-widest rounded shadow-lg transition-all",
                        userCreatedStatus === 'success' ? "bg-emerald-600 text-white" : "bg-lake-green text-accent-gold hover:bg-opacity-90 active:scale-95"
                      )}
                    >
                      {userCreatedStatus === 'success' ? 'Inserito' : 'Crea Profilo'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-md">
          <div className="bg-white rounded-lg p-6 sm:p-10 max-w-md w-full shadow-2xl border-t-8 border-lake-green relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => { setShowEditModal(false); setEditingUser(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-off-white p-3 rounded border border-slate-100 text-lake-green">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-xl font-serif text-lake-green leading-none mb-1">Modifica Utente</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Aggiorna dati di {editingUser.displayName}</p>
              </div>
            </div>

            <form onSubmit={handleEditUser} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Nome Completo</label>
                <input 
                  required
                  type="text"
                  value={editingUser.displayName}
                  onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                  className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Email</label>
                <input 
                  required
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Nome Utente</label>
                    <input 
                      type="text"
                      value={editingUser.username || ''}
                      onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Password</label>
                    <input 
                      type="text"
                      value={editingUser.password || ''}
                      onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Ruolo</label>
                <select 
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                  className="w-full bg-off-white border border-slate-200 rounded px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-lake-green appearance-none"
                >
                  <option value="quotista">Quotista</option>
                  <option value="socio">Socio</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Giornate Venatorie Fisse</label>
                <div className="grid grid-cols-7 gap-1">
                  {itDays.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setEditingUser({ ...editingUser, assignedDaysOfWeek: toggleDay(editingUser.assignedDaysOfWeek || [], idx) })}
                      className={cn(
                        "py-3 rounded text-[10px] font-black uppercase transition-all border",
                        (editingUser.assignedDaysOfWeek || []).includes(idx)
                          ? "bg-lake-green text-white border-lake-green shadow-md scale-105"
                          : "bg-off-white text-slate-400 border-slate-100 hover:border-lake-green/30"
                      )}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 italic">Clicca per selezionare uno o più giorni fissi.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[0.6rem] uppercase tracking-widest rounded transition-all"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-lake-green text-accent-gold font-black text-[0.6rem] uppercase tracking-widest rounded shadow-lg hover:bg-opacity-90 active:scale-95 transition-all"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && userToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-rose-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border-t-8 border-rose-500 relative"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4 text-rose-500">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-serif text-slate-900 mb-2">Conferma Eliminazione</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Sei sicuro di voler eliminare <span className="font-bold text-slate-900">{userToDelete.displayName}</span> ({userToDelete.email})? 
                  <br />
                  <span className="text-rose-600 font-bold mt-2 block">Questa azione è irreversibile.</span>
                </p>

                <div className="flex w-full gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setUserToDelete(null);
                    }}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[0.6rem] uppercase tracking-widest rounded transition-all"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-[0.6rem] uppercase tracking-widest rounded transition-all shadow-lg shadow-rose-200"
                  >
                    Elimina Utente
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
