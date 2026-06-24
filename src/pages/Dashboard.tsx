import React, { useState, useEffect } from 'react';
import { 
  subscribeToTransactions, 
  subscribeToHarvests,
  subscribeToUsers,
  subscribeToHuntingLimits
} from '../services';
import { Transaction, Harvest, UserProfile, HuntingLimit } from '../types';
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
  Award
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';

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
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [limits, setLimits] = useState<HuntingLimit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub1 = subscribeToTransactions(setTxs);
    const unsub2 = subscribeToHarvests(setHarvests);
    const unsub3 = subscribeToUsers(setUsers);
    const unsub4 = subscribeToHuntingLimits(setLimits);
    setLoading(false);
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, []);

  const totalIncome = txs.filter(i => i.type === 'entrata').reduce((acc, i) => acc + i.amount, 0);
  const totalExpense = txs.filter(i => i.type === 'uscita').reduce((acc, i) => acc + i.amount, 0);
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
      // Since a hunting season is typically YYYY/YYYY+1, we find the highest year (maxY) which represents
      // the end of the latest season, and return `${maxY - 1}/${maxY}` (e.g. 2026/2027 if maxY is 2027).
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

  // Top Hunters Logic
  const huntersMap: Record<string, number> = {};
  harvests.forEach(h => {
    huntersMap[h.hunterName] = (huntersMap[h.hunterName] || 0) + h.count;
  });

  const topHunters = Object.entries(huntersMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const stats = [
    { name: 'Saldo Cassa Tot.', value: `€${(totalIncome - totalExpense).toLocaleString()}`, icon: Wallet, color: 'text-lake-green' },
    { name: 'Abbattimenti Tot.', value: totalBirds, icon: Bird, color: 'text-earth-brown' },
    { name: 'Entrate (Quote)', value: `€${totalIncome.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-700' },
    { name: 'Uscite (Spese)', value: `€${totalExpense.toLocaleString()}`, icon: TrendingDown, color: 'text-rose-700' },
  ];

  // Calculate Cassa per Socio
  const soci = users.filter(u => u.isActive && (u.role === 'socio' || u.role === 'admin'));
  const sociCassa = soci.map(s => {
    const sIncome = txs.filter(t => t.type === 'entrata' && t.memberUid === s.uid).reduce((acc, t) => acc + t.amount, 0);
    const sExpense = txs.filter(t => t.type === 'uscita' && t.memberUid === s.uid).reduce((acc, t) => acc + t.amount, 0);
    return {
      ...s,
      balance: sIncome - sExpense
    };
  }).sort((a, b) => b.balance - a.balance);

  if (loading) return null;

  return (
    <div className="space-y-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="card-polish flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <span className="text-[0.75rem] font-bold text-slate-gray uppercase tracking-widest leading-none">{stat.name}</span>
              <stat.icon size={20} className={stat.color} />
            </div>
            <p className="text-3xl font-bold text-slate-900 tracking-tighter">{stat.value}</p>
          </div>
        ))}
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
              <div key={socio.uid} className="bg-off-white border border-slate-100 rounded-lg p-4 flex flex-col gap-3 group hover:border-lake-green transition-all shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{socio.displayName}</h4>
                    <span className="text-[9px] font-black text-lake-green/50 uppercase tracking-widest">{socio.role}</span>
                  </div>
                  <div className={cn(
                    "p-2 rounded-full",
                    socio.balance >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  )}>
                    <Wallet size={16} />
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo in Tasca</p>
                  <p className={cn(
                    "text-2xl font-black tracking-tighter",
                    socio.balance >= 0 ? "text-slate-900" : "text-rose-600"
                  )}>
                    €{socio.balance.toLocaleString()}
                  </p>
                </div>
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-lake-green transition-all duration-1000" 
                    style={{ width: `${(totalIncome - totalExpense) > 0 ? (Math.max(0, socio.balance) / (totalIncome - totalExpense)) * 100 : 100}%` }} 
                  />
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
              <h3 className="text-sm font-black uppercase tracking-widest">Migliori Cacciatori</h3>
              <p className="text-xs text-white/60 font-medium">Classifica abbattimenti stagionali</p>
            </div>
          </div>

          <div className="flex items-end justify-center gap-2 sm:gap-6 pt-4 pb-2">
            {/* 2nd Place */}
            {topHunters[1] && (
              <div className="flex flex-col items-center group">
                <div className="mb-2 text-center">
                  <p className="text-[10px] font-black uppercase text-white/50 tracking-tighter leading-none mb-1">2° Posto</p>
                  <p className="text-xs font-bold truncate max-w-[80px]">{topHunters[1].name.split(' ')[0]}</p>
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
                  <p className="text-sm font-black truncate max-w-[100px]">{topHunters[0].name.split(' ')[0]}</p>
                </div>
                <div className="w-20 sm:w-24 bg-white/20 backdrop-blur-sm border-t-4 border-accent-gold h-32 rounded-t-xl flex flex-col items-center justify-center gap-1 group-hover:bg-white/30 transition-all shadow-2xl relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-accent-gold/50 blur-sm rounded-full" />
                  <span className="text-3xl font-black text-accent-gold">{topHunters[0].count}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/50">Capi</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {topHunters[2] && (
              <div className="flex flex-col items-center group">
                <div className="mb-2 text-center">
                  <p className="text-[10px] font-black uppercase text-white/50 tracking-tighter leading-none mb-1">3° Posto</p>
                  <p className="text-xs font-bold truncate max-w-[80px]">{topHunters[2].name.split(' ')[0]}</p>
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
              <p className="text-white/40 italic text-sm">Ancora nessun abbattimento registrato</p>
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
                          t.type === 'entrata' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                        )}>{t.category}</span>
                      </td>
                      <td className={cn(
                        "py-3 text-right font-bold",
                        t.type === 'entrata' ? "text-emerald-700" : "text-rose-700"
                      )}>
                        {t.type === 'entrata' ? '+' : '-'}€{t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
