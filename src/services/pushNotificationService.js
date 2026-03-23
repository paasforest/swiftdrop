import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { postJson } from '../apiClient';
import { getAuth } from '../authStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Native FCM device token (Android) / APNs-compatible device token path for Expo.
 * Firebase Admin `messaging.send({ token })` requires this — not the Expo push token.
 */
export async function getFCMToken() {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    const res = await Notifications.getDevicePushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return res?.data ?? null;
  } catch (e) {
    console.warn('[FCM] getDevicePushTokenAsync error:', e?.message || e);
    return null;
  }
}

/**
 * Request permissions, obtain native push token, register with backend.
 * @returns {Promise<string|null>}
 */
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('[push] Notifications require a physical device.');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[push] Permission not granted');
    return null;
  }

  const token = await getFCMToken();
  if (!token) {
    console.warn('[push] No native device push token (FCM). Check EAS projectId / google-services.');
    return null;
  }

  const auth = getAuth();
  if (auth?.token) {
    try {
      await postJson('/api/notifications/fcm-token', { fcm_token: token }, { token: auth.token });
      console.log('[push] Registered native push token with backend');
    } catch (e) {
      console.warn('[push] Failed to register token on server:', e?.message || e);
    }
  }

  return token;
}

/**
 * Foreground: show in-app alert (listener registered from App.js) for non-job-offer types.
 */
export function alertForegroundNotification(notification) {
  const title = notification.request.content.title ?? 'SwiftDrop';
  const body = notification.request.content.body ?? '';
  Alert.alert(title, body);
}
