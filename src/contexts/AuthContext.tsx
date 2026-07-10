import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User,
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { ensureUserProfile } from '../services';
import { UserProfile } from '../types';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { safeLocalStorage } from '../lib/safeLocalStorage';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithCredentials: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let isFetchingCustomProfile = false;

    // Check local storage FIRST for immediate session recovery (useful for the custom admin login)
    const persistedUser = safeLocalStorage.getItem('lake_app_user');
    if (persistedUser) {
      try {
        const userData = JSON.parse(persistedUser);
        setUser(userData);
        
        // Handle hardcoded admin profile immediately
        if (userData.uid === 'admin-id' || userData.email === 'snecaj@gmail.com') {
          const adminProfile: UserProfile = {
            uid: userData.uid,
            email: 'snecaj@gmail.com',
            displayName: 'Stefano',
            role: 'admin',
            isActive: true,
            username: 'snecaj@gmail.com',
            assignedDaysOfWeek: [],
            bio: 'Amministratore del sistema',
            location: 'Lago',
            photoURL: '',
            createdAt: new Date().toISOString()
          };
          setProfile(adminProfile);
          setLoading(false);
        } else {
          isFetchingCustomProfile = true;
          // Fetch real profile from Firestore for other credential users
          if (!db) {
            const localUsers = JSON.parse(safeLocalStorage.getItem('lake_db_users') || '[]');
            const found = localUsers.find((u: any) => u.uid === userData.uid);
            if (found && mounted) {
              setProfile(found);
            }
            isFetchingCustomProfile = false;
            setLoading(false);
          } else {
            const docRef = doc(db, 'users', userData.uid);
            getDoc(docRef).then(snap => {
              if (mounted && snap.exists()) {
                setProfile(snap.data() as UserProfile);
              }
              if (mounted) {
                isFetchingCustomProfile = false;
                setLoading(false);
              }
            }).catch(err => {
              console.error("Error fetching persisted profile", err);
              if (mounted) {
                isFetchingCustomProfile = false;
                setLoading(false);
              }
            });
          }
        }
      } catch (e) {
        console.error("Error parsing persisted user", e);
        setLoading(false);
      }
    } else {
      // If no persisted user and we have no firebase auth, set loading to false
      if (!auth && mounted) {
        setLoading(false);
      }
    }

    const unsubscribe = auth ? onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      
      if (firebaseUser) {
        // Real Firebase Auth user (Google, etc)
        setUser(firebaseUser);
        const userProfile = await ensureUserProfile(firebaseUser);
        
        if (mounted) {
          setProfile(userProfile);
          // Persist user for faster recovery on refresh
          safeLocalStorage.setItem('lake_app_user', JSON.stringify({ 
            uid: firebaseUser.uid, 
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
          }));
          setLoading(false);
        }
      } else {
        // No Firebase user, check if we still have the local storage one (custom credentials or recently logged out)
        const checkPersisted = safeLocalStorage.getItem('lake_app_user');
        if (!checkPersisted) {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        } else {
          // If we have a persisted user but Firebase says null, 
          // we might be in the middle of a refresh for a custom credential user.
          // Don't set user to null yet unless they are not currently fetching.
          if (mounted && !isFetchingCustomProfile) {
            setLoading(false);
          }
        }
      }
    }) : () => {};

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = async () => {
    if (!auth) {
      throw new Error("Autenticazione Firebase non disponibile.");
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithCredentials = async (username: string, password: string) => {
    setLoading(true);
    safeLocalStorage.removeItem('lake_explicit_logout');
    try {
      // Hardcoded fallback for admin login since Firestore might not be configured
      if (username === 'snecaj@gmail.com' && password === 'admin') {
        const adminProfile: UserProfile = {
          uid: 'admin-id',
          email: 'snecaj@gmail.com',
          displayName: 'Stefano',
          username: 'snecaj@gmail.com',
          role: 'admin',
          isActive: true,
          assignedDaysOfWeek: [],
          bio: 'Amministratore del sistema',
          location: 'Lago',
          photoURL: '',
          createdAt: new Date().toISOString()
        };
        setUser({ uid: adminProfile.uid, email: adminProfile.email } as User);
        setProfile(adminProfile);
        safeLocalStorage.setItem('lake_app_user', JSON.stringify({ uid: adminProfile.uid, email: adminProfile.email }));
        return;
      }

      if (!db) {
        const localUsers = JSON.parse(safeLocalStorage.getItem('lake_db_users') || safeLocalStorage.getItem('lake_users') || '[]');
        const found = localUsers.find((u: any) => u.username === username && u.password === password);
        if (!found) {
          throw new Error('Credenziali non valide');
        }
        setUser({ uid: found.uid, email: found.email } as User);
        setProfile(found);
        safeLocalStorage.setItem('lake_app_user', JSON.stringify({ uid: found.uid, email: found.email }));
        return;
      }

      // Find the profile with this username/password in Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username), where('password', '==', password));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Credenziali non valide');
      }

      const userProfile = querySnapshot.docs[0].data() as UserProfile;
      
      setUser({ uid: userProfile.uid, email: userProfile.email } as User);
      setProfile(userProfile);
      
      safeLocalStorage.setItem('lake_app_user', JSON.stringify({
        uid: userProfile.uid,
        email: userProfile.email
      }));
    } catch (error) {
      console.error("Login Error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    safeLocalStorage.removeItem('lake_app_user');
    safeLocalStorage.setItem('lake_explicit_logout', 'true');
    setUser(null);
    setProfile(null);
  };

  const finalProfile = profile && (profile.email === 'snecaj@gmail.com' || profile.uid === 'admin-id')
    ? { ...profile, displayName: 'Stefano' }
    : profile;

  return (
    <AuthContext.Provider value={{ user, profile: finalProfile, loading, signIn, signInWithCredentials, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
