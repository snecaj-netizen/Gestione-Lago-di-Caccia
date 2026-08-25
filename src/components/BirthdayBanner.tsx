import React, { useState, useMemo } from 'react';
import { UserProfile } from '../types';
import { Cake, Sparkles, Calendar, PartyPopper, X } from 'lucide-react';
import { motion } from 'motion/react';

interface BirthdayBannerProps {
  users: UserProfile[];
  isAdmin?: boolean;
}

export function BirthdayBanner({ users }: BirthdayBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Compute live birthdays
  const { todayBirthdays, tomorrowBirthdays } = useMemo(() => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const todayMMDD = `${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowMonth = tomorrow.getMonth() + 1;
    const tomorrowDay = tomorrow.getDate();
    const tomorrowMMDD = `${String(tomorrowMonth).padStart(2, '0')}-${String(tomorrowDay).padStart(2, '0')}`;

    const todayList: UserProfile[] = [];
    const tomorrowList: UserProfile[] = [];

    users.filter(u => u.isActive && u.birthDate).forEach(u => {
      if (!u.birthDate) return;
      const parts = u.birthDate.split('-');
      if (parts.length < 3) return;
      const bMMDD = `${parts[1]}-${parts[2]}`;

      if (bMMDD === todayMMDD) {
        todayList.push(u);
      } else if (bMMDD === tomorrowMMDD) {
        tomorrowList.push(u);
      }
    });

    return { todayBirthdays: todayList, tomorrowBirthdays: tomorrowList };
  }, [users]);

  const hasRealBirthdays = todayBirthdays.length > 0 || tomorrowBirthdays.length > 0;

  if (!hasRealBirthdays || dismissed) {
    return null;
  }

  // Format list of names nicely
  const formatNames = (profiles: UserProfile[]) => {
    const names = profiles.map(p => p.displayName || p.username || 'un socio');
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} e ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  };

  const showToday = todayBirthdays.length > 0;
  const showTomorrow = tomorrowBirthdays.length > 0;

  return (
    <div className="space-y-3">
      {/* REAL BIRTHDAY TODAY */}
      {showToday && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-4 sm:p-5 text-white shadow-lg border border-amber-400/40"
        >
          <div className="absolute right-0 top-0 -mr-6 -mt-6 h-32 w-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-inner border border-white/30 text-accent-gold">
                <PartyPopper size={24} className="animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-white/25 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest inline-flex items-center gap-1">
                    <Cake size={11} /> Compleanno di Oggi
                  </span>
                  <span className="text-[10px] text-amber-100 font-medium">Auguri da tutto il gruppo del Lago! 🎂</span>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white drop-shadow-sm">
                  Oggi è il compleanno di {formatNames(todayBirthdays)}! 🎉
                </h3>
              </div>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              title="Chiudi avviso"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* REAL BIRTHDAY TOMORROW */}
      {showTomorrow && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-lake-green via-lake-green/95 to-slate-900 p-4 sm:p-5 text-white shadow-lg border border-accent-gold/30"
        >
          <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-accent-gold/20 backdrop-blur-md border border-accent-gold/30 text-accent-gold">
                <Calendar size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="bg-accent-gold text-lake-green text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest inline-flex items-center gap-1">
                    <Sparkles size={11} /> Promemoria
                  </span>
                  <span className="text-[10px] text-emerald-100/80 font-medium">Non dimenticare di fare gli auguri domani!</span>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-accent-gold drop-shadow-sm">
                  Domani è il compleanno di {formatNames(tomorrowBirthdays)}! 🎂
                </h3>
              </div>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              title="Chiudi avviso"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
