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
import { UserProfile, HuntingDay, Transaction, Harvest, LakeSettings, HuntingPhoto, BudgetItem, Notification, HuntingTime, Recipe, HuntingLimit, TesserinoEntry, RegulationSummary } from './types';
import { format } from 'date-fns';
import { safeLocalStorage } from './lib/safeLocalStorage';

// --- BEGIN MOCK DATABASE FALLBACK SYSTEM ---
export const getLocalCollection = (col: string): any[] => {
  try {
    const data = safeLocalStorage.getItem(`lake_db_${col}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error reading local collection", col, e);
    return [];
  }
};

export const saveLocalCollection = (col: string, data: any[]) => {
  try {
    safeLocalStorage.setItem(`lake_db_${col}`, JSON.stringify(data));
    triggerMockSubscribers(col);
  } catch (e) {
    console.error("Error saving local collection", col, e);
  }
};

const mockSubscribers = new Map<string, Set<(data: any[]) => void>>();

export const subscribeMockCollection = (col: string, callback: (data: any[]) => void): () => void => {
  if (!mockSubscribers.has(col)) {
    mockSubscribers.set(col, new Set());
  }
  mockSubscribers.get(col)!.add(callback);
  
  // Call immediately with current data
  callback(getLocalCollection(col));
  
  return () => {
    const subs = mockSubscribers.get(col);
    if (subs) {
      subs.delete(callback);
    }
  };
};

const triggerMockSubscribers = (col: string) => {
  const subs = mockSubscribers.get(col);
  if (subs) {
    const currentData = getLocalCollection(col);
    subs.forEach(callback => callback(currentData));
  }
};

// Initial seeds for mock database
if (typeof window !== 'undefined') {
  if (!safeLocalStorage.getItem('lake_db_settings')) {
    safeLocalStorage.setItem('lake_db_settings', JSON.stringify([{
      id: 'global',
      latitude: 45.4642,
      longitude: 9.1900,
      seasonStart: '2026-09-01',
      seasonEnd: '2027-01-31'
    }]));
  }
  if (!safeLocalStorage.getItem('lake_db_users')) {
    safeLocalStorage.setItem('lake_db_users', JSON.stringify([
      {
        uid: 'admin-id',
        email: 'snecaj@gmail.com',
        username: 'snecaj@gmail.com',
        password: 'admin',
        displayName: 'Stefano',
        role: 'admin',
        isActive: true,
        assignedDaysOfWeek: [0, 3],
        seasonalQuota: 500
      }
    ]));
  } else {
    // Purge test users if present in existing storage
    try {
      const existingUsers: any[] = JSON.parse(safeLocalStorage.getItem('lake_db_users') || '[]');
      const filtered = existingUsers.filter(u => 
        u.uid !== 'socio-1' && 
        u.uid !== 'socio-2' && 
        u.username !== 'mario.rossi' && 
        u.username !== 'luigi.verdi' &&
        u.email !== 'mario.rossi@example.com' &&
        u.email !== 'luigi.verdi@example.com'
      );
      if (filtered.length !== existingUsers.length) {
        safeLocalStorage.setItem('lake_db_users', JSON.stringify(filtered));
      }
    } catch (e) {
      console.error(e);
    }
  }
  if (!safeLocalStorage.getItem('lake_db_hunting_limits')) {
    safeLocalStorage.setItem('lake_db_hunting_limits', JSON.stringify([
      { id: '1', species: 'Alzavola', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '2', species: 'Beccaccino', dailyLimit: 3, seasonalLimit: 15, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '3', species: 'Canapiglia', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '4', species: 'Codone', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '5', species: 'Fischione', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '6', species: 'Germano Reale', dailyLimit: 8, seasonalLimit: 40, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '7', species: 'Mestolone', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '8', species: 'Moretta', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '01/11/2024 - 31/01/2025' },
      { id: '9', species: 'Moriglione', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '10', species: 'Pavoncella', dailyLimit: 2, seasonalLimit: 10, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '11', species: 'Marzaiola', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '12', species: 'Folaga', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '13', species: 'Gallinella d\'acqua', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '14', species: 'Porciglione', dailyLimit: 5, seasonalLimit: 25, huntingPeriod: '15/09/2024 - 31/01/2025' },
      { id: '15', species: 'Frullino', dailyLimit: 2, seasonalLimit: 10, huntingPeriod: '15/09/2024 - 31/01/2025' }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_hunting_times')) {
    safeLocalStorage.setItem('lake_db_hunting_times', JSON.stringify([
      { id: 't1', startDate: '2026-09-01', endDate: '2026-09-15', startTime: '05:45', endTime: '19:15' },
      { id: 't2', startDate: '2026-09-16', endDate: '2026-09-30', startTime: '06:00', endTime: '18:45' },
      { id: 't3', startDate: '2026-10-01', endDate: '2026-10-15', startTime: '06:15', endTime: '18:15' },
      { id: 't4', startDate: '2026-10-16', endDate: '2026-10-31', startTime: '06:30', endTime: '17:45' },
      { id: 't5', startDate: '2026-11-01', endDate: '2026-11-15', startTime: '06:45', endTime: '17:15' },
      { id: 't6', startDate: '2026-11-16', endDate: '2026-11-30', startTime: '07:00', endTime: '17:00' },
      { id: 't7', startDate: '2026-12-01', endDate: '2026-12-15', startTime: '07:15', endTime: '16:45' },
      { id: 't8', startDate: '2026-12-16', endDate: '2026-12-31', startTime: '07:30', endTime: '16:45' },
      { id: 't9', startDate: '2027-01-01', endDate: '2027-01-15', startTime: '07:30', endTime: '17:00' },
      { id: 't10', startDate: '2027-01-16', endDate: '2027-01-31', startTime: '07:15', endTime: '17:15' }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_recipes')) {
    safeLocalStorage.setItem('lake_db_recipes', JSON.stringify([
      {
        id: 'r1',
        title: 'Germano Reale all\'Arancia',
        description: 'Un classico della cucina di cacciagione. Il sapore forte del germano si sposa deliziosamente con le note agrumate dell\'arancia.',
        ingredients: ['1 Germano Reale', '2 Arance non trattate', '50g Burro', '1 bicchiere di Vino Bianco', 'Rosmarino e Salvia', 'Sale e Pepe q.b.'],
        instructions: 'Pulire accuratamente il germano. In una casseruola, sciogliere il burro e rosolare il germano su tutti i lati con le erbe aromatiche. Sfumare con il vino bianco. Una volta evaporato, aggiungere il succo di un\'arancia, coprire e cuocere a fuoco lento per circa 1 ora e mezza. Negli ultimi 15 minuti, guarnire con fette d\'arancia e ridurre il sugo.',
        prepTime: 20,
        cookTime: 90,
        difficulty: 'Medio',
        createdAt: new Date().toISOString()
      },
      {
        id: 'r2',
        title: 'Risotto con Folaga alla Veneta',
        description: 'Piatto tradizionale ricco e saporito, tipico delle zone lagunari.',
        ingredients: ['320g Riso Vialone Nano', '1 Folaga (solo petto e cosce)', '1 Cipolla', '1 Carota', '1 costa di Sedano', '1 bicchiere di Vino Rosso', 'Brodo di carne q.b.', 'Grana Padano grattugiato'],
        instructions: 'Spellare la folaga ed eliminare tutto il grasso. Tagliare la carne a piccoli pezzi. Preparare un trito fine con cipolla, carota e sedano e rosolarlo in padella con olio d\'oliva. Aggiungere la carne e dorarla. Sfumare con vino rosso. Aggiungere brodo e cuocere lentamente per 2 ore fino a rendere la carne tenerissima. In un tegame a parte, tostare il riso, unire il ragù di folaga e portare a cottura aggiungendo brodo caldo poco alla volta. Mantecare con burro e parmigiano.',
        prepTime: 30,
        cookTime: 120,
        difficulty: 'Difficile',
        createdAt: new Date().toISOString()
      }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_budget_items')) {
    safeLocalStorage.setItem('lake_db_budget_items', JSON.stringify([
      { id: 'b1', label: 'Affitto Terreno/Lago', amount: 3500, type: 'uscita' },
      { id: 'b2', label: 'Tasse e Concessioni Venatorie', amount: 1200, type: 'uscita' },
      { id: 'b3', label: 'Mangime e Sementi per Canneti', amount: 800, type: 'uscita' },
      { id: 'b4', label: 'Manutenzione Botti e Appostamenti', amount: 1500, type: 'uscita' },
      { id: 'b5', label: 'Spese Amministrative e Assicurazioni', amount: 500, type: 'uscita' },
      { id: 'b6', label: 'Quota Stagionale', amount: 6500, type: 'entrata' },
      { id: 'b7', label: 'Quota Giornaliera', amount: 1000, type: 'entrata' },
      { id: 'b8', label: 'Contributi Straordinari Soci', amount: 500, type: 'entrata' }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_transactions')) {
    safeLocalStorage.setItem('lake_db_transactions', JSON.stringify([
      { id: 'tx-3', date: '2026-06-01', amount: -3500, type: 'spesa', category: 'Affitto', description: 'Pagamento Affitto Annuale Lago', payerUid: 'admin-id', payerName: 'Stefano' }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_harvests')) {
    safeLocalStorage.setItem('lake_db_harvests', JSON.stringify([]));
  }
  if (!safeLocalStorage.getItem('lake_db_tesserino_entries')) {
    safeLocalStorage.setItem('lake_db_tesserino_entries', JSON.stringify([]));
  }
  if (!safeLocalStorage.getItem('lake_db_regulation_summary')) {
    safeLocalStorage.setItem('lake_db_regulation_summary', JSON.stringify([{
      id: 'regulation_summary',
      rules: [
        "Rispettare le distanze di sicurezza dagli altri appostamenti foderati (minimo 150m).",
        "Vietato l'uso di richiami acustici a funzionamento elettromagnetico o digitale.",
        "Compilare sempre il tesserino venatorio subito dopo l'abbattimento del capo di selvaggina stanziale o migratoria.",
        "I fucili devono essere custoditi scarichi all'interno del fodero durante i trasferimenti a piedi."
      ],
      datesAndPeriods: [
        "Apertura generale della caccia alla terza domenica di Settembre.",
        "La caccia agli anatidi (Germano, Alzavola, fischione) chiude il 31 Gennaio.",
        "Giornate di silenzio venatorio fisse: Martedì e Venerdì."
      ],
      allowedSpecies: [
        "Germano Reale: carniere giornaliero massimo 8 capi, stagionale 40.",
        "Alzavola, Fischione, Mestolone, Canapiglia: carniere giornaliero massimo 5 capi.",
        "Beccaccino: carniere giornaliero massimo 3 capi."
      ],
      generalInfo: [
        "Ogni socio è tenuto a partecipare ad almeno 2 giornate di manutenzione dei canneti e ripristino delle botti prima dell'apertura.",
        "In caso di emergenza o infrazioni segnalare immediatamente al guardiacaccia o al Presidente."
      ],
      updatedAt: new Date().toISOString()
    }]));
  }
}

const addLocalDoc = (col: string, data: any) => {
  const list = getLocalCollection(col);
  const id = data.id || Math.random().toString(36).substring(2, 11);
  const newDoc = { ...data, id };
  list.push(newDoc);
  saveLocalCollection(col, list);
  return newDoc;
};

const updateLocalDoc = (col: string, id: string, updates: any) => {
  const list = getLocalCollection(col);
  const idx = list.findIndex(item => item.id === id || item.uid === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    saveLocalCollection(col, list);
  }
};

const deleteLocalDoc = (col: string, id: string) => {
  const list = getLocalCollection(col);
  const filtered = list.filter(item => item.id !== id && item.uid !== id);
  saveLocalCollection(col, filtered);
};

const setLocalDoc = (col: string, id: string, data: any) => {
  const list = getLocalCollection(col);
  const idx = list.findIndex(item => item.id === id || item.uid === id);
  const docData = { ...data, id, uid: data.uid || id };
  if (idx !== -1) {
    list[idx] = docData;
  } else {
    list.push(docData);
  }
  saveLocalCollection(col, list);
};
// --- END MOCK DATABASE FALLBACK SYSTEM ---

// Helper to strip undefined values from objects before Firestore operations
export const cleanData = (data: any) => {
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
  if (!db) {
    return subscribeMockCollection('hunting_times', (list) => {
      const sorted = [...list].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'hunting_times'), orderBy('startDate'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingTime)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'hunting_times'));
};

export const addHuntingTime = async (time: Omit<HuntingTime, 'id'>) => {
  if (!db) {
    addLocalDoc('hunting_times', time);
    return;
  }
  try {
    await addDoc(collection(db, 'hunting_times'), time);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'hunting_times');
  }
};

export const updateHuntingTime = async (id: string, updates: Partial<HuntingTime>) => {
  if (!db) {
    updateLocalDoc('hunting_times', id, updates);
    return;
  }
  try {
    await updateDoc(doc(db, 'hunting_times', id), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `hunting_times/${id}`);
  }
};

export const deleteHuntingTime = async (id: string) => {
  if (!db) {
    deleteLocalDoc('hunting_times', id);
    return;
  }
  try {
    await deleteDoc(doc(db, 'hunting_times', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hunting_times/${id}`);
  }
};

export const clearAllHuntingTimes = async () => {
  if (!db) {
    saveLocalCollection('hunting_times', []);
    return;
  }
  try {
    const q = query(collection(db, 'hunting_times'));
    const snapshot = await getDocs(q);
    const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(promises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'hunting_times_all');
  }
};

// Photos Gallery
export const subscribeToPhotos = (callback: (photos: HuntingPhoto[]) => void) => {
  if (!db) {
    return subscribeMockCollection('photos', (list) => {
      const sorted = [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(sorted);
    });
  }
  const q = query(collection(db, 'photos'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingPhoto)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'photos'));
};

export const addPhoto = async (album: Omit<HuntingPhoto, 'id' | 'userUid' | 'userName' | 'createdAt'>, user: UserProfile) => {
  const albumData = {
    ...album,
    userUid: user.uid,
    userName: user.displayName,
    createdAt: new Date().toISOString()
  };
  if (!db) {
    const newDoc = addLocalDoc('photos', albumData);
    const firstCaption = album.images[0]?.caption || album.albumCaption;
    await notifyAdminsAndSubscribers(
      album.images.length > 1 ? "Nuovo Album Gallery" : "Nuova Foto Gallery",
      `${user.displayName} ha caricato ${album.images.length > 1 ? `un album con ${album.images.length} foto` : 'una nuova foto'}${firstCaption ? ': ' + firstCaption : ''}`,
      'photo',
      `/galleria?view=${newDoc.id}`,
      { photoId: newDoc.id }
    );
    return;
  }
  try {
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
  if (!db) {
    updateLocalDoc('photos', photoId, updates);
    return;
  }
  try {
    await updateDoc(doc(db, 'photos', photoId), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `photos/${photoId}`);
  }
};

export const deletePhoto = async (photoId: string) => {
  if (!db) {
    deleteLocalDoc('photos', photoId);
    return;
  }
  try {
    const photoRef = doc(db, 'photos', photoId);
    await deleteDoc(photoRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `photos/${photoId}`);
  }
};
// Global Settings
export const subscribeToSettings = (callback: (settings: LakeSettings) => void) => {
  if (!db) {
    const list = getLocalCollection('settings');
    const defaults: LakeSettings = {
      latitude: 45.4642,
      longitude: 9.1900,
      seasonStart: format(new Date(), 'yyyy-MM-dd'),
      seasonEnd: format(new Date(), 'yyyy-MM-dd')
    };
    const found = list.find(s => s.id === 'global') || defaults;
    callback(found as LakeSettings);
    return subscribeMockCollection('settings', (newList) => {
      const updated = newList.find(s => s.id === 'global') || defaults;
      callback(updated as LakeSettings);
    });
  }
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
  if (!db) {
    setLocalDoc('settings', 'global', updates);
    return;
  }
  try {
    await setDoc(doc(db, 'settings', 'global'), cleanData(updates), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
  }
};

// Auth & User Profile
export const ensureUserProfile = async (user: any): Promise<UserProfile> => {
  if (!db) {
    const list = getLocalCollection('users');
    let found = list.find(u => u.uid === user.uid);
    const isAdmin = user.email === 'snecaj@gmail.com';
    if (!found) {
      found = {
        uid: user.uid,
        email: user.email || '',
        username: isAdmin ? 'snecaj@gmail.com' : (user.email || ''),
        password: isAdmin ? 'bledar_hila' : '',
        displayName: user.displayName || (isAdmin ? 'Stefano' : 'Utente'),
        role: isAdmin ? 'admin' : 'quotista',
        isActive: isAdmin,
        assignedDaysOfWeek: [],
        seasonalQuota: 0
      };
      list.push(found);
      saveLocalCollection('users', list);
    } else {
      if (isAdmin) {
        let changed = false;
        if (!found.isActive) { found.isActive = true; changed = true; }
        if (found.role !== 'admin') { found.role = 'admin'; changed = true; }
        if (!found.username) { found.username = 'snecaj@gmail.com'; changed = true; }
        if (!found.password) { found.password = 'bledar_hila'; changed = true; }
        if (changed) {
          saveLocalCollection('users', list);
        }
      }
    }
    return found as UserProfile;
  }
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
        password: isAdmin ? 'bledar_hila' : '',
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
      if (!data.username) { updates.username = 'snecaj@gmail.com'; needsUpdate = true; }
      if (!data.password) { updates.password = 'bledar_hila'; needsUpdate = true; }

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
  if (!db) {
    return subscribeMockCollection('users', (list) => {
      const sorted = [...list].sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'users'), orderBy('email'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
    callback(users);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
};

export const updateUserProfile = async (uid: string, updates: Partial<UserProfile>) => {
  if (!db) {
    updateLocalDoc('users', uid, updates);
    return;
  }
  try {
    await updateDoc(doc(db, 'users', uid), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
};

export const addUserManually = async (user: Omit<UserProfile, 'uid'>) => {
  if (!db) {
    const uid = Math.random().toString(36).substring(2, 11);
    addLocalDoc('users', { ...user, uid, isActive: true });
    return;
  }
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
  if (!db) {
    deleteLocalDoc('users', uid);
    return;
  }
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
};

export const seedUsers = async () => {
  const adminEmail = 'snecaj@gmail.com';
  if (!db) {
    let list = getLocalCollection('users');
    // Remove test accounts
    list = list.filter(u => 
      u.uid !== 'socio-1' && 
      u.uid !== 'socio-2' && 
      u.username !== 'mario.rossi' && 
      u.username !== 'luigi.verdi' &&
      u.email !== 'mario.rossi@example.com' &&
      u.email !== 'luigi.verdi@example.com'
    );
    const idx = list.findIndex(u => (u.email && u.email.toLowerCase() === adminEmail) || (u.username && u.username.toLowerCase() === adminEmail));
    if (idx === -1) {
      list.push({
        uid: 'admin-id',
        email: adminEmail,
        username: adminEmail,
        password: 'bledar_hila',
        displayName: 'Stefano',
        role: 'admin',
        isActive: true,
        assignedDaysOfWeek: [],
        seasonalQuota: 0
      });
    } else {
      const u = list[idx];
      let changed = false;
      if (!u.isActive) { u.isActive = true; changed = true; }
      if (u.role !== 'admin') { u.role = 'admin'; changed = true; }
      if (u.password !== 'bledar_hila') { u.password = 'bledar_hila'; changed = true; }
      if (!u.displayName) { u.displayName = 'Stefano'; changed = true; }
      if (changed) {
        list[idx] = u;
      }
    }
    saveLocalCollection('users', list);
    console.log("Users seeded successfully (local)");
    return;
  }
  try {
    const usersRef = collection(db, 'users');

    // Clean up test users from Firestore if any exist
    try {
      const testUsernames = ['mario.rossi', 'luigi.verdi'];
      for (const tUser of testUsernames) {
        const qTest = query(usersRef, where('username', '==', tUser));
        const testSnap = await getDocs(qTest);
        for (const docItem of testSnap.docs) {
          await deleteDoc(doc(db, 'users', docItem.id));
        }
      }
    } catch (cleanErr) {
      console.warn("Could not clean test users from Firestore:", cleanErr);
    }

    // Check if admin exists
    const usersSnap = await getDocs(usersRef);
    const adminDoc = usersSnap.docs.find(d => {
      const data = d.data();
      return (data.email && data.email.toLowerCase() === adminEmail) || 
             (data.username && data.username.toLowerCase() === adminEmail) ||
             d.id === 'admin-id';
    });

    if (!adminDoc) {
      const newAdminRef = doc(usersRef);
      await setDoc(newAdminRef, cleanData({
        uid: newAdminRef.id,
        email: adminEmail,
        username: adminEmail,
        password: 'bledar_hila',
        displayName: 'Stefano',
        role: 'admin',
        isActive: true,
        assignedDaysOfWeek: [],
        seasonalQuota: 0
      }));
    } else {
      // Ensure admin has correct active, role, and password status
      const data = adminDoc.data();
      let needsUpdate = false;
      const updates: any = {};
      if (!data.isActive) { updates.isActive = true; needsUpdate = true; }
      if (data.role !== 'admin') { updates.role = 'admin'; needsUpdate = true; }
      if (data.password !== 'bledar_hila') { updates.password = 'bledar_hila'; needsUpdate = true; }
      if (!data.displayName) { updates.displayName = 'Stefano'; needsUpdate = true; }
      if (needsUpdate) {
        await updateDoc(doc(db, 'users', adminDoc.id), cleanData(updates));
      }
    }

    console.log("Users seeded successfully");
  } catch (error) {
    console.error("Seeding error:", error);
  }
};

// Hunting Days
export const subscribeToHuntingDays = (callback: (days: HuntingDay[]) => void) => {
  if (!db) {
    return subscribeMockCollection('hunting_days', (list) => {
      const sorted = [...list].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'hunting_days'), orderBy('date'));
  return onSnapshot(q, (snapshot) => {
    const days = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingDay));
    callback(days);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'hunting_days'));
};

export const assignHuntingDay = async (day: HuntingDay) => {
  const id = `${day.date}_${day.assignedToUid}`;
  if (!db) {
    setLocalDoc('hunting_days', id, day);
    return;
  }
  try {
    await setDoc(doc(db, 'hunting_days', id), cleanData({ ...day, id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `hunting_days/${day.date}`);
  }
};

export const unassignHuntingDay = async (id: string) => {
  if (!db) {
    deleteLocalDoc('hunting_days', id);
    return;
  }
  try {
    await deleteDoc(doc(db, 'hunting_days', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hunting_days/${id}`);
  }
};

// Transactions
export const subscribeToTransactions = (callback: (txs: Transaction[]) => void) => {
  if (!db) {
    return subscribeMockCollection('transactions', (list) => {
      const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Transaction)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'transactions'));
};

export const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
  if (!db) {
    const newDoc = addLocalDoc('transactions', tx);
    const amount = tx.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    const userName = tx.payerName || "Un utente";
    await notifyAdminsAndSubscribers(
      "Nuovo Versamento",
      `${userName} ha effettuato un versamento di ${amount}`,
      'transaction',
      '/spese',
      { transactionId: newDoc.id }
    );
    return;
  }
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

export const deleteTransaction = async (id: string) => {
  if (!db) {
    deleteLocalDoc('transactions', id);
    return;
  }
  try {
    await deleteDoc(doc(db, 'transactions', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
  }
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
  if (!db) {
    updateLocalDoc('transactions', id, updates);
    return;
  }
  try {
    await updateDoc(doc(db, 'transactions', id), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
  }
};

// Budget Items (Preventive)
export const subscribeToBudgetItems = (callback: (items: BudgetItem[]) => void) => {
  if (!db) {
    return subscribeMockCollection('budget_items', (list) => {
      const normalized = list.map(item => ({
        ...item,
        type: item.type || 'uscita'
      }));
      const sorted = [...normalized].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'budget_items'), orderBy('label'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        type: data.type || 'uscita'
      } as BudgetItem;
    });
    callback(items);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'budget_items'));
};

export const addBudgetItem = async (item: Omit<BudgetItem, 'id'>) => {
  if (!db) {
    addLocalDoc('budget_items', item);
    return;
  }
  try {
    await addDoc(collection(db, 'budget_items'), cleanData(item));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'budget_items');
  }
};

export const updateBudgetItem = async (itemId: string, updates: Partial<BudgetItem>) => {
  if (!db) {
    updateLocalDoc('budget_items', itemId, updates);
    return;
  }
  try {
    await updateDoc(doc(db, 'budget_items', itemId), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `budget_items/${itemId}`);
  }
};

export const deleteBudgetItem = async (itemId: string) => {
  if (!db) {
    deleteLocalDoc('budget_items', itemId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'budget_items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `budget_items/${itemId}`);
  }
};

// Harvests
export const subscribeToHarvests = (callback: (harvests: Harvest[]) => void) => {
  if (!db) {
    return subscribeMockCollection('harvests', (list) => {
      const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'harvests'), orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Harvest)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'harvests'));
};

export const notifyAllUsers = async (title: string, body: string, type: Notification['type'], link?: string, metadata?: any) => {
  try {
    let recipients: UserProfile[] = [];
    if (!db) {
      const localUsers = getLocalCollection('users');
      recipients = localUsers.filter(u => u.isActive);
      const list = getLocalCollection('notifications');
      recipients.forEach(u => {
        list.push({
          id: Math.random().toString(36).substring(2, 11),
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
      saveLocalCollection('notifications', list);
      return;
    }
    const usersSnap = await getDocs(collection(db, 'users'));
    recipients = usersSnap.docs
      .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
      .filter(u => u.isActive);

    const promises = recipients.map(async (u) => {
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
    console.error("Error creating notifications for all users:", error);
  }
};

export const sendBirthdayNotifications = async (birthdayUser: UserProfile, isToday: boolean, reminderId: string) => {
  try {
    let recipients: UserProfile[] = [];
    if (!db) {
      const localUsers = getLocalCollection('users');
      recipients = localUsers.filter(u => u.isActive);
      const list = getLocalCollection('notifications');
      
      recipients.forEach(u => {
        if (!isToday && u.uid === birthdayUser.uid) {
          // Do not send tomorrow's notification to the birthday person themselves
          return;
        }

        const isSelf = u.uid === birthdayUser.uid;
        const title = isSelf ? "Buon Compleanno!" : (isToday ? "Buon Compleanno!" : "Compleanno in arrivo");
        const body = isSelf 
          ? "Tanti auguri di buon compleanno da tutto il gruppo del Lago! 🎂🎉"
          : (isToday ? `Oggi è il compleanno di ${birthdayUser.displayName}!` : `Domani è il compleanno di ${birthdayUser.displayName}!`);

        list.push({
          id: Math.random().toString(36).substring(2, 11),
          title,
          body,
          type: 'system',
          targetUid: u.uid,
          read: false,
          createdAt: new Date().toISOString(),
          link: '/',
          metadata: { birthdayReminderId: reminderId, birthdayUserUid: birthdayUser.uid, type: isToday ? 'birthday_today' : 'birthday_tomorrow' }
        });
      });
      saveLocalCollection('notifications', list);
      return;
    }

    const usersSnap = await getDocs(collection(db, 'users'));
    recipients = usersSnap.docs
      .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
      .filter(u => u.isActive);

    const promises = recipients.map(async (u) => {
      if (!isToday && u.uid === birthdayUser.uid) {
        return; // Skip tomorrow notification for the birthday person
      }

      const isSelf = u.uid === birthdayUser.uid;
      const title = isSelf ? "Buon Compleanno!" : (isToday ? "Buon Compleanno!" : "Compleanno in arrivo");
      const body = isSelf 
        ? "Tanti auguri di buon compleanno da tutto il gruppo del Lago! 🎂🎉"
        : (isToday ? `Oggi è il compleanno di ${birthdayUser.displayName}!` : `Domani è il compleanno di ${birthdayUser.displayName}!`);

      await addDoc(collection(db, 'notifications'), cleanData({
        title,
        body,
        type: 'system',
        targetUid: u.uid,
        read: false,
        createdAt: new Date().toISOString(),
        link: '/',
        metadata: { birthdayReminderId: reminderId, birthdayUserUid: birthdayUser.uid, type: isToday ? 'birthday_today' : 'birthday_tomorrow' }
      }));
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error creating birthday notifications:", error);
  }
};

export const checkAndSendBirthdayNotifications = async () => {
  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayMMDD = `${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowMonth = tomorrow.getMonth() + 1;
    const tomorrowDay = tomorrow.getDate();
    const tomorrowMMDD = `${String(tomorrowMonth).padStart(2, '0')}-${String(tomorrowDay).padStart(2, '0')}`;

    let usersList: UserProfile[] = [];
    if (!db) {
      usersList = getLocalCollection('users').filter(u => u.isActive && u.birthDate);
      const existingNotifs = getLocalCollection('notifications');
      
      for (const u of usersList) {
        if (!u.birthDate) continue;
        const bParts = u.birthDate.split('-');
        if (bParts.length < 3) continue;
        const bMMDD = `${bParts[1]}-${bParts[2]}`;

        // Check Today
        if (bMMDD === todayMMDD) {
          const reminderId = `birthday_today_${u.uid}_${todayStr}`;
          const alreadySent = existingNotifs.some(n => n.metadata?.birthdayReminderId === reminderId);
          if (!alreadySent) {
            await sendBirthdayNotifications(u, true, reminderId);
          }
        }

        // Check Tomorrow
        if (bMMDD === tomorrowMMDD) {
          const reminderId = `birthday_tomorrow_${u.uid}_${todayStr}`;
          const alreadySent = existingNotifs.some(n => n.metadata?.birthdayReminderId === reminderId);
          if (!alreadySent) {
            await sendBirthdayNotifications(u, false, reminderId);
          }
        }
      }
      return;
    }

    // Firestore mode
    const usersSnap = await getDocs(collection(db, 'users'));
    usersList = usersSnap.docs
      .map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile))
      .filter(u => u.isActive && u.birthDate);

    for (const u of usersList) {
      if (!u.birthDate) continue;
      const bParts = u.birthDate.split('-');
      if (bParts.length < 3) continue;
      const bMMDD = `${bParts[1]}-${bParts[2]}`;

      // Check Today
      if (bMMDD === todayMMDD) {
        const reminderId = `birthday_today_${u.uid}_${todayStr}`;
        const qNotifs = query(
          collection(db, 'notifications'),
          where('metadata.birthdayReminderId', '==', reminderId)
        );
        const notifSnap = await getDocs(qNotifs);
        if (notifSnap.empty) {
          await sendBirthdayNotifications(u, true, reminderId);
        }
      }

      // Check Tomorrow
      if (bMMDD === tomorrowMMDD) {
        const reminderId = `birthday_tomorrow_${u.uid}_${todayStr}`;
        const qNotifs = query(
          collection(db, 'notifications'),
          where('metadata.birthdayReminderId', '==', reminderId)
        );
        const notifSnap = await getDocs(qNotifs);
        if (notifSnap.empty) {
          await sendBirthdayNotifications(u, false, reminderId);
        }
      }
    }
  } catch (err) {
    console.error("Error in checkAndSendBirthdayNotifications:", err);
  }
};

const notifyAdminsAndSubscribers = async (title: string, body: string, type: Notification['type'], link?: string, metadata?: any) => {
  try {
    let recipients: UserProfile[] = [];
    if (!db) {
      const localUsers = getLocalCollection('users');
      recipients = localUsers.filter(u => (u.role === 'admin' || u.role === 'socio') && u.isActive);
      const list = getLocalCollection('notifications');
      recipients.forEach(u => {
        list.push({
          id: Math.random().toString(36).substring(2, 11),
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
      saveLocalCollection('notifications', list);
      return;
    }
    const usersSnap = await getDocs(collection(db, 'users'));
    recipients = usersSnap.docs
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
  if (!db) {
    const newDoc = addLocalDoc('harvests', harvest);
    await notifyAdminsAndSubscribers(
      "Nuovo Abbattimento",
      `${harvest.hunterName} ha registrato ${harvest.count}x ${harvest.species}`,
      'harvest',
      `/abbattimenti?highlight=${newDoc.id}`,
      { harvestId: newDoc.id }
    );
    return;
  }
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
  if (!db) {
    const list = getLocalCollection('harvests');
    const item = list.find(h => h.id === harvestId);
    if (item) {
      const oldData = { ...item };
      updateLocalDoc('harvests', harvestId, updates);
      
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
    }
    return;
  }
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
  if (!db) {
    deleteLocalDoc('harvests', harvestId);
    return;
  }
  try {
    await deleteDoc(doc(db, 'harvests', harvestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `harvests/${harvestId}`);
  }
};

// Notifications
export const subscribeToUserNotifications = (uid: string, callback: (notifications: Notification[]) => void) => {
  const processNotifications = (list: Notification[]) => {
    const filtered = list.filter(n => {
      if (n.targetUid !== uid) return false;
      if (n.metadata?.type === 'birthday_tomorrow' && n.metadata?.birthdayUserUid === uid) {
        return false;
      }
      return true;
    }).map(n => {
      if (n.metadata?.type === 'birthday_today' && n.metadata?.birthdayUserUid === uid) {
        return {
          ...n,
          title: "Buon Compleanno!",
          body: "Tanti auguri di buon compleanno da tutto il gruppo del Lago! 🎂🎉"
        };
      }
      return n;
    });

    const sorted = [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    callback(sorted);
  };

  if (!db) {
    return subscribeMockCollection('notifications', (list) => {
      processNotifications(list);
    });
  }
  const q = query(
    collection(db, 'notifications'), 
    where('targetUid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
    processNotifications(list);
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));
};

export const createNotification = async (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
  if (!db) {
    addLocalDoc('notifications', {
      ...notif,
      read: false,
      createdAt: new Date().toISOString()
    });
    return;
  }
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
  if (!db) {
    updateLocalDoc('notifications', id, { read: true });
    return;
  }
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
};

export const deleteNotification = async (id: string) => {
  if (!db) {
    deleteLocalDoc('notifications', id);
    return;
  }
  try {
    await deleteDoc(doc(db, 'notifications', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${id}`);
  }
};

export const markAllNotificationsAsRead = async (ids: string[]) => {
  if (!db) {
    ids.forEach(id => updateLocalDoc('notifications', id, { read: true }));
    return;
  }
  try {
    const promises = ids.map(id => updateDoc(doc(db, 'notifications', id), { read: true }));
    await Promise.all(promises);
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
};

export const deleteAllNotifications = async (ids: string[]) => {
  if (!db) {
    ids.forEach(id => deleteLocalDoc('notifications', id));
    return;
  }
  try {
    const promises = ids.map(id => deleteDoc(doc(db, 'notifications', id)));
    await Promise.all(promises);
  } catch (error) {
    console.error("Error deleting all notifications:", error);
  }
};

// Recipes
export const subscribeToRecipes = (callback: (recipes: Recipe[]) => void) => {
  if (!db) {
    return subscribeMockCollection('recipes', (list) => {
      const sorted = [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Recipe)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'recipes'));
};

export const addRecipe = async (recipe: Omit<Recipe, 'id'>) => {
  if (!db) {
    addLocalDoc('recipes', recipe);
    return;
  }
  try {
    await addDoc(collection(db, 'recipes'), cleanData(recipe));
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'recipes');
  }
};

export const updateRecipe = async (id: string, updates: Partial<Recipe>) => {
  if (!db) {
    updateLocalDoc('recipes', id, updates);
    return;
  }
  try {
    await updateDoc(doc(db, 'recipes', id), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `recipes/${id}`);
  }
};

export const deleteRecipe = async (id: string) => {
  if (!db) {
    deleteLocalDoc('recipes', id);
    return;
  }
  try {
    await deleteDoc(doc(db, 'recipes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `recipes/${id}`);
  }
};

// Hunting Limits
export const subscribeToHuntingLimits = (callback: (limits: HuntingLimit[]) => void) => {
  if (!db) {
    return subscribeMockCollection('hunting_limits', (list) => {
      const sorted = [...list].sort((a, b) => (a.species || '').localeCompare(b.species || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'hunting_limits'), orderBy('species'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as HuntingLimit)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'hunting_limits'));
};

export const saveHuntingLimit = async (limit: HuntingLimit) => {
  if (!db) {
    setLocalDoc('hunting_limits', limit.id, limit);
    return;
  }
  try {
    await setDoc(doc(db, 'hunting_limits', limit.id), cleanData(limit));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `hunting_limits/${limit.id}`);
  }
};

export const deleteHuntingLimit = async (id: string) => {
  if (!db) {
    deleteLocalDoc('hunting_limits', id);
    return;
  }
  try {
    await deleteDoc(doc(db, 'hunting_limits', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `hunting_limits/${id}`);
  }
};

export const clearAllHuntingLimits = async () => {
  if (!db) {
    saveLocalCollection('hunting_limits', []);
    return;
  }
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
  if (!db) {
    return subscribeMockCollection('tesserino_entries', (list) => {
      const sorted = [...list].sort((a, b) => {
        const dateComp = (b.date || '').localeCompare(a.date || '');
        if (dateComp !== 0) return dateComp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
      callback(sorted);
    });
  }
  const q = query(collection(db, 'tesserino_entries'), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TesserinoEntry)));
  }, (error) => handleFirestoreError(error, OperationType.LIST, 'tesserino_entries'));
};

export const addTesserinoEntry = async (entry: Omit<TesserinoEntry, 'id'>) => {
  if (!db) {
    const newDoc = addLocalDoc('tesserino_entries', entry);
    return newDoc.id;
  }
  try {
    const docRef = await addDoc(collection(db, 'tesserino_entries'), cleanData(entry));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'tesserino_entries');
  }
};

export const deleteTesserinoEntry = async (id: string) => {
  if (!db) {
    deleteLocalDoc('tesserino_entries', id);
    return;
  }
  try {
    await deleteDoc(doc(db, 'tesserino_entries', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tesserino_entries/${id}`);
  }
};

export const updateTesserinoEntry = async (id: string, updates: Partial<TesserinoEntry>) => {
  if (!db) {
    updateLocalDoc('tesserino_entries', id, updates);
    return;
  }
  try {
    await updateDoc(doc(db, 'tesserino_entries', id), cleanData(updates));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tesserino_entries/${id}`);
  }
};

// Regulation Summary Services
export const subscribeToRegulationSummary = (callback: (summary: RegulationSummary | null) => void) => {
  if (!db) {
    return subscribeMockCollection('regulation_summary', (list) => {
      const found = list.find(r => r.id === 'regulation_summary') || null;
      callback(found);
    });
  }
  const docRef = doc(db, 'settings', 'regulation_summary');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ ...docSnap.data(), id: docSnap.id } as RegulationSummary);
    } else {
      callback(null);
    }
  }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/regulation_summary'));
};

export const saveRegulationSummary = async (summary: RegulationSummary) => {
  if (!db) {
    setLocalDoc('regulation_summary', 'regulation_summary', summary);
    return;
  }
  try {
    const docRef = doc(db, 'settings', 'regulation_summary');
    await setDoc(docRef, cleanData(summary));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/regulation_summary');
  }
};

export const clearRegulationSummary = async () => {
  if (!db) {
    deleteLocalDoc('regulation_summary', 'regulation_summary');
    return;
  }
  try {
    const docRef = doc(db, 'settings', 'regulation_summary');
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'settings/regulation_summary');
  }
};

// --- DATA BACKUP & OFFLINE JSON EXPORT SERVICES ---
export interface AppBackupData {
  metadata: {
    appName: string;
    exportDate: string;
    exportTimestamp: number;
    exportedBy: string;
    source: 'firestore' | 'local_storage' | 'hybrid';
    counts: Record<string, number>;
    totalRecords: number;
  };
  data: {
    users: UserProfile[];
    settings: any[];
    hunting_days: HuntingDay[];
    hunting_times: HuntingTime[];
    hunting_limits: HuntingLimit[];
    transactions: Transaction[];
    budget_items: BudgetItem[];
    harvests: Harvest[];
    photos: HuntingPhoto[];
    recipes: Recipe[];
    tesserino_entries: TesserinoEntry[];
    notifications: Notification[];
    regulation_summary: any;
  };
}

export const fetchAllDatabaseData = async (userEmail?: string): Promise<AppBackupData> => {
  const collectionNames = [
    'users',
    'settings',
    'hunting_days',
    'hunting_times',
    'hunting_limits',
    'transactions',
    'budget_items',
    'harvests',
    'photos',
    'recipes',
    'tesserino_entries',
    'notifications'
  ];

  const resultData: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  let totalRecords = 0;
  let source: 'firestore' | 'local_storage' | 'hybrid' = db ? 'firestore' : 'local_storage';

  for (const colName of collectionNames) {
    let items: any[] = [];
    if (db) {
      try {
        const snap = await getDocs(collection(db, colName));
        items = snap.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id }));
        if (items.length === 0) {
          const localItems = getLocalCollection(colName);
          if (localItems && localItems.length > 0) {
            items = localItems;
          }
        }
      } catch (err) {
        console.warn(`Could not fetch ${colName} from Firestore, falling back to local:`, err);
        items = getLocalCollection(colName);
        source = 'hybrid';
      }
    } else {
      items = getLocalCollection(colName);
    }
    resultData[colName] = items;
    counts[colName] = items.length;
    totalRecords += items.length;
  }

  // Also include regulation summary if present
  let regulationSummary: any = null;
  if (db) {
    try {
      const regSnap = await getDoc(doc(db, 'settings', 'regulation_summary'));
      if (regSnap.exists()) {
        regulationSummary = { ...regSnap.data(), id: regSnap.id };
      }
    } catch (e) {
      console.warn("Could not fetch regulation_summary", e);
    }
  }
  if (!regulationSummary) {
    const localReg = getLocalCollection('regulation_summary');
    if (localReg && localReg.length > 0) {
      regulationSummary = localReg[0];
    }
  }

  return {
    metadata: {
      appName: 'Gestione Caccia al Lago',
      exportDate: new Date().toISOString(),
      exportTimestamp: Date.now(),
      exportedBy: userEmail || 'Stefano (Admin)',
      source,
      counts,
      totalRecords
    },
    data: {
      users: resultData['users'] || [],
      settings: resultData['settings'] || [],
      hunting_days: resultData['hunting_days'] || [],
      hunting_times: resultData['hunting_times'] || [],
      hunting_limits: resultData['hunting_limits'] || [],
      transactions: resultData['transactions'] || [],
      budget_items: resultData['budget_items'] || [],
      harvests: resultData['harvests'] || [],
      photos: resultData['photos'] || [],
      recipes: resultData['recipes'] || [],
      tesserino_entries: resultData['tesserino_entries'] || [],
      notifications: resultData['notifications'] || [],
      regulation_summary: regulationSummary
    }
  };
};

export const downloadDatabaseBackup = async (userEmail?: string): Promise<AppBackupData> => {
  const backup = await fetchAllDatabaseData(userEmail);
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const now = new Date();
  const dateStr = format(now, 'yyyy-MM-dd_HH-mm');
  const filename = `backup_caccia_lago_${dateStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return backup;
};

