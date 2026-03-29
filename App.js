import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/services/firebaseConfig';
import { getJson } from './src/apiClient';
import { clearAuth, setAuth, useAuthStore } from './src/authStore';
import { navigationRef } from './src/navigationRef';
import RoleNavigator from './src/navigation/RoleNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import SplashScreen from './src/screens/shared/SplashScreen';
import { registerForPushNotificationsAsync } from './src/services/pushNotificationService';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const { user, setUser, clearUser } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const data = await getJson('/api/auth/me', { token });
          const nextUser = data?.user || {
            firebase_uid: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: firebaseUser.displayName,
            role: null,
            profile_complete: false,
          };
          setAuth({
            token,
            firebaseUid: firebaseUser.uid,
            role: nextUser.role ?? null,
            profileComplete: data?.profileComplete ?? nextUser.profile_complete ?? false,
            user: nextUser,
          });
          setUser(nextUser);
          registerForPushNotificationsAsync({ bearerToken: token }).catch(() => {});
        } catch {
          const fallbackUser = {
            firebase_uid: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: firebaseUser.displayName,
            role: null,
            profile_complete: false,
          };
          const fbToken = await firebaseUser.getIdToken();
          setAuth({
            token: fbToken,
            firebaseUid: firebaseUser.uid,
            role: null,
            profileComplete: false,
            user: fallbackUser,
          });
          setUser(fallbackUser);
          registerForPushNotificationsAsync({ bearerToken: fbToken }).catch(() => {});
        }
      } else {
        clearAuth();
        clearUser();
      }
      setInitializing(false);
    });

    return unsubscribe;
  }, [clearUser, setUser]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {initializing ? (
          <SplashScreen />
        ) : (
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="auto" />
            {user ? <RoleNavigator /> : <AuthNavigator />}
          </NavigationContainer>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
