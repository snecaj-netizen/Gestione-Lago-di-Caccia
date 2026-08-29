import React from 'react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  CloudSun, 
  Wallet, 
  Target, 
  LayoutDashboard, 
  Users,
  LogOut,
  Menu,
  X,
  Lock,
  User as UserIcon,
  Camera,
  Bird,
  Download,
  Waves,
  Fish,
  Utensils,
  FileText,
  BookOpen,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from './lib/utils';
import { safeLocalStorage } from './lib/safeLocalStorage';

// Pages (to be implemented in sub-components or here for simplicity)
import { Dashboard } from './pages/Dashboard';
import { HuntingCalendar } from './pages/HuntingCalendar';
import { WeatherPage } from './pages/WeatherPage';
import { Accounting } from './pages/Accounting';
import { Harvests } from './pages/Harvests';
import { AdminPanel } from './pages/AdminPanel';
import { Profile } from './pages/Profile';
import { Gallery } from './pages/Gallery';
import { Recipes } from './pages/Recipes';
import { Tesserino } from './pages/Tesserino';
import { Regulation } from './pages/Regulation';
import { InstallModal } from './components/InstallModal';
import { NotificationCenter } from './components/NotificationCenter';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { it } from 'date-fns/locale';
import { format } from 'date-fns';
import { db } from './firebase';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { Notification as AppNotification } from './types';
import { seedUsers, createNotification, checkAndSendBirthdayNotifications } from './services';

function Sidebar({ 
  isOpen, 
  setIsOpen,
  decreaseFontSize,
  increaseFontSize,
  scaleIndex,
  fontScale,
  FONT_SCALES
}: { 
  isOpen: boolean, 
  setIsOpen: (val: boolean) => void,
  decreaseFontSize: () => void,
  increaseFontSize: () => void,
  scaleIndex: number,
  fontScale: number,
  FONT_SCALES: number[]
}) {
  const { logout, profile } = useAuth();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallModal, setShowInstallModal] = React.useState(false);

  const isStandalone = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

  // Close sidebar on path change
  React.useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const handler = (e: any) => {
      console.log('PWA: beforeinstallprompt event fired in Sidebar');
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setDeferredPrompt(null));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const navItems = [
    { name: 'Oggi al Lago', path: '/', icon: CalendarIcon },
    { name: 'Meteo Lago', path: '/meteo', icon: CloudSun },
    { name: 'Abbattimenti', path: '/abbattimenti', icon: Target },
    { name: 'Galleria Foto', path: '/galleria', icon: Camera },
    { name: 'Selvaggina in Cucina', path: '/ricette', icon: Utensils },
  ];

  if (profile?.role === 'admin' || profile?.role === 'socio') {
    navItems.push({ name: 'Spese & Quote', path: '/spese', icon: Wallet });
    navItems.push({ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
  }

  if (profile?.role === 'admin') {
    navItems.push({ name: 'Tesserino Venatorio', path: '/tesserino', icon: BookOpen });
    navItems.push({ name: 'Info e Regolamento', path: '/regolamento', icon: FileText });
    navItems.push({ name: 'Admin', path: '/admin', icon: Users });
  } else {
    navItems.push({ name: 'Info e Regolamento', path: '/regolamento', icon: FileText });
    navItems.push({ name: 'Mio Profilo', path: '/profilo', icon: UserIcon });
  }

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  return (
    <>
      <div className="lg:hidden">
        {/* Mobile Burger is now in the header */}
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 lg:w-64 bg-lake-green text-white flex flex-col shadow-xl transform transition-transform duration-300 lg:translate-x-0 overflow-hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full relative overflow-y-auto scrollbar-none">
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden absolute top-3 right-3 p-1.5 text-white/70 hover:text-white transition-colors z-50 active:scale-95 transition-all"
          >
            <X size={26} />
          </button>

          <div className="flex flex-col items-center pt-4 lg:pt-4 mb-3 px-4 shrink-0">
            <Link to="/" onClick={() => setIsOpen(false)} className="text-center group">
              <h2 className="text-lg font-serif font-bold text-white tracking-widest uppercase group-hover:text-accent-gold transition-colors">Lago di Caccia</h2>
            </Link>
            
            {/* Mobile Font Size controls */}
            <div className="mt-2.5 flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5 shadow-inner border border-white/15">
              <button 
                onClick={decreaseFontSize}
                disabled={scaleIndex === 0}
                className="p-1 px-3 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all text-xs font-black flex items-center justify-center min-w-[28px] h-[28px] cursor-pointer disabled:cursor-not-allowed active:scale-90"
                title="Riduci testo (A-)"
              >
                A-
              </button>
              <span className="text-[11px] font-black text-accent-gold px-2.5 uppercase select-none min-w-[36px] text-center">
                {fontScale}%
              </span>
              <button 
                onClick={increaseFontSize}
                disabled={scaleIndex === FONT_SCALES.length - 1}
                className="p-1 px-3 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all text-xs font-black flex items-center justify-center min-w-[28px] h-[28px] cursor-pointer disabled:cursor-not-allowed active:scale-90"
                title="Aumenta testo (A+)"
              >
                A+
              </button>
            </div>
          </div>
          <nav className="flex-1">
            <ul className="space-y-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3.5 px-5 py-3 transition-all duration-200 border-l-4 font-semibold text-base sm:text-base",
                    location.pathname === item.path 
                      ? "bg-white/15 border-accent-gold text-white font-bold shadow-xs" 
                      : "border-transparent text-white/80 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon size={22} className={cn(
                    "shrink-0",
                    location.pathname === item.path ? "text-accent-gold" : "opacity-80"
                  )} />
                  <span className="truncate">{item.name}</span>
                </Link>
              ))}
            </ul>
          </nav>

          <div className="mt-auto p-4 border-t border-white/10 space-y-3 shrink-0">
            {!isStandalone && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center justify-center gap-2.5 w-full text-sm font-bold text-lake-green bg-accent-gold hover:bg-accent-gold/90 transition-all py-3 px-3.5 rounded-xl shadow-md border border-accent-gold/40 active:scale-98 cursor-pointer"
              >
                <Download size={18} />
                Installa App sul Telefono
              </button>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full text-sm font-semibold text-white/70 hover:text-rose-300 transition-colors py-1.5 active:scale-98"
            >
              <LogOut size={18} />
              Esci dal portale
            </button>
            <div className="pt-1 text-center">
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                © 2026 Stefano Necaj
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* PWA Install Guide Modal */}
      <InstallModal 
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        deferredPrompt={deferredPrompt}
        onNativeInstall={handleInstallClick}
      />

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-md">
          <div className="bg-white rounded-lg p-8 max-w-sm w-full shadow-2xl border-t-8 border-rose-500 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="text-rose-500" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Sei sicuro?</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium">
              Stai per uscire dal portale di gestione del lago. Dovrai rieffettuare l'accesso con le tue credenziali.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[0.7rem] uppercase tracking-widest rounded transition-all"
              >
                Annulla
              </button>
              <button 
                onClick={confirmLogout}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[0.7rem] uppercase tracking-widest rounded shadow-lg active:scale-95 transition-all"
              >
                Esci Ora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Login() {
  const { signInWithCredentials, user, profile } = useAuth();
  const navigate = useNavigate();
  const [rememberMe, setRememberMe] = React.useState(() => {
    return safeLocalStorage.getItem('lake_remember_me') !== 'false';
  });
  const [username, setUsername] = React.useState(() => {
    return safeLocalStorage.getItem('lake_username') || '';
  });
  const [password, setPassword] = React.useState(() => {
    return safeLocalStorage.getItem('lake_password') || '';
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallModal, setShowInstallModal] = React.useState(false);

  const isStandalone = typeof window !== 'undefined' && 
    (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

  React.useEffect(() => {
    if (user && (profile?.isActive || profile?.role === 'admin' || user.email === 'snecaj@gmail.com')) {
      navigate('/', { replace: true });
    }
  }, [user, profile, navigate]);

  React.useEffect(() => {
    const isExplicitLogout = safeLocalStorage.getItem('lake_explicit_logout') === 'true';
    const isRemembered = safeLocalStorage.getItem('lake_remember_me') !== 'false';
    const savedUser = safeLocalStorage.getItem('lake_username');
    const savedPass = safeLocalStorage.getItem('lake_password');

    if (isRemembered && savedUser && savedPass && !user && !isSubmitting && !isExplicitLogout) {
      const performAutoLogin = async () => {
        setIsSubmitting(true);
        try {
          await signInWithCredentials(savedUser, savedPass);
          navigate('/', { replace: true });
        } catch (err: any) {
          console.warn("Auto-login failed:", err);
        } finally {
          setIsSubmitting(false);
        }
      };
      performAutoLogin();
    }
  }, []);

  React.useEffect(() => {
    seedUsers();
    
    // Debug PWA status
    try {
      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (!isInIframe && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          console.log('PWA: Service Worker registration state:', reg ? 'Found' : 'Not found');
          if (reg) console.log('PWA: Registration active:', !!reg.active);
        }).catch(err => {
          console.warn('PWA: Service worker check failed with error:', err);
        });
      }
    } catch (e) {
      console.warn('PWA: Service worker is not accessible or blocked in this environment:', e);
    }

    const handler = (e: any) => {
      console.log('PWA: beforeinstallprompt event fired!');
      e.preventDefault();
      setDeferredPrompt(e);
      // Let the user know the prompt is ready (internally)
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App was successfully installed');
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA: User choice: ${outcome}`);
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithCredentials(username, password);
      if (rememberMe) {
        safeLocalStorage.setItem('lake_remember_me', 'true');
        safeLocalStorage.setItem('lake_username', username);
        safeLocalStorage.setItem('lake_password', password);
      } else {
        safeLocalStorage.removeItem('lake_remember_me');
        safeLocalStorage.removeItem('lake_username');
        safeLocalStorage.removeItem('lake_password');
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'accesso');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-body flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 sm:p-10 text-center rounded-xl shadow-2xl border-t-8 border-lake-green">
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center mx-auto">
            <img 
              src="/logo_lago.png" 
              alt="Gestione Lago Logo" 
              className="max-h-full max-w-full object-contain mix-blend-multiply"
              onError={(e) => {
                const target = e.target as HTMLElement;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
            <div className="hidden w-full h-full items-center justify-center">
              <Bird className="text-lake-green w-10 h-10 sm:w-12 sm:h-12" />
            </div>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif text-lake-green mb-2 sm:mb-4">Gestione Lago</h1>
        <p className="text-slate-gray mb-8 sm:mb-10 font-medium text-sm">Portale riservato ai soci e quotisti</p>
        
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded uppercase flex items-center gap-2">
              <Lock size={14} /> {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Nome Utente</label>
            <input 
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-off-white border border-slate-200 rounded px-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-lake-green transition-all shadow-inner"
              placeholder="Inserisci nome utente"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-off-white border border-slate-200 rounded pl-4 pr-12 py-4 text-sm font-bold text-slate-900 outline-none focus:border-lake-green transition-all shadow-inner"
                placeholder="Inserisci password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-lake-green focus:outline-none transition-colors"
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center pt-2">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-lake-green border-slate-300 rounded focus:ring-lake-green focus:ring-offset-0 cursor-pointer accent-lake-green"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer select-none">
              Ricorda credenziali
            </label>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-lake-green text-white font-bold py-4 px-6 rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 mt-6 uppercase text-xs tracking-widest hover:bg-lake-green/90 cursor-pointer"
          >
            {isSubmitting ? 'Accesso in corso...' : 'Accedi al Portale'}
          </button>
        </form>

        {!isStandalone && (
          <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Installazione Consigliata</p>
            <button 
              type="button"
              onClick={handleInstall}
              className="w-full bg-accent-gold text-lake-green font-black py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 uppercase text-[0.7rem] tracking-[0.15em] hover:bg-accent-gold/90 border border-lake-green/10 cursor-pointer"
            >
              <Download size={16} />
              Installa App Sul Telefono
            </button>
          </div>
        )}

        <InstallModal 
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          deferredPrompt={deferredPrompt}
          onNativeInstall={handleInstall}
        />
      </div>
    </div>
  );
}

function PrivateRoute({ children, allowPending = false }: { children: React.ReactElement, allowPending?: boolean }) {
  const { user, profile, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
    </div>
  );
  
  if (!user) return <Login />;

  if (user?.email === 'snecaj@gmail.com' || profile?.role === 'admin') return children;

  if (!profile?.isActive && !allowPending) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
          <Lock className="text-amber-500 mx-auto mb-6" size={56} />
          <h2 className="text-2xl font-black text-white mb-3 uppercase tracking-tight">Accesso Riservato</h2>
          <p className="text-slate-400 mb-8 font-medium leading-relaxed text-sm">
            Ciao <span className="text-indigo-400 font-bold">{profile?.displayName || 'Utente'}</span>, il tuo account è in attesa di approvazione dall'Amministratore (Stefano).
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition-all shadow-lg active:scale-95 text-xs uppercase tracking-[0.2em]"
            >
              Controlla Stato
            </button>
            <button 
              onClick={() => {
                safeLocalStorage.removeItem('lake_app_user');
                window.location.href = '/login';
              }}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-xs uppercase tracking-widest border border-slate-700"
            >
              Cambia Account / Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

function Logo() {
  const [version, setVersion] = React.useState(Date.now());

  React.useEffect(() => {
    const handleUpdate = () => setVersion(Date.now());
    window.addEventListener('lake-logo-updated', handleUpdate);
    return () => window.removeEventListener('lake-logo-updated', handleUpdate);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <Link to="/" className="group flex flex-col items-center">
        <div className="relative">
          <div className="w-14 h-14 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-all duration-300">
            <img 
              src={`/logo_lago.png?v=${version}`} 
              alt="Logo Lago" 
              className="max-h-full max-w-full object-contain mix-blend-multiply"
              onError={(e) => {
                const target = e.target as HTMLElement;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'block';
                }
              }}
            />
            <Bird className="text-lake-green w-8 h-8 hidden" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-accent-gold p-1 rounded-full shadow-sm">
            <Waves className="text-white" size={10} />
          </div>
        </div>
      </Link>
    </div>
  );
}

function MainLayout() {
  const { profile, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Font size adjustment for older users
  const FONT_SCALES = [90, 100, 110, 120, 135, 150];
  const [fontScale, setFontScale] = React.useState(() => {
    return Number(safeLocalStorage.getItem('lake_font_scale') || '100');
  });

  React.useEffect(() => {
    try {
      document.documentElement.style.fontSize = `${fontScale}%`;
      safeLocalStorage.setItem('lake_font_scale', fontScale.toString());
    } catch (e) {
      console.warn("Could not set font scale on document element:", e);
    }
  }, [fontScale]);

  const scaleIndex = FONT_SCALES.indexOf(fontScale) !== -1 ? FONT_SCALES.indexOf(fontScale) : 1;

  const decreaseFontSize = () => {
    if (scaleIndex > 0) {
      setFontScale(FONT_SCALES[scaleIndex - 1]);
    }
  };

  const increaseFontSize = () => {
    if (scaleIndex < FONT_SCALES.length - 1) {
      setFontScale(FONT_SCALES[scaleIndex + 1]);
    }
  };

  // Notification permission and browser push
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (e) {
      console.warn("Notification API is restricted or not supported in this environment:", e);
    }
  }, []);

  // Monitor new notifications for browser alert
  React.useEffect(() => {
    if (!profile?.uid || !db) return;

    const q = query(
      collection(db, 'notifications'),
      where('targetUid', '==', profile.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    let isInitial = true;
    const unsub = onSnapshot(q, (snapshot) => {
      if (isInitial) {
        isInitial = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = change.doc.data() as AppNotification;
          try {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(notif.title, {
                body: notif.body,
                icon: '/logo.png' // Adjust if logo path differs
              }).onclick = () => {
                if (notif.link) navigate(notif.link);
                window.focus();
              };
            }
          } catch (e) {
            console.warn("Could not display browser notification in this environment:", e);
          }
        }
      });
    });

    return () => unsub();
  }, [profile?.uid, navigate]);

  // Check for tomorrow's hunt reminder
  React.useEffect(() => {
    if (!profile?.uid || !db) return;

    const checkReminders = async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

      // 1. Check if user has a hunt tomorrow
      const qHunts = query(
        collection(db, 'hunting_days'),
        where('date', '==', tomorrowStr),
        where('assignedToUid', '==', profile.uid)
      );
      const huntSnap = await getDocs(qHunts);

      if (!huntSnap.empty) {
        // 2. Check if reminder already sent today
        const reminderId = `reminder_${profile.uid}_${tomorrowStr}`;
        const qNotifs = query(
          collection(db, 'notifications'),
          where('targetUid', '==', profile.uid),
          where('metadata.reminderId', '==', reminderId)
        );
        const notifSnap = await getDocs(qNotifs);

        if (notifSnap.empty) {
          // Send reminder
          await createNotification({
            title: "Promemoria Caccia",
            body: `Domani (${format(tomorrow, 'dd/MM', { locale: it })}) hai una giornata di caccia prenotata!`,
            type: 'system',
            targetUid: profile.uid,
            link: '/',
            metadata: { reminderId }
          });
        }
      }
    };

    checkReminders();
  }, [profile?.uid]);

  // Check for birthdays (today & tomorrow) and send push/in-app notifications
  React.useEffect(() => {
    if (!profile?.uid) return;
    checkAndSendBirthdayNotifications();
    const interval = setInterval(() => {
      checkAndSendBirthdayNotifications();
    }, 1000 * 60 * 30); // check every 30 minutes
    return () => clearInterval(interval);
  }, [profile?.uid]);

  // Handle mutual exclusivity
  const toggleNotifications = (val: boolean) => {
    if (val) {
      setShowProfileMenu(false);
      setIsOpen(false);
    }
    setShowNotifications(val);
  };

  const toggleProfileMenu = (val: boolean) => {
    if (val) {
      setShowNotifications(false);
      setIsOpen(false);
    }
    setShowProfileMenu(val);
  };

  const toggleSidebar = (val: boolean) => {
    if (val) {
      setShowNotifications(false);
      setShowProfileMenu(false);
    }
    setIsOpen(val);
  };

  // Swipe back logic
  React.useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      
      // Left-to-right swipe (back)
      if (dx > 70 && Math.abs(dy) < 30) {
        // Only swipe back if we are not at root
        if (location.pathname !== '/') {
          navigate(-1);
        }
      }
    };
    
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [location.pathname, navigate]);

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar 
        isOpen={isOpen} 
        setIsOpen={toggleSidebar}
        decreaseFontSize={decreaseFontSize}
        increaseFontSize={increaseFontSize}
        scaleIndex={scaleIndex}
        fontScale={fontScale}
        FONT_SCALES={FONT_SCALES}
      />
      
      {/* Global Overlay for Menus (Profile/Notifications) */}
      <AnimatePresence>
        {(showProfileMenu || showNotifications) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-[25] backdrop-blur-[1px]"
            onClick={() => {
              setShowProfileMenu(false);
              setShowNotifications(false);
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-[30] flex items-center justify-between px-4 sm:px-8 shadow-sm">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => toggleSidebar(!isOpen)}
            className="lg:hidden flex flex-col items-center text-lake-green hover:bg-slate-100 rounded-md transition-colors px-1"
          >
            <Menu size={24}/>
            <span className="text-[10px] font-black uppercase tracking-tighter -mt-0.5">Menu</span>
          </button>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Logo />
          </div>

          <div className="flex-1 lg:hidden" />
          <div className="hidden lg:block flex-1" />

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Regolazione Font Size (Hidden on mobile/tablet, shown on desktop menu / sidebars for mobile) */}
            <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 shadow-sm border border-slate-200/50">
              <button 
                onClick={decreaseFontSize}
                disabled={scaleIndex === 0}
                className="p-1 sm:p-1.5 rounded hover:bg-white text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-[11px] sm:text-xs font-black flex items-center justify-center min-w-[24px] sm:min-w-[28px] h-6 sm:h-[28px] cursor-pointer disabled:cursor-not-allowed active:scale-90"
                title="Riduci testo"
              >
                A-
              </button>
              <span className="hidden sm:inline-block text-[10px] font-black text-slate-500 px-1.5 uppercase select-none min-w-[32px] text-center">
                {fontScale}%
              </span>
              <button 
                onClick={increaseFontSize}
                disabled={scaleIndex === FONT_SCALES.length - 1}
                className="p-1 sm:p-1.5 rounded hover:bg-white text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-[11px] sm:text-xs font-black flex items-center justify-center min-w-[24px] sm:min-w-[28px] h-6 sm:h-[28px] cursor-pointer disabled:cursor-not-allowed active:scale-90"
                title="Aumenta testo"
              >
                A+
              </button>
            </div>

            <div className="hidden md:block h-8 w-[1px] bg-slate-100 mx-0.5 sm:mx-1" />

            <NotificationCenter isOpen={showNotifications} onToggle={toggleNotifications} />
            <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden sm:block" />
            
            <div className="relative">
              <button 
                onClick={() => toggleProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 hover:bg-slate-50 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-black text-slate-900 leading-none">{profile?.displayName}</p>
                  <p className="text-[10px] font-bold text-lake-green uppercase tracking-tighter mt-1">{profile?.role}</p>
                </div>
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs ring-2 ring-off-white overflow-hidden border border-slate-100">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    profile?.displayName?.[0]
                  )}
                </div>
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-40 transform origin-top-right transition-all"
                  >
                    <div className="px-4 py-2 border-b border-slate-50 lg:hidden">
                      <p className="text-xs font-black text-slate-900">{profile?.displayName}</p>
                      <p className="text-[10px] font-bold text-lake-green uppercase tracking-tighter">{profile?.role}</p>
                    </div>
                    <Link 
                      to="/profilo"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-lake-green transition-colors"
                    >
                      <UserIcon size={14} />
                      Il mio profilo
                    </Link>
                    <button 
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 w-full text-left transition-colors"
                    >
                      <LogOut size={14} />
                      Esci (Logout)
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Logout Confirmation Modal (Shared) */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-md">
            <div className="bg-white rounded-lg p-8 max-w-sm w-full shadow-2xl border-t-8 border-rose-500 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="text-rose-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Sei sicuro?</h3>
              <p className="text-slate-500 text-sm mb-8 font-medium">
                Stai per uscire dal portale di gestione del lago. Dovrai rieffettuare l'accesso.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[0.7rem] uppercase tracking-widest rounded transition-all"
                >
                  Annulla
                </button>
                <button 
                  onClick={confirmLogout}
                  className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[0.7rem] uppercase tracking-widest rounded shadow-lg active:scale-95 transition-all"
                >
                  Esci Ora
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="p-3 sm:p-4 lg:p-10 pt-24 sm:pt-28 lg:pt-32 min-h-screen w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <Routes location={location}>
                  <Route path="/" element={<HuntingCalendar />} />
                  <Route path="/regolamento" element={<Regulation />} />
                  {(profile?.role === 'admin' || profile?.role === 'socio') && (
                    <>
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/spese" element={<Accounting />} />
                    </>
                  )}
                  <Route path="/meteo" element={<WeatherPage />} />
                  <Route path="/abbattimenti" element={<Harvests />} />
                  <Route path="/galleria" element={<Gallery />} />
                  <Route path="/ricette" element={<Recipes />} />
                  {profile?.role === 'admin' && (
                    <Route path="/tesserino" element={<Tesserino />} />
                  )}
                  <Route path="/admin" element={<AdminPanel />} />
                  <Route path="/profilo" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [supportServiceWorker, setSupportServiceWorker] = React.useState(false);

  React.useEffect(() => {
    try {
      const savedScale = safeLocalStorage.getItem('lake_font_scale') || '100';
      document.documentElement.style.fontSize = `${savedScale}%`;
    } catch (e) {
      console.warn("Could not apply initial font scale:", e);
    }
  }, []);

  React.useEffect(() => {
    try {
      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (!isInIframe && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        setSupportServiceWorker(true);
      }
    } catch (e) {
      console.warn("Service workers are not supported or blocked in this environment:", e);
    }
  }, []);

  return (
    <Router>
      <AuthProvider>
        {supportServiceWorker && <PWAUpdatePrompt />}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
