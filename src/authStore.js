// In-memory auth store for the current app session.
// For production persistence, swap this for SecureStore/AsyncStorage.
let auth = null;

export function setAuth(nextAuth) {
  auth = nextAuth;
}

export function getAuth() {
  return auth;
}

export function clearAuth() {
  auth = null;
}

