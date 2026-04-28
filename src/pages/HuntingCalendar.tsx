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
import { ChevronLeft, ChevronRight, User as UserIcon, Calendar as CalendarIcon, Info, Plus, X, Clock, Trash2, Filter, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

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

export function HuntingCalendar() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasInitializedDate, setHasInitializedDate] = useState(false);
  const [huntingDays, setHuntingDays] = useState<HuntingDay[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<LakeSettings | null>(null);
  const [huntingTimes, setHuntingTimes] = useState<HuntingTime[]>([]);
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
    
    // 1. Manual assignments
    const manual = huntingDays.find(d => isSameDay(new Date(d.date), date));
    if (manual) {
      list.push(manual);
    }

    // 2. Automatic recurring assignments
    if (isInSeason(date)) {
      const dayOfWeek = getDay(date);
      const recurringUsers = availableUsers.filter(u => u.isActive && (u.assignedDaysOfWeek || []).includes(dayOfWeek));
      
      recurringUsers.forEach(u => {
        // Only add if not manually overwritten for this specific person
        if (!manual || manual.assignedToUid !== u.uid) {
          list.push({
            id: `recurring-${u.uid}-${format(date, "yyyy-MM-dd")}`,
            date: format(date, "yyyy-MM-dd"),
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
    const user = availableUsers.find(u => u.uid === userId);
    if (!user) return;

    await assignHuntingDay({
      id: format(selectedDay, 'yyyy-MM-dd'),
      date: format(selectedDay, 'yyyy-MM-dd'),
      assignedToUid: user.uid,
      assignedToName: user.displayName,
      type: user.role === 'socio' || user.role === 'admin' ? 'socio' : 'quotista'
    });
    setIsAssigning(false);
    setSelectedDay(null);
  };

  const onUnassign = async () => {
    if (!selectedDay) return;
    await unassignHuntingDay(format(selectedDay, 'yyyy-MM-dd'));
    setIsAssigning(false);
    setSelectedDay(null);
  };

  const onSwap = async () => {
    if (!selectedDay || !swapTargetDate) return;
    
    const date1 = format(selectedDay, 'yyyy-MM-dd');
    const date2 = swapTargetDate;

    const assignment1 = huntingDays.find(d => d.date === date1);
    const assignment2 = huntingDays.find(d => d.date === date2);

    if (assignment1) {
      await assignHuntingDay({ ...assignment1, date: date2, id: date2 });
    } else {
      await unassignHuntingDay(date2);
    }

    if (assignment2) {
      await assignHuntingDay({ ...assignment2, date: date1, id: date1 });
    } else {
      await unassignHuntingDay(date1);
    }

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
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded border border-slate-200 shadow-sm text-xs font-bold text-lake-green uppercase tracking-wide">
            <Info size={14} className="text-accent-gold" />
            Martedì e Venerdì: Chiuso
          </div>
        </div>
      </header>

      {settings && settings.seasonStart && parseISO(settings.seasonStart).toString() !== 'Invalid Date' && parseISO(settings.seasonStart) > new Date() && (
        <div className="space-y-6">
          <Countdown targetDate={settings.seasonStart} />
          
          {huntingTimes.length > 0 && (
            <div className="card-polish overflow-hidden !p-0 border-t-4 border-lake-green">
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-off-white border-b border-slate-100 flex items-center gap-2"
              >
                <Clock size={16} className="text-lake-green" />
                <h3 className="text-xs font-black text-slate-gray uppercase tracking-widest">Tabella Orari e Periodi di Caccia</h3>
              </motion.div>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-slate-50">
                    <tr className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-4 py-2">Inizio</th>
                      <th className="px-4 py-2">Fine</th>
                      <th className="px-4 py-2">Inizio</th>
                      <th className="px-4 py-2">Fine</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {huntingTimes.map((time) => (
                      <tr key={time.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <span className="text-[11px] font-bold text-slate-900 leading-none">
                            {format(new Date(time.startDate), 'dd/MM/yy', { locale: it })}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <span className="text-[11px] font-bold text-slate-900 leading-none">
                            {format(new Date(time.endDate), 'dd/MM/yy', { locale: it })}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <span className="text-[10px] font-black text-lake-green bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                            {time.startTime}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 whitespace-nowrap">
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-100">
                            {time.endTime}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                   <span className="text-[8px] font-bold text-lake-green bg-emerald-50 px-2 py-0.5 rounded">
                     {dayAssignments(selectedDay).length} / 2 POSTI
                   </span>
                 )}
               </div>
               
               {dayAssignments(selectedDay).length === 0 ? (
                 <p className="text-xs text-slate-400 italic">Nessun cacciatore assegnato per oggi.</p>
               ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {dayAssignments(selectedDay).map(a => (
                      <div key={a.id} className="p-3 bg-off-white rounded-lg border border-slate-100 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              a.type === 'socio' ? "bg-blue-500" : "bg-purple-500"
                            )} />
                            <span className="text-sm font-bold text-slate-800">{a.assignedToName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {a.id.includes('recurring') && <span className="text-[7px] font-black text-accent-gold uppercase tracking-tighter">FISSO</span>}
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

                {/* Current Manual Assignment */}
                {huntingDays.find(d => isSameDay(new Date(d.date), selectedDay)) && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Rimozione Assegnazione</p>
                      <p className="text-sm font-bold text-rose-900">
                        {huntingDays.find(d => isSameDay(new Date(d.date), selectedDay))?.assignedToName}
                      </p>
                    </div>
                    <button 
                      onClick={onUnassign}
                      className="bg-rose-600 text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-rose-700 transition-all flex items-center gap-2"
                    >
                      <Trash2 size={12} /> Rimuovi
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1">Aggiungi Cacciatore (Manuale)</p>
                  <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {availableUsers
                      .filter(u => u.isActive)
                      .filter(u => !dayAssignments(selectedDay).some(a => a.assignedToUid === u.uid))
                      .map(user => (
                        <button
                          key={user.uid}
                          onClick={() => onAssign(user.uid)}
                          className="w-full flex items-center justify-between p-3 rounded border border-slate-50 hover:border-accent-gold hover:bg-white transition-all group mb-2"
                        >
                          <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold uppercase",
                            user.role === 'admin' ? "bg-lake-green text-white" : "bg-slate-100 text-slate-gray"
                          )}>
                            {user.displayName[0]}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-slate-800 text-xs">{user.displayName}</p>
                            <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest leading-tight">{user.role}</p>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-200 group-hover:text-accent-gold" />
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
