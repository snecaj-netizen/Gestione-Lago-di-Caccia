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

    // Check local storage FIRST for immediate session recovery (useful for the custom admin login)
    const persistedUser = localStorage.getItem('lake_app_user');
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
          // Fetch real profile from Firestore for other credential users
          const docRef = doc(db, 'users', userData.uid);
          getDoc(docRef).then(snap => {
            if (mounted && snap.exists()) {
              setProfile(snap.data() as UserProfile);
              setLoading(false);
            } else if (mounted) {
              setLoading(false);
            }
          }).catch(err => {
            console.error("Error fetching persisted profile", err);
            if (mounted) setLoading(false);
          });
        }
      } catch (e) {
        console.error("Error parsing persisted user", e);
        setLoading(false);
      }
    } else {
      // If no persisted user, we still need to wait for onAuthStateChanged
      // which is handled below.
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      
      if (firebaseUser) {
        // Real Firebase Auth user (Google, etc)
        setUser(firebaseUser);
        const userProfile = await ensureUserProfile(firebaseUser);
        
        if (mounted) {
          setProfile(userProfile);
          // Persist user for faster recovery on refresh
          localStorage.setItem('lake_app_user', JSON.stringify({ 
            uid: firebaseUser.uid, 
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
          }));
          setLoading(false);
        }
      } else {
        // No Firebase user, check if we still have the local storage one (custom credentials or recently logged out)
        const checkPersisted = localStorage.getItem('lake_app_user');
        if (!checkPersisted) {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        } else {
          // If we have a persisted user but Firebase says null, 
          // we might be in the middle of a refresh for a custom credential user.
          // Don't set user to null yet.
          if (mounted) setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithCredentials = async (username: string, password: string) => {
    setLoading(true);
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
        localStorage.setItem('lake_app_user', JSON.stringify({ uid: adminProfile.uid, email: adminProfile.email }));
        return;
      }

      if (!db) {
        throw new Error('Database Firebase non configurato. Usa le credenziali admin di default.');
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
      
      localStorage.setItem('lake_app_user', JSON.stringify({
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
    await signOut(auth);
    localStorage.removeItem('lake_app_user');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInWithCredentials, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
