import React, { useState, useEffect } from 'react';
import { 
  subscribeToHuntingDays, 
  subscribeToUsers, 
  assignHuntingDay,
  unassignHuntingDay,
  subscribeToSettings,
  subscribeToTransactions,
  subscribeToHuntingTimes
} from '../services';
import { HuntingDay, UserProfile, LakeSettings, Transaction, HuntingTime } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  getDay,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
  differenceInSeconds
} from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, User as UserIcon, Calendar as CalendarIcon, Info, Plus, X, Clock, Trash2, Filter, ArrowRight, ArrowLeftRight, ChevronDown, ShieldAlert, Target, Bird } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { useWeather } from '../hooks/useWeather';

function DuckHuntAI({ latitude, longitude }: { latitude?: number, longitude?: number }) {
  const { weather, loading: weatherLoading } = useWeather(latitude, longitude);
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && weather.length >= 3 && !prediction && !loading) {
      const getPrediction = async () => {
        setLoading(true);
        try {
          const summary = weather
            .filter(d => {
              const day = getDay(new Date(d.date));
              return day !== 2 && day !== 5; // Skip Tue and Fri
            })
            .slice(0, 3)
            .map(d => ({
            date: d.date,
            temp: d.temp,
            wind: d.windSpeed,
            windDir: d.windDirection,
            rainSum: d.rainAmount,
            prob: d.rainProb,
            condition: d.condition
          }));
          
          const response = await fetch('/api/ai/hunt-prediction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weatherSummary: summary })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to fetch prediction");
          }

          const data = await response.json();
          setPrediction(data);
        } catch (e: any) {
          console.error(e);
          setPrediction({ error: e.message });
        } finally {
          setLoading(false);
        }
      };
      getPrediction();
    }
  }, [weather, prediction, loading, isOpen]);

  return (
    <div className="bg-slate-900 text-white rounded-xl overflow-hidden border border-slate-800 shadow-lg animate-in fade-in slide-in-from-top-2 duration-500 mb-6 group">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 bg-gradient-to-r from-accent-gold/20 to-transparent border-b border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="bg-accent-gold p-1 rounded-sm shadow-lg shadow-accent-gold/20">
            <Target size={12} className="text-slate-900" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent-gold">IA Previsione Caccia</span>
        </div>
        <div className="flex items-center gap-3">
          {(!prediction && !loading) && <span className="text-[7px] font-bold uppercase text-slate-500 animate-pulse">Analisi disponibile</span>}
          <div className={cn("transition-transform duration-300", isOpen ? "rotate-180" : "")}>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3">
              {loading || weatherLoading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <div className="w-6 h-6 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-accent-gold/50">Consultando l'Intelligenza Artificiale...</span>
                </div>
              ) : prediction && prediction.days ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-white/10 pb-2 md:pb-0 md:pr-4">
                    <p className="text-[10px] font-bold italic text-slate-200 leading-tight mb-2">
                      "{prediction.prediction}"
                    </p>
                    <div className="flex items-center gap-1 opacity-60">
                      <Bird size={10} className="text-accent-gold" />
                      <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">Analisi Fenologica (ISPRA)</span>
                    </div>
                  </div>
                  
                  <div className="md:col-span-3">
                    <div className="flex justify-between gap-1 sm:gap-4 overflow-x-auto scrollbar-hide">
                      {prediction.days.map((day: any) => (
                        <div key={day.date} className="flex flex-1 items-center gap-2 sm:gap-3 min-w-max px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                          <div className="flex flex-col items-center min-w-[30px]">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                              {format(new Date(day.date), 'EEE', { locale: it })}
                            </span>
                            <span className="text-[10px] font-bold text-white leading-none">
                              {format(new Date(day.date), 'dd')}
                            </span>
                          </div>
                          
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "text-base font-black tabular-nums drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]",
                              day.probability > 70 ? "text-emerald-400" : day.probability > 40 ? "text-accent-gold" : "text-rose-400"
                            )}>
                              {day.probability}%
                            </div>
                          </div>

                          <div className="hidden sm:flex flex-col">
                            <p className={cn(
                              "text-[8px] font-black uppercase tracking-tight leading-none mb-0.5",
                              day.probability > 70 ? "text-emerald-400" : day.probability > 40 ? "text-accent-gold" : "text-rose-400"
                            )}>{day.label}</p>
                            <p className="text-[8px] text-slate-300 font-medium leading-none truncate max-w-[90px]">{day.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-[10px] text-rose-400 font-bold uppercase">
                  {prediction?.error ? `Errore: ${prediction.error}` : "Impossibile ottenere la previsione"}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Countdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, s: number } | null>(null);

  useEffect(() => {
    const calculate = () => {
      const target = parseISO(targetDate);
      const now = new Date();
      const diff = differenceInSeconds(target, now);

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        d: Math.floor(diff / (24 * 3600)),
        h: Math.floor((diff % (24 * 3600)) / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: diff % 60
      });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-3 sm:gap-4 bg-lake-green text-accent-gold p-4 sm:p-6 rounded-lg shadow-xl border-t-4 border-accent-gold animate-in fade-in zoom-in duration-500">
      <div className="bg-white/10 p-2 sm:p-3 rounded-full shrink-0">
        <Clock size={24} className="sm:w-8 sm:h-8 text-white animate-pulse" />
      </div>
      <div className="min-w-0">
        <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/60 mb-1 truncate">Apertura Stagione Venatoria</p>
        <div className="flex gap-2 sm:gap-4">
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-3xl font-black tabular-nums">{timeLeft.d}</span>
            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-white/40">Giorni</span>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white/20">:</div>
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-3xl font-black tabular-nums">{timeLeft.h.toString().padStart(2, '0')}</span>
            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-white/40">Ore</span>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white/20">:</div>
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-3xl font-black tabular-nums">{timeLeft.m.toString().padStart(2, '0')}</span>
            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-white/40">Min</span>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white/20">:</div>
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-3xl font-black tabular-nums">{timeLeft.s.toString().padStart(2, '0')}</span>
            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-widest text-white/40">Sec</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TodayInfo({ day, assignments, isSilenced, title }: { day: Date, assignments: HuntingDay[], isSilenced: boolean, title?: string }) {
  const dayName = format(day, 'EEEE', { locale: it });
  const dateStr = format(day, 'dd', { locale: it });
  const monthStr = format(day, 'MMMM', { locale: it });

  if (isSilenced) {
    return (
      <div className="flex items-center gap-3 sm:gap-4 bg-rose-600 text-white p-4 sm:p-6 rounded-lg shadow-xl border-t-4 border-rose-800 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/10 p-2 sm:p-3 rounded-full shrink-0">
          <ShieldAlert size={24} className="sm:w-8 sm:h-8 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/50 mb-0.5 truncate">{title || "Stato Attuale"}</p>
          <h3 className="text-xl sm:text-3xl font-black tabular-nums leading-none mb-1 capitalize">
            {dayName} <span className="opacity-60">{dateStr}</span> {monthStr}
          </h3>
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest opacity-80 italic">Silenzio Venatorio - Chiuso</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 sm:gap-4 bg-lake-green text-accent-gold p-4 sm:p-6 rounded-lg shadow-xl border-t-4 border-accent-gold animate-in fade-in zoom-in duration-500">
      <div className="bg-white/10 p-2 sm:p-3 rounded-full shrink-0">
        <UserIcon size={24} className="sm:w-8 sm:h-8 text-white transition-transform" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/40 mb-0.5 truncate">{title || "Cacciatori di Oggi"}</p>
        <h3 className="text-xl sm:text-3xl font-black tabular-nums text-white leading-none mb-2 capitalize">
          {dayName} <span className="opacity-40">{dateStr}</span> {monthStr}
        </h3>
        <div className="flex flex-wrap gap-2">
          {assignments.length > 0 ? (
            assignments.map(a => (
              <span key={a.id} className="bg-white/10 px-3 py-1 rounded border border-white/20 text-[10px] sm:text-xs font-black text-accent-gold uppercase tracking-widest whitespace-nowrap">
                {a.assignedToName}
              </span>
            ))
          ) : (
            <span className="text-white/40 italic text-[10px] sm:text-xs font-bold uppercase tracking-widest">Nessun cacciatore assegnato</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function HuntingCalendar() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasInitializedDate, setHasInitializedDate] = useState(false);
  const [huntingDays, setHuntingDays] = useState<HuntingDay[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<LakeSettings | null>(null);
  const [huntingTimes, setHuntingTimes] = useState<HuntingTime[]>([]);
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [hideSilence, setHideSilence] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTargetDate, setSwapTargetDate] = useState<string>('');

  useEffect(() => {
    // Auto-toggle based on initial screen size
    if (window.innerWidth > 1024) {
      setHideSilence(false);
    }
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribeToHuntingDays(setHuntingDays),
      subscribeToUsers(setAvailableUsers),
      subscribeToSettings(setSettings),
      subscribeToHuntingTimes(setHuntingTimes)
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    if (settings?.seasonStart && !hasInitializedDate) {
      try {
        setCurrentDate(parseISO(settings.seasonStart));
        setHasInitializedDate(true);
      } catch (e) {
        console.error("Error setting initial calendar date:", e);
      }
    }
  }, [settings, hasInitializedDate]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const isHuntingDay = (date: Date) => {
    const day = getDay(date);
    // Martedì(2) e Venerdì(5) sono Silenzio Venatorio
    return day !== 2 && day !== 5;
  };

  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const visibleDays = hideSilence ? allDays.filter(isHuntingDay) : allDays;

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const itDays = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
  const visibleHeaders = hideSilence ? itDays.filter((_, i) => i !== 1 && i !== 4) : itDays;

  const isInSeason = (date: Date) => {
    if (!settings) return true;
    try {
      return isWithinInterval(date, {
        start: parseISO(settings.seasonStart),
        end: parseISO(settings.seasonEnd)
      });
    } catch (e) {
      return true;
    }
  };

  const dayAssignments = (date: Date): HuntingDay[] => {
    const list: HuntingDay[] = [];
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // 1. Manual assignments
    const manuals = huntingDays.filter(d => d.date === dateStr);
    list.push(...manuals);

    // 2. Automatic recurring assignments
    if (isInSeason(date)) {
      const dayOfWeek = getDay(date);
      const recurringUsers = availableUsers.filter(u => u.isActive && (u.assignedDaysOfWeek || []).includes(dayOfWeek));
      
      recurringUsers.forEach(u => {
        // Only add if not manually overwritten for this specific person
        if (!manuals.some(m => m.assignedToUid === u.uid)) {
          list.push({
            id: `recurring-${u.uid}-${dateStr}`,
            date: dateStr,
            assignedToUid: u.uid,
            assignedToName: u.displayName,
            type: u.role === "quotista" ? "quotista" : "socio"
          });
        }
      });
    }
    return list;
  };

  const handleDayClick = (date: Date) => {
    if (!isHuntingDay(date)) return;
    if (!profile) return;
    setSelectedDay(date);
    setIsAssigning(true);
  };

  const onAssign = async (userId: string) => {
    if (!selectedDay) return;
    const currentAssignments = dayAssignments(selectedDay);
    if (currentAssignments.length >= 4) {
      alert("Massimo 4 cacciatori consentiti per giornata.");
      return;
    }

    const user = availableUsers.find(u => u.uid === userId);
    if (!user) return;

    await assignHuntingDay({
      id: `${format(selectedDay, 'yyyy-MM-dd')}_${user.uid}`,
      date: format(selectedDay, 'yyyy-MM-dd'),
      assignedToUid: user.uid,
      assignedToName: user.displayName,
      type: user.role === 'socio' || user.role === 'admin' ? 'socio' : 'quotista'
    });
  };

  const onUnassign = async (id: string) => {
    await unassignHuntingDay(id);
  };

  const onSwap = async () => {
    if (!selectedDay || !swapTargetDate) return;
    
    const date1 = format(selectedDay, 'yyyy-MM-dd');
    const date2 = swapTargetDate;

    const assignments1 = huntingDays.filter(d => d.date === date1);
    const assignments2 = huntingDays.filter(d => d.date === date2);

    // Swap date1 to date2
    const promises: Promise<any>[] = [];

    // Remove existing ones
    assignments1.forEach(a => promises.push(unassignHuntingDay(a.id)));
    assignments2.forEach(a => promises.push(unassignHuntingDay(a.id)));

    await Promise.all(promises);

    const newPromises: Promise<any>[] = [];
    // Move 1 to 2
    assignments1.forEach(a => {
      newPromises.push(assignHuntingDay({ ...a, date: date2, id: `${date2}_${a.assignedToUid}` }));
    });
    // Move 2 to 1
    assignments2.forEach(a => {
      newPromises.push(assignHuntingDay({ ...a, date: date1, id: `${date1}_${a.assignedToUid}` }));
    });

    await Promise.all(newPromises);

    setShowSwapModal(false);
    setIsAssigning(false);
    setSelectedDay(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Calendario Venatorio</h1>
          <p className="text-slate-gray font-medium">Assegnazione giornate ai soci e quotisti</p>
        </div>
        <div className="flex flex-col items-end gap-2">
        </div>
      </header>
      
      {/* AI Hunting Prediction element */}
      <DuckHuntAI latitude={settings?.latitude} longitude={settings?.longitude} />

      {/* Countdown or Today's Status based on season start */}
      {settings && settings.seasonStart && parseISO(settings.seasonStart).toString() !== 'Invalid Date' && (
        <div className="space-y-6">
          {parseISO(settings.seasonStart) > new Date() ? (
            <Countdown targetDate={settings.seasonStart} />
          ) : (
            <TodayInfo 
              day={new Date()} 
              assignments={dayAssignments(new Date())} 
              isSilenced={!isHuntingDay(new Date())} 
            />
          )}
          
          {huntingTimes.length > 0 && (
            <div className="card-polish overflow-hidden !p-0 border-t-4 border-lake-green">
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-off-white border-b border-slate-100 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-lake-green" />
                  <h3 className="text-xs font-black text-slate-gray uppercase tracking-widest">Tabella Orari e Periodi di Caccia</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-lake-green animate-pulse" />
                  <span className="text-[10px] font-black text-lake-green uppercase tracking-widest">Periodo Attivo</span>
                </div>
              </motion.div>
              <div className="">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead className="bg-white border-b border-slate-100">
                    <tr className="text-[0.55rem] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-2 py-3 w-[28%] text-center">Dal</th>
                      <th className="px-2 py-3 w-[26%] text-center">Al</th>
                      <th className="px-2 py-3 w-[23%] text-center">Alba</th>
                      <th className="px-2 py-3 w-[23%] text-center">Tramonto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllTimes ? huntingTimes : huntingTimes.slice(0, 2)).map((time, idx) => {
                      const isCurrent = idx === 0;
                      return (
                        <tr 
                          key={time.id} 
                          className={cn(
                            "transition-all duration-300",
                            isCurrent 
                              ? "bg-emerald-50/60 ring-2 ring-inset ring-lake-green relative z-10 shadow-sm" 
                              : "hover:bg-slate-50/50 border-b border-slate-50 last:border-0"
                          )}
                        >
                          <td className="px-1 py-3 whitespace-nowrap text-center align-bottom">
                            <div className="flex flex-col items-center">
                              {isCurrent && <span className="text-[7px] font-black text-lake-green uppercase tracking-tighter mb-0.5">In corso</span>}
                              <span className={cn(
                                "font-black leading-none",
                                isCurrent ? "text-xs text-lake-green" : "text-[10px] text-slate-700"
                              )}>
                                {format(new Date(time.startDate), 'dd/MM/yy', { locale: it })}
                              </span>
                            </div>
                          </td>
                          <td className="px-1 py-3 whitespace-nowrap align-bottom text-center">
                            <div className="pb-[1px]">
                              <span className={cn(
                                "font-bold leading-none",
                                isCurrent ? "text-xs text-slate-900" : "text-[10px] text-slate-600"
                              )}>
                                {format(new Date(time.endDate), 'dd/MM/yy', { locale: it })}
                              </span>
                            </div>
                          </td>
                          <td className="px-1 py-3 whitespace-nowrap align-bottom text-center">
                            <div className="pb-0.5">
                              <span className={cn(
                                "font-black text-white px-2 py-1 rounded shadow-sm inline-block min-w-[42px]",
                                isCurrent ? "bg-lake-green text-[11px]" : "bg-lake-green/50 text-[9px]"
                              )}>
                                {time.startTime}
                              </span>
                            </div>
                          </td>
                          <td className="px-1 py-3 whitespace-nowrap align-bottom text-center">
                            <div className="pb-0.5">
                              <span className={cn(
                                "font-black text-white px-2 py-1 rounded shadow-sm inline-block min-w-[42px]",
                                isCurrent ? "bg-rose-600 text-[11px]" : "bg-rose-600/50 text-[9px]"
                              )}>
                                {time.endTime}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {huntingTimes.length > 2 && (
                <button
                  onClick={() => setShowAllTimes(!showAllTimes)}
                  className="w-full py-3 bg-white hover:bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2 transition-colors group"
                >
                  <span className="text-[10px] font-black text-slate-400 group-hover:text-lake-green uppercase tracking-[0.2em]">
                    {showAllTimes ? 'Mostra meno periodi' : `Mostra altri ${huntingTimes.length - 2} periodi`}
                  </span>
                  <div className={cn("transition-transform duration-300", showAllTimes ? "rotate-180" : "")}>
                    <ChevronDown size={14} className="text-slate-300 group-hover:text-lake-green" />
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <section className="card-polish !p-0 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 bg-off-white border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-sm sm:text-lg font-bold text-slate-gray uppercase tracking-widest">
              {format(currentDate, 'MMMM yyyy', { locale: it })}
            </h2>
            <button 
              onClick={() => setHideSilence(!hideSilence)}
              className={cn(
                "hidden sm:flex items-center gap-2 px-3 py-1 rounded border text-[9px] font-black uppercase tracking-widest transition-all",
                hideSilence ? "bg-lake-green text-white border-lake-green" : "bg-white text-slate-400 border-slate-200"
              )}
            >
              <Filter size={12} /> {hideSilence ? 'Mostra Giorni Chiusi' : 'Nascondi Giorni Chiusi'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setHideSilence(!hideSilence)}
              className={cn(
                "sm:hidden p-2 rounded border transition-all",
                hideSilence ? "bg-lake-green text-white border-lake-green" : "bg-white text-slate-400 border-slate-200"
              )}
            >
              <Filter size={18} />
            </button>
            <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded transition-colors text-lake-green">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded transition-colors text-lake-green">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="min-w-[320px] lg:min-w-0">
            <div className={cn(
              "grid border-b border-slate-50",
              hideSilence ? "grid-cols-5" : "grid-cols-7"
            )}>
              {visibleHeaders.map(d => (
                <div key={d} className="py-4 text-center text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className={cn(
              "grid",
              hideSilence ? "grid-cols-5" : "grid-cols-7"
            )}>
              {visibleDays.map((day, idx) => {
                const assignments = dayAssignments(day);
                const canHunt = isHuntingDay(day);
                const inSeason = isInSeason(day);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isToday = isSameDay(day, new Date());

                const isSilenced = !canHunt || !inSeason;

                return (
                  <div 
                    key={day.toString()}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "min-h-[80px] lg:min-h-[140px] p-1.5 sm:p-2 border-r border-b border-slate-50 transition-all group relative cursor-pointer",
                      !isCurrentMonth && "opacity-30",
                      !isSilenced ? "calendar-day-hunting" : "bg-rose-50/30",
                      !isSilenced && isCurrentMonth && "hover:bg-accent-gold/5"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-xs font-bold h-6 w-6 flex items-center justify-center rounded-sm",
                        isToday ? "bg-accent-gold text-white" : "text-slate-gray",
                        isSilenced && !isToday && "text-rose-400"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {!isSilenced ? (
                      assignments.length > 0 ? (
                        <div className="flex flex-col gap-1 mt-1">
                          {/* Mobile View: Dots */}
                          <div className="flex flex-wrap gap-1 lg:hidden">
                            {assignments.map(assignment => (
                              <div 
                                key={assignment.id} 
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  assignment.type === 'socio' ? "bg-blue-500" : "bg-purple-500"
                                )}
                                title={assignment.assignedToName}
                              />
                            ))}
                          </div>
                          
                          {/* Desktop View: Names */}
                          <div className="hidden lg:flex flex-col gap-1">
                            {assignments.map(assignment => (
                              <div key={assignment.id} className="flex flex-col items-center bg-white/50 p-1 rounded border border-slate-100 shadow-sm">
                                <span className="text-[0.55rem] font-bold uppercase text-slate-600 truncate w-full text-center">
                                  {assignment.assignedToName}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className={cn(
                                    "text-[7px] font-black px-1 rounded uppercase tracking-tighter",
                                    assignment.type === 'socio' ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                                  )}>
                                    {assignment.type === 'socio' ? 'Socio' : 'Quota'}
                                  </span>
                                  {assignment.id.includes('recurring') && (
                                    <span className="text-[7px] font-black text-accent-gold uppercase tracking-tighter">Fisso</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="hidden group-hover:flex items-center justify-center opacity-20 h-8">
                          {profile?.role === 'admin' || profile?.role === 'socio' ? <Plus size={16} className="text-lake-green" /> : null}
                        </div>
                      )
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 pointer-events-none text-rose-800 text-center p-2">
                        <span className="text-[0.55rem] font-bold uppercase tracking-widest leading-none mb-1">
                          {!inSeason ? 'Fuori Stagione' : 'Silenzio'}
                        </span>
                        <span className="text-[10px] font-black italic uppercase">Chiuso</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Assignment Modal */}
      <AnimatePresence>
        {isAssigning && selectedDay && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-8 max-w-lg w-full shadow-2xl border-t-8 border-accent-gold max-h-[90vh] overflow-y-auto relative"
            >
            <button 
              onClick={() => setIsAssigning(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-lake-green transition-colors"
            >
              <X size={24} />
            </button>
            <h3 className="text-xl font-serif text-lake-green mb-1">
              Dettaglio Giornata
            </h3>
            <p className="text-slate-gray text-sm mb-6 font-medium capitalize">
              {format(selectedDay, 'EEEE dd MMMM yyyy', { locale: it })}
            </p>

            {/* Current Assignments Summary (Viewable by everyone) */}
            <div className="mb-8 space-y-4">
               <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                 <h4 className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Cacciatori Presenti</h4>
                 {dayAssignments(selectedDay).length > 0 && (
                   <span className={cn(
                     "text-[8px] font-bold px-2 py-0.5 rounded",
                     dayAssignments(selectedDay).length >= 4 ? "bg-rose-50 text-rose-600" : "text-lake-green bg-emerald-50"
                   )}>
                     {dayAssignments(selectedDay).length} / 4 POSTI
                   </span>
                 )}
               </div>
               
               {dayAssignments(selectedDay).length === 0 ? (
                 <p className="text-xs text-slate-400 italic">Nessun cacciatore assegnato per oggi.</p>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {dayAssignments(selectedDay).map(a => (
                      <div key={a.id} className="p-3 bg-off-white rounded-lg border border-slate-100 flex flex-col gap-1 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              a.type === 'socio' ? "bg-blue-500" : "bg-purple-500"
                            )} />
                            <span className="text-sm font-bold text-slate-800">{a.assignedToName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {a.id.includes('recurring') ? (
                              <span className="text-[7px] font-black text-accent-gold uppercase tracking-tighter">FISSO</span>
                            ) : (
                              (profile?.role === 'admin' || profile?.role === 'socio') && (
                                <button 
                                  onClick={() => onUnassign(a.id)}
                                  className="text-rose-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Rimuovi"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )
                            )}
                            <span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">
                              {a.type === 'socio' ? 'Socio' : 'Quotista'}
                            </span>
                          </div>
                        </div>
                      </div>
                   ))}
                 </div>
               )}
            </div>

            {/* Admin/Socio Controls */}
            {(profile?.role === 'admin' || profile?.role === 'socio') && (
              <div className="border-t border-slate-100 pt-6 space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest">Azioni Rapide</p>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowSwapModal(true)}
                      className="text-[9px] font-bold text-accent-gold hover:underline flex items-center gap-1"
                    >
                      <ArrowLeftRight size={10} /> SCAMBIA GIORNATA
                    </button>
                    <Link 
                      to="/accounting"
                      className="text-[9px] font-bold text-lake-green hover:underline flex items-center gap-1"
                    >
                      REGISTRA QUOTA <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>

                {showSwapModal && (
                  <div className="p-4 bg-accent-gold/5 border border-accent-gold/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-accent-gold uppercase tracking-widest mb-3">Seleziona data con cui scambiare</p>
                    <div className="flex gap-2">
                      <input 
                        type="date"
                        value={swapTargetDate}
                        onChange={e => setSwapTargetDate(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-accent-gold"
                      />
                      <button 
                        onClick={onSwap}
                        disabled={!swapTargetDate}
                        className="bg-accent-gold text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-opacity-90 disabled:opacity-50"
                      >
                        Conferma
                      </button>
                      <button 
                        onClick={() => setShowSwapModal(false)}
                        className="text-[10px] font-bold text-slate-400 px-2"
                      >
                        X
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1">Aggiungi Cacciatore (Manuale)</p>
                    {dayAssignments(selectedDay).length >= 4 && (
                      <span className="text-[9px] font-bold text-rose-500 uppercase tracking-tight italic">Limite raggiunto (4)</span>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {availableUsers
                      .filter(u => u.isActive)
                      .filter(u => !dayAssignments(selectedDay).some(a => a.assignedToUid === u.uid))
                      .map(user => (
                        <button
                          key={user.uid}
                          disabled={dayAssignments(selectedDay).length >= 4}
                          onClick={() => onAssign(user.uid)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded border border-slate-50 transition-all group mb-2 text-left",
                            dayAssignments(selectedDay).length >= 4 
                              ? "opacity-50 cursor-not-allowed grayscale" 
                              : "hover:border-accent-gold hover:bg-white"
                          )}
                        >
                          <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold uppercase",
                            user.role === 'admin' ? "bg-lake-green text-white" : "bg-slate-100 text-slate-gray"
                          )}>
                            {user.displayName[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs">{user.displayName}</p>
                            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest leading-tight">{user.role}</p>
                          </div>
                        </div>
                        {dayAssignments(selectedDay).length < 4 && (
                          <Plus size={14} className="text-slate-200 group-hover:text-accent-gold" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsAssigning(false)}
              className="mt-8 w-full py-2 text-slate-gray font-bold text-xs uppercase tracking-widest hover:text-lake-green transition-colors"
            >
              Chiudi
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}
