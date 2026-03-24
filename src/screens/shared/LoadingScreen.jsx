import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions, useNavigation } from '@react-navigation/native';
import ParcelLogoIcon from '../../components/auth/ParcelLogoIcon';
import { loadAuth, setAuth, clearAuth, getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { resetToRoleHome } from '../../navigationHelpers';

const BRAND_BLUE = '#1A73E8';
const MIN_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoadingScreen() {
  const navigation = useNavigation();
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const t0 = Date.now();

      const finish = async () => {
        const elapsed = Date.now() - t0;
        if (elapsed < MIN_MS) await sleep(MIN_MS - elapsed);
      };

      const stored = await loadAuth();

      if (stored?.token) {
        setAuth(stored);

        try {
          const me = await getJson('/api/auth/me', { quiet: true });
          if (cancelled) return;
          const session = getAuth();
          setAuth({
            token: session?.token ?? stored.token,
            refreshToken: session?.refreshToken ?? stored.refreshToken ?? null,
            user: me,
          });
          await finish();
          if (cancelled || doneRef.current) return;
          doneRef.current = true;
          resetToRoleHome(navigation, me);
        } catch {
          if (cancelled) return;
          clearAuth();
          await finish();
          if (cancelled || doneRef.current) return;
          doneRef.current = true;
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Welcome' }],
            })
          );
        }
        return;
      }

      const onboardingDone = await AsyncStorage.getItem('onboarding_complete');
      if (cancelled) return;
      await finish();
      if (cancelled || doneRef.current) return;
      doneRef.current = true;

      if (onboardingDone !== 'true') {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Onboarding' }],
          })
        );
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          })
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return (
    <View style={styles.root}>
      <ParcelLogoIcon size={80} color="#FFFFFF" />
      <Text style={styles.title}>SwiftDrop</Text>
      <ActivityIndicator size="small" color="#FFFFFF" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  spinner: {
    marginTop: 8,
  },
});
