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
      },
      {
        uid: 'socio-1',
        email: 'mario.rossi@example.com',
        username: 'mario.rossi',
        password: 'user1',
        displayName: 'Mario Rossi',
        role: 'socio',
        isActive: true,
        assignedDaysOfWeek: [1, 4],
        seasonalQuota: 350
      },
      {
        uid: 'socio-2',
        email: 'luigi.verdi@example.com',
        username: 'luigi.verdi',
        password: 'user2',
        displayName: 'Luigi Verdi',
        role: 'quotista',
        isActive: true,
        assignedDaysOfWeek: [2, 5],
        seasonalQuota: 200
      }
    ]));
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
      { id: 'b1', label: 'Affitto Terreno/Lago', amount: 3500 },
      { id: 'b2', label: 'Tasse e Concessioni Venatorie', amount: 1200 },
      { id: 'b3', label: 'Mangime e Sementi per Canneti', amount: 800 },
      { id: 'b4', label: 'Manutenzione Botti e Appostamenti', amount: 1500 },
      { id: 'b5', label: 'Spese Amministrative e Assicurazioni', amount: 500 }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_transactions')) {
    safeLocalStorage.setItem('lake_db_transactions', JSON.stringify([
      { id: 'tx-1', date: '2026-05-15', amount: 500, type: 'quota', category: 'Quota Stagionale', description: 'Acconto Quota Stagionale', payerUid: 'socio-1', payerName: 'Mario Rossi' },
      { id: 'tx-2', date: '2026-05-20', amount: 350, type: 'quota', category: 'Quota Stagionale', description: 'Saldatura Quota', payerUid: 'socio-2', payerName: 'Luigi Verdi' },
      { id: 'tx-3', date: '2026-06-01', amount: -3500, type: 'spesa', category: 'Affitto', description: 'Pagamento Affitto Annuale Lago', payerUid: 'admin-id', payerName: 'Stefano' }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_harvests')) {
    safeLocalStorage.setItem('lake_db_harvests', JSON.stringify([
      { id: 'h-1', date: '2026-01-10', hunterUid: 'socio-1', hunterName: 'Mario Rossi', species: 'Germano Reale', count: 3, notes: 'Giornata ventosa, ottima cura.' },
      { id: 'h-2', date: '2026-01-12', hunterUid: 'socio-2', hunterName: 'Luigi Verdi', species: 'Alzavola', count: 4, notes: 'Passo eccezionale all\'alba.' }
    ]));
  }
  if (!safeLocalStorage.getItem('lake_db_tesserino_entries')) {
    safeLocalStorage.setItem('lake_db_tesserino_entries', JSON.stringify([
      {
        id: 'te-1',
        date: '2026-01-10',
        hunterUid: 'socio-1',
        hunterName: 'Mario Rossi',
        species: 'Germano Reale',
        count: 3,
        notes: 'Annotato regolarmente sul tesserino regionale cartaceo.',
        createdAt: new Date().toISOString()
      }
    ]));
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
  const idx = list.findIndex(item => item.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    saveLocalCollection(col, list);
  }
};

const deleteLocalDoc = (col: string, id: string) => {
  const list = getLocalCollection(col);
  const filtered = list.filter(item => item.id !== id);
  saveLocalCollection(col, filtered);
};

const setLocalDoc = (col: string, id: string, data: any) => {
  const list = getLocalCollection(col);
  const idx = list.findIndex(item => item.id === id);
  const docData = { ...data, id };
  if (idx !== -1) {
    list[idx] = docData;
  } else {
    list.push(docData);
  }
  saveLocalCollection(col, list);
};
// --- END MOCK DATABASE FALLBACK SYSTEM ---

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
        password: isAdmin ? 'admin' : '',
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
        if (found.username !== 'snecaj@gmail.com') { found.username = 'snecaj@gmail.com'; changed = true; }
        if (found.password !== 'admin') { found.password = 'admin'; changed = true; }
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
  if (!db) {
    const list = getLocalCollection('users');
    const adminEmail = 'snecaj@gmail.com';
    const idx = list.findIndex(u => u.email === adminEmail);
    if (idx === -1) {
      list.push({
        uid: 'admin-id',
        email: adminEmail,
        username: adminEmail,
        password: 'admin',
        displayName: 'Stefano',
        role: 'admin',
        isActive: true,
        assignedDaysOfWeek: [],
        seasonalQuota: 0
      });
      saveLocalCollection('users', list);
    } else {
      const u = list[idx];
      if (u.username !== adminEmail || u.password !== 'admin' || !u.isActive || u.role !== 'admin') {
        list[idx] = { ...u, username: adminEmail, password: 'admin', isActive: true, role: 'admin' };
        saveLocalCollection('users', list);
      }
    }
    console.log("Users seeded successfully (local)");
    return;
  }
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
      const sorted = [...list].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
      callback(sorted);
    });
  }
  const q = query(collection(db, 'budget_items'), orderBy('label'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BudgetItem)));
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
  if (!db) {
    return subscribeMockCollection('notifications', (list) => {
      const filtered = list.filter(n => n.targetUid === uid);
      const sorted = [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(sorted);
    });
  }
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

