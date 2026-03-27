import AsyncStorage from '@react-native-async-storage/async-storage';

/** Persisted session blob (token + user + optional refresh). */
export const AUTH_STORAGE_KEY = 'swiftdrop_auth_token';

// In-memory auth for the current app session (hydrated from AsyncStorage on bootstrap).
let auth = null;

function shouldPersistAuth(nextAuth) {
  if (!nextAuth?.token) return false;
  return nextAuth?.user?.user_type !== 'driver';
}

export function setAuth(nextAuth) {
  auth = nextAuth;
  if (shouldPersistAuth(nextAuth)) {
    const payload = JSON.stringify({
      token: nextAuth.token,
      user: nextAuth.user,
      refreshToken: nextAuth.refreshToken ?? null,
    });
    AsyncStorage.setItem(AUTH_STORAGE_KEY, payload).catch(() => {});
  } else {
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
  }
}

export function getAuth() {
  return auth;
}

export function clearAuth() {
  auth = null;
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
