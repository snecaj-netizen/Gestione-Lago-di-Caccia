import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, Target, Wallet, Info, Camera, ExternalLink } from 'lucide-react';
import { subscribeToUserNotifications, markNotificationAsRead, deleteNotification, markAllNotificationsAsRead, deleteAllNotifications } from '../services';
import { Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

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

export function NotificationCenter({ isOpen, onToggle }: { isOpen: boolean, onToggle: (val: boolean) => void }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = subscribeToUserNotifications(profile.uid, setNotifications);
    return () => unsub();
  }, [profile?.uid]);

  // Reset confirmation dialog if notification center is closed
  useEffect(() => {
    if (!isOpen) {
      setShowConfirmDeleteAll(false);
    }
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length > 0) {
      await markAllNotificationsAsRead(unreadIds);
    }
  };

  const handleDeleteAllClick = () => {
    setShowConfirmDeleteAll(true);
  };

  const handleConfirmDeleteAll = async () => {
    setShowConfirmDeleteAll(false);
    const allIds = notifications.map(n => n.id);
    if (allIds.length > 0) {
      await deleteAllNotifications(allIds);
    }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await markNotificationAsRead(n.id);
    }
    if (n.link) {
      navigate(n.link);
      onToggle(false);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'harvest': return <Target size={16} className="text-lake-green" />;
      case 'transaction': return <Wallet size={16} className="text-accent-gold" />;
      case 'photo': return <Camera size={16} className="text-sky-500" />;
      default: return <Info size={16} className="text-slate-400" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => onToggle(!isOpen)}
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-100 z-[70] overflow-hidden origin-top-right"
          >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-off-white/50">
                <h3 className="text-xs font-black text-lake-green uppercase tracking-widest">Notifiche</h3>
                <button 
                  onClick={() => onToggle(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

               {notifications.length > 0 && (
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-[10px]">
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={unreadCount === 0}
                    className="font-black text-lake-green hover:text-emerald-700 disabled:text-slate-400 disabled:no-underline uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Check size={12} /> Segna tutte come lette
                  </button>
                  <button
                    onClick={handleDeleteAllClick}
                    className="font-black text-rose-500 hover:text-rose-700 uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={12} /> Elimina tutte
                  </button>
                </div>
              )}

              {showConfirmDeleteAll && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-[80] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-3 animate-bounce">
                    <Trash2 size={24} />
                  </div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">Eliminare tutte le notifiche?</h4>
                  <p className="text-xs font-medium text-slate-500 max-w-[240px] mb-6 leading-relaxed">
                    Questa azione è irreversibile e rimuoverà tutte le notifiche presenti.
                  </p>
                  <div className="flex gap-3 w-full max-w-[240px]">
                    <button
                      onClick={() => setShowConfirmDeleteAll(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleConfirmDeleteAll}
                      className="flex-1 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold py-2.5 px-4 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm shadow-rose-100 cursor-pointer"
                    >
                      Conferma
                    </button>
                  </div>
                </div>
              )}

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
                          "p-4 transition-colors group relative border-l-2",
                          !n.read ? "bg-lake-green/5 border-lake-green" : "hover:bg-slate-50 border-transparent",
                          n.link && "cursor-pointer"
                        )}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="flex gap-3">
                          <div className="shrink-0 mt-1">
                            {getIcon(n.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                {n.title}
                                {n.link && <ExternalLink size={8} className="text-slate-300" />}
                              </p>
                              <span className="text-[9px] font-medium text-slate-400 whitespace-nowrap ml-2">
                                {safeFormatDate(n.createdAt, 'HH:mm • d MMM', { locale: it })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{n.body}</p>
                            
                            <div className="flex items-center gap-3 mt-3">
                              {!n.read && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markNotificationAsRead(n.id);
                                  }}
                                  className="text-[9px] font-black text-lake-green uppercase tracking-widest flex items-center gap-1 hover:underline"
                                >
                                  <Check size={10} /> Segna come letta
                                </button>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotification(n.id);
                                }}
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
        )}
      </AnimatePresence>
    </div>
  );
}
