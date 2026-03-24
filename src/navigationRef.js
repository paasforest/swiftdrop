import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Deepest focused route name (handles nested navigators). */
function getFocusedRouteName(state) {
  if (!state || state.index == null || !state.routes?.length) return undefined;
  const r = state.routes[state.index];
  if (r?.state) return getFocusedRouteName(r.state);
  return r?.name;
}

/**
 * Avoid stacking JobOffer again (foreground push + poll) or jumping to a new offer
 * while already in an active delivery flow for another job.
 */
function shouldSkipJobOfferNavigation(type) {
  const name = getFocusedRouteName(navigationRef.getState());
  if (name === 'JobOffer') return true;
  if (type === 'job_offer') {
    if (
      [
        'ActiveDelivery',
        'EnRoutePickup',
        'PickupConfirm',
        'EnRouteDelivery',
        'DeliveryConfirm',
      ].includes(name)
    ) {
      return true;
    }
  }
  return false;
}

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
        if (shouldSkipJobOfferNavigation(type)) {
          return;
        }
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
