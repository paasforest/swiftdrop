import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Normalize FCM/expo data (values are often strings). */
export function normalizePushData(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const o = { ...raw };
  for (const k of Object.keys(o)) {
    if (o[k] == null) continue;
    if (typeof o[k] !== 'string') o[k] = String(o[k]);
  }
  return o;
}

/**
 * Navigate from notification `data` payload (taps / cold start).
 * @param {Record<string, string>} raw
 */
export function navigateFromNotificationData(raw) {
  return normalizePushData(raw);
}
