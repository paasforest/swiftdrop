import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions, useNavigation } from '@react-navigation/native';
import AppText from '../../components/ui/AppText';
import ParcelLogoIcon from '../../components/auth/ParcelLogoIcon';
import { loadAuth, setAuth, clearAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { resetToRoleHome } from '../../navigationHelpers';
import { colors } from '../../theme/theme';

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
        try {
          const me = await getJson('/api/auth/me', { token: stored.token });
          if (cancelled) return;
          setAuth({
            token: stored.token,
            refreshToken: stored.refreshToken ?? null,
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
      <ParcelLogoIcon size={60} color={colors.primary} />
      <AppText variant="h2" color="primary" style={styles.brand}>
        SwiftDrop
      </AppText>
      <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    marginTop: 12,
    fontWeight: '800',
  },
  spinner: {
    marginTop: 16,
  },
});
