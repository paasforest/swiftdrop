import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { API_BASE_URL } from '../../apiConfig';
import { getJson, postJson } from '../../apiClient';
import { colors, spacing, radius } from '../../theme/theme';
import ParcelLogoIcon from '../../components/auth/ParcelLogoIcon';

const { width, height } = Dimensions.get('window');

const RADAR_BLUE = '#1A73E8';
const POLL_MS = 3000;
const FOUND_NAV_DELAY_MS = 1500;

/** Driver has accepted or job is already in progress (poll may skip `accepted`). */
function isDriverMatchedStatus(status) {
  const s = String(status || '');
  return [
    'accepted',
    'pickup_en_route',
    'pickup_arrived',
    'collected',
    'delivery_en_route',
    'delivery_arrived',
    'delivered',
    'completed',
  ].includes(s);
}

const STATUS_MESSAGES = [
  'Finding your driver...',
  'Checking nearby drivers...',
  'Searching in your area...',
  'Still searching — please wait...',
  'Almost there...',
];

/** Secondary reassurance line under rotating title (by elapsed search time). */
function reassuranceSubtitle(elapsedSec) {
  if (elapsedSec >= 120) return 'Almost there — checking all drivers...';
  if (elapsedSec >= 90) return 'Expanding search area...';
  if (elapsedSec >= 60) return 'Searching for 1 minute...';
  if (elapsedSec >= 30) return 'Searching for 30 seconds...';
  return '';
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  return `R${x.toFixed(2)}`;
}

function tierLabel(tier) {
  if (!tier) return 'Standard';
  const s = String(tier);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Staggered infinite pulse: first cycle waits `staggerMs`, then every 1800ms. */
function startRadarRing(scale, opacity, staggerMs, isCancelled) {
  let first = true;
  const step = () => {
    if (isCancelled()) return;
    const delayMs = first ? staggerMs : 0;
    first = false;
    Animated.sequence([
      Animated.delay(delayMs),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.5,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.3, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ]),
    ]).start(() => step());
  };
  step();
}

const DriverMatching = ({ navigation, route }) => {
  const {
    orderId,
    pickup_address,
    pickup_lat: pickupLatParam,
    pickup_lng: pickupLngParam,
    dropoff_address,
    delivery_tier,
    total_price,
  } = route?.params || {};

  const pickupAddress = pickup_address || route?.params?.pickup || 'Pickup address';
  const dropoffAddress = dropoff_address || route?.params?.dropoff || 'Delivery address';
  const deliveryTier = delivery_tier || route?.params?.deliveryTier;
  const totalPrice = total_price ?? route?.params?.totalPrice;

  const pickupLat = Number(pickupLatParam);
  const pickupLng = Number(pickupLngParam);
  const hasPickupCoord = Number.isFinite(pickupLat) && Number.isFinite(pickupLng);

  const [noDriverFound, setNoDriverFound] = useState(false);
  const [driverFound, setDriverFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const cancelledRef = useRef(false);
  const timeoutRef = useRef(null);

  const scale0 = useRef(new Animated.Value(0.3)).current;
  const opacity0 = useRef(new Animated.Value(0.6)).current;
  const scale1 = useRef(new Animated.Value(0.3)).current;
  const opacity1 = useRef(new Animated.Value(0.6)).current;
  const scale2 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.6)).current;

  const dot0 = useRef(new Animated.Value(0.35)).current;
  const dot1 = useRef(new Animated.Value(0.35)).current;
  const dot2 = useRef(new Animated.Value(0.35)).current;

  const messageOpacity = useRef(new Animated.Value(1)).current;
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const stopAnimations = useCallback(() => {
    cancelledRef.current = true;
    scale0.stopAnimation();
    scale1.stopAnimation();
    scale2.stopAnimation();
    opacity0.stopAnimation();
    opacity1.stopAnimation();
    opacity2.stopAnimation();
    dot0.stopAnimation();
    dot1.stopAnimation();
    dot2.stopAnimation();
  }, [scale0, scale1, scale2, opacity0, opacity1, opacity2, dot0, dot1, dot2]);

  const startAnimations = useCallback(() => {
    cancelledRef.current = false;
    scale0.setValue(0.3);
    opacity0.setValue(0.6);
    scale1.setValue(0.3);
    opacity1.setValue(0.6);
    scale2.setValue(0.3);
    opacity2.setValue(0.6);

    const isCancelled = () => cancelledRef.current;
    startRadarRing(scale0, opacity0, 0, isCancelled);
    startRadarRing(scale1, opacity1, 600, isCancelled);
    startRadarRing(scale2, opacity2, 1200, isCancelled);

    const typingLoop = () => {
      if (isCancelled()) return;
      Animated.sequence([
        Animated.timing(dot0, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dot0, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 0.35, duration: 280, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 0.35, duration: 280, useNativeDriver: true }),
      ]).start(() => typingLoop());
    };
    typingLoop();
  }, [scale0, scale1, scale2, opacity0, opacity1, opacity2, dot0, dot1, dot2]);

  const isSearching = !noDriverFound && !driverFound;
  const reassuranceText = reassuranceSubtitle(elapsedSec);

  useEffect(() => {
    if (!isSearching) {
      stopAnimations();
      return undefined;
    }
    startAnimations();
    return () => {
      stopAnimations();
    };
  }, [isSearching, startAnimations, stopAnimations]);

  useEffect(() => {
    if (!isSearching) return undefined;
    const started = Date.now();
    setElapsedSec(0);
    const tick = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [isSearching]);

  useEffect(() => {
    if (!isSearching) return undefined;
    const id = setInterval(() => {
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length);
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);
    return () => clearInterval(id);
  }, [isSearching, messageOpacity]);

  useEffect(() => {
    if (!orderId || driverFound || noDriverFound) return undefined;
    const auth = getAuth();
    if (!auth?.token) return undefined;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        const st = data?.status;

        if (st === 'unmatched') {
          setNoDriverFound(true);
          return;
        }

        if (isDriverMatchedStatus(st)) {
          setDriverFound(true);
        }
      } catch {
        /* keep polling */
      }
    };

    tick();
    const intervalId = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [orderId, driverFound, noDriverFound]);

  useEffect(() => {
    if (!driverFound || !orderId) return undefined;
    const t = setTimeout(() => {
      navigation.replace('Tracking', { orderId });
    }, FOUND_NAV_DELAY_MS);
    return () => clearTimeout(t);
  }, [driverFound, orderId, navigation]);

  const handleCancelOrder = async () => {
    if (!orderId) {
      Alert.alert('Cannot cancel', 'No order is linked. You can go back.');
      return;
    }
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
      const refund = json?.refund;
      const refundMessage =
        refund != null ? `Refund: ${formatMoney(refund)}` : json?.message || 'Order cancelled';
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home', params: { refundMessage } }],
      });
    } catch (e) {
      Alert.alert('Cancel failed', e.message || 'Could not cancel the order.');
    } finally {
      setCancelling(false);
    }
  };

  const onCancelPress = () => {
    Alert.alert(
      'Cancel order?',
      'Are you sure? You will receive a full refund.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: handleCancelOrder,
        },
      ]
    );
  };

  const handleKeepSearching = async () => {
    if (!orderId) {
      setNoDriverFound(false);
      setDriverFound(false);
      return;
    }
    setRetrying(true);
    try {
      const auth = getAuth();
      if (!auth?.token) {
        navigation.navigate('Welcome');
        return;
      }
      await postJson(`/api/orders/${orderId}/retry-matching`, {}, { token: auth.token });
      setNoDriverFound(false);
      setDriverFound(false);
    } catch (e) {
      Alert.alert('Retry failed', e.message || 'Could not retry matching.');
    } finally {
      setRetrying(false);
    }
  };

  const handleCancelFromSadState = () => {
    Alert.alert(
      'Cancel for full refund?',
      'Are you sure? You will receive a full refund.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Cancel for full refund', style: 'destructive', onPress: handleCancelOrder },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <MapView
          style={styles.mapFill}
          provider={PROVIDER_GOOGLE}
          pointerEvents="none"
          initialRegion={{
            latitude: hasPickupCoord ? pickupLat : -33.9249,
            longitude: hasPickupCoord ? pickupLng : 18.4241,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {hasPickupCoord ? (
            <Marker
              coordinate={{
                latitude: pickupLat,
                longitude: pickupLng,
              }}
              pinColor={RADAR_BLUE}
            />
          ) : null}
        </MapView>

        <View style={styles.mapOverlay} pointerEvents="none" />

        {/* Radar + center */}
        <View style={styles.radarSection}>
          <View style={styles.radarStage}>
            {isSearching ? (
              <>
                <Animated.View
                  style={[
                    styles.radarRing,
                    { transform: [{ scale: scale0 }], opacity: opacity0 },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.radarRing,
                    { transform: [{ scale: scale1 }], opacity: opacity1 },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.radarRing,
                    { transform: [{ scale: scale2 }], opacity: opacity2 },
                  ]}
                />
              </>
            ) : null}

            <View style={styles.centerIconWrap} pointerEvents="none">
              {driverFound ? (
                <View style={styles.centerIconSuccess}>
                  <Ionicons name="checkmark" size={38} color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.centerIcon}>
                  {noDriverFound ? (
                    <Ionicons name="warning-outline" size={34} color={RADAR_BLUE} />
                  ) : (
                    <ParcelLogoIcon size={34} color={RADAR_BLUE} />
                  )}
                </View>
              )}
            </View>
          </View>

          {driverFound ? (
            <>
              <Text style={styles.mainTitle}>Driver found!</Text>
              <Text style={styles.subtitle}>Starting live tracking…</Text>
            </>
          ) : noDriverFound ? (
            <>
              <Text style={styles.mainTitle}>No drivers are available near your pickup right now.</Text>
              <Text style={styles.subtitle}>
                {"We'll keep looking and notify you as soon as one becomes available."}
              </Text>
            </>
          ) : (
            <>
              <Animated.Text style={[styles.mainTitle, { opacity: messageOpacity }]}>
                {STATUS_MESSAGES[messageIndex]}
              </Animated.Text>
              {reassuranceText ? <Text style={styles.reassuranceLine}>{reassuranceText}</Text> : null}
              <View style={styles.dotsRow}>
                <Animated.View style={[styles.loadingDot, { opacity: dot0 }]} />
                <Animated.View style={[styles.loadingDot, { opacity: dot1 }]} />
                <Animated.View style={[styles.loadingDot, { opacity: dot2 }]} />
              </View>
            </>
          )}
        </View>

        {/* Order card */}
        <View style={styles.card}>
          <View style={styles.addrRow}>
            <View style={[styles.dot, styles.dotGreen]} />
            <Text style={styles.addrText} numberOfLines={2}>
              {pickupAddress}
            </Text>
          </View>
          <View style={styles.addrRow}>
            <View style={[styles.dot, styles.dotRed]} />
            <Text style={styles.addrText} numberOfLines={2}>
              {dropoffAddress}
            </Text>
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>{tierLabel(deliveryTier)}</Text>
            </View>
            <Text style={styles.priceText}>{formatMoney(totalPrice)}</Text>
          </View>
        </View>

        {driverFound ? null : noDriverFound ? (
          <View style={styles.sadActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, retrying && styles.btnDisabled]}
              onPress={handleKeepSearching}
              disabled={retrying}
            >
              {retrying ? (
                <ActivityIndicator color={colors.textWhite} />
              ) : (
                <Text style={styles.primaryBtnText}>Keep Searching</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, cancelling && styles.btnDisabled, { marginTop: 4 }]}
              onPress={handleCancelFromSadState}
              disabled={cancelling}
            >
              <Text style={styles.secondaryBtnText}>Cancel for Full Refund</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.cancelLink}
            onPress={onCancelPress}
            disabled={cancelling}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Text style={styles.cancelLinkText}>Cancel Order</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    width,
    minHeight: height,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  radarSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: height * 0.38,
    marginTop: spacing.md,
  },
  radarStage: {
    width: 260,
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  radarRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: RADAR_BLUE,
    backgroundColor: 'transparent',
  },
  centerIconWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  centerIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: RADAR_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  centerIconSuccess: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
    marginBottom: 12,
  },
  reassuranceLine: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
    marginBottom: 8,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RADAR_BLUE,
    marginHorizontal: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
  },
  dotGreen: {
    backgroundColor: '#22C55E',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  addrText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  tierBadge: {
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: RADAR_BLUE,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  cancelLinkText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
  },
  sadActions: {
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: RADAR_BLUE,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.7,
  },
});

export default DriverMatching;
