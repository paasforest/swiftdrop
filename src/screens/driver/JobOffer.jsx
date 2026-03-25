import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  ToastAndroid,
  Vibration,
} from 'react-native';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { colors, spacing, radius } from '../../theme/theme';

const { width } = Dimensions.get('window');

const HEADER_BG = '#0F172A';
const EARN_ORANGE = '#EA580C';

function zoneLabel(zone) {
  if (!zone) return '';
  const z = String(zone);
  if (z === 'city') return 'City';
  if (z === 'regional') return 'Regional';
  if (z === 'intercity') return 'Intercity';
  if (z === 'long_distance') return 'Long distance';
  return z.replace(/_/g, ' ');
}

function tierLabel(tier) {
  if (!tier) return 'Standard';
  const t = String(tier);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function timerRingColor(sec) {
  if (sec >= 10) return '#22C55E';
  if (sec >= 5) return '#F97316';
  return '#EF4444';
}

function showOfferExpiredToast() {
  const msg = 'Offer expired';
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    Alert.alert(msg, 'You have been returned to the home screen.');
  }
}

function resetToDriverHome(navigation) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'DriverHome' }],
    })
  );
}

const JobOffer = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [offer, setOffer] = useState(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [offerExpiredMessage, setOfferExpiredMessage] = useState(null);

  const initialTotalSecRef = useRef(15);
  const expiredHandledRef = useRef(false);
  const offerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const headerPulse = useRef(new Animated.Value(1)).current;
  const dangerPulse = useRef(new Animated.Value(1)).current;

  offerRef.current = offer;

  const tickOfferExpiry = useCallback(() => {
    const o = offerRef.current;
    if (!o?.offer_expires_at) return 0;
    const exp = new Date(o.offer_expires_at).getTime();
    return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
  }, []);

  const runExpireFlow = useCallback(async () => {
    if (expiredHandledRef.current) return;
    expiredHandledRef.current = true;

    const oid = offerRef.current?.orderId;
    if (oid != null) {
      try {
        const auth = getAuth();
        if (auth?.token) {
          await postJson(`/api/orders/${oid}/decline`, {}, { token: auth.token });
        }
      } catch {
        /* still navigate home */
      }
    }

    showOfferExpiredToast();
    resetToDriverHome(navigation);
  }, [navigation]);

  const loadOffer = useCallback(async (cancelRef) => {
    setLoading(true);
    setLoadError(null);
    try {
      const auth = getAuth();
      if (!auth?.token) {
        setLoadError('Please sign in as a driver.');
        setOffer(null);
        offerRef.current = null;
        return;
      }
      const data = await getJson('/api/orders/pending-offer', { token: auth.token });
      if (cancelRef?.current) return;
      if (!data?.offer) {
        setOffer(null);
        offerRef.current = null;
        setRemainingSec(0);
        progressAnim.setValue(0);
        return;
      }
      offerRef.current = data.offer;
      setOffer(data.offer);
      setOfferExpiredMessage(null);
      const rem = Math.max(
        0,
        Math.ceil((new Date(data.offer.offer_expires_at).getTime() - Date.now()) / 1000)
      );
      initialTotalSecRef.current = rem > 0 ? rem : 15;
      setRemainingSec(rem);
      progressAnim.setValue(rem > 0 ? 1 : 0);
      expiredHandledRef.current = false;
      if (rem <= 0) {
        setTimeout(() => runExpireFlow(), 0);
      }
    } catch (e) {
      if (!cancelRef?.current) setLoadError(e.message || 'Could not load offer');
    } finally {
      if (!cancelRef?.current) setLoading(false);
    }
  }, [progressAnim, runExpireFlow]);

  useFocusEffect(
    useCallback(() => {
      const cancelRef = { current: false };
      loadOffer(cancelRef);
      return () => {
        cancelRef.current = true;
        expiredHandledRef.current = false;
        setOffer(null);
        offerRef.current = null;
        setRemainingSec(0);
        progressAnim.setValue(0);
        setOfferExpiredMessage(null);
      };
    }, [loadOffer, progressAnim])
  );

  // Keep the offer screen from getting stuck if the customer cancels
  // while the driver is viewing the offer.
  useEffect(() => {
    const currentOfferId = offer?.orderId;
    if (!currentOfferId) return undefined;

    const interval = setInterval(async () => {
      try {
        const auth = getAuth();
        if (!auth?.token) return;

        const data = await getJson('/api/orders/pending-offer', { token: auth.token });
        const nextOffer = data?.offer;

        if (!nextOffer || nextOffer.orderId !== currentOfferId) {
          clearInterval(interval);
          expiredHandledRef.current = true;
          setOfferExpiredMessage('This offer is no longer available');
          setTimeout(() => resetToDriverHome(navigation), 800);
        }
      } catch (e) {
        // Network error — keep showing the offer, do not dismiss
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [offer?.orderId, navigation]);

  useEffect(() => {
    if (!offer || loading) return;
    Vibration.vibrate([0, 400, 200, 400, 200, 400]);
  }, [offer?.orderId, loading]);

  useEffect(() => {
    if (!offer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(headerPulse, {
          toValue: 1.25,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(headerPulse, {
          toValue: 1,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [offer, headerPulse]);

  useEffect(() => {
    if (remainingSec > 4 || !offer) {
      dangerPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dangerPulse, {
          toValue: 1.08,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(dangerPulse, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [remainingSec, offer, dangerPulse]);

  useEffect(() => {
    if (!offer || loading) return;
    const id = setInterval(() => {
      const rem = tickOfferExpiry();
      setRemainingSec(rem);
      const total = initialTotalSecRef.current || 15;
      const ratio = total > 0 ? Math.min(1, Math.max(0, rem / total)) : 0;
      Animated.timing(progressAnim, {
        toValue: ratio,
        duration: 300,
        useNativeDriver: false,
      }).start();
      if (rem <= 0) {
        clearInterval(id);
        runExpireFlow();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [offer, loading, tickOfferExpiry, runExpireFlow, progressAnim]);

  useEffect(() => {
    if (loading) return;
    if (offer) return;
    if (loadError) return;
    const t = setTimeout(() => {
      resetToDriverHome(navigation);
    }, 2000);
    return () => clearTimeout(t);
  }, [loading, offer, loadError, navigation]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handleAccept = async () => {
    if (!offer?.orderId || accepting || declining) return;
    const auth = getAuth();
    if (!auth?.token) {
      Alert.alert('Sign in required', 'Please log in again.');
      return;
    }
    setAccepting(true);
    try {
      const updated = await postJson(`/api/orders/${offer.orderId}/accept`, {}, { token: auth.token });
      expiredHandledRef.current = true;
      navigation.replace('ActiveDelivery', {
        orderId: offer.orderId,
        pickup_address: updated?.pickup_address || offer.pickup_address,
        dropoff_address: updated?.dropoff_address || offer.dropoff_address,
        pickup_lat: updated?.pickup_lat || offer.pickup_lat,
        pickup_lng: updated?.pickup_lng || offer.pickup_lng,
        dropoff_lat: updated?.dropoff_lat || offer.dropoff_lat,
        dropoff_lng: updated?.dropoff_lng || offer.dropoff_lng,
      });
    } catch (e) {
      Alert.alert('Could not accept', e.message || 'Accept failed');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!offer?.orderId || declining || accepting) return;
    const auth = getAuth();
    if (!auth?.token) return;
    setDeclining(true);
    try {
      expiredHandledRef.current = true;
      await postJson(`/api/orders/${offer.orderId}/decline`, {}, { token: auth.token });
      resetToDriverHome(navigation);
    } catch (e) {
      Alert.alert('Decline failed', e.message || 'Try again');
    } finally {
      setDeclining(false);
    }
  };

  const specialHandlingText = useMemo(() => {
    const s = offer?.special_handling;
    if (s == null || String(s).trim() === '') return null;
    return String(s).trim();
  }, [offer]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: HEADER_BG }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingTextLight}>Loading job offer…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!offer) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.noOfferTitle}>No active offer</Text>
          <Text style={styles.noOfferSub}>Returning to home…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ringColor = timerRingColor(remainingSec);
  const tierBadge = tierLabel(offer.delivery_tier);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.flex1}>
        {offerExpiredMessage ? (
          <View style={styles.offerExpiredBanner}>
            <Text style={styles.offerExpiredBannerText}>{offerExpiredMessage}</Text>
          </View>
        ) : null}
        {/* Top — incoming-request header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: headerPulse }],
              },
            ]}
          />
          <View style={styles.iconCircle}>
            <Ionicons name="cube" size={44} color="#FFFFFF" />
          </View>
          <Text style={styles.headerTitle}>New delivery request</Text>
        </View>

        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.earnBlock}>
              <Text style={styles.earnLabel}>You earn</Text>
              <Text style={styles.earnValue}>{formatMoney(offer.driver_earns)}</Text>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{tierBadge}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.rowAddress}>
                <View style={styles.dotGreen} />
                <View style={styles.addressTextWrap}>
                  <Text style={styles.addrLabel}>From</Text>
                  <Text style={styles.addrValue}>{offer.pickup_address}</Text>
                </View>
              </View>
              <View style={styles.rowAddress}>
                <View style={styles.dotRed} />
                <View style={styles.addressTextWrap}>
                  <Text style={styles.addrLabel}>To</Text>
                  <Text style={styles.addrValue}>{offer.dropoff_address}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>Distance</Text>
                  <Text style={styles.metaChipValue}>{offer.distance_km} km</Text>
                </View>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipLabel}>Zone</Text>
                  <Text style={styles.metaChipValue}>{zoneLabel(offer.zone)}</Text>
                </View>
              </View>
              <View style={styles.parcelRow}>
                <Text style={styles.parcelLabel}>Parcel</Text>
                <Text style={styles.parcelValue}>
                  {offer.parcel_type || '—'}
                  {offer.parcel_size ? ` · ${offer.parcel_size}` : ''}
                </Text>
              </View>
            </View>

            {specialHandlingText ? (
              <View style={styles.specialBox}>
                <Text style={styles.specialTitle}>Special handling</Text>
                <Text style={styles.specialBody}>{specialHandlingText}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.countdownCaption}>Time to respond</Text>
            <Animated.View
              style={[
                styles.timerCircle,
                {
                  borderColor: ringColor,
                  transform: remainingSec <= 4 ? [{ scale: dangerPulse }] : [{ scale: 1 }],
                },
              ]}
            >
              <Text style={[styles.timerSeconds, { color: ringColor }]}>{remainingSec}</Text>
            </Animated.View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: ringColor }]} />
            </View>

            <TouchableOpacity
              style={[styles.acceptBtn, accepting && styles.btnDisabled]}
              onPress={handleAccept}
              disabled={accepting || declining}
              activeOpacity={0.9}
            >
              {accepting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptBtnText}>Accept Job</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.declineLink}
              onPress={handleDecline}
              disabled={accepting || declining}
              hitSlop={{ top: 12, bottom: 12 }}
            >
              {declining ? (
                <ActivityIndicator color={colors.textSecondary} />
              ) : (
                <Text style={styles.declineLinkText}>Decline</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: HEADER_BG,
  },
  flex1: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingTextLight: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  header: {
    minHeight: width * 0.34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 28,
    position: 'relative',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(59,130,246,0.25)',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    zIndex: 2,
  },
  headerTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    letterSpacing: -0.3,
    zIndex: 2,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    overflow: 'hidden',
  },
  scrollInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  earnBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  earnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  earnValue: {
    fontSize: 44,
    fontWeight: '900',
    color: EARN_ORANGE,
    letterSpacing: -1,
  },
  tierBadge: {
    marginTop: 10,
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4338CA',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  rowAddress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    marginTop: 5,
    marginRight: 10,
  },
  dotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginTop: 5,
    marginRight: 10,
  },
  addressTextWrap: {
    flex: 1,
  },
  addrLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 4,
  },
  addrValue: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaChip: {
    width: '48%',
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: radius.md,
  },
  metaChipLabel: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '700',
    marginBottom: 2,
  },
  metaChipValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  parcelRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  parcelLabel: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '700',
    marginBottom: 4,
  },
  parcelValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  specialBox: {
    marginTop: spacing.md,
    backgroundColor: colors.warningLight,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  specialTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.accentDark,
    marginBottom: 6,
  },
  specialBody: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  countdownCaption: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  timerSeconds: {
    fontSize: 48,
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  acceptBtn: {
    backgroundColor: '#16A34A',
    minHeight: 64,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.75,
  },
  declineLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  declineLinkText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  errorText: {
    fontSize: 16,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  noOfferTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  noOfferSub: {
    fontSize: 15,
    color: colors.textLight,
  },
  offerExpiredBanner: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  offerExpiredBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

export default JobOffer;
