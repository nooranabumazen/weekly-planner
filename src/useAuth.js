import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { auth, db } from './firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const signup = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);

  // On sign-out, also wipe Firestore's local cache. Without this, signing in
  // to a different account in the same browser can serve cached data from the
  // previous account and trigger writes that contaminate the new account's
  // Firestore documents. After clearing, force a full reload so a fresh
  // Firestore instance initializes on next sign-in.
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign out failed:', e);
    }
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (e) {
      // Non-fatal: cache may already be cleared or the app already terminated.
      console.warn('Cache clear during logout had an issue:', e);
    }
    // Reload so a fresh Firestore instance can initialize cleanly.
    window.location.reload();
  };

  return { user, loading, login, signup, logout };
}
