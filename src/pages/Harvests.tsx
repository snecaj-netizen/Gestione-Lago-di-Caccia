import React, { useState, useEffect } from 'react';
import { 
  addHarvest, 
  addHarvestsBatch,
  updateHarvest,
  deleteHarvest,
  subscribeToHarvests,
  subscribeToUsers,
  subscribeToHuntingLimits,
  subscribeToHuntingDays,
  getAssignedHuntersForDate
} from '../services';
import { Harvest, UserProfile, HuntingLimit, HuntingDay } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Target, Trash2, Search, Filter, X, Edit2, User, ChevronDown, ShieldAlert, Users, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

const safeFormatDate = (dateStr: any, formatStr: string, options?: any) => {
  try {
    if (!dateStr) return '---';
    let parsed: Date;
    if (dateStr && typeof dateStr.toDate === 'function') {
      parsed = dateStr.toDate();
    } else {
      parsed = new Date(dateStr);
    }
    if (isNaN(parsed.getTime())) {
      return typeof dateStr === 'string' ? dateStr : '---';
    }
    return format(parsed, formatStr, options);
  } catch (e) {
    return '---';
  }
};

const SPECIES_LIST = [
  'Alzavola',
  'Beccaccino',
  'Canapiglia',
  'Codone',
  'Colombaccio',
  'Fagiano',
  'Fischione',
  'Folaga',
  'Frullino',
  'Gallinella',
  'Germano',
  'Lepre',
  'Marzaiola',
  'Mestolone',
  'Moriglione',
  'Porciglione',
  'Stampi',
  'Altro'
].sort();

export function Harvests() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModalState, setShowModalState] = useState<boolean>(() => searchParams.get('modal') === 'record');
  const [showDeleteConfirmState, setShowDeleteConfirmState] = useState<boolean>(() => searchParams.get('modal') === 'delete');
  const highlightId = searchParams.get('highlight');

  const showModal = showModalState;
  const showDeleteConfirm = showDeleteConfirmState;

  const setShowModal = (val: boolean) => {
    setShowModalState(val);
    if (val) {
      setSearchParams({ modal: 'record' });
    } else {
      setSearchParams({});
    }
  };

  const setShowDeleteConfirm = (val: boolean) => {
    setShowDeleteConfirmState(val);
    if (val) {
      setSearchParams({ modal: 'delete' });
    } else {
      setSearchParams({});
    }
  };

  const [editingItem, setEditingItem] = useState<Harvest | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Harvest | null>(null);
  const [showSpeciesList, setShowSpeciesList] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [limits, setLimits] = useState<HuntingLimit[]>([]);
  const [huntingDays, setHuntingDays] = useState<HuntingDay[]>([]);

  const [formData, setFormData] = useState<{
    date: string;
    species: string;
    count: string;
    hunterUid: string;
    hunterName: string;
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    species: '',
    count: '',
    hunterUid: '',
    hunterName: ''
  });

  useEffect(() => {
    const unsubHarvests = subscribeToHarvests((data) => {
      setItems(data);
      setLoading(false);
    });

    const unsubUsers = subscribeToUsers((data) => {
      const activeHunters = data.filter(u => u.isActive && (u.role === 'admin' || u.role === 'socio' || u.role === 'quotista'));
      setUsers(activeHunters);
    });

    const unsubLimits = subscribeToHuntingLimits(setLimits);
    const unsubHuntingDays = subscribeToHuntingDays(setHuntingDays);

    return () => {
      unsubHarvests();
      unsubUsers();
      unsubLimits();
      unsubHuntingDays();
    };
  }, []);

  useEffect(() => {
    if (highlightId && !loading) {
      const element = document.getElementById(`harvest-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightId, loading]);

  // Calculate assigned hunters for the selected date
  const assignedHuntersForSelectedDate = getAssignedHuntersForDate(formData.date, huntingDays, users);
  
  // Permission check: Admin can insert for any day; Non-admin can only insert if assigned to that day
  const isUserAssignedToSelectedDate = Boolean(profile && assignedHuntersForSelectedDate.some(h => h.uid === profile.uid));
  const canUserInsertForSelectedDate = profile?.role === 'admin' || isUserAssignedToSelectedDate;

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      species: '',
      count: '',
      hunterUid: '',
      hunterName: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (item: Harvest) => {
    setEditingItem(item);
    setFormData({
      date: item.date,
      species: item.species,
      count: item.count ? item.count.toString() : '',
      hunterUid: item.hunterUid,
      hunterName: item.hunterName
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // Check permission for the selected date
    const assignedHunters = getAssignedHuntersForDate(formData.date, huntingDays, users);
    const isAssigned = assignedHunters.some(h => h.uid === profile.uid);

    if (profile.role !== 'admin' && !isAssigned) {
      alert(`Non sei autorizzato a registrare abbattimenti per il ${formData.date}. Possono registrare solo i cacciatori assegnati a questa data o l'amministratore.`);
      return;
    }

    // Non-admins must use the list
    if (profile.role !== 'admin' && !SPECIES_LIST.includes(formData.species)) {
      alert('Per favore, seleziona una specie valida dalla lista.');
      return;
    }

    const parsedCount = parseInt(formData.count, 10);
    if (!formData.count || isNaN(parsedCount) || parsedCount <= 0) {
      alert('Per favore, inserisci un numero valido di capi (minimo 1).');
      return;
    }

    try {
      if (editingItem) {
        // Editing an existing single record
        await updateHarvest(editingItem.id, {
          date: formData.date,
          species: formData.species,
          count: parsedCount,
          hunterUid: formData.hunterUid || editingItem.hunterUid,
          hunterName: formData.hunterName || editingItem.hunterName
        });
      } else {
        // Adding new harvest: Automatic distribution among assigned hunters for that date
        // If no hunters assigned (e.g. admin inserting on unassigned day), fall back to creator
        const targetHunters = assignedHunters.length > 0 
          ? assignedHunters 
          : [{ uid: profile.uid, displayName: profile.displayName, role: profile.role }];

        const numHunters = targetHunters.length;
        const baseShare = Math.floor(parsedCount / numHunters);
        const remainder = parsedCount % numHunters;

        const harvestsToAdd: Omit<Harvest, 'id'>[] = [];

        targetHunters.forEach((hunter, index) => {
          // If remainder > 0 or count < numHunters, assign the extra/remainder to the first hunter
          const hunterCount = index === 0 ? (baseShare + remainder) : baseShare;
          if (hunterCount > 0) {
            harvestsToAdd.push({
              date: formData.date,
              species: formData.species,
              count: hunterCount,
              hunterUid: hunter.uid,
              hunterName: hunter.displayName
            });
          }
        });

        if (harvestsToAdd.length === 1) {
          await addHarvest(harvestsToAdd[0]);
        } else if (harvestsToAdd.length > 1) {
          await addHarvestsBatch(harvestsToAdd);
        }
      }
      setShowModal(false);
    } catch (err: any) {
      console.error(err);
      alert("Errore durante il salvataggio: " + (err.message || "Errore sconosciuto"));
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteHarvest(itemToDelete.id);
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (err: any) {
      console.error(err);
      alert("Errore durante l'eliminazione: " + (err.message || "Errore sconosciuto"));
    }
  };

  const filteredItems = items.filter(item => {
    if (!profile) return false;
    if (profile.role === 'admin' || profile.role === 'socio') return true;
    return item.hunterUid === profile.uid;
  });

  const totalBirds = filteredItems.reduce((acc, h) => acc + h.count, 0);

  const canManage = (item: Harvest) => {
    if (!profile) return false;
    return profile.role === 'admin' || item.hunterUid === profile.uid;
  };

  const currentLimit = limits.find(l => l.species.toLowerCase() === formData.species.toLowerCase());
  
  // Reference hunter for limit calculation:
  // In edit mode: the item's hunter
  // In add mode: first assigned hunter if available, otherwise current user
  const effectiveHunterUid = editingItem 
    ? (formData.hunterUid || editingItem.hunterUid)
    : (assignedHuntersForSelectedDate.length > 0 ? assignedHuntersForSelectedDate[0].uid : (profile?.uid || ''));

  const dailyCount = items
    .filter(h => h.date === formData.date && h.hunterUid === effectiveHunterUid && h.species.toLowerCase() === formData.species.toLowerCase() && h.id !== editingItem?.id)
    .reduce((acc, h) => acc + h.count, 0);

  const seasonalCount = items
    .filter(h => h.hunterUid === effectiveHunterUid && h.species.toLowerCase() === formData.species.toLowerCase() && h.id !== editingItem?.id)
    .reduce((acc, h) => acc + h.count, 0);

  // Calculate projected counts for limit checking
  const validCount = formData.count ? (parseInt(formData.count, 10) || 0) : 0;
  
  // For new harvest distribution: calculate how much the first hunter will actually receive
  const projectedShareForEffectiveHunter = editingItem
    ? validCount
    : (assignedHuntersForSelectedDate.length > 0
        ? Math.floor(validCount / assignedHuntersForSelectedDate.length) + (validCount % assignedHuntersForSelectedDate.length)
        : validCount);

  const projectedDaily = dailyCount + projectedShareForEffectiveHunter;
  const projectedSeasonal = seasonalCount + projectedShareForEffectiveHunter;

  const isDailyLimitExceeded = currentLimit && currentLimit.dailyLimit > 0 && projectedDaily > currentLimit.dailyLimit;
  const isSeasonalLimitExceeded = currentLimit && currentLimit.seasonalLimit > 0 && projectedSeasonal > currentLimit.seasonalLimit;

  return (
    <div className="space-y-8 pb-24 sm:pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Catture & Abbattimenti</h1>
          <p className="text-slate-gray font-medium">Registro dettagliato del prelievo venatorio</p>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-polish">
          <span className="text-[0.65rem] font-bold text-slate-gray uppercase tracking-[0.2em] mb-4 block">Prelievo Totale</span>
          <div className="flex items-end gap-2">
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{totalBirds}</p>
            <span className="text-xs font-bold text-slate-400 uppercase pb-1.5">Esemplari</span>
          </div>
        </div>
        <div className="card-polish">
          <span className="text-[0.65rem] font-bold text-lake-green uppercase tracking-[0.2em] mb-4 block">Specie Prevalente</span>
          <p className="text-lg font-bold text-lake-green">
            {filteredItems.length > 0 
              ? Array.from(filteredItems.reduce((acc, item) => {
                  acc.set(item.species, (acc.get(item.species) || 0) + item.count);
                  return acc;
                }, new Map<string, number>()).entries())
                .sort((a, b) => b[1] - a[1])[0][0]
              : 'Nessuna'}
          </p>
        </div>
        <div className="card-polish">
          <span className="text-[0.65rem] font-bold text-accent-gold uppercase tracking-[0.2em] mb-4 block">Media/Giornata</span>
          <p className="text-2xl font-black text-slate-900">
            {filteredItems.length > 0 ? (totalBirds / filteredItems.length).toFixed(1) : '0.0'}
          </p>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={handleOpenAdd}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent-gold text-lake-green rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-4 border-white"
      >
        <Plus size={32} />
      </button>

      {/* Modal Tool (Add/Edit) */}
      <AnimatePresence>
        {showModal && (
          <div 
            className="fixed inset-0 w-full h-full z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-lake-green/90 backdrop-blur-md"
            onClick={() => setShowModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-8 max-w-xl w-full shadow-2xl border-t-8 border-accent-gold relative my-auto max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-lake-green transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-off-white p-3 rounded border border-slate-100 text-lake-green">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-lake-green leading-none mb-1">
                    {editingItem ? 'Modifica Registrazione' : 'Registra Cattura'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    {editingItem ? 'Modifica i dati dell\'abbattimento' : 'Inserisci i dati dell\'abbattimento odierno'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Data</label>
                    <input 
                      type="date"
                      required
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Numero Capi</label>
                    <input 
                      type="number"
                      min="1"
                      required
                      value={formData.count}
                      onChange={e => setFormData({ ...formData, count: e.target.value })}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                      placeholder="Es. 1, 2..."
                    />
                  </div>
                </div>
                
                {/* Limit Warnings */}
                {currentLimit && (
                  <div className={cn(
                    "p-3 rounded-lg flex gap-3 items-center transition-colors border",
                    (isDailyLimitExceeded || isSeasonalLimitExceeded) 
                      ? "bg-rose-50 border-rose-200 text-rose-800" 
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  )}>
                    {(isDailyLimitExceeded || isSeasonalLimitExceeded) ? (
                      <ShieldAlert size={20} className="shrink-0 text-rose-600" />
                    ) : (
                      <Target size={20} className="shrink-0 text-slate-400" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none">Status Carniere Regionale</p>
                        {currentLimit.dailyLimit > 0 && (
                          <span className="text-[9px] font-black bg-white/50 px-1.5 py-0.5 rounded border border-black/5">
                            Max: {currentLimit.dailyLimit} G / {currentLimit.seasonalLimit || '∞'} S
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold leading-tight">
                        {isDailyLimitExceeded 
                          ? `ATTENZIONE: Con questo inserimento si supera il limite giornaliero (${currentLimit.dailyLimit}) per ${currentLimit.species}.` 
                          : isSeasonalLimitExceeded 
                          ? `ATTENZIONE: Con questo inserimento si supera il limite stagionale (${currentLimit.seasonalLimit}) per ${currentLimit.species}.`
                          : (
                            <span>
                              Capi già abbattuti oggi: <span className="font-black text-slate-800">{dailyCount}</span>
                              {currentLimit.dailyLimit > 0 && <span> / {currentLimit.dailyLimit}</span>}
                              {validCount > 0 && (
                                <span className="text-lake-green ml-1">
                                  (+{projectedShareForEffectiveHunter} proposti &rarr; tot. {projectedDaily}{currentLimit.dailyLimit > 0 ? `/${currentLimit.dailyLimit}` : ''})
                                </span>
                              )}
                            </span>
                          )}
                      </p>
                      {currentLimit.notes && (
                        <p className="text-[9px] mt-1 opacity-60 italic">{currentLimit.notes}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2 relative">
                  <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Specie</label>
                  <div className="relative">
                    <input 
                      required
                      placeholder="Cerca o seleziona specie..."
                      value={formData.species}
                      onChange={e => {
                        setFormData({ ...formData, species: e.target.value });
                        setShowSpeciesList(true);
                      }}
                      onFocus={() => setShowSpeciesList(true)}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowSpeciesList(!showSpeciesList)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <ChevronDown size={16} className={cn("transition-transform", showSpeciesList && "rotate-180")} />
                    </button>
                  </div>

                  {showSpeciesList && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-xl max-h-48 overflow-y-auto py-1">
                      {SPECIES_LIST.filter(s => 
                        s.toLowerCase().includes(formData.species.toLowerCase())
                      ).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, species: s });
                            setShowSpeciesList(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm font-bold text-slate-gray hover:bg-lake-green hover:text-white transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                      {profile?.role === 'admin' && formData.species && !SPECIES_LIST.includes(formData.species) && (
                        <button
                          type="button"
                          onClick={() => setShowSpeciesList(false)}
                          className="w-full text-left px-4 py-2 text-sm font-black text-lake-green hover:bg-slate-50 transition-colors border-t border-slate-100 italic"
                        >
                          Usa nuovo: "{formData.species}"
                        </button>
                      )}
                      {SPECIES_LIST.filter(s => 
                        s.toLowerCase().includes(formData.species.toLowerCase())
                      ).length === 0 && profile?.role !== 'admin' && (
                        <div className="px-4 py-2 text-xs text-slate-400 italic">Nessun risultato</div>
                      )}
                    </div>
                  )}
                  {profile?.role !== 'admin' && formData.species && !SPECIES_LIST.includes(formData.species) && (
                    <p className="text-[10px] font-bold text-rose-500 italic mt-1">
                      * Devi selezionare una specie dalla lista ufficiale
                    </p>
                  )}
                </div>

                {/* Assigned Hunters & Auto Distribution Info */}
                <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-lake-green" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                        Cacciatori Presenti ({assignedHuntersForSelectedDate.length})
                      </span>
                    </div>
                    {canUserInsertForSelectedDate ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        {profile?.role === 'admin' ? 'Autorizzato (Admin)' : 'Autorizzato (In Turno)'}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                        Non in turno
                      </span>
                    )}
                  </div>

                  {assignedHuntersForSelectedDate.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {assignedHuntersForSelectedDate.map((hunter, idx) => {
                          const numHunters = assignedHuntersForSelectedDate.length;
                          const base = Math.floor(validCount / numHunters);
                          const rem = validCount % numHunters;
                          const assignedCount = idx === 0 ? (base + rem) : base;

                          return (
                            <span 
                              key={hunter.uid}
                              className={cn(
                                "text-xs font-semibold px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5",
                                hunter.uid === profile?.uid 
                                  ? "bg-lake-green/10 border-lake-green/30 text-lake-green font-bold" 
                                  : "bg-white border-slate-200 text-slate-700"
                              )}
                            >
                              <span>{hunter.displayName}</span>
                              {validCount > 0 && !editingItem && (
                                <span className="bg-accent-gold/20 text-slate-800 text-[10px] px-1.5 py-0.2 rounded font-black">
                                  +{assignedCount}
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>

                      {!editingItem && validCount > 0 && (
                        <p className="text-[10px] text-slate-500 italic pt-1">
                          Ripartizione automatica: {assignedHuntersForSelectedDate.length > 1 
                            ? (validCount % assignedHuntersForSelectedDate.length !== 0 
                                ? `Numero non divisibile equamente: il resto viene assegnato al primo cacciatore (${assignedHuntersForSelectedDate[0].displayName}).` 
                                : `Divisi equamente (${Math.floor(validCount / assignedHuntersForSelectedDate.length)} per cacciatore).`)
                            : `Assegnati a ${assignedHuntersForSelectedDate[0].displayName}.`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      Nessun cacciatore assegnato a questa data nel calendario venatorio.
                      {profile?.role === 'admin' ? ' (In qualità di Admin, i capi registrati verranno intestati al tuo account).' : ''}
                    </div>
                  )}

                  {!canUserInsertForSelectedDate && (
                    <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-bold flex items-center gap-2">
                      <ShieldAlert size={16} className="shrink-0 text-rose-600" />
                      <span>Solo i cacciatori assegnati a questa data o l'Admin possono registrare abbattimenti.</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 px-6 rounded bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit"
                    disabled={!canUserInsertForSelectedDate}
                    className={cn(
                      "flex-1 py-3 px-6 rounded font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95",
                      canUserInsertForSelectedDate 
                        ? "bg-accent-gold text-lake-green hover:bg-opacity-90 cursor-pointer" 
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none active:scale-100"
                    )}
                  >
                    {editingItem ? 'Salva Modifiche' : 'Registra Abbattimento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && itemToDelete && (
          <div 
            className="fixed inset-0 w-full h-full z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-rose-950/50 backdrop-blur-md"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-8 max-w-sm w-full shadow-2xl border-t-8 border-rose-600 relative my-auto max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-serif text-slate-900 mb-2">Conferma Eliminazione</h3>
              <p className="text-sm text-slate-500 mb-6">
                Sei sicuro di voler eliminare questa registrazione? L'azione non può essere annullata.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 px-6 rounded bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 px-6 rounded bg-rose-600 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg active:scale-95"
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Harvest Table */}
      <section className="card-polish !p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[320px]">
            <thead className="bg-off-white border-b border-slate-100 uppercase tracking-widest text-[0.6rem] sm:text-[0.65rem] font-black text-slate-400">
              <tr>
                <th className="pl-3 sm:pl-6 pr-1 sm:pr-2 py-3 font-bold text-left w-14 sm:w-16">Azioni</th>
                <th className="px-2 sm:px-4 py-3 font-bold">Data</th>
                <th className="px-2 sm:px-4 py-3 font-bold">Specie</th>
                <th className="px-2 sm:px-4 py-3 font-bold hidden md:table-cell">Cacciatore</th>
                <th className="pl-2 pr-3 sm:pr-6 py-3 font-bold text-right">Q.tà</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-10 text-center text-slate-300 italic font-medium">Caricamento registro...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 sm:px-6 py-10 text-center text-slate-300 italic font-medium">Nessun record trovato</td>
                </tr>
              ) : filteredItems.map((item) => (
                <tr 
                  key={item.id} 
                  id={`harvest-${item.id}`}
                  className={cn(
                    "hover:bg-slate-50 transition-colors group",
                    item.id === highlightId ? "bg-lake-green/10" : ""
                  )}
                >
                  <td className="pl-3 sm:pl-6 pr-1 sm:pr-2 py-3 text-left whitespace-nowrap">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {canManage(item) ? (
                        <>
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-lake-green transition-colors"
                            title="Modifica cattura"
                            aria-label="Modifica"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={() => {
                              setItemToDelete(item);
                              setShowDeleteConfirm(true);
                            }}
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Elimina cattura"
                            aria-label="Elimina"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <span className="w-8 inline-block" />
                      )}
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium text-slate-600 whitespace-nowrap">
                    {safeFormatDate(item.date, 'dd MMM', { locale: it })}
                  </td>
                  <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Target size={12} className="text-lake-green opacity-40 shrink-0 hidden sm:block" />
                      <span className="text-xs sm:text-sm font-semibold text-lake-green">
                        {item.species}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-[10px] sm:text-xs text-slate-400 font-medium italic whitespace-nowrap hidden md:table-cell">
                    {item.hunterName}
                  </td>
                  <td className="pl-2 pr-3 sm:pr-6 py-3 text-right font-black text-sm sm:text-lg text-slate-900 tracking-tighter">
                    {item.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
