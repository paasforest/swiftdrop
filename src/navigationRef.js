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
  const data = normalizePushData(raw);
  const type = data.type;
  const orderIdRaw = data.orderId;
  const orderId =
    orderIdRaw != null && orderIdRaw !== '' && !Number.isNaN(Number(orderIdRaw))
      ? Number(orderIdRaw)
      : undefined;

  if (!navigationRef.isReady()) {
    setTimeout(() => navigateFromNotificationData(raw), 500);
    return;
  }

  try {
    switch (type) {
      case 'job_offer':
      case 'return_load':
        navigationRef.navigate('JobOffer');
        break;
      case 'payment':
        navigationRef.navigate('Earnings');
        break;
      case 'order_update':
      case 'otp_pickup':
      case 'otp_delivery':
      case 'delivered':
      case 'unmatched':
        if (orderId != null) navigationRef.navigate('Tracking', { orderId });
        break;
      default:
        if (orderId != null) navigationRef.navigate('Tracking', { orderId });
        break;
    }
  } catch (e) {
    console.warn('[push] navigateFromNotificationData', e?.message || e);
  }
}
