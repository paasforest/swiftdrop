import { CommonActions } from '@react-navigation/native';
import { clearAuth } from './authStore';
import { registerForPushNotificationsAsync } from './services/pushNotificationService';

export function resetToRoleHome(navigation, user) {
  const type = user?.role || user?.user_type;
  let name = 'SenderHome';
  if (type === 'driver') name = 'DriverHome';

  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name }],
    })
  );

  registerForPushNotificationsAsync().catch(() => {});
}

export function resetToLogin(navigation) {
  Promise.resolve(clearAuth()).finally(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  });
}
