import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, Firestore, getDocFromServer, doc } from 'firebase/firestore';

// Firebase configuration
// We prioritize VITE_ prefixed environment variables which are exposed via vite.config.ts
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

const isConfigured = !!firebaseConfig.projectId && !!firebaseConfig.appId && !!firebaseConfig.apiKey;

let db: Firestore | null = null;
let auth: Auth | null = null;

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    // Explicitly handle default vs custom database ID
    const dbId = (firebaseConfig.firestoreDatabaseId && 
                 firebaseConfig.firestoreDatabaseId !== '(default)' && 
                 firebaseConfig.firestoreDatabaseId.trim() !== '') 
      ? firebaseConfig.firestoreDatabaseId 
      : undefined;
    
    // Use initializeFirestore to enable experimentalForceLongPolling, which often helps in proxy/sandbox environments
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, dbId);
    
    auth = getAuth(app);
    console.log("Firebase initialized successfully with Long Polling enabled. Project ID:", firebaseConfig.projectId, dbId ? `and Database ID: ${dbId}` : "(default database)");
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
} else {
  console.warn("Firebase is not fully configured. Missing Project ID, App ID, or API Key.");
}

// Connection test - CRITICAL for AI Studio environment diagnostics
if (db) {
  const testConnection = async () => {
    try {
      // Attempt a server-side read to verify connection
      await getDocFromServer(doc(db!, '_internal_', 'connection_test'));
      console.log("Firestore connection verified.");
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('offline')) {
          console.error("Firestore is offline. Check network or project configuration.");
        } else if (error.message.includes('permission')) {
          console.warn("Firestore connection attempt failed with permission error (expected if test doc doesn't exist).");
        } else {
          console.error("Firestore diagnostic failed:", error.message);
        }
      }
    }
  };
  testConnection();
}

export { db, auth };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
