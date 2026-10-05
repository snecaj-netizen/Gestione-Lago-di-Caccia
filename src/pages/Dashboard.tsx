import React, { useState, useEffect } from 'react';
import { 
  subscribeToTransactions, 
  subscribeToHarvests, 
  subscribeToUsers, 
  subscribeToHuntingLimits,
  subscribeToSettings,
  subscribeToBudgetItems
} from '../services';
import { Transaction, Harvest, UserProfile, HuntingLimit, LakeSettings, BudgetItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { BirthdayBanner } from '../components/BirthdayBanner';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Calendar as CalendarIcon,
  ChevronRight, 
  Bird, 
  Wallet, 
  ExternalLink, 
  Trophy, 
  Medal, 
  Award,
  X,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ArrowRightLeft,
  Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { format, subDays, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn, formatUserName } from '../lib/utils';
import { isAnatide } from './Harvests';

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

export function Dashboard() {
  const { profile } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [limits, setLimits] = useState<HuntingLimit[]>([]);
  const [settings, setSettings] = useState<LakeSettings | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals for Quote & Expenses details
  const [showQuotistiModal, setShowQuotistiModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [expandedQuotistaUid, setExpandedQuotistaUid] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    const unsub1 = subscribeToTransactions(setTxs);
    const unsub2 = subscribeToHarvests(setHarvests);
    const unsub3 = subscribeToUsers(setUsers);
    const unsub4 = subscribeToHuntingLimits(setLimits);
    const unsub5 = subscribeToSettings(setSettings);
    const unsub6 = subscribeToBudgetItems(setBudgetItems);
    setLoading(false);
    return () => { 
      unsub1(); 
      unsub2(); 
      unsub3(); 
      unsub4(); 
      unsub5();
      unsub6();
    };
  }, []);

  const totalIncome = txs.filter(i => i.type === 'entrata').reduce((acc, i) => acc + i.amount, 0);
  const totalExpense = txs.filter(i => i.type === 'uscita').reduce((acc, i) => acc + i.amount, 0);
  const totalBalance = totalIncome - totalExpense;
  const isNegativeBalance = totalBalance < 0;
  const totalBirds = harvests.reduce((acc, i) => acc + i.count, 0);
  
  const getSeasonLabel = () => {
    const years = new Set<number>();
    limits.forEach(l => {
      if (!l.huntingPeriod) return;
      const dateMatches = l.huntingPeriod.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g);
      if (dateMatches) {
        dateMatches.forEach(match => {
          const parts = match.split(/[\/\-\.]/);
          let year = parseInt(parts[parts.length - 1]);
          if (year < 100) year += 2000;
          years.add(year);
        });
      } else {
        const standaloneYears = l.huntingPeriod.match(/\b(20\d{2})\b/g);
        if (standaloneYears) {
          standaloneYears.forEach(y => years.add(parseInt(y)));
        }
      }
    });

    if (years.size > 0) {
      const sortedYears = Array.from(years).sort((a, b) => a - b);
      const maxY = sortedYears[sortedYears.length - 1];
      return `${maxY - 1}/${maxY}`;
    }
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 7) return `${currentYear}/${currentYear + 1}`;
    return `${currentYear - 1}/${currentYear}`;
  };

  const seasonLabel = getSeasonLabel();
  
  const recentHarvests = harvests.slice(0, 5);
  const recentTxs = txs.slice(0, 5);

  // Top Hunters Logic - Solo Anatidi
  const huntersMap: Record<string, number> = {};
  harvests.forEach(h => {
    if (isAnatide(h.species)) {
      huntersMap[h.hunterName] = (huntersMap[h.hunterName] || 0) + h.count;
    }
  });

  const topHunters = Object.entries(huntersMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Quotisti & Quote Calculations
  const quotistiSummary = React.useMemo(() => {
    const activeQuotisti = users.filter(u => u.isActive && u.role === 'quotista');
    
    const huntersPerDay: Record<number, number> = {};
    activeQuotisti.forEach(u => {
      (u.assignedDaysOfWeek || []).forEach(dayIdx => {
        if (dayIdx !== 3 && dayIdx !== 6) {
          huntersPerDay[dayIdx] = (huntersPerDay[dayIdx] || 0) + 1;
        }
      });
    });

    return activeQuotisti.map(u => {
      let targetQuota = u.seasonalQuota || 0;
      if (targetQuota === 0) {
        (u.assignedDaysOfWeek || []).forEach(dayIdx => {
          if (dayIdx === 3 || dayIdx === 6) return;
          const dayTotal = settings?.weekdaySeasonQuotas?.[dayIdx] || 0;
          const participants = huntersPerDay[dayIdx] || 1;
          targetQuota += dayTotal / participants;
        });
      }

      const payments = txs.filter(t => t.type === 'entrata' && t.payerUid === u.uid);
      const paid = payments.reduce((acc, t) => acc + t.amount, 0);

      return {
        ...u,
        targetQuota: Math.round(targetQuota),
        paid,
        balance: Math.round(targetQuota) - paid,
        payments
      };
    }).sort((a, b) => b.balance - a.balance);
  }, [users, settings, txs]);

  const totalExpectedFromQuotisti = quotistiSummary.reduce((acc, q) => acc + q.targetQuota, 0);
  
  const budgetIncomeQuotas = budgetItems
    .filter(b => b.type === 'entrata')
    .reduce((acc, b) => acc + b.amount, 0);

  const budgetExpense = budgetItems
    .filter(b => b.type === 'uscita')
    .reduce((acc, b) => acc + b.amount, 0);

  const totalExpectedQuotas = totalExpectedFromQuotisti > 0 
    ? totalExpectedFromQuotisti 
    : (budgetIncomeQuotas > 0 ? budgetIncomeQuotas : totalIncome);

  const quotaCollectionPct = totalExpectedQuotas > 0 ? (totalIncome / totalExpectedQuotas) * 100 : 100;

  // Aggregated Expense Categories
  const expenseCategories = React.useMemo(() => {
    const map = new Map<string, { amount: number; transactions: Transaction[] }>();
    txs.filter(t => t.type === 'uscita').forEach(t => {
      const cat = (t.category || 'Altro').trim();
      const existing = map.get(cat) || { amount: 0, transactions: [] };
      existing.amount += t.amount;
      existing.transactions.push(t);
      map.set(cat, existing);
    });

    const totalExp = totalExpense > 0 ? totalExpense : 1;
    return Array.from(map.entries())
      .map(([category, data]) => {
        const percentage = ((data.amount / totalExp) * 100).toFixed(1);
        const matchingBudget = budgetItems.find(b => b.type === 'uscita' && b.label.trim().toLowerCase() === category.toLowerCase());
        return {
          category,
          amount: data.amount,
          percentage,
          budgetAmount: matchingBudget ? matchingBudget.amount : null,
          transactions: data.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [txs, totalExpense, budgetItems]);

  // Calculate Cassa per Socio
  const soci = users.filter(u => u.isActive && (u.role === 'socio' || u.role === 'admin'));
  const sociCassa = soci.map(s => {
    const sIncome = txs.filter(t => (t.type === 'entrata' && t.memberUid === s.uid) || (t.type === 'trasferimento' && t.memberUid === s.uid)).reduce((acc, t) => acc + t.amount, 0);
    const sExpense = txs.filter(t => (t.type === 'uscita' && t.memberUid === s.uid) || (t.type === 'trasferimento' && t.payerUid === s.uid)).reduce((acc, t) => acc + t.amount, 0);
    const sContributionsGiven = txs.filter(t => t.type === 'entrata' && t.payerUid === s.uid && (t.category.toLowerCase().includes('contribut') || t.category.toLowerCase().includes('ripian'))).reduce((acc, t) => acc + t.amount, 0);
    return {
      ...s,
      income: sIncome,
      expenses: sExpense,
      contributionsGiven: sContributionsGiven,
      balance: sIncome - sExpense
    };
  }).sort((a, b) => a.balance - b.balance);

  if (loading) return null;

  return (
    <div className="space-y-6">
      <BirthdayBanner users={users} />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif text-lake-green">Gestione Lago di Caccia</h1>
          <p className="text-slate-gray font-medium">Panoramica attività e bilancio</p>
        </div>
        <a 
          href="https://maps.app.goo.gl/ZW3CcZraufAy5dXr7?g_st=ac" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[0.8rem] bg-white px-4 py-2 rounded border border-slate-200 font-bold text-slate-gray shadow-sm hover:border-lake-green hover:text-lake-green transition-all flex items-center gap-2 group"
        >
          <span className="group-hover:animate-pulse">📍</span> Lago Principale • Stagione {seasonLabel}
          <ExternalLink size={12} className="text-slate-300 group-hover:text-lake-green" />
        </a>
      </header>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Saldo Cassa Totale (in rosso se negativo) */}
        <div className={cn(
          "card-polish flex flex-col justify-between transition-all",
          isNegativeBalance && "border-rose-200 bg-rose-50/20"
        )}>
          <div className="flex justify-between items-start">
            <span className="text-[0.75rem] font-bold text-slate-gray uppercase tracking-widest leading-none">
              Saldo Cassa Tot.
            </span>
            <Wallet size={20} className={isNegativeBalance ? "text-rose-600" : "text-lake-green"} />
          </div>
          <div>
            <p className={cn(
              "text-3xl font-bold tracking-tighter",
              isNegativeBalance ? "text-rose-600 font-black" : "text-slate-900"
            )}>
              {totalBalance < 0 ? `-€${Math.abs(totalBalance).toLocaleString()}` : `€${totalBalance.toLocaleString()}`}
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
              {isNegativeBalance ? (
                <span className="text-rose-600 bg-rose-100/70 px-2 py-0.5 rounded border border-rose-200">
                  ⚠ Disavanzo di cassa
                </span>
              ) : (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  ✓ Saldo in attivo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Abbattimenti Totali */}
        <div className="card-polish flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[0.75rem] font-bold text-slate-gray uppercase tracking-widest leading-none">
              Abbattimenti Tot.
            </span>
            <Bird size={20} className="text-earth-brown" />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900 tracking-tighter">{totalBirds}</p>
            <div className="mt-2 text-[10px] font-bold text-slate-400">
              {harvests.filter(h => isAnatide(h.species)).reduce((a, b) => a + b.count, 0)} Anatidi registrati
            </div>
          </div>
        </div>

        {/* Card 3: Entrate (Quote) con confronto quote totali e click popup quotisti */}
        <div 
          onClick={() => setShowQuotistiModal(true)}
          className="card-polish flex flex-col justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group relative border border-slate-100"
          title="Clicca per visualizzare i singoli quotisti ed il loro saldo"
        >
          <div className="flex justify-between items-start">
            <span className="text-[0.75rem] font-bold text-slate-gray uppercase tracking-widest leading-none">
              Entrate (Quote)
            </span>
            <TrendingUp size={20} className="text-emerald-700 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-bold text-slate-900 tracking-tighter">€{totalIncome.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">/ €{totalExpectedQuotas.toLocaleString()}</span>
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(quotaCollectionPct, 100)}%` }} 
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span>{quotaCollectionPct.toFixed(0)}% quote totali</span>
                <span className="text-emerald-700 font-black flex items-center gap-0.5 group-hover:underline">
                  Dettaglio quotisti <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Uscite (Spese) con click popup elenco aggregato voci di spesa */}
        <div 
          onClick={() => setShowExpensesModal(true)}
          className="card-polish flex flex-col justify-between cursor-pointer hover:border-rose-400 hover:shadow-md transition-all group relative border border-slate-100"
          title="Clicca per visualizzare l'elenco aggregato di ogni voce di spesa"
        >
          <div className="flex justify-between items-start">
            <span className="text-[0.75rem] font-bold text-slate-gray uppercase tracking-widest leading-none">
              Uscite (Spese)
            </span>
            <TrendingDown size={20} className="text-rose-700 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl font-bold text-slate-900 tracking-tighter">€{totalExpense.toLocaleString()}</span>
              {budgetExpense > 0 && (
                <span className="text-xs font-bold text-slate-400">/ €{budgetExpense.toLocaleString()} prev.</span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 rounded-full transition-all duration-700" 
                  style={{ width: `${budgetExpense > 0 ? Math.min((totalExpense / budgetExpense) * 100, 100) : 100}%` }} 
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span>{expenseCategories.length} voci aggregate</span>
                <span className="text-rose-700 font-black flex items-center gap-0.5 group-hover:underline">
                  Vedi aggregato <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cassa Soci Section */}
      <section className="card-polish border-t-4 border-t-lake-green">
        <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-gray uppercase flex items-center gap-2">
            <Wallet size={16} className="text-lake-green" /> Cassa Soci (Tasche Soci)
          </h3>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Monitoraggio fondi detenuti da ogni socio</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sociCassa.length === 0 ? (
            <p className="p-4 text-center text-slate-300 italic text-xs col-span-full">Nessun socio trovato</p>
          ) : (
            sociCassa.map(socio => (
              <div 
                key={socio.uid} 
                className={cn(
                  "border rounded-lg p-4 flex flex-col justify-between gap-3 group transition-all shadow-sm",
                  socio.balance < 0 
                    ? "bg-rose-50/30 border-rose-200/80 hover:border-rose-400" 
                    : socio.balance > 0 
                      ? "bg-emerald-50/20 border-emerald-200/80 hover:border-emerald-400" 
                      : "bg-off-white border-slate-100 hover:border-lake-green"
                )}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{formatUserName(socio.displayName)}</h4>
                      <span className="text-[9px] font-black text-lake-green/60 uppercase tracking-widest">{socio.role}</span>
                    </div>
                    <div className={cn(
                      "p-2 rounded-full",
                      socio.balance < 0 ? "bg-rose-100 text-rose-700" : socio.balance > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    )}>
                      <Wallet size={16} />
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Cassa</p>
                      <span className={cn(
                        "text-[8px] font-black uppercase px-1.5 py-0.2 rounded border",
                        socio.balance < 0 
                          ? "bg-rose-100 text-rose-700 border-rose-200" 
                          : socio.balance > 0 
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200" 
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {socio.balance < 0 ? 'In Negativo' : socio.balance > 0 ? 'In Positivo' : 'In Pari'}
                      </span>
                    </div>
                    <p className={cn(
                      "text-2xl font-black tracking-tighter mt-0.5",
                      socio.balance < 0 ? "text-rose-600" : socio.balance > 0 ? "text-emerald-700" : "text-slate-800"
                    )}>
                      {socio.balance < 0 ? `-€${Math.abs(socio.balance).toLocaleString()}` : `€${socio.balance.toLocaleString()}`}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                      {socio.balance < 0 
                        ? 'Ha anticipato spese per il lago' 
                        : socio.balance > 0 
                          ? 'Disponibilità di cassa' 
                          : 'Spese e incassi allineati'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100/80">
                  {socio.balance < 0 ? (
                    <Link
                      to={`/spese?modal=contributo&targetUid=${socio.uid}`}
                      className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all shadow-sm active:scale-95"
                    >
                      <Coins size={11} /> Ripiana con Contributo
                    </Link>
                  ) : socio.balance > 0 ? (
                    <Link
                      to={`/spese?modal=transfer&fromUid=${socio.uid}`}
                      className="w-full py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all shadow-sm active:scale-95"
                    >
                      <ArrowRightLeft size={11} /> Trasferisci Cassa
                    </Link>
                  ) : (
                    <Link
                      to="/spese"
                      className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all"
                    >
                      Dettaglio Spese <ChevronRight size={10} />
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Top Hunters Podium */}
      <section className="card-polish bg-gradient-to-br from-lake-green to-lake-green/90 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
          <Trophy size={160} />
        </div>
        
        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
              <Trophy size={20} className="text-accent-gold" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                Migliori Cacciatori
              </h3>
              <p className="text-xs text-white/60 font-medium">Classifica abbattimenti stagionali (Anatidi)</p>
            </div>
          </div>

          <div className="flex items-end justify-center gap-2 sm:gap-6 pt-4 pb-2">
            {/* 2nd Place */}
            {topHunters[1] && (
              <div className="flex flex-col items-center group">
                <div className="mb-2 text-center">
                  <p className="text-[10px] font-black uppercase text-white/50 tracking-tighter leading-none mb-1">2° Posto</p>
                  <p className="text-xs font-bold truncate max-w-[80px]">{formatUserName(topHunters[1].name)}</p>
                </div>
                <div className="w-16 sm:w-20 bg-white/10 backdrop-blur-sm border-t-2 border-slate-300 h-20 rounded-t-lg flex flex-col items-center justify-center gap-1 group-hover:bg-white/20 transition-all">
                  <Medal size={20} className="text-slate-300" />
                  <span className="text-lg font-black">{topHunters[1].count}</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {topHunters[0] && (
              <div className="flex flex-col items-center group">
                <div className="mb-2 text-center scale-110">
                  <Trophy size={24} className="text-accent-gold mx-auto mb-1 animate-bounce" />
                  <p className="text-[10px] font-black uppercase text-white/70 tracking-tighter leading-none mb-1 uppercase tracking-widest">Campione</p>
                  <p className="text-sm font-black truncate max-w-[100px]">{formatUserName(topHunters[0].name)}</p>
                </div>
                <div className="w-20 sm:w-24 bg-white/20 backdrop-blur-sm border-t-4 border-accent-gold h-32 rounded-t-xl flex flex-col items-center justify-center gap-1 group-hover:bg-white/30 transition-all shadow-2xl relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-accent-gold/50 blur-sm rounded-full" />
                  <span className="text-3xl font-black text-accent-gold">{topHunters[0].count}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Anatidi</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {topHunters[2] && (
              <div className="flex flex-col items-center group">
                <div className="mb-2 text-center">
                  <p className="text-[10px] font-black uppercase text-white/50 tracking-tighter leading-none mb-1">3° Posto</p>
                  <p className="text-xs font-bold truncate max-w-[80px]">{formatUserName(topHunters[2].name)}</p>
                </div>
                <div className="w-14 sm:w-16 bg-white/10 backdrop-blur-sm border-t-2 border-amber-700/50 h-16 rounded-t-lg flex flex-col items-center justify-center gap-1 group-hover:bg-white/20 transition-all">
                  <Award size={18} className="text-amber-600" />
                  <span className="text-base font-black">{topHunters[2].count}</span>
                </div>
              </div>
            )}
          </div>

          {topHunters.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-white/40 italic text-sm">Ancora nessun abbattimento di anatidi registrato</p>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Harvests */}
        <section className="card-polish">
          <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-gray uppercase flex items-center gap-2">
              <Target size={16} className="text-lake-green" /> Ultimi Abbattimenti
            </h3>
          </div>
          <div className="space-y-0 text-sm overflow-x-auto">
            {recentHarvests.length === 0 ? (
              <p className="text-slate-400 text-center py-10 italic">Nessun dato registrato</p>
            ) : (
              <table className="w-full min-w-[300px]">
                <thead>
                  <tr className="text-[0.65rem] text-slate-400 uppercase tracking-wider text-left border-b border-slate-50">
                    <th className="pb-2 font-bold">Data</th>
                    <th className="pb-2 font-bold">Specie</th>
                    <th className="pb-2 font-bold text-right">N°</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentHarvests.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 text-slate-gray font-medium">{safeFormatDate(h.date, 'dd MMM', { locale: it })}</td>
                      <td className="py-3 font-semibold text-lake-green">{h.species}</td>
                      <td className="py-3 text-right font-black text-slate-900">{h.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Recent Financials */}
        <section className="card-polish">
          <div className="mb-6 flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-gray uppercase flex items-center gap-2">
              <Wallet size={16} className="text-lake-green" /> Movimenti Cassa
            </h3>
          </div>
          <div className="space-y-0 text-sm overflow-x-auto">
            {recentTxs.length === 0 ? (
              <p className="text-slate-400 text-center py-10 italic">Nessun dato registrato</p>
            ) : (
              <table className="w-full min-w-[350px]">
                <thead>
                  <tr className="text-[0.65rem] text-slate-400 uppercase tracking-wider text-left border-b border-slate-50">
                    <th className="pb-2 font-bold">Data</th>
                    <th className="pb-2 font-bold">Categoria</th>
                    <th className="pb-2 font-bold text-right">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentTxs.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 text-slate-gray font-medium">{safeFormatDate(t.date, 'dd MMM', { locale: it })}</td>
                      <td className="py-3">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                          t.type === 'entrata' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          t.type === 'trasferimento' ? "bg-purple-50 text-purple-700 border-purple-100" :
                          "bg-rose-50 text-rose-700 border-rose-100"
                        )}>{t.type === 'trasferimento' ? 'Trasferimento' : t.category}</span>
                      </td>
                      <td className={cn(
                        "py-3 text-right font-bold",
                        t.type === 'entrata' ? "text-emerald-700" :
                        t.type === 'trasferimento' ? "text-purple-700" :
                        "text-rose-700"
                      )}>
                        {t.type === 'entrata' ? '+' : t.type === 'uscita' ? '-' : '⇄ '}€{t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* MODAL 1: Popup Dettaglio Quotisti & Saldo */}
      <AnimatePresence>
        {showQuotistiModal && (
          <div 
            className="fixed inset-0 w-full h-full z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setShowQuotistiModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border-t-8 border-emerald-600 relative my-auto max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <Users size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-slate-900 leading-tight">Quote & Saldo Quotisti</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Confronto quote stagionali e stato pagamenti singoli cacciatori
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowQuotistiModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* KPI Bar */}
              <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-100 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Quote Totali Previste</span>
                    <p className="text-xl font-black text-slate-900">€{totalExpectedQuotas.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 block mb-1">Totale Incassato</span>
                    <p className="text-xl font-black text-emerald-600">€{totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Da Saldare</span>
                    <p className={cn("text-xl font-black", (totalExpectedQuotas - totalIncome) > 0 ? "text-rose-600" : "text-emerald-600")}>
                      €{Math.max(0, totalExpectedQuotas - totalIncome).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Avanzamento incasso quote</span>
                    <span>{quotaCollectionPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(quotaCollectionPct, 100)}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Scrollable List of Quotisti */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-3.5 flex-1">
                {quotistiSummary.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 italic text-sm">
                    Nessun cacciatore quotista registrato nel sistema.
                  </div>
                ) : (
                  quotistiSummary.map(hunter => {
                    const isFullyPaid = hunter.balance <= 0 && hunter.targetQuota > 0;
                    const hunterPct = hunter.targetQuota > 0 ? Math.min((hunter.paid / hunter.targetQuota) * 100, 100) : (hunter.paid > 0 ? 100 : 0);
                    const isExpanded = expandedQuotistaUid === hunter.uid;

                    return (
                      <div 
                        key={hunter.uid}
                        className={cn(
                          "rounded-xl border p-4 transition-all",
                          isFullyPaid 
                            ? "bg-emerald-50/30 border-emerald-200/80" 
                            : "bg-white border-slate-200 shadow-sm"
                        )}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                              {hunter.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                {formatUserName(hunter.displayName)}
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-100">
                                  Quotista
                                </span>
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium">
                                Turni: {(hunter.assignedDaysOfWeek || []).length > 0
                                  ? (hunter.assignedDaysOfWeek || []).map(d => ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][d]).join(', ')
                                  : 'Nessun turno fisso'}
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="flex items-center gap-2">
                            {isFullyPaid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 size={13} className="text-emerald-700" /> In Regola
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                <AlertCircle size={13} className="text-rose-700" /> Da saldare: €{hunter.balance.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Financial Figures */}
                        <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50/80 rounded-lg text-xs mb-3 border border-slate-100">
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Quota Assegnata</span>
                            <span className="font-bold text-slate-900">€{hunter.targetQuota.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Versato</span>
                            <span className="font-bold text-emerald-600">€{hunter.paid.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 block">Saldo</span>
                            <span className={cn("font-black", hunter.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                              {hunter.balance > 0 ? `-€${hunter.balance.toLocaleString()}` : '€0 (Saldato)'}
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1">
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full rounded-full transition-all duration-500", isFullyPaid ? "bg-emerald-500" : "bg-accent-gold")}
                              style={{ width: `${hunterPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Payment history toggle */}
                        {hunter.payments.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setExpandedQuotistaUid(isExpanded ? null : hunter.uid)}
                              className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                            >
                              <span>{isExpanded ? 'Nascondi versamenti' : `Visualizza versamenti (${hunter.payments.length})`}</span>
                              <ChevronDown size={12} className={cn("transition-transform", isExpanded && "rotate-180")} />
                            </button>

                            {isExpanded && (
                              <div className="mt-2 space-y-1.5 text-xs bg-white rounded-lg p-2.5 border border-slate-100">
                                {hunter.payments.map((p) => (
                                  <div key={p.id} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                                    <div>
                                      <span className="font-semibold text-slate-800">{safeFormatDate(p.date, 'dd MMM yyyy', { locale: it })}</span>
                                      {p.description && <span className="text-[10px] text-slate-400 ml-1.5">({p.description})</span>}
                                    </div>
                                    <span className="font-bold text-emerald-700">+€{p.amount.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Stagione {seasonLabel}
                </span>
                <button
                  onClick={() => setShowQuotistiModal(false)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Popup Elenco Aggregato Voci di Spesa */}
      <AnimatePresence>
        {showExpensesModal && (
          <div 
            className="fixed inset-0 w-full h-full z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setShowExpensesModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border-t-8 border-rose-600 relative my-auto max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100">
                    <TrendingDown size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif text-slate-900 leading-tight">Elenco Aggregato Voci di Spesa</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Riepilogo totale uscite per ogni voce di costo della stagione
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowExpensesModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* KPI Bar */}
              <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-100">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-rose-200/80 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 block mb-1">Totale Spese Actual</span>
                    <p className="text-xl font-black text-rose-700">€{totalExpense.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Voci di Spesa</span>
                    <p className="text-xl font-black text-slate-900">{expenseCategories.length}</p>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-sm col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Movimenti Uscita</span>
                    <p className="text-xl font-black text-slate-900">{txs.filter(t => t.type === 'uscita').length}</p>
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                {expenseCategories.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 italic text-sm">
                    Nessuna uscita registrata per questa stagione.
                  </div>
                ) : (
                  <>
                    {/* Visual Bar Chart */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        Ripartizione Spese per Voce
                      </p>
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={expenseCategories} margin={{ top: 20, right: 10, left: -15, bottom: 20 }}>
                            <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `€${val}`} allowDecimals={false} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                              formatter={(val: any) => [`€${Number(val).toLocaleString()}`, 'Spesa Totale']}
                            />
                            <Bar dataKey="amount" fill="#be123c" radius={[4, 4, 0, 0]}>
                              <LabelList 
                                dataKey="amount" 
                                position="top" 
                                formatter={(val: any) => `€${Number(val).toLocaleString()}`} 
                                style={{ fontSize: '9px', fill: '#be123c', fontWeight: 'bold' }} 
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Detailed Category List */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Elenco Aggregato per Voce di Costo
                      </p>

                      {expenseCategories.map(cat => {
                        const isExpanded = expandedCategory === cat.category;
                        return (
                          <div 
                            key={cat.category}
                            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                  {cat.category}
                                  <span className="text-[10px] font-normal text-slate-400">
                                    ({cat.transactions.length} {cat.transactions.length === 1 ? 'movimento' : 'movimenti'})
                                  </span>
                                </h4>
                                {cat.budgetAmount !== null && (
                                  <p className="text-[10px] text-slate-500 font-medium">
                                    Budget previsto: €{cat.budgetAmount.toLocaleString()} • 
                                    <span className={cn("ml-1 font-bold", cat.amount <= cat.budgetAmount ? "text-emerald-600" : "text-rose-600")}>
                                      {cat.amount <= cat.budgetAmount ? 'Entro budget' : `Superato di €${(cat.amount - cat.budgetAmount).toLocaleString()}`}
                                    </span>
                                  </p>
                                )}
                              </div>
                              <div className="text-left sm:text-right">
                                <span className="text-base font-black text-rose-700">€{cat.amount.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-slate-400 block">
                                  {cat.percentage}% del totale spese
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2">
                              <div 
                                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                                style={{ width: `${cat.percentage}%` }}
                              />
                            </div>

                            {/* Toggle transactions list */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                                className="text-[10px] font-bold text-slate-500 hover:text-rose-700 flex items-center gap-1 transition-colors"
                              >
                                <span>{isExpanded ? 'Nascondi scontrini/uscite' : `Visualizza scontrini/uscite (${cat.transactions.length})`}</span>
                                <ChevronDown size={12} className={cn("transition-transform", isExpanded && "rotate-180")} />
                              </button>

                              {isExpanded && (
                                <div className="mt-2 space-y-1.5 text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                  {cat.transactions.map((t) => (
                                    <div key={t.id} className="flex justify-between items-center py-1.5 border-b border-slate-200/60 last:border-0">
                                      <div>
                                        <div className="font-semibold text-slate-800">
                                          {safeFormatDate(t.date, 'dd MMM yyyy', { locale: it })}
                                        </div>
                                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                          {t.description && <span>{t.description}</span>}
                                          {(t.payerName || t.memberName) && (
                                            <span className="italic">Pagato da: {t.payerName || t.memberName}</span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="font-black text-rose-700">-€{t.amount.toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Totale Spese: €{totalExpense.toLocaleString()}
                </span>
                <button
                  onClick={() => setShowExpensesModal(false)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
