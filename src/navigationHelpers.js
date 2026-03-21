import { CommonActions } from '@react-navigation/native';
import { clearAuth } from './authStore';
import { registerForPushNotificationsAsync } from './services/pushNotificationService';

export function resetToRoleHome(navigation, user) {
  const type = user?.user_type;
  let name = 'Home';
  if (type === 'driver') name = 'DriverHome';
  else if (type === 'admin') name = 'AdminOverview';

  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name }],
    })
  );

  registerForPushNotificationsAsync().catch(() => {});
}

export function resetToLogin(navigation) {
  clearAuth();
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    })
  );
}
