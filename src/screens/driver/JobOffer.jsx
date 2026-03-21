import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  ToastAndroid,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';

const { width } = Dimensions.get('window');

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.loadingText}>Loading job offer…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
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
        <View style={styles.centered}>
          <Text style={styles.noOfferTitle}>No active offer</Text>
          <Text style={styles.noOfferSub}>Returning to home…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>New job offer</Text>

        <Text style={styles.earnsLabel}>You earn</Text>
        <Text style={styles.earnsValue}>{formatMoney(offer.driver_earns)}</Text>

        <View style={styles.timerBlock}>
          <View style={styles.timerRow}>
            <Text style={styles.timerLabel}>Time left</Text>
            <Text style={styles.timerSeconds}>{remainingSec}s</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>

        <View style={styles.rowAddress}>
          <View style={styles.dotGreen} />
          <View style={styles.addressTextWrap}>
            <Text style={styles.addrLabel}>Pickup</Text>
            <Text style={styles.addrValue}>{offer.pickup_address}</Text>
          </View>
        </View>

        <View style={styles.rowAddress}>
          <View style={styles.dotRed} />
          <View style={styles.addressTextWrap}>
            <Text style={styles.addrLabel}>Dropoff</Text>
            <Text style={styles.addrValue}>{offer.dropoff_address}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Distance</Text>
            <Text style={styles.metaValue}>{offer.distance_km} km</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Zone</Text>
            <Text style={styles.metaValue}>{zoneLabel(offer.zone)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Est. time</Text>
            <Text style={styles.metaValue}>{offer.time_estimate}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Parcel</Text>
            <Text style={styles.metaValue}>
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.acceptBtn, (accepting || declining) && styles.btnDisabled]}
            onPress={handleAccept}
            disabled={accepting || declining}
          >
            {accepting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.declineBtn, (accepting || declining) && styles.btnDisabled]}
            onPress={handleDecline}
            disabled={accepting || declining}
            activeOpacity={0.85}
          >
            {declining ? (
              <ActivityIndicator color="#1A73E8" />
            ) : (
              <Text style={styles.declineBtnText}>Decline</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
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
    color: '#5F6368',
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  earnsLabel: {
    fontSize: 14,
    color: '#5F6368',
    fontWeight: '600',
    marginTop: 8,
  },
  earnsValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#E65100',
    marginBottom: 16,
    letterSpacing: -1,
  },
  timerBlock: {
    marginBottom: 20,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timerLabel: {
    fontSize: 14,
    color: '#5F6368',
    fontWeight: '600',
  },
  timerSeconds: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A73E8',
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: '#34A853',
  },
  rowAddress: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  dotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34A853',
    marginTop: 4,
    marginRight: 10,
  },
  dotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EA4335',
    marginTop: 4,
    marginRight: 10,
  },
  addressTextWrap: {
    flex: 1,
  },
  addrLabel: {
    fontSize: 12,
    color: '#5F6368',
    fontWeight: '600',
    marginBottom: 4,
  },
  addrValue: {
    fontSize: 15,
    color: '#202124',
    lineHeight: 22,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    width: '48%',
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EAED',
  },
  metaLabel: {
    fontSize: 11,
    color: '#80868B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#202124',
  },
  specialBox: {
    backgroundColor: '#FFF8E1',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE082',
    marginBottom: 16,
  },
  specialTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E65100',
    marginBottom: 6,
  },
  specialBody: {
    fontSize: 14,
    color: '#5D4037',
    lineHeight: 20,
  },
  actions: {
    marginTop: 8,
  },
  acceptBtn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  declineBtn: {
    marginTop: 12,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A73E8',
    minHeight: 50,
    justifyContent: 'center',
  },
  declineBtnText: {
    color: '#1A73E8',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: 16,
    color: '#c5221f',
    textAlign: 'center',
    marginBottom: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryBtnText: {
    color: '#1A73E8',
    fontSize: 16,
    fontWeight: '600',
  },
  noOfferTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5F6368',
    marginBottom: 8,
  },
  noOfferSub: {
    fontSize: 15,
    color: '#80868B',
  },
});

export default JobOffer;
