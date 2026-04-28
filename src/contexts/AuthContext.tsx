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
    // Check local storage for persisted session
    const persistedUser = localStorage.getItem('lake_app_user');
    
    if (persistedUser) {
      const userData = JSON.parse(persistedUser);
      setUser(userData);
      const docRef = doc(db, 'users', userData.uid);
      getDoc(docRef).then(snap => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
        setLoading(false);
      });
    } else {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setLoading(true);
        if (user) {
          setUser(user);
          const userProfile = await ensureUserProfile(user);
          setProfile(userProfile);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    }
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signInWithCredentials = async (username: string, password: string) => {
    setLoading(true);
    try {
      // Find the profile with this username/password in Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username), where('password', '==', password));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        throw new Error('Credenziali non valide');
      }

      const userProfile = querySnapshot.docs[0].data() as UserProfile;
      
      // For this specific app setup, we manage auth via Firestore profile state
      // instead of standard Firebase Auth email/password, as requested by user.
      // We set the profile manually to signify a successful login.
      setUser({ uid: userProfile.uid, email: userProfile.email } as User);
      setProfile(userProfile);
      
      // Store session in localStorage to persist login
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
