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
import { UserProfile, HuntingDay, Transaction, Harvest, LakeSettings, HuntingPhoto, BudgetItem, Notification, HuntingTime, Recipe, HuntingLimit, TesserinoEntry } from './types';
import { format } from 'date-fns';

// Helper to strip undefined values from objects before Firestore operations
const cleanData = (data: any) => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
    // Also handle nested cleaning if necessary, but keep it simple for now
    if (cleaned[key] !== null && typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key])) {
      cleaned[key] = cleanData(cleaned[key]);
    }
  });
  return cleaned;
};
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
    await updateDoc(doc(db, 'hunting_times', id), cleanData(updates));
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

export const addPhoto = async (album: Omit<HuntingPhoto, 'id' | 'userUid' | 'userName' | 'createdAt'>, user: UserProfile) => {
  try {
    const albumData = {
      ...album,
      userUid: user.uid,
      userName: user.displayName,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, 'photos'), cleanData(albumData));

    // Notify admins and soci
    const firstCaption = album.images[0]?.caption || album.albumCaption;
    await notifyAdminsAndSubscribers(
      album.images.length > 1 ? "Nuovo Album Gallery" : "Nuova Foto Gallery",
      `${user.displayName} ha caricato ${album.images.length > 1 ? `un album con ${album.images.length} foto` : 'una nuova foto'}${firstCaption ? ': ' + firstCaption : ''}`,
      'photo',
      `/galleria?view=${docRef.id}`,
      { photoId: docRef.id }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'photos');
  }
};

export const updatePhoto = async (photoId: string, updates: Partial<HuntingPhoto>) => {
  try {
    await updateDoc(doc(db, 'photos', photoId), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `photos/${photoId}`);
  }
};

export const deletePhoto = async (photoId: string) => {
  try {
    const photoRef = doc(db, 'photos', photoId);
    await deleteDoc(photoRef);
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
    await setDoc(doc(db, 'settings', 'global'), cleanData(updates), { merge: true });
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
        displayName: user.displayName || (isAdmin ? 'Stefano' : 'Utente'),
        role: isAdmin ? 'admin' : 'quotista', // Default to quotista, admin must approve
        isActive: isAdmin, // Stefano is active, others wait for approval
        assignedDaysOfWeek: [],
        seasonalQuota: 0
      };
      await setDoc(userDocRef, cleanData(newProfile));
      return newProfile;
    }
    
    let data = userDoc.data() as UserProfile;
    
    // Safety check: ensure Stefano is ALWAYS admin and active if he signs in
    if (data.email === 'snecaj@gmail.com') {
      let needsUpdate = false;
      const updates: any = {};
      
      if (!data.isActive) { updates.isActive = true; needsUpdate = true; }
      if (data.role !== 'admin') { updates.role = 'admin'; needsUpdate = true; }
      if (data.username !== 'snecaj@gmail.com') { updates.username = 'snecaj@gmail.com'; needsUpdate = true; }
      if (data.password !== 'admin') { updates.password = 'admin'; needsUpdate = true; }

      if (needsUpdate) {
        await updateDoc(userDocRef, cleanData(updates));
        data = { ...data, ...updates };
      }
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
    await updateDoc(doc(db, 'users', uid), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const addUserManually = async (user: Omit<UserProfile, 'uid'>) => {
  try {
    const usersRef = collection(db, 'users');
    const newDocRef = doc(usersRef); // Generate a ID first
    await setDoc(newDocRef, cleanData({
      ...user,
      uid: newDocRef.id, // Include UID in initial creation
      isActive: true
    }));
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
        displayName: 'Stefano',
        role: 'admin',
        isActive: true,
        assignedDaysOfWeek: [],
        seasonalQuota: 0
      });
    } else {
      // Ensure admin has correct credentials
      const adminDoc = adminSnap.docs[0];
      const data = adminDoc.data();
      if (data.username !== adminEmail || data.password !== 'admin' || !data.isActive || data.role !== 'admin') {
        await updateDoc(doc(db, 'users', adminDoc.id), {
          username: adminEmail,
          password: 'admin',
          isActive: true,
          role: 'admin'
        });
      }
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
    const id = `${day.date}_${day.assignedToUid}`;
    await setDoc(doc(db, 'hunting_days', id), cleanData({ ...day, id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `hunting_days/${day.date}`);
  }
};

export const unassignHuntingDay = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'hunting_days', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hunting_days/${id}`);
  }
};

// Transactions
export const subscribeToTransactions = (callback: (txs: Transaction[]) => void) => {
  const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
};

export const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'transactions'), cleanData(tx));

    // Notify admins
    const amount = tx.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    const userName = tx.payerName || "Un utente";

    await notifyAdminsAndSubscribers(
      "Nuovo Versamento",
      `${userName} ha effettuato un versamento di ${amount}`,
      'transaction',
      '/spese',
      { transactionId: docRef.id }
    );
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
    await addDoc(collection(db, 'budget_items'), cleanData(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'budget_items');
  }
};

export const updateBudgetItem = async (itemId: string, updates: Partial<BudgetItem>) => {
  try {
    await updateDoc(doc(db, 'budget_items', itemId), cleanData(updates));
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

const notifyAdminsAndSubscribers = async (title: string, body: string, type: Notification['type'], link?: string, metadata?: any) => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const recipients = usersSnap.docs
      .map(doc => doc.data() as UserProfile)
      .filter(u => (u.role === 'admin' || u.role === 'socio') && u.isActive);

    const promises = recipients.map(async (u) => {
      // Don't notify the person who triggered it if metadata exists and has current user info? 
      // Actually simplified logic: notify all relevant roles.
      await addDoc(collection(db, 'notifications'), {
        title,
        body,
        type,
        targetUid: u.uid,
        read: false,
        createdAt: new Date().toISOString(),
        link,
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
    const docRef = await addDoc(collection(db, 'harvests'), cleanData(harvest));
    
    // Notify admins and soci
    await notifyAdminsAndSubscribers(
      "Nuovo Abbattimento",
      `${harvest.hunterName} ha registrato ${harvest.count}x ${harvest.species}`,
      'harvest',
      `/abbattimenti?highlight=${docRef.id}`,
      { harvestId: docRef.id }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'harvests');
  }
};

export const updateHarvest = async (harvestId: string, updates: Partial<Harvest>) => {
  try {
    const docRef = doc(db, 'harvests', harvestId);
    const oldDoc = await getDoc(docRef);
    const oldData = oldDoc.data() as Harvest;
    
    await updateDoc(docRef, cleanData(updates));

    // Notify about the change
    const species = updates.species || oldData.species;
    const count = updates.count !== undefined ? updates.count : oldData.count;
    const oldCount = oldData.count;

    let message = `${oldData.hunterName} ha modificato un record: ${species}`;
    if (updates.count !== undefined && updates.count !== oldCount) {
      message = `${oldData.hunterName} ha aggiornato il numero di capi per ${species}: da ${oldCount} a ${count}`;
    }

    await notifyAdminsAndSubscribers(
      "Abbattimento Modificato",
      message,
      'harvest',
      `/abbattimenti?highlight=${harvestId}`,
      { harvestId, previousCount: oldCount, newCount: count }
    );
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

export const createNotification = async (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  try {
    await addDoc(collection(db, 'notifications'), cleanData({
      ...notif,
      read: false,
      createdAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error creating manual notification:", error);
  }
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

// Recipes
export const subscribeToRecipes = (callback: (recipes: Recipe[]) => void) => {
  const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Recipe)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'recipes'));
};

export const addRecipe = async (recipe: Omit<Recipe, 'id'>) => {
  try {
    await addDoc(collection(db, 'recipes'), cleanData(recipe));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'recipes');
  }
};

export const updateRecipe = async (id: string, updates: Partial<Recipe>) => {
  try {
    await updateDoc(doc(db, 'recipes', id), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `recipes/${id}`);
  }
};

export const deleteRecipe = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'recipes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `recipes/${id}`);
  }
};

// Hunting Limits
export const subscribeToHuntingLimits = (callback: (limits: HuntingLimit[]) => void) => {
  const q = query(collection(db, 'hunting_limits'), orderBy('species'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingLimit)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'hunting_limits'));
};

export const saveHuntingLimit = async (limit: HuntingLimit) => {
  try {
    await setDoc(doc(db, 'hunting_limits', limit.id), cleanData(limit));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `hunting_limits/${limit.id}`);
  }
};

export const deleteHuntingLimit = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'hunting_limits', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hunting_limits/${id}`);
  }
};

export const clearAllHuntingLimits = async () => {
  try {
    const q = query(collection(db, 'hunting_limits'));
    const snapshot = await getDocs(q);
    const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'hunting_limits_all');
  }
};

// Tesserino Entries Services
export const subscribeToTesserinoEntries = (callback: (entries: TesserinoEntry[]) => void) => {
  const q = query(collection(db, 'tesserino_entries'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TesserinoEntry)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'tesserino_entries'));
};

export const addTesserinoEntry = async (entry: Omit<TesserinoEntry, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'tesserino_entries'), cleanData(entry));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'tesserino_entries');
  }
};

export const deleteTesserinoEntry = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'tesserino_entries', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tesserino_entries/${id}`);
  }
};

export const updateTesserinoEntry = async (id: string, updates: Partial<TesserinoEntry>) => {
  try {
    await updateDoc(doc(db, 'tesserino_entries', id), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tesserino_entries/${id}`);
  }
};
