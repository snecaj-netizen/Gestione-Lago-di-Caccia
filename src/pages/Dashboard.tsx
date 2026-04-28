import React, { useState, useEffect } from 'react';
import { 
  subscribeToTransactions, 
  subscribeToHarvests 
} from '../services';
import { Transaction, Harvest } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Calendar as CalendarIcon,
  ChevronRight,
  Bird,
  Wallet,
  ExternalLink
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '../lib/utils';

export function Dashboard() {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub1 = subscribeToTransactions(setTxs);
    const unsub2 = subscribeToHarvests(setHarvests);
    setLoading(false);
    return () => { unsub1(); unsub2(); };
  }, []);

  const totalIncome = txs.filter(i => i.type === 'entrata').reduce((acc, i) => acc + i.amount, 0);
  const totalExpense = txs.filter(i => i.type === 'uscita').reduce((acc, i) => acc + i.amount, 0);
  const totalBirds = harvests.reduce((acc, i) => acc + i.count, 0);
  
  const recentHarvests = harvests.slice(0, 5);
  const recentTxs = txs.slice(0, 5);

  const stats = [
    { name: 'Saldo Cassa', value: `€${(totalIncome - totalExpense).toLocaleString()}`, icon: Wallet, color: 'text-lake-green' },
    { name: 'Abbattimenti Tot.', value: totalBirds, icon: Bird, color: 'text-earth-brown' },
    { name: 'Entrate (Quote)', value: `€${totalIncome.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-700' },
    { name: 'Uscite (Spese)', value: `€${totalExpense.toLocaleString()}`, icon: TrendingDown, color: 'text-rose-700' },
  ];

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
          <span className="group-hover:animate-pulse">📍</span> Lago Principale • Stagione {new Date().getFullYear()}
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
                      <td className="py-3 text-slate-gray font-medium">{format(new Date(h.date), 'dd MMM', { locale: it })}</td>
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
                      <td className="py-3 text-slate-gray font-medium">{format(new Date(t.date), 'dd MMM', { locale: it })}</td>
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
