import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/** Persisted session blob (token + user + optional refresh). */
export const AUTH_STORAGE_KEY = 'swiftdrop_auth_token';

// In-memory auth for the current app session (hydrated from AsyncStorage on bootstrap).
let auth = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

function shouldPersistAuth(nextAuth) {
  return Boolean(nextAuth?.token);
}

export function setAuth(nextAuth) {
  auth = nextAuth;
  if (shouldPersistAuth(nextAuth)) {
    const payload = JSON.stringify({
      token: nextAuth.token,
      user: nextAuth.user,
      role: nextAuth.role ?? nextAuth.user?.role ?? null,
      firebaseUid: nextAuth.firebaseUid ?? null,
      refreshToken: nextAuth.refreshToken ?? null,
    });
    AsyncStorage.setItem(AUTH_STORAGE_KEY, payload).catch(() => {});
  } else {
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
  }
  emit();
}

export function getAuth() {
  return auth;
}

export function clearAuth() {
  auth = null;
  emit();
  return AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
}

/**
 * Read persisted session from disk. Does not set in-memory auth.
 * @returns {Promise<{ token: string, user: object, refreshToken?: string } | null>}
 */
export async function loadAuth() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return auth;
}

export function useAuthStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    user: snapshot?.user ?? null,
    role: snapshot?.role ?? snapshot?.user?.role ?? null,
    profileComplete:
      snapshot?.profileComplete ??
      snapshot?.user?.profile_complete ??
      false,
    token: snapshot?.token ?? null,
    setUser(user) {
      const current = getSnapshot();
      setAuth({
        ...(current || {}),
        token: current?.token ?? null,
        firebaseUid: current?.firebaseUid ?? null,
        role: user?.role ?? current?.role ?? null,
        profileComplete: user?.profileComplete ?? user?.profile_complete ?? current?.profileComplete ?? false,
        user,
      });
    },
    clearUser() {
      clearAuth();
    },
    setRole(role) {
      const current = getSnapshot();
      setAuth({
        ...(current || {}),
        role,
        user: current?.user ? { ...current.user, role } : current?.user ?? null,
      });
    },
    setProfileComplete(profileComplete = true) {
      const current = getSnapshot();
      setAuth({
        ...(current || {}),
        profileComplete,
        user: current?.user ? { ...current.user, profile_complete: profileComplete } : current?.user ?? null,
      });
    },
  };
}
