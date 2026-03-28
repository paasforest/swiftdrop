import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue } from 'firebase/database';
import { database, auth } from '../../services/firebaseConfig';
import { getJson } from '../../apiClient';
import { theme } from '../../theme/theme';

const OTP_TTL_SECONDS = 300; // 5 minutes

export default function PickupOTPScreen({ route, navigation }) {
  const { booking } = route.params;
  const bookingId = booking?.bookingId || booking?.id;

  const [otp, setOtp] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS);
  const [loadingOtp, setLoadingOtp] = useState(true);

  // Fetch OTP on mount
  useEffect(() => {
    (async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        const data = await getJson(`/api/bookings/${bookingId}/pickup-otp`, { token });
        setOtp(data?.otp ?? null);
      } catch {
        setOtp('????');
      } finally {
        setLoadingOtp(false);
      }
    })();
  }, [bookingId]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to RTDB for status → in_transit
  useEffect(() => {
    if (!bookingId) return;
    const statusRef = ref(database, `bookings/${bookingId}/status`);
    const unsub = onValue(statusRef, (snap) => {
      const status = snap.val();
      if (status === 'in_transit') {
        navigation.replace('TrackDriver', { booking: { ...booking, status: 'in_transit' } });
      }
    });
    return () => unsub();
  }, [bookingId, booking, navigation]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <SafeAreaView style={styles.safe}>
      {/* Badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>PICKUP CODE</Text>
      </View>

      <Text style={styles.title}>Read this to your driver</Text>
      <Text style={styles.subtitle}>
        Your driver has arrived. Read the 4-digit code below to confirm collection.
      </Text>

      {/* OTP box */}
      <View style={styles.otpBox}>
        {loadingOtp ? (
          <ActivityIndicator color={theme.colors.volt} />
        ) : (
          <>
            <Text style={styles.otpDigits}>
              {otp ? otp.split('').join('  ') : '– – – –'}
            </Text>
            <Text style={styles.countdown}>EXPIRES IN {mm}:{ss}</Text>
          </>
        )}
      </View>

      <Text style={styles.instruction}>
        Do not share this code until the driver is physically present at your location.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  badge: {
    backgroundColor: theme.colors.volt,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 28,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.obsidian,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 44,
  },
  otpBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.volt,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  otpDigits: {
    fontSize: 56,
    fontWeight: '700',
    color: theme.colors.volt,
    letterSpacing: 8,
    marginBottom: 16,
  },
  countdown: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: theme.colors.textOnDarkMuted,
  },
  instruction: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
