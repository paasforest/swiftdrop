import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
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
 * Request permissions, obtain native push token (FCM on Android), register with backend.
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

  let token = null;

  try {
    const native = await Notifications.getDevicePushTokenAsync();
    token = native?.data ?? null;
  } catch (e) {
    console.warn('[push] getDevicePushTokenAsync failed:', e?.message || e);
  }

  if (!token) {
    try {
      const expoTok = await Notifications.getExpoPushTokenAsync();
      token = expoTok?.data ?? null;
    } catch (e) {
      console.warn('[push] getExpoPushTokenAsync failed:', e?.message || e);
    }
  }

  const auth = getAuth();
  if (token && auth?.token) {
    try {
      await postJson(
        '/api/notifications/fcm-token',
        { fcm_token: token },
        { token: auth.token }
      );
      console.log('[push] Registered FCM token with backend');
    } catch (e) {
      console.warn('[push] Failed to register token on server:', e?.message || e);
    }
  }

  return token;
}

/**
 * Foreground: show in-app alert (listener registered from App.js).
 */
export function alertForegroundNotification(notification) {
  const title = notification.request.content.title ?? 'SwiftDrop';
  const body = notification.request.content.body ?? '';
  Alert.alert(title, body);
}
