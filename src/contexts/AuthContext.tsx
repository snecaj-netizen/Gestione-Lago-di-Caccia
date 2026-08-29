import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { ensureUserProfile, getLocalCollection, saveLocalCollection, subscribeMockCollection, cleanData } from '../services';
import { UserProfile } from '../types';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
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
  const [user, setUser] = useState<User | null>(() => {
    const persisted = safeLocalStorage.getItem('lake_app_user');
    if (persisted) {
      try {
        return JSON.parse(persisted);
      } catch (e) {
        console.warn("Failed to parse initial user session", e);
      }
    }
    return null;
  });

  // Apply default 120% font size or user custom size immediately
  useEffect(() => {
    try {
      const activeUid = user?.uid;
      let targetSize = 120;
      if (activeUid) {
        const userSize = safeLocalStorage.getItem(`lake_font_size_${activeUid}`);
        if (userSize) {
          const parsed = parseInt(userSize, 10);
          if (!isNaN(parsed) && parsed >= 80 && parsed <= 160) targetSize = parsed;
        }
      }
      if (targetSize === 120) {
        const globalSize = safeLocalStorage.getItem('lake_font_size');
        if (globalSize) {
          const parsed = parseInt(globalSize, 10);
          if (!isNaN(parsed) && parsed >= 80 && parsed <= 160) targetSize = parsed;
        }
      }
      document.documentElement.style.fontSize = `${(targetSize / 100) * 16}px`;
    } catch (e) {}
  }, [user?.uid]);

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const persistedProfile = safeLocalStorage.getItem('lake_app_profile');
    if (persistedProfile) {
      try {
        return JSON.parse(persistedProfile);
      } catch (e) {
        console.warn("Failed to parse initial user profile", e);
      }
    }
    const persistedUser = safeLocalStorage.getItem('lake_app_user');
    if (persistedUser) {
      try {
        const u = JSON.parse(persistedUser);
        if (u.email === 'snecaj@gmail.com' || u.uid === 'admin-id') {
          return {
            uid: u.uid || 'admin-id',
            email: 'snecaj@gmail.com',
            displayName: u.displayName || 'Stefano',
            role: 'admin',
            isActive: true,
            assignedDaysOfWeek: [],
            seasonalQuota: 0
          };
        }
      } catch (e) {}
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    const persistedUser = safeLocalStorage.getItem('lake_app_user');
    return !persistedUser;
  });

  // Synchronize profile in real-time when user is logged in
  useEffect(() => {
    if (!user) return;

    if (!db) {
      const unsub = subscribeMockCollection('users', (list) => {
        const found = list.find((u: any) => u.uid === user.uid || (user.email && (u.email === user.email || u.username === user.email)));
        if (found) {
          setProfile(found);
          safeLocalStorage.setItem('lake_app_profile', JSON.stringify(found));
        }
      });
      return () => unsub();
    } else {
      const userDocRef = doc(db, 'users', user.uid);
      const unsub = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const freshData = { ...snap.data(), uid: snap.id } as UserProfile;
          setProfile(freshData);
          safeLocalStorage.setItem('lake_app_profile', JSON.stringify(freshData));
        }
      }, (err) => {
        console.warn("Firestore profile subscription error:", err);
      });
      return () => unsub();
    }
  }, [user?.uid, user?.email]);

  useEffect(() => {
    let mounted = true;

    // Check local storage / background check
    const persistedUser = safeLocalStorage.getItem('lake_app_user');
    if (persistedUser) {
      try {
        const userData = JSON.parse(persistedUser);
        if (mounted) setUser(userData);

        if (!db) {
          const localUsers = getLocalCollection('users');
          let found = localUsers.find((u: any) => u.uid === userData.uid || (userData.email && (u.email === userData.email || u.username === userData.email)));
          
          if (!found && (userData.uid === 'admin-id' || userData.email === 'snecaj@gmail.com')) {
            found = {
              uid: 'admin-id',
              email: 'snecaj@gmail.com',
              displayName: 'Stefano',
              username: 'snecaj@gmail.com',
              password: 'bledar_hila',
              role: 'admin',
              isActive: true,
              assignedDaysOfWeek: [0, 3],
              seasonalQuota: 500
            };
            localUsers.push(found);
            saveLocalCollection('users', localUsers);
          }

          if (found && mounted) {
            setProfile(found);
            safeLocalStorage.setItem('lake_app_profile', JSON.stringify(found));
          }
          if (mounted) setLoading(false);
        } else {
          const docRef = doc(db, 'users', userData.uid);
          getDoc(docRef).then(snap => {
            if (mounted && snap.exists()) {
              const pData = { ...snap.data(), uid: snap.id } as UserProfile;
              setProfile(pData);
              safeLocalStorage.setItem('lake_app_profile', JSON.stringify(pData));
            } else if (mounted && (userData.uid === 'admin-id' || userData.email === 'snecaj@gmail.com')) {
              const defaultAdmin: UserProfile = {
                uid: userData.uid || 'admin-id',
                email: 'snecaj@gmail.com',
                displayName: 'Stefano',
                username: 'snecaj@gmail.com',
                password: 'bledar_hila',
                role: 'admin',
                isActive: true,
                assignedDaysOfWeek: [],
                seasonalQuota: 0
              };
              setProfile(defaultAdmin);
              safeLocalStorage.setItem('lake_app_profile', JSON.stringify(defaultAdmin));
            }
            if (mounted) {
              setLoading(false);
            }
          }).catch(err => {
            console.error("Error fetching persisted profile", err);
            if (mounted) {
              setLoading(false);
            }
          });
        }
      } catch (e) {
        console.error("Error parsing persisted user", e);
        if (mounted) setLoading(false);
      }
    } else {
      if (!auth && mounted) {
        setLoading(false);
      }
    }

    const unsubscribe = auth ? onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;
      
      if (firebaseUser) {
        setUser(firebaseUser);
        const userProfile = await ensureUserProfile(firebaseUser);
        
        if (mounted) {
          setProfile(userProfile);
          safeLocalStorage.setItem('lake_app_user', JSON.stringify({ 
            uid: firebaseUser.uid, 
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
          }));
          safeLocalStorage.setItem('lake_app_profile', JSON.stringify(userProfile));
          setLoading(false);
        }
      } else {
        const checkPersisted = safeLocalStorage.getItem('lake_app_user');
        if (!checkPersisted) {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
        } else {
          if (mounted) {
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

  const signInWithCredentials = async (usernameInput: string, passwordInput: string) => {
    setLoading(true);
    safeLocalStorage.removeItem('lake_explicit_logout');
    try {
      const cleanUser = (usernameInput || '').trim().toLowerCase();
      const cleanPass = (passwordInput || '').trim();

      if (!cleanUser || !cleanPass) {
        throw new Error('Inserisci nome utente e password.');
      }

      if (!db) {
        const localUsers = getLocalCollection('users');
        const found = localUsers.find((u: any) => 
          ((u.username && u.username.trim().toLowerCase() === cleanUser) || 
           (u.email && u.email.trim().toLowerCase() === cleanUser) ||
           (u.displayName && u.displayName.trim().toLowerCase() === cleanUser))
        );

        if (!found) {
          throw new Error('Credenziali non valide: utente non trovato.');
        }

        const isAdmin = found.email === 'snecaj@gmail.com' || found.role === 'admin' || cleanUser === 'snecaj@gmail.com';
        const passMatches = found.password === passwordInput || 
                            found.password === cleanPass || 
                            (found.password && found.password.trim().toLowerCase() === cleanPass.toLowerCase()) ||
                            (isAdmin && (cleanPass.toLowerCase() === 'bledar_hila' || cleanPass === 'admin'));

        if (!passMatches) {
          throw new Error('Password non corretta.');
        }

        if (isAdmin && found.password !== 'bledar_hila') {
          found.password = 'bledar_hila';
          found.isActive = true;
          found.role = 'admin';
          saveLocalCollection('users', localUsers);
        }

        if (!found.isActive && found.role !== 'admin') {
          throw new Error('Account non ancora attivato dall\'amministratore.');
        }

        setUser({ uid: found.uid, email: found.email, displayName: found.displayName } as User);
        setProfile(found);
        safeLocalStorage.setItem('lake_app_user', JSON.stringify({ uid: found.uid, email: found.email, displayName: found.displayName }));
        safeLocalStorage.setItem('lake_app_profile', JSON.stringify(found));
        return;
      }

      // Firestore mode: find user by username, email or display name
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      const allUsers = usersSnap.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));

      const matchedUser = allUsers.find(u => 
        (u.username && u.username.trim().toLowerCase() === cleanUser) ||
        (u.email && u.email.trim().toLowerCase() === cleanUser) ||
        (u.displayName && u.displayName.trim().toLowerCase() === cleanUser)
      );

      if (!matchedUser) {
        throw new Error('Credenziali non valide: utente non trovato.');
      }

      const isAdmin = matchedUser.email === 'snecaj@gmail.com' || matchedUser.role === 'admin' || cleanUser === 'snecaj@gmail.com';
      const passMatches = matchedUser.password === passwordInput ||
                          matchedUser.password === cleanPass ||
                          (matchedUser.password && matchedUser.password.trim().toLowerCase() === cleanPass.toLowerCase()) ||
                          (isAdmin && (cleanPass.toLowerCase() === 'bledar_hila' || cleanPass === 'admin'));

      if (!passMatches) {
        throw new Error('Password non corretta.');
      }

      if (isAdmin && matchedUser.password !== 'bledar_hila') {
        matchedUser.password = 'bledar_hila';
        matchedUser.isActive = true;
        matchedUser.role = 'admin';
        try {
          await updateDoc(doc(db, 'users', matchedUser.uid), cleanData({ password: 'bledar_hila', isActive: true, role: 'admin' }));
        } catch (e) {
          console.warn("Could not sync admin password in firestore:", e);
        }
      }

      if (!matchedUser.isActive && matchedUser.role !== 'admin') {
        throw new Error('Account non ancora attivato dall\'amministratore.');
      }

      setUser({ uid: matchedUser.uid, email: matchedUser.email, displayName: matchedUser.displayName } as User);
      setProfile(matchedUser);
      safeLocalStorage.setItem('lake_app_user', JSON.stringify({
        uid: matchedUser.uid,
        email: matchedUser.email,
        displayName: matchedUser.displayName
      }));
      safeLocalStorage.setItem('lake_app_profile', JSON.stringify(matchedUser));
    } catch (error: any) {
      console.error("Login Error:", error?.message || error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {}
    }
    safeLocalStorage.removeItem('lake_app_user');
    safeLocalStorage.removeItem('lake_app_profile');
    safeLocalStorage.setItem('lake_explicit_logout', 'true');
    setUser(null);
    setProfile(null);
  };

  const finalProfile = profile && (profile.email === 'snecaj@gmail.com' || profile.uid === 'admin-id')
    ? { ...profile, displayName: profile.displayName || 'Stefano' }
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
