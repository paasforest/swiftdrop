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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from '../../authStore';
import { API_BASE_URL } from '../../apiConfig';
import { getJson } from '../../apiClient';

const { width } = Dimensions.get('window');

const POLL_MS = 4000;

/** While matching / waiting for a driver */
function isSearchingStatus(status) {
  const s = String(status || '');
  return s === 'matching' || s === 'pending';
}

/** Order is in progress — send customer to tracking */
function isActiveDeliveryStatus(status) {
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

const DriverMatching = ({ navigation, route }) => {
  const { orderId } = route?.params || {};

  const [phase, setPhase] = useState('searching'); // 'searching' | 'unmatched'
  const [matchStatus, setMatchStatus] = useState('searching');
  const [driverEta, setDriverEta] = useState(null);
  const [foundDriverName, setFoundDriverName] = useState(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const pollRef = useRef(null);
  const searchTimerRef = useRef(null);
  const stoppedRef = useRef(false);
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
    const auth = getAuth();
    if (!auth?.token) return;

    try {
      const order = await getJson(`/api/orders/${orderId}`, { token: auth.token });
      const st = String(order?.status || '');

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

      if (st === 'unmatched') {
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        setPhase('unmatched');
        return;
      }

      if (st === 'accepted' || isActiveDeliveryStatus(st)) {
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        navigation.replace('Tracking', { orderId });
        return;
      }

      if (st === 'cancelled') {
        stoppedRef.current = true;
        clearPoll();
        clearSearchTimer();
        navigation.replace('Home');
        return;
      }

      if (!isSearchingStatus(st)) {
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
    if (!orderId) return undefined;

    void pollOnce();
    pollRef.current = setInterval(pollOnce, POLL_MS);

    return () => {
      stoppedRef.current = true;
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
