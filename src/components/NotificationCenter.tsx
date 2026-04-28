import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, Target, Wallet, Info } from 'lucide-react';
import { subscribeToUserNotifications, markNotificationAsRead, deleteNotification } from '../services';
import { Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

export function NotificationCenter() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToUserNotifications(profile.uid, setNotifications);
    return () => unsub();
  }, [profile?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'harvest': return <Target size={16} className="text-lake-green" />;
      case 'transaction': return <Wallet size={16} className="text-accent-gold" />;
      default: return <Info size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-lake-green transition-colors bg-white rounded-full shadow-sm border border-slate-100"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-100 z-[70] overflow-hidden origin-top-right"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-off-white/50">
                <h3 className="text-xs font-black text-lake-green uppercase tracking-widest">Notifiche</h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto scrollbar-hide bg-white">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell size={32} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-xs font-medium text-slate-400">Nessuna notifica</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={cn(
                          "p-4 transition-colors group relative",
                          !n.read ? "bg-lake-green/5" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="shrink-0 mt-1">
                            {getIcon(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{n.title}</p>
                              <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap ml-2">
                                {format(new Date(n.createdAt), 'HH:mm • d MMM', { locale: it })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{n.body}</p>
                            
                            <div className="flex items-center gap-3 mt-3">
                              {!n.read && (
                                <button 
                                  onClick={() => markNotificationAsRead(n.id)}
                                  className="text-[9px] font-black text-lake-green uppercase tracking-widest flex items-center gap-1 hover:underline"
                                >
                                  <Check size={10} /> Segna come letta
                                </button>
                              )}
                              <button 
                                onClick={() => deleteNotification(n.id)}
                                className="text-[9px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={10} /> Elimina
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="p-3 bg-slate-50 text-center border-t border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Le notifiche scadono dopo 30 giorni</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
