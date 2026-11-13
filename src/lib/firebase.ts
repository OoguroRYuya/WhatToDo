/**
 * Firebase Web SDK (requirement 3.5). Works in Expo Go; no native Firebase modules.
 * Config comes from EXPO_PUBLIC_FIREBASE_* in .env (see .env.example). These values identify
 * the project and are not secrets: access is enforced by Firestore security rules
 * (firestore.rules), which only let a signed-in user read and write their own documents.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(config);
  try {
    // Keeps the session across app restarts. Firebase stores its refresh token here.
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast refresh re-runs this module; auth is already initialised.
    auth = getAuth(app);
  }
  db = getFirestore(app);
}

export function firebaseAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured. Copy .env.example to .env and fill it in.');
  return auth;
}

export function firestore(): Firestore {
  if (!db) throw new Error('Firebase is not configured. Copy .env.example to .env and fill it in.');
  return db;
}

/** Firebase error codes in words a person can act on. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is not right.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/weak-password':
      return 'Choose a longer password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Signing in needs the internet the first time.';
    default:
      return 'Something went wrong. Try again.';
  }
}
