import React, { useState, useEffect } from 'react';
import { 
  addTransaction, 
  deleteTransaction,
  updateTransaction,
  subscribeToTransactions, 
  subscribeToHuntingDays,
  subscribeToUsers,
  subscribeToSettings,
  updateSettings,
  subscribeToBudgetItems,
  addBudgetItem,
  updateBudgetItem,
  deleteBudgetItem
} from '../services';
import { Transaction, HuntingDay, UserProfile, LakeSettings, BudgetItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, X, User as UserIcon, Calendar as CalendarIcon, Settings, ChevronRight, CheckCircle2, BarChart3, Target, PieChart, Trash2, Edit2, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, getDay, isWithinInterval } from 'date-fns';
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

export function Accounting() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  const showAdd = searchParams.get('modal') === 'add';
  const showQuotaConfig = searchParams.get('modal') === 'quota';
  const showBudgetConfig = searchParams.get('modal') === 'budget';

  const handleToggleModal = (modalName: 'quota' | 'budget' | 'add' | null) => {
    if (!modalName) {
      setSearchParams({});
      setEditingTransactionId(null);
    } else {
      setSearchParams({ modal: modalName });
    }
  };

  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [huntingDays, setHuntingDays] = useState<HuntingDay[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<LakeSettings | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [editingBudgetItemId, setEditingBudgetItemId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const [newBudgetItem, setNewBudgetItem] = useState<Omit<BudgetItem, 'id'>>({
    label: '',
    amount: 0,
    type: 'uscita'
  });

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'entrata' as 'entrata' | 'uscita',
    category: '',
    amount: 0,
    description: '',
    huntingDayId: '',
    payerUid: '',
    payerName: '',
    memberUid: '',
    memberName: ''
  });

  const getSortedBudgetCategories = (type: 'entrata' | 'uscita', itemsList: BudgetItem[]) => {
    return itemsList
      .filter(b => (b.type || 'uscita') === type)
      .sort((a, b) => {
        if (type === 'entrata') {
          const isAStagionale = a.label.trim().toLowerCase().includes('stagional');
          const isBStagionale = b.label.trim().toLowerCase().includes('stagional');
          if (isAStagionale && !isBStagionale) return -1;
          if (!isAStagionale && isBStagionale) return 1;
        }
        return (a.label || '').localeCompare(b.label || '');
      });
  };

  const availableBudgetCategories = getSortedBudgetCategories(formData.type, budgetItems);

  const handleTypeChange = (newType: 'entrata' | 'uscita') => {
    const cats = getSortedBudgetCategories(newType, budgetItems);
    const isCurrentValid = cats.some(c => c.label === formData.category);
    setFormData({
      ...formData,
      type: newType,
      category: isCurrentValid ? formData.category : (cats[0]?.label || '')
    });
  };

  const getCategoryActual = (label: string, type: 'entrata' | 'uscita') => {
    return items
      .filter(t => t.type === type && (t.category || '').trim().toLowerCase() === label.trim().toLowerCase())
      .reduce((acc, t) => acc + t.amount, 0);
  };

  useEffect(() => {
    const unsubTx = subscribeToTransactions((data) => {
      setItems(data);
      const uniqueCats = Array.from(new Set(data.map(i => i.category))).sort();
      setCategorySuggestions(uniqueCats);
      setLoading(false);
    });

    const unsubDays = subscribeToHuntingDays(setHuntingDays);
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubSettings = subscribeToSettings(setSettings);
    const unsubBudget = subscribeToBudgetItems((bItems) => {
      setBudgetItems(bItems);
      setFormData(prev => {
        if (!prev.category && bItems.length > 0) {
          const sorted = getSortedBudgetCategories(prev.type, bItems);
          if (sorted.length > 0) return { ...prev, category: sorted[0].label };
        }
        return prev;
      });
    });

    return () => {
      unsubTx();
      unsubDays();
      unsubUsers();
      unsubSettings();
      unsubBudget();
    };
  }, []);

  const totalIncome = items.filter(i => i.type === 'entrata').reduce((acc, i) => acc + i.amount, 0);
  const totalExpense = items.filter(i => i.type === 'uscita').reduce((acc, i) => acc + i.amount, 0);
  const balance = totalIncome - totalExpense;

  // Budget Calculations
  const budgetIncome = budgetItems.filter(b => b.type === 'entrata').reduce((acc, b) => acc + b.amount, 0);
  const budgetExpense = budgetItems.filter(b => b.type === 'uscita').reduce((acc, b) => acc + b.amount, 0);
  const budgetBalance = budgetIncome - budgetExpense;

  const handleUpdateWeekdayQuota = async (dayIndex: number, amount: number) => {
    if (!settings) return;
    const newQuotas = { ...(settings.weekdaySeasonQuotas || {}) };
    newQuotas[dayIndex] = amount;
    await updateSettings({ weekdaySeasonQuotas: newQuotas });
  };

  const getHuntersSummary = () => {
    const activeHunters = users.filter(u => u.isActive && u.role === 'quotista');
    
    // Calculate how many hunters per day to divide the quota
    const huntersPerDay: Record<number, number> = {};
    activeHunters.forEach(u => {
      (u.assignedDaysOfWeek || []).forEach(dayIdx => {
        // Only count days that aren't excluded (socio days)
        if (dayIdx !== 3 && dayIdx !== 6) {
          huntersPerDay[dayIdx] = (huntersPerDay[dayIdx] || 0) + 1;
        }
      });
    });

    return activeHunters
      .map(u => {
        // Use seasonalQuota if defined (and not zero), otherwise fallback to period-based calculation
        let targetQuota = u.seasonalQuota || 0;

        if (targetQuota === 0) {
          // Calculate target quota based on assigned days of week divided by group size
          (u.assignedDaysOfWeek || []).forEach(dayIdx => {
            // Explicitly zero for Wed (3) and Sat (6) as requested
            if (dayIdx === 3 || dayIdx === 6) return;
            
            const dayTotal = settings?.weekdaySeasonQuotas?.[dayIdx] || 0;
            const participants = huntersPerDay[dayIdx] || 1;
            targetQuota += dayTotal / participants;
          });
        }

        const paid = items
          .filter(t => t.type === 'entrata' && t.payerUid === u.uid)
          .reduce((acc, t) => acc + t.amount, 0);

        return {
          ...u,
          targetQuota,
          paid,
          balance: targetQuota - paid
        };
      })
      .sort((a, b) => b.balance - a.balance);
  };

  // Logic to get participants for a specific day (re-using calendar logic)
  const getParticipantsForDay = (dateStr: string) => {
    if (!dateStr) return [];
    const date = parseISO(dateStr);
    const dayOfWeek = getDay(date);
    
    const list: { uid: string, displayName: string, type: 'socio' | 'quotista' }[] = [];
    
    // 1. Manual assignments
    huntingDays.filter(d => d.date === dateStr).forEach(d => {
      list.push({ uid: d.assignedToUid, displayName: d.assignedToName, type: d.type });
    });

    // 2. Automatic recurring assignments
    const isInSeason = (d: Date) => {
      if (!settings) return true;
      try {
        return isWithinInterval(d, {
          start: parseISO(settings.seasonStart),
          end: parseISO(settings.seasonEnd)
        });
      } catch (e) {
        return true;
      }
    };

    if (isInSeason(date)) {
      users.filter(u => u.isActive && (u.assignedDaysOfWeek || []).includes(dayOfWeek)).forEach(u => {
        if (!list.some(m => m.uid === u.uid)) {
          list.push({
            uid: u.uid,
            displayName: u.displayName,
            type: u.role === "quotista" ? "quotista" : "socio"
          });
        }
      });
    }
    return list;
  };

  const getDayTotalExpenses = (dayId: string) => {
    return items
      .filter(t => t.type === 'uscita' && t.huntingDayId === dayId)
      .reduce((acc, t) => acc + t.amount, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // Auto-populate payerName if payerUid is selected
    const finalData = { ...formData };
    if (finalData.payerUid) {
      const u = users.find(user => user.uid === finalData.payerUid);
      if (u) finalData.payerName = u.displayName;
    }
    
    // Auto-populate memberName if memberUid is selected
    if (finalData.memberUid) {
      const u = users.find(user => user.uid === finalData.memberUid);
      if (u) finalData.memberName = u.displayName;
    } else if (profile.role === 'socio') {
      // Default to current socio if not set
      finalData.memberUid = profile.uid;
      finalData.memberName = profile.displayName;
    }

    if (editingTransactionId) {
        await updateTransaction(editingTransactionId, {
          ...finalData,
        });
        setEditingTransactionId(null);
    } else {
        await addTransaction({
          ...finalData,
          createdBy: profile.uid
        });
    }
    setFormData({ 
      ...formData, 
      category: '', 
      amount: 0, 
      description: '',
      huntingDayId: '',
      payerUid: '',
      payerName: '',
      memberUid: '',
      memberName: ''
    });
    handleToggleModal(null);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Contabilità & Spese</h1>
          <p className="text-slate-gray font-medium">Monitoraggio flussi finanziari del lago</p>
        </div>
        <div className="flex items-center gap-3">
          {(profile?.role === 'socio' || profile?.role === 'admin') && (
            <>
              <button 
                onClick={() => handleToggleModal(showBudgetConfig ? null : 'budget')}
                className={cn(
                  "px-4 py-2.5 rounded font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all border shadow-sm",
                  showBudgetConfig ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-lake-green hover:text-lake-green"
                )}
              >
                <PieChart size={16} />
                {showBudgetConfig ? 'Chiudi Budget' : 'Budget Preventivo'}
              </button>
              <button 
                onClick={() => handleToggleModal(showQuotaConfig ? null : 'quota')}
                className={cn(
                  "px-4 py-2.5 rounded font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all border shadow-sm",
                  showQuotaConfig ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-lake-green hover:text-lake-green"
                )}
              >
                <Settings size={16} />
                {showQuotaConfig ? 'Chiudi Config.' : 'Config. Quote'}
              </button>
            </>
          )}
          {profile?.role === 'socio' || profile?.role === 'admin' ? null : null}
        </div>
      </header>

      {showQuotaConfig && (
        <section className="card-polish !border-t-lake-green animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-serif text-lake-green">Gestione Quote Stagionali</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo totale della stagione diviso tra i cacciatori fissi</p>
            </div>
            <div className="px-3 py-1 bg-emerald-50 rounded border border-emerald-100 text-[10px] font-bold text-emerald-700">
              MERCOLEDÌ E SABATO SONO RISERVATI AI SOCI E NON HANNO QUOTA
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
            {['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'].map((day, idx) => {
              const isSilence = idx === 2 || idx === 5;
              const isSocioDay = idx === 3 || idx === 6;
              const huntersCount = users.filter(u => u.isActive && u.role === 'quotista' && (u.assignedDaysOfWeek || []).includes(idx)).length;
              const dayTotal = settings?.weekdaySeasonQuotas?.[idx] || 0;
              const quotaPerHunter = huntersCount > 0 ? dayTotal / huntersCount : 0;

              return (
                <div key={day} className={cn(
                  "p-4 rounded-lg border transition-all",
                  isSilence || isSocioDay ? "bg-slate-50 border-slate-100 opacity-60" : "bg-off-white border-slate-200 hover:border-lake-green group"
                )}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{day}</p>
                    <span className="text-[8px] font-bold text-slate-400">{huntersCount} cacciatori</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 group-focus-within:text-lake-green">€</span>
                    <input 
                      type="number"
                      disabled={isSilence || isSocioDay || profile?.role !== 'admin'}
                      placeholder=""
                      value={dayTotal || ''}
                      onChange={(e) => handleUpdateWeekdayQuota(idx, parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-100 rounded pl-6 pr-2 py-2 text-sm font-bold text-slate-900 outline-none focus:border-lake-green disabled:bg-transparent"
                    />
                  </div>
                  {!isSilence && !isSocioDay && quotaPerHunter > 0 && (
                    <p className="text-[8px] text-lake-green mt-2 font-bold uppercase tracking-tighter">Quota p.p. €{Math.round(quotaPerHunter).toLocaleString()}</p>
                  )}
                  {isSilence && <p className="text-[8px] text-slate-400 mt-1 font-bold">SILENZIO VENATORIO</p>}
                  {isSocioDay && <p className="text-[8px] text-blue-400 mt-1 font-bold">GIORNATA SOCI</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showBudgetConfig && (
        <section className="card-polish !border-t-purple-600 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-lg font-serif text-slate-900">Budget Preventivo Annuale</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Definisci le previsioni di spesa e di entrata per la stagione</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {profile?.role === 'admin' ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                    {editingBudgetItemId ? <Edit2 size={14} className="text-purple-600" /> : <Plus size={14} className="text-emerald-500" />} 
                    {editingBudgetItemId ? 'Modifica Voce di Budget' : 'Aggiungi Voce di Budget'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <input 
                        type="text"
                        placeholder="Descrizione (es. Mangime, Affitto...)"
                        value={newBudgetItem.label}
                        onChange={e => setNewBudgetItem({...newBudgetItem, label: e.target.value})}
                        className="w-full bg-off-white border border-slate-200 rounded px-3 py-2 text-xs font-bold outline-none focus:border-purple-600"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 italic">€</span>
                        <input 
                          type="number"
                          placeholder="Importo"
                          value={newBudgetItem.amount || ''}
                          onFocus={(e) => e.target.select()}
                          onChange={e => setNewBudgetItem({...newBudgetItem, amount: parseFloat(e.target.value) || 0})}
                          className="w-full bg-off-white border border-slate-200 rounded pl-6 pr-2 py-2 text-xs font-bold outline-none focus:border-purple-600"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <select 
                        value={newBudgetItem.type}
                        onChange={e => setNewBudgetItem({...newBudgetItem, type: e.target.value as any})}
                        className="w-full bg-off-white border border-slate-200 rounded px-2 py-2 text-xs font-bold outline-none focus:border-purple-600"
                      >
                        <option value="entrata">Entrata</option>
                        <option value="uscita">Uscita</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1 flex gap-1">
                      <button 
                        onClick={async () => {
                          if (!newBudgetItem.label || !newBudgetItem.amount) return;
                          if (editingBudgetItemId) {
                            await updateBudgetItem(editingBudgetItemId, newBudgetItem);
                            setEditingBudgetItemId(null);
                          } else {
                            await addBudgetItem(newBudgetItem);
                          }
                          setNewBudgetItem({ label: '', amount: 0, type: 'uscita' });
                        }}
                        className={cn(
                          "flex-1 aspect-square rounded flex items-center justify-center transition-colors shadow-sm",
                          editingBudgetItemId ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-emerald-600 text-white hover:bg-emerald-700"
                        )}
                        title={editingBudgetItemId ? "Aggiorna" : "Aggiungi"}
                      >
                        {editingBudgetItemId ? <Save size={16} /> : <Plus size={16} />}
                      </button>
                      {editingBudgetItemId && (
                        <button 
                          onClick={() => {
                            setEditingBudgetItemId(null);
                            setNewBudgetItem({ label: '', amount: 0, type: 'uscita' });
                          }}
                          className="flex-1 aspect-square bg-slate-200 text-slate-500 rounded flex items-center justify-center hover:bg-slate-300 transition-colors"
                          title="Annulla"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-lg text-xs text-slate-500 font-bold italic text-center">
                  Inserimento e modifiche del budget sono riservati all'amministratore
                </div>
              )}

              <div className="divide-y divide-slate-100 border rounded overflow-hidden">
                {budgetItems.length === 0 ? (
                  <p className="p-10 text-center text-xs text-slate-300 font-medium italic">Nessuna voce di budget definita</p>
                ) : (
                  budgetItems.map(item => {
                    const actual = getCategoryActual(item.label, item.type);
                    const pct = item.amount > 0 ? (actual / item.amount) * 100 : 0;
                    const isOverBudget = item.type === 'uscita' && actual > item.amount;
                    const isGoalReached = item.type === 'entrata' && actual >= item.amount;

                    return (
                      <div key={item.id} className={cn(
                        "p-3.5 flex flex-col gap-2 group hover:bg-slate-50 transition-colors",
                        editingBudgetItemId === item.id && "bg-purple-50"
                      )}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-slate-800">{item.label}</p>
                              <span className={cn(
                                "text-[8px] font-black uppercase px-1.5 py-0.5 rounded border",
                                item.type === 'entrata' 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              )}>
                                {item.type}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                              {item.type === 'entrata' ? 'Incassato' : 'Speso'}: <span className="font-bold text-slate-900">€{actual.toLocaleString()}</span> di €{item.amount.toLocaleString()} previsti ({pct.toFixed(0)}%)
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-700">Prev. €{item.amount.toLocaleString()}</span>
                            {profile?.role === 'admin' && (
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => {
                                    setEditingBudgetItemId(item.id);
                                    setNewBudgetItem({
                                      label: item.label,
                                      amount: item.amount,
                                      type: item.type
                                    });
                                  }}
                                  className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                  title="Modifica"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button 
                                  onClick={() => deleteBudgetItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                  title="Elimina"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar & Status indicator */}
                        <div className="space-y-1">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                item.type === 'entrata'
                                  ? (isGoalReached ? "bg-emerald-500" : "bg-accent-gold")
                                  : (isOverBudget ? "bg-rose-500" : "bg-slate-700")
                              )}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] font-bold">
                            <span className={cn(
                              item.type === 'entrata'
                                ? (isGoalReached ? "text-emerald-600" : "text-slate-400")
                                : (isOverBudget ? "text-rose-600 font-black" : "text-slate-400")
                            )}>
                              {item.type === 'entrata'
                                ? (isGoalReached ? '✓ Obiettivo raggiunto' : `Mancano €${Math.max(0, item.amount - actual).toLocaleString()}`)
                                : (isOverBudget ? `⚠ Fuori budget di €${(actual - item.amount).toLocaleString()}` : `Disponibile residuo €${(item.amount - actual).toLocaleString()}`)}
                            </span>
                            <span className="text-slate-400">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl p-6 text-white h-fit shadow-xl border border-white/5">
              <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-6">Analisi Preventivo</h4>
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <div>
                    <p className="text-white/40 text-[10px] font-bold uppercase mb-1">Entrate Previste</p>
                    <p className="text-2xl font-black text-emerald-400 tracking-tighter">€{budgetIncome.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-[10px] font-bold uppercase mb-1">Spese Previste</p>
                    <p className="text-2xl font-black text-rose-400 tracking-tighter">€{budgetExpense.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest leading-none">Cassa Attesa a fine stagione</p>
                  <p className={cn("text-3xl font-black tracking-tighter", budgetBalance >= 0 ? "text-white" : "text-rose-600")}>
                    €{budgetBalance.toLocaleString()}
                  </p>
                </div>
                <p className="text-[9px] text-white/20 italic text-center pt-4 uppercase tracking-widest">I dati actual verranno confrontati con questi obiettivi nel dashboard superiore</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hunters Status Table */}
      {(profile?.role === 'socio' || profile?.role === 'admin') && !showAdd && !showQuotaConfig && !showBudgetConfig && (
        <section className="card-polish">
          <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-gray uppercase flex items-center gap-2">
              <UserIcon size={16} className="text-lake-green" /> Stato Versamenti Cacciatori
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getHuntersSummary().map(hunter => (
              <div key={hunter.uid} className={cn(
                "p-4 rounded-lg border transition-all flex flex-col gap-3",
                hunter.balance <= 0 ? "bg-emerald-50/30 border-emerald-100" : "bg-white border-slate-100 shadow-sm"
              )}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                      {hunter.displayName}
                      {hunter.seasonalQuota ? (
                        <span className="text-[7px] bg-amber-100 text-amber-700 font-black px-1 rounded uppercase tracking-tighter">Fissa</span>
                      ) : null}
                    </h4>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      {(hunter.assignedDaysOfWeek || []).map(d => ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][d]).join(', ')}
                    </p>
                  </div>
                  {hunter.balance <= 0 && hunter.targetQuota > 0 ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded",
                      hunter.role === 'socio' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    )}>{hunter.role}</span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400">PAGATO</span>
                    <span className="text-slate-900">€{hunter.paid.toLocaleString()} / €{hunter.targetQuota.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        hunter.balance <= 0 ? "bg-emerald-500" : "bg-accent-gold"
                      )}
                      style={{ width: `${hunter.targetQuota > 0 ? Math.min((hunter.paid / hunter.targetQuota) * 100, 100) : 0}%` }}
                    />
                  </div>
                  {hunter.balance > 0 && (
                    <p className="text-[9px] text-rose-600 font-bold text-right tracking-tighter">MANCANO €{hunter.balance.toLocaleString()}</p>
                  )}
                </div>

                <button 
                  onClick={() => {
                    const defaultIncomeCat = budgetItems.find(b => b.type === 'entrata' && b.label.toLowerCase().includes('stagional'))?.label || budgetItems.find(b => b.type === 'entrata')?.label || '';
                    setFormData({
                      ...formData,
                      type: 'entrata',
                      category: defaultIncomeCat,
                      payerUid: hunter.uid,
                      payerName: hunter.displayName,
                      memberUid: profile?.role === 'socio' ? profile.uid : ''
                    });
                    handleToggleModal('add');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="mt-1 w-full text-[9px] font-black text-lake-green uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-lake-green/5 py-1.5 rounded transition-colors"
                >
                  REGISTRA VERSAMENTO <ChevronRight size={10} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="card-polish flex flex-col gap-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
            <Wallet size={64} />
          </div>
          <span className="text-[0.65rem] font-bold text-slate-gray uppercase tracking-widest leading-none">Saldo Attuale</span>
          <p className={cn(
            "text-3xl font-bold tracking-tighter z-10",
            balance >= 0 ? "text-slate-900" : "text-rose-700"
          )}>€{balance.toLocaleString()}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded",
              balance >= budgetBalance ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {balance >= budgetBalance ? 'Sopra' : 'Sotto'} Preventivo
            </span>
            <span className="text-[9px] font-bold text-slate-400">Progresso: €{budgetBalance > 0 ? Math.round((balance / budgetBalance) * 100) : '--'}%</span>
          </div>
        </div>

        <div className="card-polish flex flex-col gap-3 relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
            <TrendingUp size={64} />
          </div>
          <span className="text-[0.65rem] font-bold text-emerald-600 uppercase tracking-widest leading-none">Entrate Actual</span>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-emerald-700 tracking-tighter">€{totalIncome.toLocaleString()}</p>
            <span className="text-[10px] font-black text-slate-300">/ €{budgetIncome.toLocaleString()} prev.</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full mt-1">
             <div 
               className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
               style={{ width: `${budgetIncome > 0 ? Math.min((totalIncome / budgetIncome) * 100, 100) : 0}%` }} 
             />
          </div>
        </div>

        <div className="card-polish flex flex-col gap-3 relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
            <TrendingDown size={64} />
          </div>
          <span className="text-[0.65rem] font-bold text-rose-600 uppercase tracking-widest leading-none">Uscite Actual</span>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-rose-700 tracking-tighter">€{totalExpense.toLocaleString()}</p>
            <span className="text-[10px] font-black text-slate-300">/ €{budgetExpense.toLocaleString()} prev.</span>
          </div>
          <div className="h-1 bg-slate-100 rounded-full mt-1">
             <div 
               className="h-full bg-rose-500 rounded-full transition-all duration-1000" 
               style={{ width: `${budgetExpense > 0 ? Math.min((totalExpense / budgetExpense) * 100, 100) : 0}%` }} 
             />
          </div>
        </div>

        <div className="card-polish flex flex-col gap-3 relative group bg-lake-green text-white">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Target size={64} className="text-white" />
          </div>
          <span className="text-[0.65rem] font-bold text-white/60 uppercase tracking-widest leading-none">Performance Cassa</span>
          <p className="text-3xl font-bold tracking-tighter">
            {budgetBalance !== 0 ? ((balance / budgetBalance) * 100).toFixed(1) : '0'} %
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[9px] font-bold">
            <BarChart3 size={10} className="text-accent-gold" />
            <span className="uppercase tracking-widest text-white/50">Rispetto a fine stagione atteso</span>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      {(profile?.role === 'socio' || profile?.role === 'admin') && (
        <button
        onClick={() => {
          const firstCat = availableBudgetCategories[0]?.label || '';
          setFormData({
            ...formData,
            category: firstCat,
            memberUid: profile?.role === 'socio' ? profile.uid : ''
          });
          handleToggleModal('add');
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent-gold text-lake-green rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-4 border-white"
      >
        <Plus size={32} />
      </button>
      )}

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 sm:p-8 max-w-2xl w-full shadow-2xl border-t-8 border-accent-gold relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => handleToggleModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-lake-green transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-off-white p-3 rounded border border-slate-100 text-lake-green">
                  <Wallet size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-serif text-lake-green leading-none mb-1">
                    {editingTransactionId ? 'Modifica Movimento' : 'Nuovo Movimento'}
                  </h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    {editingTransactionId ? 'Aggiorna i dettagli dell\'operazione' : 'Registra una nuova entrata o uscita dal budget'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Tipo Movimento</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleTypeChange('entrata')}
                        className={cn(
                          "py-2 px-4 rounded font-bold text-xs uppercase tracking-widest border transition-all",
                          formData.type === 'entrata' 
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-md" 
                            : "bg-white text-slate-400 border-slate-200 hover:border-emerald-200"
                        )}
                      >
                        Entrata
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTypeChange('uscita')}
                        className={cn(
                          "py-2 px-4 rounded font-bold text-xs uppercase tracking-widest border transition-all",
                          formData.type === 'uscita' 
                            ? "bg-rose-500 text-white border-rose-500 shadow-md" 
                            : "bg-white text-slate-400 border-slate-200 hover:border-rose-200"
                        )}
                      >
                        Uscita
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">
                        Categoria {formData.type === 'entrata' ? '(Voci Entrata Budget)' : '(Voci Uscita Budget)'}
                      </label>
                      {availableBudgetCategories.length === 0 && (profile?.role === 'admin' || profile?.role === 'socio') && (
                        <button
                          type="button"
                          onClick={() => handleToggleModal('budget')}
                          className="text-[9px] font-bold text-purple-600 hover:text-purple-800 uppercase underline"
                        >
                          + Budget
                        </button>
                      )}
                    </div>
                    <select 
                      required
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                    >
                      <option value="" disabled>-- Seleziona Voce di {formData.type === 'entrata' ? 'Entrata' : 'Uscita'} --</option>
                      {availableBudgetCategories.map(b => (
                        <option key={b.id} value={b.label}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    {availableBudgetCategories.length === 0 && (
                      <p className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                        Nessuna voce di {formData.type} definita nel Budget Preventivo. Aggiungine una nella sezione "Budget Preventivo".
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Importo (€)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                      <input 
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={isNaN(formData.amount) || formData.amount === 0 ? '' : formData.amount}
                        onFocus={(e) => e.target.select()}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          setFormData({ ...formData, amount: isNaN(val) ? 0 : val });
                        }}
                        className="w-full bg-off-white border border-slate-200 rounded pl-8 pr-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                      />
                    </div>
                  </div>
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
                </div>
                
                {formData.type === 'entrata' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-emerald-50/50 rounded border border-emerald-100">
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        <CalendarIcon size={12} /> Associa a Giornata
                      </label>
                      <select 
                        value={formData.huntingDayId}
                        onChange={e => {
                          const hDayId = e.target.value;
                          const hDay = huntingDays.find(d => d.id === hDayId);
                          const participants = getParticipantsForDay(hDayId);
                          const dayExpenses = getDayTotalExpenses(hDayId);
                          const suggestedAmount = participants.length > 0 ? dayExpenses / participants.length : 0;
                          const dailyCat = budgetItems.find(b => b.type === 'entrata' && (b.label.toLowerCase().includes('giornalier') || b.label.toLowerCase().includes('ospit')))?.label || budgetItems.find(b => b.type === 'entrata')?.label || formData.category;

                          setFormData({ 
                            ...formData, 
                            huntingDayId: hDayId,
                            payerUid: hDay?.assignedToUid || (participants.length === 1 ? participants[0].uid : ''),
                            payerName: hDay?.assignedToName || (participants.length === 1 ? participants[0].displayName : ''),
                            category: hDay ? dailyCat : formData.category,
                            amount: suggestedAmount > 0 ? parseFloat(suggestedAmount.toFixed(2)) : formData.amount
                          });
                        }}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                      >
                        <option value="">Nessuna</option>
                        {huntingDays.slice().reverse().slice(0, 30).map(day => (
                          <option key={day.id} value={day.id}>
                            {safeFormatDate(day.date, 'dd MMM yyyy', { locale: it })} - {day.assignedToName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        <UserIcon size={12} /> Pagato Da
                      </label>
                      <select 
                        value={formData.payerUid}
                        onChange={e => {
                          const u = users.find(user => user.uid === e.target.value);
                          setFormData({ ...formData, payerUid: e.target.value, payerName: u?.displayName || '' });
                        }}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-gray outline-none focus:border-lake-green"
                      >
                        <option value="">Seleziona Utente...</option>
                        {formData.huntingDayId && getParticipantsForDay(formData.huntingDayId).length > 0 ? (
                          <optgroup label="Partecipanti Giornata">
                            {getParticipantsForDay(formData.huntingDayId).map(p => (
                              <option key={p.uid} value={p.uid}>{p.displayName} ({p.type})</option>
                            ))}
                          </optgroup>
                        ) : null}
                        <optgroup label="Tutti gli Utenti">
                          {users.filter(u => u.isActive).map(user => (
                            <option key={user.uid} value={user.uid}>{user.displayName}</option>
                          ))}
                        </optgroup>
                      </select>

                      {formData.huntingDayId && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-100 shadow-sm space-y-3">
                          <div className="flex justify-between items-center border-b border-emerald-50 pb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dettaglio Giornata</span>
                            <span className="text-[10px] font-bold text-lake-green">Spesa: €{getDayTotalExpenses(formData.huntingDayId).toLocaleString()}</span>
                          </div>
                          
                          <div className="space-y-2">
                            {getParticipantsForDay(formData.huntingDayId).map(p => {
                              const alreadyPaid = items
                                .filter(t => t.type === 'entrata' && t.huntingDayId === formData.huntingDayId && t.payerUid === p.uid)
                                .reduce((acc, t) => acc + t.amount, 0);
                              
                              return (
                                <button
                                  key={p.uid}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, payerUid: p.uid, payerName: p.displayName })}
                                  className={cn(
                                    "w-full flex justify-between items-center p-2 rounded border transition-all text-left",
                                    formData.payerUid === p.uid 
                                      ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500" 
                                      : "bg-off-white border-slate-100 hover:border-emerald-200"
                                  )}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-700">{p.displayName}</span>
                                    {alreadyPaid > 0 && <span className="text-[8px] text-emerald-600 font-bold uppercase">Versato: €{alreadyPaid.toLocaleString()}</span>}
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{p.type}</span>
                                    {formData.payerUid === p.uid && <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">Selezionato</div>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="pt-1">
                            <p className="text-[8px] text-slate-400 italic">
                              Clicca su un nome per impostarlo come pagatore. Puoi sovrascrivere l'importo manualmente se le quote non sono uguali.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                        <Wallet size={12} /> Ricevuto Da (Cassa)
                      </label>
                      <select 
                        required={formData.type === 'entrata'}
                        disabled={profile?.role === 'socio'}
                        value={formData.memberUid || (profile?.role === 'socio' ? profile.uid : '')}
                        onChange={e => setFormData({ ...formData, memberUid: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-gray outline-none focus:border-lake-green disabled:bg-slate-50"
                      >
                        <option value="">Seleziona Socio...</option>
                        {users.filter(u => u.isActive && (u.role === 'socio' || u.role === 'admin')).map(user => (
                          <option key={user.uid} value={user.uid}>{user.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {formData.type === 'uscita' && (
                  <div className="p-4 bg-rose-50/50 rounded border border-rose-100">
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
                        <Wallet size={12} /> Pagato Da (Cassa)
                      </label>
                      <select 
                        required={formData.type === 'uscita'}
                        disabled={profile?.role === 'socio'}
                        value={formData.memberUid || (profile?.role === 'socio' ? profile.uid : '')}
                        onChange={e => setFormData({ ...formData, memberUid: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-gray outline-none focus:border-lake-green disabled:bg-slate-50"
                      >
                        <option value="">Seleziona Socio...</option>
                        {users.filter(u => u.isActive && (u.role === 'socio' || u.role === 'admin')).map(user => (
                          <option key={user.uid} value={user.uid}>{user.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Descrizione (Opzionale)</label>
                  <textarea 
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-off-white border border-slate-200 rounded px-4 py-2.5 text-sm font-bold text-slate-gray outline-none focus:border-lake-green resize-none"
                    placeholder="Note aggiuntive..."
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => handleToggleModal(null)}
                    className="flex-1 py-3 px-6 rounded bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Annulla
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-6 rounded bg-accent-gold text-lake-green font-black text-xs uppercase tracking-widest hover:bg-opacity-90 transition-all shadow-lg active:scale-95"
                  >
                    Salva Movimento
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="card-polish !p-0 overflow-hidden shadow-sm">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[350px]">
            <thead>
              <tr className="bg-off-white border-b border-slate-100 uppercase tracking-widest text-[0.6rem] sm:text-[0.65rem] font-black text-slate-400">
                <th className="px-3 sm:px-6 py-3">Data</th>
                <th className="px-3 sm:px-6 py-3">Categoria</th>
                <th className="px-3 sm:px-6 py-3 hidden sm:table-cell">Note</th>
                <th className="px-3 sm:px-6 py-3 text-right">Importo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 sm:px-6 py-10 text-center text-slate-300 italic font-medium">Caricamento registro...</td>
                </tr>
              ) : (
                items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium text-slate-600 whitespace-nowrap">
                        {safeFormatDate(item.date, 'dd MMM', { locale: it })}
                      </td>
                      <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-[8px] sm:text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border w-fit mb-0.5",
                            item.type === 'entrata' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                          )}>
                            {item.category}
                          </span>
                          {item.payerName && (
                            <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                              <UserIcon size={10} /> {item.payerName}
                              {item.huntingDayId && <span className="text-accent-gold">• {safeFormatDate(item.huntingDayId, 'dd/MM')}</span>}
                            </div>
                          )}
                          {item.memberName && (
                            <div className="flex items-center gap-1 text-[9px] text-lake-green font-bold uppercase tracking-tighter mt-0.5">
                              <Wallet size={10} className="opacity-70" /> {item.type === 'entrata' ? 'In cassa a' : 'Pagato da'}: {item.memberName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 text-[10px] sm:text-xs text-slate-400 font-medium italic whitespace-nowrap hidden sm:table-cell truncate max-w-[150px]">
                        {item.description || '---'}
                      </td>
                      <td className={cn(
                        "px-3 sm:px-6 py-3 text-right font-bold text-sm whitespace-nowrap flex items-center justify-end gap-3",
                        item.type === 'entrata' ? "text-emerald-700" : "text-rose-700"
                      )}>
                        <span>{item.type === 'entrata' ? '+' : '-'}€{item.amount.toLocaleString()}</span>
                        {profile?.role === 'admin' && (
                           <div className="flex items-center gap-1.5 ml-2">
                             <button 
                                onClick={() => {
                                    // Populate form and open modal safely
                                    setFormData({
                                      date: item.date || format(new Date(), 'yyyy-MM-dd'),
                                      type: item.type || 'entrata',
                                      category: item.category || '',
                                      amount: item.amount || 0,
                                      description: item.description || '',
                                      huntingDayId: item.huntingDayId || '',
                                      payerUid: item.payerUid || '',
                                      payerName: item.payerName || '',
                                      memberUid: item.memberUid || '',
                                      memberName: item.memberName || ''
                                    });
                                    setEditingTransactionId(item.id);
                                    handleToggleModal('add');
                                }}
                                className="p-1 text-slate-500 hover:text-lake-green bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                title="Modifica"
                             >
                                <Edit2 size={12}/>
                             </button>
                             <button 
                                 onClick={() => setDeleteConfirmId(item.id)}
                                 className="p-1 text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                 title="Elimina"
                             >
                                 <Trash2 size={12}/>
                             </button>
                           </div>
                        )}
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-lg font-bold text-slate-800 mb-2">Conferma eliminazione</h3>
              <p className="text-sm text-slate-500 mb-6">Sei sicuro di voler eliminare questa operazione? Questa azione non può essere annullata.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200"
                >
                  Annulla
                </button>
                <button 
                  onClick={async () => {
                    if (deleteConfirmId) {
                      await deleteTransaction(deleteConfirmId);
                      setDeleteConfirmId(null);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
                >
                  Elimina
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
