import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { ref, onValue, remove } from 'firebase/database';
import { database, auth } from '../../services/firebaseConfig';
import { useAuthStore } from '../../authStore';
import { clearAuth, postJson } from '../../apiClient';
import {
  getFreshForegroundPosition,
  syncDriverLocationToBackend,
  startDriverLocationTracking,
  stopDriverLocationTracking,
} from '../../services/locationTracking';
import { theme } from '../../theme/theme';

function firstInitial(name) {
  return (name || 'D').trim()[0].toUpperCase();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DriverDashboardScreen({ navigation }) {
  const { user } = useAuthStore();
  const displayName = user?.full_name || user?.displayName || 'Driver';
  const firebaseUid = user?.firebase_uid || auth.currentUser?.uid;

  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [jobOffer, setJobOffer] = useState(null);
  const [offerVisible, setOfferVisible] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  // Slide-up animation for job offer modal
  const slideAnim = useRef(new Animated.Value(400)).current;

  const showOffer = useCallback((offer) => {
    setJobOffer(offer);
    setOfferVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [slideAnim]);

  const hideOffer = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setOfferVisible(false);
      setJobOffer(null);
    });
  }, [slideAnim]);

  // Listen to jobOffers/{driverUid} in RTDB
  useEffect(() => {
    if (!firebaseUid || !isOnline) return;
    const offerRef = ref(database, `jobOffers/${firebaseUid}`);
    const unsub = onValue(offerRef, (snap) => {
      const offer = snap.val();
      if (offer && offer.status === 'pending') {
        showOffer(offer);
      }
    });
    return () => unsub();
  }, [firebaseUid, isOnline, showOffer]);

  // Go online / offline
  const handleToggleOnline = async (value) => {
    setTogglingOnline(true);
    try {
      if (value) {
        // Check / request location permission first
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location required',
            'SwiftDrop needs your location to show you nearby jobs. Please enable it in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }

        const pos = await getFreshForegroundPosition({ requestPermission: false });
        await syncDriverLocationToBackend({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          isOnline: true,
        });
        setIsOnline(true);
      } else {
        stopDriverLocationTracking();
        await syncDriverLocationToBackend({
          latitude: 0,
          longitude: 0,
          isOnline: false,
        }).catch(() => {});
        setIsOnline(false);
        hideOffer();
      }
    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[DriverDashboard] Toggle online failed:', msg);
      if (msg.includes('permission') || msg.includes('Location')) {
        Alert.alert(
          'Location required',
          'Enable location in Settings to go online.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Could not go online', `Error: ${msg}`);
      }
    } finally {
      setTogglingOnline(false);
    }
  };

  // Accept job offer
  const handleAccept = async () => {
    if (!jobOffer?.bookingId) return;
    setAccepting(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      await postJson(`/api/bookings/${jobOffer.bookingId}/accept`, {}, { token });

      // Start GPS tracking for this delivery
      if (firebaseUid) {
        startDriverLocationTracking(firebaseUid, String(jobOffer.bookingId)).catch(() => {});
      }

      hideOffer();
      navigation.navigate('NavigatePickup', {
        job: {
          bookingId: jobOffer.bookingId,
          pickupAddress: jobOffer.pickupAddress,
          dropoffAddress: jobOffer.dropoffAddress,
          driverPayout: jobOffer.driverPayout,
          distanceKm: jobOffer.distanceKm,
        },
      });
    } catch (err) {
      Alert.alert('Error', 'Could not accept this job. It may have been taken already.');
      hideOffer();
    } finally {
      setAccepting(false);
    }
  };

  // Decline job offer
  const handleDecline = async () => {
    if (!jobOffer?.bookingId) return;
    setDeclining(true);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      await postJson(`/api/bookings/${jobOffer.bookingId}/decline`, {}, { token });
      // Remove local offer node so listener doesn't re-fire
      if (firebaseUid) {
        remove(ref(database, `jobOffers/${firebaseUid}`)).catch(() => {});
      }
    } catch { /* non-fatal */ } finally {
      setDeclining(false);
      hideOffer();
    }
  };

  const handleSignOut = async () => {
    stopDriverLocationTracking();
    await signOut(auth);
    clearAuth();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>{greeting()},</Text>
          <Text style={styles.headerName}>{displayName.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onLongPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Text style={styles.avatarText}>{firstInitial(displayName)}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Online toggle card ── */}
      <View style={styles.toggleCard}>
        <View style={styles.toggleLeft}>
          <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <View>
            <Text style={styles.toggleLabel}>{isOnline ? 'You are online' : 'You are offline'}</Text>
            <Text style={styles.toggleSub}>
              {isOnline ? 'Accepting nearby jobs' : 'Toggle to start receiving jobs'}
            </Text>
          </View>
        </View>
        <Switch
          value={isOnline}
          onValueChange={handleToggleOnline}
          disabled={togglingOnline}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: theme.colors.volt }}
          thumbColor={isOnline ? theme.colors.obsidian : 'rgba(255,255,255,0.4)'}
          ios_backgroundColor="rgba(255,255,255,0.1)"
        />
      </View>

      {/* ── Body ── */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Earnings placeholder card */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>TODAY'S EARNINGS</Text>
          <Text style={styles.earningsAmount}>R 0.00</Text>
          <Text style={styles.earningsSub}>0 deliveries completed</Text>
        </View>

        {/* Status tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>
            {isOnline ? '✓  Listening for nearby jobs' : '  Go online to receive jobs'}
          </Text>
          <Text style={styles.tipBody}>
            {isOnline
              ? 'A job offer card will slide up automatically when a sender nearby requests a delivery.'
              : 'Toggle the switch above to go online. Make sure your location is enabled.'}
          </Text>
        </View>
      </ScrollView>

      {/* ── Job offer modal ── */}
      <Modal
        visible={offerVisible}
        transparent
        animationType="none"
        onRequestClose={handleDecline}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.offerSheet, { transform: [{ translateY: slideAnim }] }]}
          >
            {/* Drag handle */}
            <View style={styles.handle} />

            <View style={styles.offerBadge}>
              <Text style={styles.offerBadgeText}>NEW JOB OFFER</Text>
            </View>

            <Text style={styles.offerTitle}>Delivery request</Text>

            {/* Route */}
            <View style={styles.offerRoute}>
              <View style={styles.offerRouteRow}>
                <View style={styles.dotPickup} />
                <Text style={styles.offerAddress} numberOfLines={2}>
                  {jobOffer?.pickupAddress || '—'}
                </Text>
              </View>
              <View style={styles.offerConnector} />
              <View style={styles.offerRouteRow}>
                <View style={styles.dotDropoff} />
                <Text style={styles.offerAddress} numberOfLines={2}>
                  {jobOffer?.dropoffAddress || '—'}
                </Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={styles.offerStats}>
              {[
                { value: `${jobOffer?.distanceKm ?? '—'} km`, label: 'Distance' },
                { value: `${jobOffer?.estimatedMins ?? '—'} min`, label: 'Est. time' },
                { value: `R ${jobOffer?.driverPayout ?? '—'}`, label: 'Your payout' },
              ].map((s) => (
                <View key={s.label} style={styles.offerStat}>
                  <Text style={styles.offerStatValue}>{s.value}</Text>
                  <Text style={styles.offerStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.offerActions}>
              <TouchableOpacity
                style={styles.declineBtn}
                onPress={handleDecline}
                disabled={declining || accepting}
                activeOpacity={0.7}
              >
                <Text style={styles.declineBtnText}>
                  {declining ? 'Declining…' : 'Decline'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={handleAccept}
                disabled={accepting || declining}
                activeOpacity={0.85}
              >
                <Text style={styles.acceptBtnText}>
                  {accepting ? 'Accepting…' : 'Accept job'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.obsidian,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerGreeting: {
    fontSize: 13,
    color: theme.colors.textOnDarkMuted,
    fontWeight: '500',
  },
  headerName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textLight,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.signalGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },

  // Online toggle card
  toggleCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  dotOnline: {
    backgroundColor: theme.colors.signalGreen,
    shadowColor: theme.colors.signalGreen,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dotOffline: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginBottom: 2,
  },
  toggleSub: {
    fontSize: 11,
    color: theme.colors.textOnDarkMuted,
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  earningsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: 22,
    marginBottom: 16,
  },
  earningsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.textOnDarkMuted,
    marginBottom: 10,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.volt,
    letterSpacing: -1,
    marginBottom: 4,
  },
  earningsSub: {
    fontSize: 12,
    color: theme.colors.textOnDarkMuted,
  },

  tipCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderDark,
    padding: 18,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textLight,
    marginBottom: 8,
  },
  tipBody: {
    fontSize: 13,
    color: theme.colors.textOnDarkMuted,
    lineHeight: 20,
  },

  // Job offer modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  offerSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: 24,
  },
  offerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.volt,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
  },
  offerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: theme.colors.obsidian,
  },
  offerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5,
    marginBottom: 20,
  },

  // Route in offer
  offerRoute: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  offerRouteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dotPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.obsidian,
    marginTop: 3,
    flexShrink: 0,
  },
  dotDropoff: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.volt,
    borderWidth: 2,
    borderColor: theme.colors.obsidian,
    marginTop: 3,
    flexShrink: 0,
  },
  offerConnector: {
    width: 1,
    height: 14,
    backgroundColor: '#DDD',
    marginLeft: 4,
    marginVertical: 4,
  },
  offerAddress: {
    fontSize: 13,
    color: theme.colors.text,
    flex: 1,
    lineHeight: 19,
  },

  // Stats row
  offerStats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  offerStat: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  offerStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  offerStatLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  // Actions
  offerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  acceptBtn: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.volt,
    letterSpacing: 0.2,
  },
});
