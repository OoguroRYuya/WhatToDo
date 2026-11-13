import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from '@/lib/firebase';

type AuthState = {
  user: User | null;
  /** True until Firebase has restored (or not) the saved session. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(firebaseAuth(), (u) => {
      setUser(u);
      setInitializing(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
      },
      register: async (email, password) => {
        await createUserWithEmailAndPassword(firebaseAuth(), email.trim(), password);
      },
      signOut: () => fbSignOut(firebaseAuth()),
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** For screens behind the guard, where a user always exists. */
export function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('useUid used on a screen outside the signed-in guard');
  return user.uid;
}
