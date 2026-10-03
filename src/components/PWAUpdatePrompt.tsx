import React, { useEffect, useState, useRef } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const initialServerBuildTimeRef = useRef<number | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check server version endpoint
  const checkServerVersion = async () => {
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const serverTime = Number(data.buildTime);
        if (serverTime) {
          if (initialServerBuildTimeRef.current === null) {
            initialServerBuildTimeRef.current = serverTime;
          } else if (serverTime > initialServerBuildTimeRef.current) {
            console.log('[UpdateChecker] New server build detected:', serverTime, 'initial:', initialServerBuildTimeRef.current);
            setNeedRefresh(true);
            setDismissed(false);
          }
        }
      }
    } catch (err) {
      // Offline or network error - ignore silently
    }
  };

  // Check service worker registration
  const checkServiceWorker = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        registrationRef.current = reg;

        // If a worker is already waiting to take over
        if (reg.waiting) {
          console.log('[UpdateChecker] ServiceWorker waiting found');
          setNeedRefresh(true);
          setDismissed(false);
          return;
        }

        // Trigger check on server
        await reg.update().catch(() => {});

        // Listen for new worker installing
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[UpdateChecker] New ServiceWorker installed and ready');
                setNeedRefresh(true);
                setDismissed(false);
              }
            };
          }
        };
      }
    } catch (err) {
      console.warn('[UpdateChecker] Error checking service worker:', err);
    }
  };

  useEffect(() => {
    // Initial checks on mount
    checkServerVersion();
    checkServiceWorker();

    // Listen for custom event dispatched by main.tsx
    const handleCustomUpdateEvent = (e: any) => {
      if (e.detail?.registration) {
        registrationRef.current = e.detail.registration;
      }
      setNeedRefresh(true);
      setDismissed(false);
    };

    window.addEventListener('app-update-available', handleCustomUpdateEvent);

    // Listen for message from sw.js
    let handleSwMessage: ((event: MessageEvent) => void) | null = null;
    if ('serviceWorker' in navigator) {
      handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SW_UPDATED') {
          console.log('[UpdateChecker] SW_UPDATED message received from service worker');
          setNeedRefresh(true);
          setDismissed(false);
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      checkServerVersion();
      checkServiceWorker();
    }, 30000);

    // Check when user returns to the tab or app
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkServerVersion();
        checkServiceWorker();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleFocus = () => {
      checkServerVersion();
      checkServiceWorker();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      window.removeEventListener('app-update-available', handleCustomUpdateEvent);
      if (handleSwMessage && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
    };
  }, []);

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    try {
      // 1. Tell waiting service worker to skip waiting
      const reg = registrationRef.current || (await navigator.serviceWorker?.getRegistration().catch(() => null));
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 2. Clear browser cache storage so no stale assets remain
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (e) {
          console.warn('[UpdateChecker] Error clearing caches:', e);
        }
      }

      // Small delay for SW activation
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.warn('[UpdateChecker] Reloading after error:', e);
    } finally {
      // 3. Force hard reload with timestamp query param
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.replace(url.toString());
    }
  };

  if (!needRefresh || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-[390px] z-[9999]"
      >
        <div className="bg-lake-green text-white p-4 rounded-2xl shadow-2xl border-2 border-accent-gold/60 backdrop-blur-md flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-gold/20 text-accent-gold flex items-center justify-center shrink-0 border border-accent-gold/30">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-black tracking-tight text-white">
                    Aggiornamento Disponibile!
                  </h4>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-accent-gold text-lake-green shadow-xs">
                    Nuovo
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 mt-1 leading-snug">
                  È stata pubblicata una nuova versione con aggiornamenti dal server.
                </p>
              </div>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Ricordamelo più tardi"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent-gold hover:bg-accent-gold/90 active:scale-95 text-lake-green font-black text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={isUpdating ? "animate-spin" : ""} />
              <span>{isUpdating ? 'Ricaricamento in corso...' : 'Aggiorna Ora'}</span>
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 text-xs font-bold transition-colors cursor-pointer"
            >
              Dopo
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
