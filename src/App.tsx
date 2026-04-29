import React from 'react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link,
  useLocation
} from 'react-router-dom';
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
  Download
} from 'lucide-react';
import { cn } from './lib/utils';

// Pages (to be implemented in sub-components or here for simplicity)
import { Dashboard } from './pages/Dashboard';
import { HuntingCalendar } from './pages/HuntingCalendar';
import { WeatherPage } from './pages/WeatherPage';
import { Accounting } from './pages/Accounting';
import { Harvests } from './pages/Harvests';
import { AdminPanel } from './pages/AdminPanel';
import { Profile } from './pages/Profile';
import { Gallery } from './pages/Gallery';
import { NotificationCenter } from './components/NotificationCenter';
import { seedUsers } from './services';

function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const { logout, profile } = useAuth();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);

  React.useEffect(() => {
    const handler = (e: any) => {
      console.log('PWA: beforeinstallprompt caught in Sidebar');
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const navItems = [
    { name: 'Calendario Venatorio', path: '/', icon: CalendarIcon },
    { name: 'Meteo Lago', path: '/meteo', icon: CloudSun },
    { name: 'Abbattimenti', path: '/abbattimenti', icon: Target },
    { name: 'Galleria Foto', path: '/galleria', icon: Camera },
  ];

  if (profile?.role === 'admin' || profile?.role === 'socio') {
    navItems.push({ name: 'Spese & Quote', path: '/spese', icon: Wallet });
    navItems.push({ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard });
  }

  if (profile?.role === 'admin') {
    navItems.push({ name: 'Admin', path: '/admin', icon: Users });
  } else {
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
        "fixed inset-y-0 left-0 z-40 w-64 bg-lake-green text-white flex flex-col shadow-xl transform transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full relative">
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-50 active:scale-95 transition-all"
          >
            <X size={28} />
          </button>

          <nav className="flex-1 pt-20 lg:pt-8">
            <ul>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-4 transition-all duration-200 border-l-4 font-medium",
                    location.pathname === item.path 
                      ? "bg-white/10 border-accent-gold text-white" 
                      : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon size={20} className={cn(
                    location.pathname === item.path ? "text-accent-gold" : "opacity-70"
                  )} />
                  {item.name}
                </Link>
              ))}
            </ul>
          </nav>

          <div className="mt-auto p-6 border-t border-white/10 space-y-4">
            {deferredPrompt ? (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-3 w-full text-xs font-bold text-accent-gold hover:text-white transition-colors bg-white/5 py-3 px-4 rounded-lg border border-accent-gold/20"
              >
                <Download size={18} />
                Installa App (PWA)
              </button>
            ) : (
              <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <p className="text-[10px] text-white/50 leading-tight">
                  Per installare: usa "Aggiungi a home" dal menu del browser.
                </p>
              </div>
            )}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 w-full text-sm font-semibold text-white/60 hover:text-rose-400 transition-colors"
            >
              <LogOut size={18} />
              Esci dal portale
            </button>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-lake-green/80 backdrop-blur-md">
          <div className="bg-white rounded-lg p-8 max-w-sm w-full shadow-2xl border-t-8 border-rose-500 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="text-rose-500" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Sei sicuro?</h3>
            <p className="text-slate-500 text-sm mb-8 font-medium">
              Stai per uscire dal portale di gestione del lago. Dovrai rieffettuare l'accesso con Google.
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
  const { signIn, signInWithCredentials } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);

  React.useEffect(() => {
    seedUsers();
    
    const handler = (e: any) => {
      console.log('PWA: beforeinstallprompt caught in Login');
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA: User choice: ${outcome}`);
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithCredentials(username, password);
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'accesso');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-body flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 sm:p-10 text-center rounded-xl shadow-2xl border-t-8 border-lake-green">
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-xl overflow-hidden border-4 border-lake-green/10 p-2">
          <img 
            src="/logo_lago.png" 
            alt="Logo" 
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Logo';
            }}
          />
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
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-off-white border border-slate-200 rounded px-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-lake-green transition-all shadow-inner"
              placeholder="Inserisci password"
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-lake-green text-white font-bold py-4 px-6 rounded-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 mt-6 uppercase text-xs tracking-widest hover:bg-lake-green/90"
          >
            {isSubmitting ? 'Accesso in corso...' : 'Accedi al Portale'}
          </button>
        </form>

        {deferredPrompt && (
          <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Installazione Consigliata</p>
            <button 
              onClick={handleInstall}
              className="w-full bg-accent-gold text-lake-green font-black py-3 px-6 rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 uppercase text-[0.65rem] tracking-[0.2em] hover:bg-accent-gold/90 border border-lake-green/10"
            >
              <Download size={16} />
              Installa App Sul Telefono
            </button>
          </div>
        )}
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

  if (!profile?.isActive && !allowPending) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <Lock className="text-amber-500 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">Accesso Riservato</h2>
          <p className="text-slate-400 mb-6 font-light leading-relaxed">
            Ciao <span className="text-indigo-400 font-medium">{profile?.displayName}</span>, il tuo account è in attesa di approvazione dall'Amministratore (Stefano).
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
          >
            Controlla di nuovo
          </button>
        </div>
      </div>
    );
  }

  return children;
}

function Logo() {
  const [error, setError] = React.useState(false);
  const logoUrl = "/logo_lago.png";
  
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <Link to="/" className="flex items-center justify-center group flex-col">
        <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 group-active:scale-95 transition-all duration-300 ring-4 ring-lake-green/5 overflow-hidden border border-slate-100 p-1">
          {!error ? (
            <img 
              src={logoUrl} 
              alt="Gestione Lago" 
              className="w-full h-full object-contain"
              onLoad={() => console.log('Logo loaded successfully')}
              onError={(e) => {
                console.error('Logo failed to load:', logoUrl);
                setError(true);
              }}
            />
          ) : (
            <div className="text-lake-green flex items-center justify-center">
              {/* Stylized Duck SVG inspirated by the ink drawing */}
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current drop-shadow-sm">
                <path d="M21,11C20.3,10.1 19.4,9.5 18.5,9.2C18.8,8.2 18.8,7.2 18.3,6.2C17.5,4.7 15.7,4.1 14.2,4.8C13.4,5.2 12.8,5.8 12.4,6.6C10.9,6.2 9.2,6.5 8,7.5C6.8,8.5 6.2,10 6.2,11.5C6.2,12.5 6.4,13.5 6.9,14.3C5.1,14.6 3.5,15.7 2.6,17.4C2.3,17.8 2.5,18.3 2.9,18.6C3.3,18.9 3.8,18.7 4.1,18.3C4.8,17.1 6.1,16.3 7.4,16.1C8.2,17.2 9.4,18 10.8,18.3C12.2,18.6 13.7,18.3 14.8,17.5C16,16.7 16.7,15.4 16.9,14C18.2,14.5 19.6,14.3 20.7,13.5C21.1,13.2 21.2,12.7 20.9,12.3C20.6,11.9 20.1,11.8 19.7,12.1C19,12.6 18.1,12.7 17.3,12.4C17.6,11.9 17.8,11.4 17.8,10.9C18.4,11 19,11.2 19.5,11.6C19.9,11.9 20.4,11.8 20.7,11.4C20.9,11.1 20.9,10.6 20.5,10.4C20,10.1 19.5,10 19,10C19.7,10.2 20.4,10.5 21,11M14,8C14.6,8 15,7.6 15,7C15,6.4 14.6,6 14,6C13.4,6 13,6.4 13,7C13,7.6 13.4,8 14,8Z" />
              </svg>
            </div>
          )}
        </div>
        <span className="sr-only">Calendario Venatorio</span>
      </Link>
    </div>
  );
}

function MainLayout() {
  const { profile, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isOpen={isOpen} setIsOpen={setIsOpen} />
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-20 flex items-center justify-between px-4 sm:px-8 shadow-sm">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden flex flex-col items-center text-lake-green hover:bg-slate-100 rounded-md transition-colors px-1"
          >
            <Menu size={24}/>
            <span className="text-[10px] font-black uppercase tracking-tighter -mt-0.5">Menu</span>
          </button>

          <Logo />

          <div className="flex-1 lg:hidden" />
          <div className="hidden lg:block flex-1" />

          <div className="flex items-center gap-4">
            <NotificationCenter />
            <div className="h-8 w-[1px] bg-slate-100 mx-1 hidden sm:block" />
            
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
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

              {showProfileMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-40 transform origin-top-right transition-all animate-in fade-in zoom-in duration-200">
                    <div className="px-4 py-2 border-b border-slate-50 lg:hidden">
                      <p className="text-xs font-black text-slate-900">{profile?.displayName}</p>
                      <p className="text-[10px] font-bold text-lake-green uppercase tracking-tighter">{profile?.role}</p>
                    </div>
                    {profile?.role !== 'admin' && (
                      <Link 
                        to="/profilo"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-lake-green transition-colors"
                      >
                        <UserIcon size={14} />
                        Il mio profilo
                      </Link>
                    )}
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
                  </div>
                </>
              )}
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

        <main className="p-3 sm:p-4 lg:p-10 pt-20 lg:pt-24 min-h-screen w-full">
          <div className="max-w-7xl mx-auto w-full">
            <Routes>
              <Route path="/" element={<HuntingCalendar />} />
              {(profile?.role === 'admin' || profile?.role === 'socio') && (
                <>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/spese" element={<Accounting />} />
                </>
              )}
              <Route path="/meteo" element={<WeatherPage />} />
              <Route path="/abbattimenti" element={<Harvests />} />
              <Route path="/galleria" element={<Gallery />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/profilo" element={<Profile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
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
