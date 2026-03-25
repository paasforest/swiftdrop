import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '../../authStore';
import { API_BASE_URL } from '../../apiConfig';
import { getJson } from '../../apiClient';

const { width } = Dimensions.get('window');

const POLL_MS = 4000;

function computeTimeTakenString(orderData) {
  try {
    const startRaw = orderData?.pickup_confirmed_at || orderData?.created_at;
    const endRaw = orderData?.delivery_confirmed_at || orderData?.updated_at;
    if (!startRaw || !endRaw) return null;
    const start = new Date(startRaw).getTime();
    const end = new Date(endRaw).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    const mins = Math.max(0, Math.round((end - start) / 60000));
    return `${mins} min`;
  } catch {
    return null;
  }
}

function deliveryConfirmedParams(data) {
  return {
    orderId: data.id,
    driverName: data.driver_name,
    driverRating: data.driver_rating,
    driverPhoto: data.driver_photo ?? null,
    driverDeliveriesCompleted: data.driver_deliveries_completed,
    deliveryPhoto: data.delivery_photo_url ?? null,
    delivery_photo_url: data.delivery_photo_url ?? null,
    fromAddress: data.pickup_address,
    toAddress: data.dropoff_address,
    totalPrice: data.total_price,
    timeTaken: computeTimeTakenString(data),
    basePrice: data.base_price,
    insuranceFee: data.insurance_fee,
    commissionAmount: data.commission_amount,
  };
}

function initialsFromName(name) {
  const s = String(name || '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function isPhotoUrl(uri) {
  if (uri == null || String(uri).trim() === '') return false;
  const u = String(uri).trim();
  return u.startsWith('http://') || u.startsWith('https://');
}

/** While matching / waiting for a driver */
function isSearchingStatus(status) {
  const s = String(status || '');
  return s === 'matching' || s === 'pending';
}

const TRACKING_NOW_STATUSES = [
  'pickup_en_route',
  'pickup_arrived',
  'collected',
  'delivery_en_route',
  'delivery_arrived',
];

const DriverMatching = ({ navigation, route }) => {
  const { orderId } = route?.params || {};

  const [phase, setPhase] = useState('searching'); // searching | unmatched | driver_found | cancelled
  const [matchStatus, setMatchStatus] = useState('searching');
  const [driverEta, setDriverEta] = useState(null);
  const [foundDriverName, setFoundDriverName] = useState(null);
  const [driverFoundPhoto, setDriverFoundPhoto] = useState(null);
  const [driverFoundRating, setDriverFoundRating] = useState(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const pollRef = useRef(null);
  const searchTimerRef = useRef(null);
  const stoppedRef = useRef(false);
  const navLockRef = useRef(false);
  const driverFoundTimerRef = useRef(null);
  const pulseScale = useRef(new Animated.Value(1)).current;

  const clearPoll = useCallback(() => {
    if (pollRef.current != null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearSearchTimer = useCallback(() => {
    if (searchTimerRef.current != null) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }, []);

  const handleDeleteAndGoHome = useCallback(async () => {
    if (!orderId) return;
    const auth = getAuth();
    if (!auth?.token) {
      navigation.navigate('Welcome');
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || 'Cancel failed');
      navigation.replace('Home');
    } catch (e) {
      setCancelling(false);
      Alert.alert('Cancel failed', e?.message || 'Could not cancel the order.');
    }
  }, [orderId, navigation]);

  const pollOnce = useCallback(async () => {
    if (stoppedRef.current || !orderId) return;
    if (navLockRef.current) return;
    const auth = getAuth();
    if (!auth?.token) return;

    try {
      const order = await getJson(`/api/orders/${orderId}`, { token: auth.token });
      const st = String(order?.status || '');

      if (isSearchingStatus(st)) {
        if (order?.matching_status === 'searching') {
          setMatchStatus('searching');
          setDriverEta(null);
          setFoundDriverName(null);
        }
        if (order?.matching_status === 'offered') {
          setMatchStatus('notified');
          setDriverEta(null);
          setFoundDriverName(null);
        }
        if (order?.matching_status === 'accepted') {
          setMatchStatus('found');
          setFoundDriverName(order?.driver_name || 'Your driver');
          setDriverEta(order?.time_estimate || null);
        }
      }

      if (st === 'cancelled') {
        navLockRef.current = true;
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        setPhase('cancelled');
        return;
      }

      if (st === 'unmatched') {
        navLockRef.current = true;
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        setPhase('unmatched');
        return;
      }

      if (st === 'delivered' || st === 'completed') {
        navLockRef.current = true;
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        navigation.replace('DeliveryConfirmed', deliveryConfirmedParams(order));
        return;
      }

      if (TRACKING_NOW_STATUSES.includes(st)) {
        navLockRef.current = true;
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        navigation.replace('Tracking', { orderId });
        return;
      }

      const showDriverFoundPanel =
        st === 'accepted' || (isSearchingStatus(st) && order?.matching_status === 'accepted');

      if (showDriverFoundPanel) {
        navLockRef.current = true;
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        if (driverFoundTimerRef.current != null) {
          clearTimeout(driverFoundTimerRef.current);
          driverFoundTimerRef.current = null;
        }
        setDriverFoundPhoto(order?.driver_photo ?? null);
        setDriverFoundRating(order?.driver_rating ?? null);
        setFoundDriverName(order?.driver_name || 'Your driver');
        setPhase('driver_found');
        driverFoundTimerRef.current = setTimeout(() => {
          driverFoundTimerRef.current = null;
          navigation.replace('Tracking', { orderId });
        }, 2000);
        return;
      }

      if (!isSearchingStatus(st)) {
        navLockRef.current = true;
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        navigation.replace('Tracking', { orderId });
      }
    } catch {
      /* keep polling */
    }
  }, [orderId, navigation, clearPoll, clearSearchTimer]);

  useEffect(() => {
    stoppedRef.current = false;
    navLockRef.current = false;
    setPhase('searching');
    if (!orderId) return undefined;

    void pollOnce();
    pollRef.current = setInterval(pollOnce, POLL_MS);

    return () => {
      stoppedRef.current = true;
      if (driverFoundTimerRef.current != null) {
        clearTimeout(driverFoundTimerRef.current);
        driverFoundTimerRef.current = null;
      }
      clearPoll();
      clearSearchTimer();
    };
  }, [orderId, pollOnce, clearPoll, clearSearchTimer]);

  useEffect(() => {
    if (phase !== 'searching') {
      clearSearchTimer();
      return undefined;
    }
    setSearchSeconds(0);
    const started = Date.now();
    searchTimerRef.current = setInterval(() => {
      setSearchSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      clearSearchTimer();
    };
  }, [phase, clearSearchTimer]);

  useEffect(() => {
    if (phase !== 'searching') {
      pulseScale.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulseScale.setValue(1);
    };
  }, [phase, pulseScale]);

  if (!orderId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No order to match.</Text>
          <TouchableOpacity onPress={() => navigation.replace('Home')}>
            <Text style={styles.link}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'cancelled') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.unmatchedWrap}>
          <Text style={styles.unmatchedEmoji}>⊘</Text>
          <Text style={styles.unmatchedHeading}>Order cancelled</Text>
          <Text style={styles.unmatchedBody}>
            This order is no longer active.
          </Text>
          <TouchableOpacity
            style={styles.unmatchedBtn}
            onPress={() => navigation.replace('Home')}
            activeOpacity={0.88}
          >
            <Text style={styles.unmatchedBtnText}>Go home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'driver_found') {
    const name = foundDriverName || 'Your driver';
    const r = Number(driverFoundRating);
    const ratingLine = Number.isFinite(r) ? `⭐ ${r.toFixed(1)}` : '⭐ —';
    const photoOk = isPhotoUrl(driverFoundPhoto);

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.driverFoundWrap}>
          <View style={styles.completeIcon}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          {photoOk ? (
            <Image source={{ uri: String(driverFoundPhoto).trim() }} style={styles.driverFoundAvatar} />
          ) : (
            <View style={styles.driverFoundAvatarPlaceholder}>
              <Text style={styles.driverFoundInitials}>{initialsFromName(name)}</Text>
            </View>
          )}
          <Text style={styles.driverFoundTitle}>{`${name} is on the way!`}</Text>
          <Text style={styles.driverFoundRating}>{ratingLine}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'unmatched') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.unmatchedWrap}>
          <Text style={styles.unmatchedEmoji}>😔</Text>
          <Text style={styles.unmatchedHeading}>No drivers available right now</Text>
          <Text style={styles.unmatchedBody}>
            {"We'll automatically retry when a driver comes online nearby. You don't need to do anything."}
          </Text>
          <Text style={styles.unmatchedNote}>Orders are retried for up to 2 hours</Text>
          <TouchableOpacity
            style={[styles.unmatchedBtn, cancelling && styles.unmatchedBtnDisabled]}
            onPress={handleDeleteAndGoHome}
            disabled={cancelling}
            activeOpacity={0.88}
          >
            {cancelling ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.unmatchedBtnText}>Cancel order</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.searchWrap}>
        <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseScale }] }]}>
          <View style={styles.pulseInner}>
            <Text style={styles.boxEmoji}>📦</Text>
          </View>
        </Animated.View>

        {matchStatus === 'searching' && (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.statusHeading}>
              Looking for a driver
            </Text>
            <Text style={styles.statusSubtext}>
              Searching near your pickup address...
            </Text>
            <Text style={styles.statusTimer}>
              Searching for {searchSeconds}s
            </Text>
          </View>
        )}

        {matchStatus === 'notified' && (
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.statusHeading}>
              Driver notified
            </Text>
            <Text style={styles.statusSubtext}>
              Waiting for a driver to accept...
            </Text>
            <Text style={styles.statusTimer}>
              Searching for {searchSeconds}s
            </Text>
          </View>
        )}

        {matchStatus === 'found' && (
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.statusHeading, { color: '#00C853' }]}>
              Driver found!
            </Text>
            <Text style={styles.statusSubtext}>
              {foundDriverName} is heading to pickup
            </Text>
            {driverEta && (
              <View style={styles.etaChip}>
                <Text style={styles.etaText}>
                  ⏱ {driverEta}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.footerSpacer} />
        <TouchableOpacity
          style={styles.cancelSearchBtn}
          onPress={handleDeleteAndGoHome}
          disabled={cancelling}
          activeOpacity={0.7}
        >
          {cancelling ? (
            <ActivityIndicator color="#FF3B30" />
          ) : (
            <Text style={styles.cancelSearchText}>Cancel order</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pulseOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pulseInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxEmoji: {
    fontSize: 32,
  },
  driverFoundWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  completeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  driverFoundAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 20,
  },
  driverFoundAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  driverFoundInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#616161',
  },
  driverFoundTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  driverFoundRating: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
  },
  statusHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusSubtext: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  statusTimer: {
    fontSize: 12,
    color: '#BDBDBD',
    textAlign: 'center',
    marginTop: 4,
  },
  etaChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: 'center',
  },
  etaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  footerSpacer: {
    flex: 1,
    minHeight: 24,
  },
  cancelSearchBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  cancelSearchText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  unmatchedWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  unmatchedEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  unmatchedHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  unmatchedBody: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
    marginTop: 12,
  },
  unmatchedNote: {
    fontSize: 12,
    color: '#BDBDBD',
    marginTop: 8,
    textAlign: 'center',
  },
  unmatchedBtn: {
    backgroundColor: '#000',
    borderRadius: 14,
    height: 52,
    width: width - 48,
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  unmatchedBtnDisabled: {
    opacity: 0.7,
  },
  unmatchedBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 16,
  },
  link: {
    fontSize: 16,
    color: '#1A73E8',
    fontWeight: '600',
  },
});

export default DriverMatching;
