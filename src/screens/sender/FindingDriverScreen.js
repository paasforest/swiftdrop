import React, { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, onValue } from 'firebase/database';
import { database, auth } from '../../services/firebaseConfig';
import { deleteJson } from '../../apiClient';
import { theme } from '../../theme/theme';

const TIMEOUT_MS = 90_000;

export default function FindingDriverScreen({ route, navigation }) {
  const { booking } = route.params;
  const { bookingId, pickupAddress, dropoffAddress, trackUrl } = booking;

  const handleShareTrack = async () => {
    if (!trackUrl) {
      Alert.alert('Link not ready', 'Your tracking link will appear once the booking is created.');
      return;
    }
    try {
      await Share.share({
        message: `Track this SwiftDrop delivery (no app needed): ${trackUrl}`,
        title: 'SwiftDrop tracking',
      });
    } catch {
      /* user dismissed */
    }
  };

  // Pulse animation
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.4, duration: 900, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity]);

  // RTDB status listener
  useEffect(() => {
    if (!bookingId) return;
    const statusRef = ref(database, `bookings/${bookingId}/status`);
    const unsubscribe = onValue(statusRef, (snap) => {
      const status = snap.val();
      if (status === 'active') {
        navigation.replace('TrackDriver', { booking });
      } else if (status === 'no_drivers' || status === 'cancelled') {
        Alert.alert(
          'No drivers available',
          'No nearby drivers accepted your request. Please try again in a few minutes.',
          [{ text: 'OK', onPress: () => navigation.navigate('SenderHome') }]
        );
      }
    });
    return () => unsubscribe();
  }, [bookingId, booking, navigation]);

  // 90-second timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      Alert.alert(
        'No drivers available',
        'No drivers accepted your request in time. Please try again.',
        [{ text: 'OK', onPress: () => navigation.navigate('SenderHome') }]
      );
    }, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  const handleCancel = async () => {
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      await deleteJson(`/api/bookings/${bookingId}`, { token, quiet: true });
    } catch { /* ignore */ }
    navigation.navigate('SenderHome');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Pulsing animation */}
      <View style={styles.animWrap}>
        <Animated.View
          style={[
            styles.pulseRing,
            { transform: [{ scale }], opacity },
          ]}
        />
        <View style={styles.pulseCore}>
          <Text style={styles.pulseIcon}>→</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>Finding your driver</Text>
      <Text style={styles.sub}>Matching you with the nearest available driver</Text>

      {/* Addresses */}
      <View style={styles.addressWrap}>
        <View style={styles.addressRow}>
          <View style={styles.dotPickup} />
          <Text style={styles.addressText} numberOfLines={1}>{pickupAddress || '—'}</Text>
        </View>
        <View style={styles.addressConnector} />
        <View style={styles.addressRow}>
          <View style={styles.dotDropoff} />
          <Text style={styles.addressText} numberOfLines={1}>{dropoffAddress || '—'}</Text>
        </View>
      </View>

      {trackUrl ? (
        <TouchableOpacity style={styles.shareBtn} onPress={handleShareTrack} activeOpacity={0.85}>
          <Text style={styles.shareText}>Share live tracking link</Text>
        </TouchableOpacity>
      ) : null}

      {/* Cancel */}
      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
        <Text style={styles.cancelText}>Cancel request</Text>
      </TouchableOpacity>
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

  // Pulsing volt circle
  animWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.volt,
  },
  pulseCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.obsidian,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontSize: 13,
    color: theme.colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 44,
  },

  shareBtn: {
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: 'rgba(232,255,0,0.15)',
    borderWidth: 1,
    borderColor: theme.colors.volt,
  },
  shareText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.volt,
    textAlign: 'center',
  },

  // Addresses
  addressWrap: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    marginBottom: 60,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textOnDark,
    marginRight: 12,
    flexShrink: 0,
  },
  dotDropoff: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.volt,
    marginRight: 12,
    flexShrink: 0,
  },
  addressConnector: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginLeft: 4,
    marginVertical: 4,
  },
  addressText: {
    fontSize: 13,
    color: theme.colors.textOnDark,
    flex: 1,
  },

  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 13,
    color: theme.colors.textOnDarkMuted,
    textDecorationLine: 'underline',
  },
});
