import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  ToastAndroid,
  StatusBar,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { BottomTabBar } from '../../components/ui';

function zoneLabel(zone) {
  if (!zone) return '';
  const z = String(zone);
  if (z === 'city') return 'City';
  if (z === 'regional') return 'Regional';
  if (z === 'intercity') return 'Intercity';
  if (z === 'long_distance') return 'Long distance';
  return z.replace(/_/g, ' ');
}

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [offer, setOffer] = useState(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const initialTotalSecRef = useRef(15);
  const expiredHandledRef = useRef(false);
  const offerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const auth = getAuth();
        if (!auth?.token) {
          setLoadError('Please sign in as a driver.');
          setOffer(null);
          return;
        }
        const data = await getJson('/api/orders/pending-offer', { token: auth.token });
        if (cancelled) return;
        if (!data?.offer) {
          setOffer(null);
          return;
        }
        offerRef.current = data.offer;
        setOffer(data.offer);
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
        if (!cancelled) setLoadError(e.message || 'Could not load offer');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [runExpireFlow]);

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
      navigation.navigate('EnRoutePickup', {
        orderId: offer.orderId,
        pickup_address: updated?.pickup_address || offer.pickup_address,
        dropoff_address: updated?.dropoff_address || offer.dropoff_address,
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

  // Dynamic timer color based on remaining seconds
  const timerColor =
    remainingSec > 10 ? '#00C853' : remainingSec > 5 ? '#FF9500' : '#FF3B30';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00C853" />
          <Text style={styles.loadingText}>Loading job offer…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <Text style={styles.noOfferTitle}>No active offer</Text>
          <Text style={styles.noOfferSub}>Returning to home…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section label */}
        <Text style={styles.offerTag}>NEW JOB OFFER</Text>

        {/* Countdown timer */}
        <View style={styles.timerBlock}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth, backgroundColor: timerColor },
              ]}
            />
          </View>
          <Text style={[styles.timerText, { color: timerColor }]}>
            {remainingSec}s remaining
          </Text>
        </View>

        {/* Earnings hero — the big number */}
        <View style={styles.earningsHero}>
          <Text style={styles.earningsLabel}>You will earn</Text>
          <Text style={styles.earningsAmount}>{formatMoney(offer.driver_earns)}</Text>
        </View>

        {/* Route card with connected dots */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotGreen} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.routeLabel}>PICKUP</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>
                {offer.pickup_address}
              </Text>
            </View>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={styles.routeDotBlack} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.routeLabel}>DROPOFF</Text>
              <Text style={styles.routeAddress} numberOfLines={2}>
                {offer.dropoff_address}
              </Text>
            </View>
          </View>
        </View>

        {/* Parcel info chips */}
        <View style={styles.chipsRow}>
          {offer.parcel_size ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>📦 {offer.parcel_size}</Text>
            </View>
          ) : null}
          {offer.parcel_type ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{offer.parcel_type}</Text>
            </View>
          ) : null}
          {offer.distance_km ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>📍 {offer.distance_km} km</Text>
            </View>
          ) : null}
          {offer.zone ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{zoneLabel(offer.zone)}</Text>
            </View>
          ) : null}
          {offer.time_estimate ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>⏱ {offer.time_estimate}</Text>
            </View>
          ) : null}
        </View>

        {/* Special handling */}
        {specialHandlingText ? (
          <View style={styles.specialBox}>
            <Text style={styles.specialTitle}>⚠️ Special handling</Text>
            <Text style={styles.specialBody}>{specialHandlingText}</Text>
          </View>
        ) : null}

        {/* Accept / Decline buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={accepting || declining}
            activeOpacity={0.8}
          >
            {declining ? (
              <ActivityIndicator color="#757575" size="small" />
            ) : (
              <Text style={styles.declineText}>Decline</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, (accepting || declining) && { opacity: 0.6 }]}
            onPress={handleAccept}
            disabled={accepting || declining}
            activeOpacity={0.8}
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>

      <BottomTabBar navigation={navigation} variant="driver" active="jobs" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#9E9E9E',
  },
  offerTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    textAlign: 'center',
    paddingTop: 20,
    paddingBottom: 12,
  },
  timerBlock: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  earningsHero: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  earningsLabel: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1.5,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  routeDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00C853',
    marginTop: 2,
    flexShrink: 0,
  },
  routeDotBlack: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#000000',
    marginTop: 2,
    flexShrink: 0,
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginLeft: 5,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    lineHeight: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  specialBox: {
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  specialTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  specialBody: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 32,
    paddingTop: 8,
  },
  declineButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#757575',
  },
  acceptButton: {
    flex: 2,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#00C853',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  noOfferTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  noOfferSub: {
    fontSize: 15,
    color: '#9E9E9E',
  },
});

export default JobOffer;
