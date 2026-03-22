import { Alert } from 'react-native';
import { resetToLogin } from '../navigationHelpers';

/**
 * Clears auth (token + user) via clearAuth inside resetToLogin,
 * then resets navigation to Welcome.
 */
export function performAdminLogout(navigation) {
  resetToLogin(navigation);
}

/** Confirmation dialog, then logout (for header icon on sub-screens). */
export function confirmAdminLogout(navigation) {
  Alert.alert(
    'Log out?',
    'You will need to sign in again.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => performAdminLogout(navigation) },
    ]
  );
}

/** Overview header: Profile (placeholder) + Logout (destructive), then confirm on logout. */
export function showAdminAccountMenu(navigation) {
  Alert.alert(
    'Account',
    undefined,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Profile',
        onPress: () => {
          Alert.alert('Profile', 'Coming soon.');
        },
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => confirmAdminLogout(navigation),
      },
    ]
  );
}
