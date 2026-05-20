import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Award, 
  TrendingUp, 
  BookOpen, 
  ChevronRight,
  Sparkles,
  Search,
  CheckCircle2,
  X,
  Info,
  Pencil
} from 'lucide-react';
import { 
  subscribeToTesserinoEntries, 
  addTesserinoEntry, 
  deleteTesserinoEntry, 
  updateTesserinoEntry,
  subscribeToHuntingLimits 
} from '../services';
import { TesserinoEntry, HuntingLimit } from '../types';
import { format, parseISO, compareDesc } from 'date-fns';
import { it } from 'date-fns/locale';

export function Tesserino() {
  const [entries, setEntries] = useState<TesserinoEntry[]>([]);
  const [limits, setLimits] = useState<HuntingLimit[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [count, setCount] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal States for Edit & Deletion
  const [deleteConfirm, setDeleteConfirm] = useState<{ species: string; date: string; count: number; ids: string[] } | null>(null);
  const [editingItem, setEditingItem] = useState<{ species: string; date: string; count: number; ids: string[]; originalEntries: TesserinoEntry[] } | null>(null);
  
  const [editFormSpecies, setEditFormSpecies] = useState<string>('');
  const [editFormCount, setEditFormCount] = useState<number>(1);
  const [editFormDate, setEditFormDate] = useState<string>('');
  const [editErrorMsg, setEditErrorMsg] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // UI Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState('');

  // Helper: parse textual/long written periods to numeric format (e.g. "settembre" -> "/09")
  const parsePeriodToNumeric = (period: string | undefined): string => {
    if (!period) return '';
    return period
      .toLowerCase()
      .replace(/dal|al/gi, '')
      .replace(/gennaio/gi, '/01')
      .replace(/febbraio/gi, '/02')
      .replace(/marzo/gi, '/03')
      .replace(/aprile/gi, '/04')
      .replace(/maggio/gi, '/05')
      .replace(/giugno/gi, '/06')
      .replace(/luglio/gi, '/07')
      .replace(/agosto/gi, '/08')
      .replace(/settembre/gi, '/09')
      .replace(/ottobre/gi, '/10')
      .replace(/novembre/gi, '/11')
      .replace(/dicembre/gi, '/12')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Helper: Check if a given date (YYYY-MM-DD) falls within the species' hunting period
  const isDateInPeriod = (dateStr: string, period: string | undefined): boolean => {
    if (!period) return true;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return false;
      const month = date.getMonth() + 1;
      const day = date.getDate();

      const numericPeriod = parsePeriodToNumeric(period);
      const parts = numericPeriod.split('-').map(p => p.trim());
      if (parts.length !== 2) return true;

      const [startDay, startMonth] = parts[0].split('/').map(Number);
      const [endDay, endMonth] = parts[1].split('/').map(Number);

      if (isNaN(startDay) || isNaN(startMonth) || isNaN(endDay) || isNaN(endMonth)) {
        return true;
      }

      const currentVal = month * 100 + day;
      const startVal = startMonth * 100 + startDay;
      const endVal = endMonth * 100 + endDay;

      if (startVal <= endVal) {
        return currentVal >= startVal && currentVal <= endVal;
      } else {
        // Handle season boundary wrapping around the new year (e.g., Sep 15 to Jan 31)
        return currentVal >= startVal || currentVal <= endVal;
      }
    } catch (e) {
      return true;
    }
  };

  // Helper: Generate a valid fallback date within the hunting period
  const getFallbackValidDate = (period: string | undefined): string => {
    if (!period) return format(new Date(), 'yyyy-MM-dd');
    try {
      const numericPeriod = parsePeriodToNumeric(period);
      const parts = numericPeriod.split('-').map(p => p.trim());
      if (parts.length !== 2) return format(new Date(), 'yyyy-MM-dd');

      const [startDay, startMonth] = parts[0].split('/').map(Number);
      if (isNaN(startDay) || isNaN(startMonth)) return format(new Date(), 'yyyy-MM-dd');

      const currentYear = new Date().getFullYear();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const proposedDateStr = `${currentYear}-${pad(startMonth)}-${pad(startDay)}`;
      
      const parsed = new Date(proposedDateStr);
      if (!isNaN(parsed.getTime())) {
        return proposedDateStr;
      }
    } catch (e) {
      // ignore
    }
    return format(new Date(), 'yyyy-MM-dd');
  };

  useEffect(() => {
    const unsubEntries = subscribeToTesserinoEntries((data) => {
      setEntries(data);
      setLoading(false);
    });

    const unsubLimits = subscribeToHuntingLimits((data) => {
      setLimits(data);
      if (data.length > 0 && !selectedSpecies) {
        // Default to first species
        setSelectedSpecies(data[0].species);
      }
    });

    return () => {
      unsubEntries();
      unsubLimits();
    };
  }, []);

  // Automatically adjust the Date field in real-time if invalid for the selected specie
  useEffect(() => {
    if (!selectedSpecies) return;
    const limitConfig = limits.find(l => l.species.toLowerCase() === selectedSpecies.toLowerCase());
    if (limitConfig && limitConfig.huntingPeriod) {
      const isValid = isDateInPeriod(selectedDate, limitConfig.huntingPeriod);
      if (!isValid) {
        const fallback = getFallbackValidDate(limitConfig.huntingPeriod);
        setSelectedDate(fallback);
      }
    }
  }, [selectedSpecies, limits]);

  // Automatically adjust the Edit Date field in real-time in the Edit modal if invalid for the active select edit species
  useEffect(() => {
    if (!editFormSpecies) return;
    const limitConfig = limits.find(l => l.species.toLowerCase() === editFormSpecies.toLowerCase());
    if (limitConfig && limitConfig.huntingPeriod) {
      const isValid = isDateInPeriod(editFormDate, limitConfig.huntingPeriod);
      if (!isValid) {
        const fallback = getFallbackValidDate(limitConfig.huntingPeriod);
        setEditFormDate(fallback);
      }
    }
  }, [editFormSpecies, limits]);

  // Helper: get the limits for a specific species
  const getSpeciesLimits = (speciesName: string): HuntingLimit | undefined => {
    return limits.find(l => l.species.toLowerCase() === speciesName.toLowerCase());
  };

  // Helper: total harvests for a species in the current season
  const getSeasonalTotal = (speciesName: string): number => {
    return entries
      .filter(e => e.species.toLowerCase() === speciesName.toLowerCase())
      .reduce((acc, curr) => acc + curr.count, 0);
  };

  // Helper: total harvests for a species on a specific date
  const getDailyTotalOnDate = (speciesName: string, dateStr: string): number => {
    return entries
      .filter(e => e.species.toLowerCase() === speciesName.toLowerCase() && e.date === dateStr)
      .reduce((acc, curr) => acc + curr.count, 0);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpecies) {
      setErrorMsg('Seleziona una specie valida.');
      return;
    }
    if (!count || count <= 0) {
      setErrorMsg('Quantità di capi non valida. Deve essere almeno 1.');
      return;
    }
    if (!selectedDate) {
      setErrorMsg('Seleziona una data valida.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const limitConfig = getSpeciesLimits(selectedSpecies);
    
    // Limits check
    if (limitConfig) {
      // 0. Date Period check
      if (limitConfig.huntingPeriod && !isDateInPeriod(selectedDate, limitConfig.huntingPeriod)) {
        setErrorMsg(`Errore: La data selezionata (${format(parseISO(selectedDate), 'dd/MM/yyyy')}) è fuori dal periodo consentito per ${selectedSpecies} (${limitConfig.huntingPeriod}).`);
        setIsSubmitting(false);
        return;
      }

      const dailyAlready = getDailyTotalOnDate(selectedSpecies, selectedDate);
      const seasonalAlready = getSeasonalTotal(selectedSpecies);

      // 1. Daily limitation
      if (limitConfig.dailyLimit > 0 && (dailyAlready + count) > limitConfig.dailyLimit) {
        const canTake = Math.max(0, limitConfig.dailyLimit - dailyAlready);
        setErrorMsg(`Attenzione: Limite giornaliero superato per ${selectedSpecies}. Puoi inserire al massimo ${canTake} capi per questa giornata (Già inseriti: ${dailyAlready}, Richiesti: ${count}, Limite: ${limitConfig.dailyLimit}).`);
        setIsSubmitting(false);
        return;
      }

      // 2. Seasonal limitation
      if (limitConfig.seasonalLimit > 0 && (seasonalAlready + count) > limitConfig.seasonalLimit) {
        const canTake = Math.max(0, limitConfig.seasonalLimit - seasonalAlready);
        setErrorMsg(`Attenzione: Limite stagionale superato per ${selectedSpecies}. Puoi inserire al massimo ${canTake} capi per questa stagione (Già inseriti in totale: ${seasonalAlready}, Richiesti: ${count}, Limite stagionale: ${limitConfig.seasonalLimit}).`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await addTesserinoEntry({
        date: selectedDate,
        species: selectedSpecies,
        count: count,
        createdAt: new Date().toISOString()
      });
      
      setSuccessMsg(`Registrato con successo: ${count}x ${selectedSpecies}`);
      setCount(1);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg('Impossibile salvare la registrazione.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDeleteGroup = async () => {
    if (!deleteConfirm) return;
    try {
      const deletePromises = deleteConfirm.ids.map(id => deleteTesserinoEntry(id));
      await Promise.all(deletePromises);
      setDeleteConfirm(null);
    } catch (e) {
      alert('Impossibile eliminare l\'annotazione.');
    }
  };

  const openEditModal = (species: string, date: string, count: number, ids: string[], originalEntries: TesserinoEntry[]) => {
    setEditingItem({ species, date, count, ids, originalEntries });
    setEditFormSpecies(species);
    setEditFormCount(count);
    setEditFormDate(date);
    setEditErrorMsg('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editFormSpecies) {
      setEditErrorMsg('Seleziona una specie valida.');
      return;
    }
    if (!editFormCount || editFormCount <= 0) {
      setEditErrorMsg('Quantità di capi non valida. Deve essere almeno 1.');
      return;
    }
    if (!editFormDate) {
      setEditErrorMsg('Seleziona una data valida.');
      return;
    }

    setIsSavingEdit(true);
    setEditErrorMsg('');

    const editLimitConfig = getSpeciesLimits(editFormSpecies);
    if (editLimitConfig) {
      // 0. Date Period check
      if (editLimitConfig.huntingPeriod && !isDateInPeriod(editFormDate, editLimitConfig.huntingPeriod)) {
        setEditErrorMsg(`Errore: La data selezionata (${format(parseISO(editFormDate), 'dd/MM/yyyy')}) è fuori dal periodo consentito per ${editFormSpecies} (${editLimitConfig.huntingPeriod}).`);
        setIsSavingEdit(false);
        return;
      }

      // Filter out CURRENT items that we are editing from the daily/seasonal total calculation
      const filteredEntries = entries.filter(e => !editingItem.ids.includes(e.id));
      
      const dailyAlready = filteredEntries
        .filter(e => e.species.toLowerCase() === editFormSpecies.toLowerCase() && e.date === editFormDate)
        .reduce((acc, curr) => acc + curr.count, 0);

      const seasonalAlready = filteredEntries
        .filter(e => e.species.toLowerCase() === editFormSpecies.toLowerCase())
        .reduce((acc, curr) => acc + curr.count, 0);

      // 1. Daily limitation
      if (editLimitConfig.dailyLimit > 0 && (dailyAlready + editFormCount) > editLimitConfig.dailyLimit) {
        const canTake = Math.max(0, editLimitConfig.dailyLimit - dailyAlready);
        setEditErrorMsg(`Limite giornaliero superato per ${editFormSpecies}. Puoi inserire al massimo ${canTake} capi per questa giornata (Già inseriti: ${dailyAlready}, Richiesti: ${editFormCount}, Limite: ${editLimitConfig.dailyLimit}).`);
        setIsSavingEdit(false);
        return;
      }

      // 2. Seasonal limitation
      if (editLimitConfig.seasonalLimit > 0 && (seasonalAlready + editFormCount) > editLimitConfig.seasonalLimit) {
        const canTake = Math.max(0, editLimitConfig.seasonalLimit - seasonalAlready);
        setEditErrorMsg(`Limite stagionale superato per ${editFormSpecies}. Puoi inserire al massimo ${canTake} capi per questa stagione (Già inseriti in totale: ${seasonalAlready}, Richiesti: ${editFormCount}, Limite stagionale: ${editLimitConfig.seasonalLimit}).`);
        setIsSavingEdit(false);
        return;
      }
    }

    try {
      // Save changes. Update the first document from the original group.
      const primaryId = editingItem.ids[0];
      await updateTesserinoEntry(primaryId, {
        date: editFormDate,
        species: editFormSpecies,
        count: editFormCount,
        createdAt: new Date().toISOString()
      });

      // If there were multiple entries, delete any extra entries so they merge beautifully into the single updated entry
      if (editingItem.ids.length > 1) {
        const itemsToDelete = editingItem.ids.slice(1);
        await Promise.all(itemsToDelete.map(id => deleteTesserinoEntry(id)));
      }

      setEditingItem(null);
    } catch (err) {
      setEditErrorMsg('Impossibile salvare la modifica.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Group entries by date
  const groupedEntries: Record<string, TesserinoEntry[]> = {};
  entries.forEach(entry => {
    if (!groupedEntries[entry.date]) {
      groupedEntries[entry.date] = [];
    }
    groupedEntries[entry.date].push(entry);
  });

  const sortedDates = Object.keys(groupedEntries).sort((a, b) => compareDesc(parseISO(a), parseISO(b)));

  // Selected limit preview
  const activeLimit = getSpeciesLimits(selectedSpecies);
  const activeDailyTotal = selectedSpecies ? getDailyTotalOnDate(selectedSpecies, selectedDate) : 0;
  const activeSeasonalTotal = selectedSpecies ? getSeasonalTotal(selectedSpecies) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-lake-green font-bold text-xs uppercase tracking-widest mb-1">
            <BookOpen size={16} />
            <span>Spazio Amministratore</span>
          </div>
          <h1 className="text-3xl font-serif text-slate-900">Tesserino Venatorio</h1>
          <p className="text-slate-gray font-medium text-sm mt-1">
            Gestisci in modo digitale la copia del tuo tesserino cartaceo per non sforare mai i limiti di controllo e semplificare la riconsegna.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Input form & Real-time Limit Verification info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus size={16} className="text-lake-green" />
              Nuova Annotazione Giornaliera
            </h2>
            
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Specie Cacciabile</label>
                <select 
                  required
                  value={selectedSpecies}
                  onChange={(e) => setSelectedSpecies(e.target.value)}
                  className="w-full bg-off-white border border-slate-200 rounded px-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-lake-green transition-all shadow-inner"
                >
                  <option value="" disabled>Seleziona una specie...</option>
                  {limits.map(l => (
                    <option key={l.id} value={l.species}>{l.species}</option>
                  ))}
                  {limits.length === 0 && (
                    <option value="">Nessuna specie caricata in archivio</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quantità Capi</label>
                <input 
                  type="number"
                  min="1"
                  required
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  className="w-full bg-off-white border border-slate-200 rounded px-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-lake-green transition-all shadow-inner"
                  placeholder="Seleziona la quantità"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data</label>
                <div className="relative">
                  <span className="absolute left-3 top-3.5 text-slate-400">
                    <Calendar size={16} />
                  </span>
                  <input 
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-off-white border border-slate-200 rounded pl-10 pr-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-lake-green transition-all shadow-inner"
                  />
                </div>
                {activeLimit?.huntingPeriod && (
                  <p className="text-[10px] text-slate-500 font-semibold mt-1.5 flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded p-1.5 py-1">
                    <Info size={12} className="text-lake-green shrink-0" />
                    <span>Periodo consentito: <strong className="text-slate-800 uppercase text-[9px]">{activeLimit.huntingPeriod}</strong></span>
                  </p>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded flex items-start gap-2 leading-snug">
                  <ShieldAlert size={16} className="shrink-0 text-rose-500 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || limits.length === 0}
                className="w-full bg-lake-green text-white font-bold py-3 px-4 rounded-lg shadow hover:bg-lake-green/90 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
              >
                {isSubmitting ? 'Registrazione...' : 'Aggiungi al Tesserino'}
              </button>
            </form>
          </div>

          {/* REAL TIME RUNNING LIMIT CHECKER FOR SELECTED FORM DETAILS */}
          {selectedSpecies && activeLimit && (
            <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Sparkles size={120} className="text-accent-gold" />
              </div>

              <div className="flex items-center gap-2 text-accent-gold text-[10px] uppercase font-black tracking-widest mb-3">
                <Sparkles size={12} />
                <span>Anteprima Controllo Limiti</span>
              </div>
              <h3 className="text-lg font-serif mb-4 leading-tight border-b border-slate-800 pb-2">
                {selectedSpecies}
              </h3>

              <div className="space-y-4">
                {/* Daily limit check */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-medium">Stato Giornaliero</span>
                    <span className="font-bold text-slate-200">
                      {activeDailyTotal + count} / {activeLimit.dailyLimit > 0 ? activeLimit.dailyLimit : '∞'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        activeLimit.dailyLimit > 0 && (activeDailyTotal + count) > activeLimit.dailyLimit 
                          ? 'bg-rose-500' 
                          : activeLimit.dailyLimit > 0 && (activeDailyTotal + count) === activeLimit.dailyLimit 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ 
                        width: activeLimit.dailyLimit > 0 
                          ? `${Math.min(100, ((activeDailyTotal + count) / activeLimit.dailyLimit) * 100)}%` 
                          : '10%' 
                      }}
                    ></div>
                  </div>
                  {activeLimit.dailyLimit > 0 && (
                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                      {activeDailyTotal > 0 ? `Hai già registrato ${activeDailyTotal} capi oggi. ` : ''}
                      Limite giornaliero di legge: <span className="font-bold text-slate-300">{activeLimit.dailyLimit}</span> capi.
                    </p>
                  )}
                </div>

                {/* Seasonal limit check */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-medium">Stato Stagionale</span>
                    <span className="font-bold text-slate-200">
                      {activeSeasonalTotal + count} / {activeLimit.seasonalLimit > 0 ? activeLimit.seasonalLimit : '∞'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        activeLimit.seasonalLimit > 0 && (activeSeasonalTotal + count) > activeLimit.seasonalLimit 
                          ? 'bg-rose-500' 
                          : activeLimit.seasonalLimit > 0 && (activeSeasonalTotal + count) >= (activeLimit.seasonalLimit * 0.8) 
                          ? 'bg-amber-500' 
                          : 'bg-indigo-500'
                      }`}
                      style={{ 
                        width: activeLimit.seasonalLimit > 0 
                          ? `${Math.min(100, ((activeSeasonalTotal + count) / activeLimit.seasonalLimit) * 100)}%` 
                          : '15%' 
                      }}
                    ></div>
                  </div>
                  {activeLimit.seasonalLimit > 0 && (
                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                      Totale stagionale inclusa questa immissione: <span className="font-black text-slate-300">{activeSeasonalTotal + count}</span> capi. 
                      Limite stagionale consentito: <span className="font-bold text-slate-300">{activeLimit.seasonalLimit}</span> capi.
                    </p>
                  )}
                </div>

                {/* Alert Warning Box */}
                {activeLimit.dailyLimit > 0 && (activeDailyTotal + count) > activeLimit.dailyLimit && (
                  <div className="p-3 bg-rose-950/40 border border-rose-900 rounded-lg text-[11px] text-rose-300 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                    <span>Se inserisci questo record sforerai il limite giornaliero consentito.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Limits Dashboard & Logs timeline */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* QUOTA TALLY SUMMARY CHART BOARD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={16} className="text-lake-green" />
                  Riepilogo Capienza Limiti Stagionali
                </h2>
                <p className="text-xs text-slate-400 mt-1">Situazione cumulativa degli abbattimenti registrati nel tesserino</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Search size={14} className="text-slate-400 ml-1 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Filtra specie..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 outline-none w-full sm:w-44 focus:border-lake-green focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {limits
                .filter(l => l.species.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(limit => {
                  const seasonalHarvested = getSeasonalTotal(limit.species);
                  const isLimitSet = limit.seasonalLimit > 0;
                  const ratio = isLimitSet ? (seasonalHarvested / limit.seasonalLimit) * 100 : 0;
                  
                  return (
                    <div 
                      key={limit.id} 
                      className={`p-4 rounded-lg border transition-all ${
                        seasonalHarvested > 0 
                          ? 'bg-slate-50/50 border-slate-100' 
                          : 'bg-transparent border-slate-100'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-xs font-black text-slate-800">{limit.species}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Max Giornaliero: {limit.dailyLimit > 0 ? `${limit.dailyLimit} capi` : 'Nessuno'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-600 block">
                            {seasonalHarvested} / {isLimitSet ? limit.seasonalLimit : '∞'}
                          </span>
                          <span className="text-[9px] font-sans text-slate-400">abbattuti</span>
                        </div>
                      </div>

                      {isLimitSet && (
                        <div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                ratio >= 100 
                                  ? 'bg-rose-500' 
                                  : ratio >= 80 
                                  ? 'bg-amber-500' 
                                  : 'bg-lake-green'
                              }`}
                              style={{ width: `${Math.min(100, ratio)}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400 mt-1">
                            <span>Saturazione: {Math.round(ratio)}%</span>
                            {ratio >= 100 && (
                              <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                <AlertTriangle size={8} /> LIMITE STAGIONALE RAGGIUNTO
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

              {limits.length === 0 && (
                <div className="col-span-1 md:col-span-2 text-center py-8 text-slate-400 text-xs">
                  Nessuna regola o limite di specie censiti. Inseriscili dal pannello di amministrazione nella sezione Stagione.
                </div>
              )}
            </div>
          </div>

          {/* CHRONOLOGY: TIMELINE OF WRITTEN LOGS (TESSERINO CARTACEO REAL RECONVERSION) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
              <FileText size={16} className="text-lake-green" />
              Cronologia Compilazioni Tesserino Cartaceo
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lake-green"></div>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg">
                <FileText size={40} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nessuna annotazione registrata nel tesserino digitale.</p>
                <p className="text-[10px] text-slate-400 mt-1">Compila il modulo a lato per caricare il tuo primo abbattimento.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedDates.map(dateStr => {
                  const dayEntries = groupedEntries[dateStr];
                  const parsed = parseISO(dateStr);
                  const formattedDate = format(parsed, 'EEEE dd MMMM yyyy', { locale: it });
                  
                  return (
                    <div key={dateStr} className="border-l-2 border-lake-green/30 pl-4 relative space-y-3">
                      <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-lake-green ring-4 ring-white"></div>
                      
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">{formattedDate}</h3>
                        <span className="text-[10px] bg-lake-green/10 text-lake-green font-bold px-2 py-0.5 rounded-full">
                          {dayEntries.reduce((a, b) => a + b.count, 0)} capi totali
                        </span>
                      </div>

                      <div className="bg-slate-50 hover:bg-slate-100/70 transition-colors rounded-lg divide-y divide-slate-100 border border-slate-100 overflow-hidden">
                        {(() => {
                          const dayEntriesBySpecies: Record<string, { species: string; count: number; ids: string[]; originalEntries: TesserinoEntry[] }> = {};
                          dayEntries.forEach(entry => {
                            const sName = entry.species;
                            if (!dayEntriesBySpecies[sName]) {
                              dayEntriesBySpecies[sName] = {
                                species: entry.species,
                                count: 0,
                                ids: [],
                                originalEntries: []
                              };
                            }
                            dayEntriesBySpecies[sName].count += entry.count;
                            dayEntriesBySpecies[sName].ids.push(entry.id);
                            dayEntriesBySpecies[sName].originalEntries.push(entry);
                          });
                          const groupedItems = Object.values(dayEntriesBySpecies);

                          return groupedItems.map(group => (
                            <div 
                              key={group.species} 
                              className="flex items-center justify-between px-4 py-3 text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-lake-green text-white font-bold flex items-center justify-center text-[10px]">
                                  {group.count}
                                </span>
                                <div>
                                  <span className="font-bold text-slate-800">{group.species}</span>
                                  {getSpeciesLimits(group.species) && (
                                    <span className="text-[9px] text-slate-400 ml-2 italic">
                                      (Limite G: {getSpeciesLimits(group.species)?.dailyLimit})
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={() => openEditModal(group.species, dateStr, group.count, group.ids, group.originalEntries)}
                                  className="text-slate-400 hover:text-lake-green rounded p-1 hover:bg-emerald-50 transition-colors"
                                  title="Modifica annotazione"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button 
                                  onClick={() => setDeleteConfirm({ species: group.species, date: dateStr, count: group.count, ids: group.ids })}
                                  className="text-slate-400 hover:text-rose-500 rounded p-1 hover:bg-rose-50 transition-colors"
                                  title="Elimina annotazione"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Dynamic Popups/Modals inside AnimatePresence for smooth transitions */}
      <AnimatePresence>
        {/* Deletion Confirmation Modal */}
        {deleteConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-100"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-full shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div className="w-full">
                  <h2 className="text-base font-black text-slate-900 leading-snug">Rimuovere annotazione?</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Sei sicuro di voler eliminare dal tuo tesserino l'archiviazione di questa specie per il giorno selezionato?
                  </p>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3.5 my-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Data</span>
                      <span className="font-bold text-slate-800">
                        {format(parseISO(deleteConfirm.date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Specie cacciata</span>
                      <span className="font-bold text-slate-800">{deleteConfirm.species}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Capi totali registrati</span>
                      <span className="font-bold text-slate-800">{deleteConfirm.count}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 font-medium">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all uppercase tracking-wider"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={executeDeleteGroup}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 active:scale-95 transition-all uppercase tracking-wider shadow-sm shadow-rose-600/20"
                    >
                      Sì, Elimina
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Form Modal */}
        {editingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-100"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h2 className="text-md font-black text-slate-900 flex items-center gap-2">
                  <Pencil size={16} className="text-lake-green" />
                  Modifica Annotazione Tesserino
                </h2>
                <button 
                  onClick={() => setEditingItem(null)} 
                  className="text-slate-400 hover:text-slate-600 rounded p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4 pt-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Specie Cacciabile</label>
                  <select 
                    required
                    value={editFormSpecies}
                    onChange={(e) => setEditFormSpecies(e.target.value)}
                    className="w-full bg-off-white border border-slate-200 rounded px-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-lake-green transition-all shadow-inner"
                  >
                    {limits.map(l => (
                      <option key={l.id} value={l.species}>{l.species}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quantità Capi</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    value={editFormCount}
                    onChange={(e) => setEditFormCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-off-white border border-slate-200 rounded px-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-lake-green transition-all shadow-inner"
                    placeholder="Specifica la quantità"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3.5 text-slate-400">
                      <Calendar size={16} />
                    </span>
                    <input 
                      type="date"
                      required
                      value={editFormDate}
                      onChange={(e) => setEditFormDate(e.target.value)}
                      className="w-full bg-off-white border border-slate-200 rounded pl-10 pr-3 py-3 text-sm font-bold text-slate-800 outline-none focus:border-lake-green transition-all shadow-inner"
                    />
                  </div>
                  {getSpeciesLimits(editFormSpecies)?.huntingPeriod && (
                    <p className="text-[10px] text-slate-500 font-semibold mt-1.5 flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded p-1.5 py-1">
                      <Info size={12} className="text-lake-green shrink-0" />
                      <span>Periodo consentito: <strong className="text-slate-800 uppercase text-[9px]">{getSpeciesLimits(editFormSpecies)?.huntingPeriod}</strong></span>
                    </p>
                  )}
                </div>

                {editErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded flex items-start gap-2 leading-snug">
                    <ShieldAlert size={16} className="shrink-0 text-rose-500 mt-0.5" />
                    <span>{editErrorMsg}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all uppercase tracking-wider"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2.5 bg-lake-green text-white rounded-lg text-xs font-bold hover:bg-lake-green/90 active:scale-95 transition-all flex items-center gap-1.5 uppercase tracking-wider shadow-sm"
                  >
                    {isSavingEdit ? 'Salvataggio...' : 'Salva Modifiche'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
