import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  addDoc,
  deleteDoc,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { UserProfile, HuntingDay, Transaction, Harvest, LakeSettings, HuntingPhoto, BudgetItem, Notification, HuntingTime } from './types';
import { format } from 'date-fns';

// Hunting Times & Periods
export const subscribeToHuntingTimes = (callback: (times: HuntingTime[]) => void) => {
  const q = query(collection(db, 'hunting_times'), orderBy('startDate'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingTime)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'hunting_times'));
};

export const addHuntingTime = async (time: Omit<HuntingTime, 'id'>) => {
  try {
    await addDoc(collection(db, 'hunting_times'), time);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'hunting_times');
  }
};

export const updateHuntingTime = async (id: string, updates: Partial<HuntingTime>) => {
  try {
    await updateDoc(doc(db, 'hunting_times', id), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `hunting_times/${id}`);
  }
};

export const deleteHuntingTime = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'hunting_times', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hunting_times/${id}`);
  }
};

// Photos Gallery
export const subscribeToPhotos = (callback: (photos: HuntingPhoto[]) => void) => {
  const q = query(collection(db, 'photos'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingPhoto)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'photos'));
};

export const addPhoto = async (photo: Omit<HuntingPhoto, 'id' | 'userUid' | 'userName' | 'createdAt'>, user: UserProfile) => {
  try {
    const photoData = {
      ...photo,
      userUid: user.uid,
      userName: user.displayName,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'photos'), photoData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'photos');
  }
};

export const updatePhoto = async (photoId: string, updates: Partial<HuntingPhoto>) => {
  try {
    await updateDoc(doc(db, 'photos', photoId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `photos/${photoId}`);
  }
};

export const deletePhoto = async (photoId: string) => {
  try {
    await deleteDoc(doc(db, 'photos', photoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `photos/${photoId}`);
  }
};

// Global Settings
export const subscribeToSettings = (callback: (settings: LakeSettings) => void) => {
  return onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as LakeSettings);
    } else {
      // Create defaults if not exists
      const defaults: LakeSettings = {
        latitude: 45.4642, // Default Milano area
        longitude: 9.1900,
        seasonStart: format(new Date(), 'yyyy-MM-dd'),
        seasonEnd: format(new Date(), 'yyyy-MM-dd')
      };
      setDoc(doc(db, 'settings', 'global'), defaults);
      callback(defaults);
    }
  }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/global'));
};

export const updateSettings = async (updates: Partial<LakeSettings>) => {
  try {
    await setDoc(doc(db, 'settings', 'global'), updates, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
  }
};

// Auth & User Profile
export const ensureUserProfile = async (user: any): Promise<UserProfile> => {
  const userDocRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      // Stefano is Admin by default
      const isAdmin = user.email === 'snecaj@gmail.com';
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        username: isAdmin ? 'snecaj@gmail.com' : (user.email || ''),
        password: isAdmin ? 'admin' : '',
        displayName: user.displayName || 'Utente',
        role: isAdmin ? 'admin' : 'quotista', // Default to quotista, admin must approve
        isActive: isAdmin, // Stefano is active, others wait for approval
        assignedDaysOfWeek: []
      };
      await setDoc(userDocRef, newProfile);
      return newProfile;
    }
    
    const data = userDoc.data() as UserProfile;
    // Ensure admin has the requested credentials if not set
    if (data.email === 'snecaj@gmail.com' && (!data.username || !data.password)) {
      const updates = { 
        username: data.username || 'snecaj@gmail.com', 
        password: data.password || 'admin' 
      };
      await updateDoc(userDocRef, updates);
      return { ...data, ...updates };
    }
    
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    throw error;
  }
};

export const subscribeToUsers = (callback: (users: UserProfile[]) => void) => {
  const q = query(collection(db, 'users'), orderBy('email'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
    callback(users);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  try {
    await updateDoc(doc(db, 'users', uid), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const addUserManually = async (user: Omit<UserProfile, 'uid'>) => {
  try {
    const usersRef = collection(db, 'users');
    const newDocRef = doc(usersRef); // Generate a ID first
    await setDoc(newDocRef, {
      ...user,
      uid: newDocRef.id, // Include UID in initial creation
      isActive: true
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'users');
  }
};

export const deleteUser = async (uid: string) => {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
};

export const seedUsers = async () => {
  try {
    // Check if admin exists
    const adminEmail = 'snecaj@gmail.com';
    const usersRef = collection(db, 'users');
    const qAdmin = query(usersRef, where('email', '==', adminEmail));
    const adminSnap = await getDocs(qAdmin);

    if (adminSnap.empty) {
      const newAdminRef = doc(usersRef);
      await setDoc(newAdminRef, {
        uid: newAdminRef.id,
        email: adminEmail,
        username: adminEmail,
        password: 'admin',
        displayName: 'Stefano Necaj',
        role: 'admin',
        isActive: true,
        assignedDaysOfWeek: []
      });
    }

    console.log("Users seeded successfully");
  } catch (error) {
    console.error("Seeding error:", error);
  }
};

// Hunting Days
export const subscribeToHuntingDays = (callback: (days: HuntingDay[]) => void) => {
  const q = query(collection(db, 'hunting_days'), orderBy('date'));
  return onSnapshot(q, (snapshot) => {
    const days = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingDay));
    callback(days);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'hunting_days'));
};

export const assignHuntingDay = async (day: HuntingDay) => {
  try {
    await setDoc(doc(db, 'hunting_days', day.date), day);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `hunting_days/${day.date}`);
  }
};

export const unassignHuntingDay = async (date: string) => {
  try {
    await deleteDoc(doc(db, 'hunting_days', date));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hunting_days/${date}`);
  }
};

// Transactions
export const subscribeToTransactions = (callback: (txs: Transaction[]) => void) => {
  const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
};

export const addTransaction = async (tx: Omit<Transaction, 'id' | 'createdBy'>) => {
  try {
    await addDoc(collection(db, 'transactions'), {
      ...tx,
      createdBy: auth.currentUser?.uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'transactions');
  }
};

// Budget Items (Preventive)
export const subscribeToBudgetItems = (callback: (items: BudgetItem[]) => void) => {
  const q = query(collection(db, 'budget_items'), orderBy('label'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BudgetItem)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'budget_items'));
};

export const addBudgetItem = async (item: Omit<BudgetItem, 'id'>) => {
  try {
    await addDoc(collection(db, 'budget_items'), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'budget_items');
  }
};

export const updateBudgetItem = async (itemId: string, updates: Partial<BudgetItem>) => {
  try {
    await updateDoc(doc(db, 'budget_items', itemId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `budget_items/${itemId}`);
  }
};

export const deleteBudgetItem = async (itemId: string) => {
  try {
    await deleteDoc(doc(db, 'budget_items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `budget_items/${itemId}`);
  }
};

// Harvests
export const subscribeToHarvests = (callback: (harvests: Harvest[]) => void) => {
  const q = query(collection(db, 'harvests'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Harvest)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'harvests'));
};

const notifyAdminsAndSoci = async (title: string, body: string, type: Notification['type'], metadata?: any) => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const recipients = usersSnap.docs
      .map(doc => doc.data() as UserProfile)
      .filter(u => (u.role === 'admin' || u.role === 'socio') && u.isActive);

    const promises = recipients.map(async (u) => {
      await addDoc(collection(db, 'notifications'), {
        title,
        body,
        type,
        targetUid: u.uid,
        read: false,
        createdAt: new Date().toISOString(),
        metadata
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error creating notifications:", error);
  }
};

export const addHarvest = async (harvest: Omit<Harvest, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'harvests'), harvest);
    
    // Notify admins and soci
    await notifyAdminsAndSoci(
      "Nuovo Abbattimento",
      `${harvest.hunterName} ha registrato ${harvest.count}x ${harvest.species}`,
      'harvest',
      { harvestId: docRef.id }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'harvests');
  }
};

export const updateHarvest = async (harvestId: string, updates: Partial<Harvest>) => {
  try {
    await updateDoc(doc(db, 'harvests', harvestId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `harvests/${harvestId}`);
  }
};

export const deleteHarvest = async (harvestId: string) => {
  try {
    await deleteDoc(doc(db, 'harvests', harvestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `harvests/${harvestId}`);
  }
};

// Notifications
export const subscribeToUserNotifications = (uid: string, callback: (notifications: Notification[]) => void) => {
  const q = query(
    collection(db, 'notifications'), 
    where('targetUid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));
};

export const markNotificationAsRead = async (id: string) => {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
};

export const deleteNotification = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'notifications', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
  }
};
