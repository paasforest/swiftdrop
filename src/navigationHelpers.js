import { CommonActions } from '@react-navigation/native';
import { clearAuth, getAuth } from './authStore';
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

  registerForPushNotificationsAsync({ bearerToken: getAuth()?.token }).catch(() => {});
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
