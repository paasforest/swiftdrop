import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '../../components/GradientHeader';
import * as Location from 'expo-location';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson, patchJson } from '../../apiClient';
import { resetToLogin } from '../../navigationHelpers';
import { registerForPushNotificationsAsync } from '../../services/pushNotificationService';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { BottomTabBar } from '../../components/ui';
import AvatarPlaceholder from '../../components/AvatarPlaceholder';

const { width, height } = Dimensions.get('window');

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function humanStatus(status) {
  if (!status) return '';
  return String(status).replace(/_/g, ' ');
}

function tierLabel(tier) {
  if (!tier) return 'Driver';
  const t = String(tier);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const STATUS_ERR = 'Could not update status. Check connection.';

const DriverHome = ({ navigation }) => {
  const route = useRoute();
  const [isOnline, setIsOnline] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [routeMatchBanner, setRouteMatchBanner] = useState(null);
  const [todayStats, setTodayStats] = useState(null);

  const locationIntervalRef = useRef(null);
  const lastJobOfferNavigatedOrderIdRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const stopLocationUpdates = useCallback(() => {
    if (locationIntervalRef.current != null) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  const sendLocationOnce = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) return;
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    await patchJson(
      '/api/drivers/location',
      { lat: pos.coords.latitude, lng: pos.coords.longitude },
      { token: auth.token }
    );
  }, []);

  const startLocationUpdates = useCallback(async () => {
    stopLocationUpdates();
    try {
      await sendLocationOnce();
    } catch {
      /* network errors — interval will retry */
    }
    locationIntervalRef.current = setInterval(() => {
      sendLocationOnce().catch(() => {});
    }, 10000);
  }, [sendLocationOnce, stopLocationUpdates]);

  const syncOnlineStatusFromServer = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) return false;
    try {
      const data = await getJson('/api/drivers/status', { token: auth.token });
      const online = Boolean(data.is_online);
      setIsOnline(online);
      if (online) {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          await startLocationUpdates();
          return true;
        } else {
          try {
            await patchJson('/api/drivers/status', { is_online: false }, { token: auth.token });
          } catch {
            /* best-effort */
          }
          setIsOnline(false);
          stopLocationUpdates();
          return false;
        }
      } else {
        stopLocationUpdates();
        return false;
      }
    } catch {
      /* keep local toggle; dashboard error handles API down */
      return false;
    }
  }, [startLocationUpdates, stopLocationUpdates]);

  const loadDashboard = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setLoading(false);
      setDashboard(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getJson('/api/orders/driver/dashboard', { token: auth.token });
      setDashboard(data);
    } catch (e) {
      setError(e.message || 'Could not load dashboard');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRouteMatchBanner = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setRouteMatchBanner(null);
      return;
    }
    try {
      const data = await getJson('/api/orders/pending-offer', { token: auth.token });
      const o = data?.offer;
      if (o && o.dropoff_address) {
        setRouteMatchBanner({ destination: o.dropoff_address });
      } else {
        setRouteMatchBanner(null);
      }
    } catch {
      setRouteMatchBanner(null);
    }
  }, []);

  const fetchTodayStats = useCallback(async () => {
    try {
      const auth = getAuth();
      if (!auth?.token) return;
      const data = await getJson('/api/drivers/earnings/today', { token: auth.token });
      setTodayStats(data);
    } catch (err) {
      console.error('Failed to fetch today stats:', err);
    }
  }, []);

  const stayOnline = route.params?.stayOnline === true;

  /** Service area: Western Cape & Gauteng only (align with backend provinceService). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const { latitude, longitude } = loc.coords;
        // Keep aligned with swiftdrop/backend provinceService SERVICE_AREAS
        const inWC =
          latitude >= -34.95 && latitude <= -31.5 && longitude >= 17.5 && longitude <= 21.5;
        const inGP =
          latitude >= -26.75 && latitude <= -25.2 && longitude >= 27.25 && longitude <= 29.05;
        if (!inWC && !inGP) {
          navigation.replace('UnsupportedArea', { latitude, longitude });
        }
      } catch (err) {
        console.log('[Province] Could not detect location:', err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  // After a dedicated delivery, stack reset passes stayOnline — go online locally for polling.
  // Depend only on the flag, not the whole params object, so we do not fight handleGoOffline
  // or re-force "online" after setParams({ stayOnline: false }) in the same tick as patch.
  useEffect(() => {
    if (route.params?.stayOnline !== true) return;
    setIsOnline(true);
  }, [route.params?.stayOnline]);

  // Pulsing animation for stay-online waiting UI
  useEffect(() => {
    if (!stayOnline) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stayOnline, pulseAnim]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      loadRouteMatchBanner();
      fetchTodayStats();
      const auth = getAuth();
      if (auth?.token) {
        void (async () => {
          try {
            await registerForPushNotificationsAsync();
          } catch {
            console.log('[Push] Not available in Expo Go — using polling fallback');
          }
        })();
      }

      void (async () => {
        const serverIsOnline = await syncOnlineStatusFromServer();
        if (serverIsOnline && !locationIntervalRef.current) {
          await startLocationUpdates();
        }
      })();

      return () => {
        stopLocationUpdates();
      };
    }, [loadDashboard, loadRouteMatchBanner, syncOnlineStatusFromServer, fetchTodayStats, startLocationUpdates, stopLocationUpdates])
  );

  useEffect(() => {
    return () => {
      stopLocationUpdates();
    };
  }, [stopLocationUpdates]);

  /** Uber-style: while online, poll for pending offers and open JobOffer automatically. */
  useEffect(() => {
    if (!isOnline) return undefined;

    const poll = async () => {
      try {
        const state = navigation.getState();
        const current = state?.routes?.[state.index]?.name;
        if (
          [
            'JobOffer',
            'ActiveDelivery',
            'EnRoutePickup',
            'PickupConfirm',
            'EnRouteDelivery',
            'DeliveryConfirm',
          ].includes(current)
        ) {
          return;
        }

        const auth = getAuth();
        if (!auth?.token) return;
        const data = await getJson('/api/orders/pending-offer', { token: auth.token });
        if (data?.offer) {
          const oid = data.offer.orderId;
          if (lastJobOfferNavigatedOrderIdRef.current !== oid) {
            lastJobOfferNavigatedOrderIdRef.current = oid;
            navigation.navigate('JobOffer');
          }
        } else {
          lastJobOfferNavigatedOrderIdRef.current = null;
        }
      } catch {
        /* keep polling silently */
      }
    };

    poll();
    const intervalId = setInterval(poll, 5000);
    return () => clearInterval(intervalId);
  }, [isOnline, navigation]);

  const userName = dashboard?.user?.full_name || getAuth()?.user?.full_name || 'Driver';
  const rating =
    dashboard?.current_rating != null && !Number.isNaN(Number(dashboard.current_rating))
      ? Number(dashboard.current_rating).toFixed(1)
      : '—';
  const todayEarnings = dashboard?.today?.earnings ?? 0;
  const todayDeliveries = dashboard?.today?.deliveries ?? 0;
  const totalDone = dashboard?.total_deliveries_completed ?? 0;
  const recent = Array.isArray(dashboard?.recent_orders) ? dashboard.recent_orders : [];

  const clearStayOnlineParam = useCallback(() => {
    try {
      navigation.setParams({ stayOnline: false });
    } catch {
      /* ignore */
    }
  }, [navigation]);

  const handleGoOffline = async () => {
    if (statusBusy) return;
    const auth = getAuth();
    if (!auth?.token) return;

    clearStayOnlineParam();
    setStatusBusy(true);
    try {
      await patchJson('/api/drivers/status', { is_online: false }, { token: auth.token });
      stopLocationUpdates();
      setIsOnline(false);
    } catch {
      Alert.alert('', STATUS_ERR);
    } finally {
      setStatusBusy(false);
    }
  };

  const handleToggleOnline = async () => {
    if (statusBusy) return;
    const auth = getAuth();
    if (!auth?.token) {
      Alert.alert('Sign in required', 'Please log in again.');
      return;
    }

    if (isOnline) {
      setStatusBusy(true);
      try {
        clearStayOnlineParam();
        await patchJson('/api/drivers/status', { is_online: false }, { token: auth.token });
        stopLocationUpdates();
        setIsOnline(false);
      } catch {
        Alert.alert('', STATUS_ERR);
      } finally {
        setStatusBusy(false);
      }
      return;
    }

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Location permission required',
        'Location permission required to go online and receive deliveries'
      );
      return;
    }

    setStatusBusy(true);
    try {
      await patchJson('/api/drivers/status', { is_online: true }, { token: auth.token });
      setIsOnline(true);
      await startLocationUpdates();
    } catch {
      Alert.alert('', STATUS_ERR);
    } finally {
      setStatusBusy(false);
    }
  };

  if (stayOnline) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Animated.View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.successLight,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pulseAnim }],
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.success,
                }}
              />
            </Animated.View>
          </View>

          <Text style={{ fontSize: 22, fontWeight: '700', color: '#000' }}>Online</Text>
          <Text
            style={{
              fontSize: 15,
              color: '#9E9E9E',
              marginTop: 8,
              textAlign: 'center',
              paddingHorizontal: 40,
            }}
          >
            Waiting for your next delivery...
          </Text>

          <View
            style={{
              backgroundColor: '#F5F5F5',
              borderRadius: 16,
              padding: 20,
              marginTop: 32,
              width: '80%',
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#9E9E9E' }}>TODAY</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#000', marginTop: 4 }}>
                R{(todayStats?.total || 0).toFixed(2)}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#9E9E9E' }}>DELIVERIES</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#000', marginTop: 4 }}>
                {todayStats?.count || 0}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              navigation.setParams({ stayOnline: false });
              handleGoOffline();
            }}
            disabled={statusBusy}
            style={{
              position: 'absolute',
              bottom: 48,
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 30,
              borderWidth: 1.5,
              borderColor: '#E0E0E0',
            }}
          >
            {statusBusy ? (
              <ActivityIndicator color="#757575" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#757575' }}>Go offline</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <GradientHeader>
        <View style={styles.header}>
          <View style={styles.driverInfo}>
            <Text style={styles.driverNameLight}>{userName}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={18} color={colors.warning} />
              <Text style={styles.driverRatingLight}> {rating}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => resetToLogin(navigation)}
              style={styles.logoutHeaderBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              accessibilityHint="Signs out and returns to the login screen"
            >
              <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.95)" />
              <Text style={styles.logoutHeaderBtnText}>Log out</Text>
            </TouchableOpacity>
            <AvatarPlaceholder size={60} />
          </View>
        </View>
      </GradientHeader>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {stayOnline ? (
          <View style={styles.stayOnlineBanner}>
            <View style={styles.stayOnlineBannerInner}>
              <Animated.View style={[styles.stayOnlinePulseWrap, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.stayOnlinePulseDot} />
              </Animated.View>
              <View style={styles.stayOnlineBannerTextWrap}>
                <Text style={styles.stayOnlineBannerTitle}>You're still online</Text>
                <Text style={styles.stayOnlineBannerSub}>
                  Waiting for your next delivery. Scroll for stats and jobs, or go offline anytime.
                </Text>
              </View>
            </View>
            <View style={styles.stayOnlineMiniStats}>
              <View>
                <Text style={styles.stayOnlineStatLabel}>TODAY</Text>
                <Text style={styles.stayOnlineStatValue}>R{(todayStats?.total || 0).toFixed(2)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.stayOnlineStatLabel}>DELIVERIES</Text>
                <Text style={styles.stayOnlineStatValue}>{todayStats?.count || 0}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.stayOfflineBtn}
              onPress={handleGoOffline}
              disabled={statusBusy}
              activeOpacity={0.85}
            >
              {statusBusy ? (
                <ActivityIndicator color="#555" />
              ) : (
                <Text style={styles.stayOfflineBtnText}>Go offline</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.toggleSection}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handleToggleOnline}
            disabled={statusBusy}
            style={styles.toggleContainer}
          >
            <View
              style={[
                styles.toggleCircle,
                isOnline ? styles.toggleCircleOnline : styles.toggleCircleOffline,
                isOnline ? styles.toggleGlowOnline : null,
                statusBusy ? styles.toggleCircleBusy : null,
              ]}
            >
              {statusBusy ? (
                <ActivityIndicator color={isOnline ? colors.textWhite : colors.textSecondary} />
              ) : (
                <View
                  style={[
                    styles.toggleIndicator,
                    isOnline ? styles.toggleIndicatorOnline : styles.toggleIndicatorOffline,
                  ]}
                />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.motivationalText}>
            {statusBusy
              ? 'Updating your status…'
              : isOnline
                ? 'You are live — waiting for jobs'
                : 'Go online to start earning'}
          </Text>
        </View>

        <View style={styles.matchingInfoCard}>
          <Text style={styles.matchingInfoTitle}>How matching works</Text>
          <Text style={styles.matchingInfoBody}>
            Go online and keep location on. We match you to the nearest pickup in Western Cape or Gauteng.
            Posted routes are paused for launch (Phase 2).
          </Text>
        </View>

        {todayStats && (
          <View style={styles.todayEarningsCard}>
            <View>
              <Text style={styles.todayLabel}>TODAY</Text>
              <Text style={styles.todayAmount}>R{(todayStats.total || 0).toFixed(2)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.todayLabel}>DELIVERIES</Text>
              <Text style={styles.todayAmount}>{todayStats.count || 0}</Text>
            </View>
          </View>
        )}

        {!todayStats || todayStats.count === 0 ? (
          <View style={styles.motivationalCard}>
            <Text style={styles.motivationalSubtext}>Ready for your first delivery today</Text>
          </View>
        ) : null}

        {routeMatchBanner ? (
          <TouchableOpacity
            style={styles.routeMatchBanner}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('JobOffer')}
          >
            <Ionicons name="navigate-circle" size={22} color={colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.routeMatchBannerText}>
              New delivery near{' '}
              <Text style={styles.routeMatchBannerBold}>
                {routeMatchBanner.destination.length > 48
                  ? `${routeMatchBanner.destination.slice(0, 45)}…`
                  : routeMatchBanner.destination}
              </Text>
              {' — '}open job offer.
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Today (completed)</Text>
          <Text style={styles.earningsAmount}>{formatMoney(todayEarnings)}</Text>
          <Text style={styles.deliveriesCount}>{todayDeliveries} deliveries completed today</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.viewJobsButtonSolo}
            onPress={() => navigation.navigate('JobOffer')}
          >
            <Text style={styles.viewJobsText}>View available jobs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ratingCard}>
          <View style={styles.ratingHeader}>
            <Text style={styles.ratingTitle}>Your stats</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>{tierLabel(dashboard?.tier)}</Text>
            </View>
          </View>

          <View style={styles.ratingStats}>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingValue}>{rating}</Text>
              <Text style={styles.ratingLabel}>Avg rating</Text>
            </View>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingValue}>{totalDone}</Text>
              <Text style={styles.ratingLabel}>Completed</Text>
            </View>
            <View style={styles.ratingItem}>
              <Text style={styles.ratingValue}>{dashboard?.deliveries_completed ?? 0}</Text>
              <Text style={styles.ratingLabel}>Tier count</Text>
            </View>
          </View>
        </View>

        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent jobs</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
          ) : recent.length === 0 ? (
            <Text style={styles.emptyText}>
              No assigned jobs yet. Go online and check available jobs — we’ll offer nearest pickups.
            </Text>
          ) : (
            <View style={styles.activityList}>
              {recent.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={styles.activityItem}
                  activeOpacity={0.85}
                  onPress={() => {
                    const s = String(o.status || '').toLowerCase();
                    const target = s.includes('delivery') ? 'EnRouteDelivery' : 'EnRoutePickup';
                    navigation.navigate(target, { orderId: o.id });
                  }}
                >
                  <View style={styles.activityIcon}>
                    <Ionicons name="cube-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {o.order_number} · {humanStatus(o.status)}
                    </Text>
                    <Text style={styles.activitySubtitle} numberOfLines={2}>
                      {o.dropoff_address || '—'}
                    </Text>
                    <Text style={styles.activityTime}>
                      {o.updated_at ? new Date(o.updated_at).toLocaleString() : ''}
                    </Text>
                  </View>
                  <Text style={styles.activityAmount}>{formatMoney(o.driver_earnings)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <BottomTabBar navigation={navigation} variant="driver" active="home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width,
    minHeight: height,
    paddingBottom: 72,
  },
  stayOnlineBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    ...shadows.card,
  },
  stayOnlineBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stayOnlinePulseWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stayOnlinePulseDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
  },
  stayOnlineBannerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  stayOnlineBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stayOnlineBannerSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  stayOnlineMiniStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.25)',
  },
  stayOnlineStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stayOnlineStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  stayOfflineBtn: {
    marginTop: spacing.md,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 140,
    alignItems: 'center',
  },
  stayOfflineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  driverInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  logoutHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoutHeaderBtnText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
  },
  driverNameLight: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textWhite,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  driverRatingLight: {
    fontSize: 16,
    color: colors.textWhite,
    fontWeight: '600',
  },
  toggleSection: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 28,
    alignItems: 'center',
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  toggleCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleCircleOffline: {
    backgroundColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleCircleOnline: {
    backgroundColor: colors.primary,
  },
  toggleGlowOnline: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 32,
    elevation: 24,
  },
  toggleCircleBusy: {
    opacity: 0.88,
  },
  toggleIndicator: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.textWhite,
  },
  toggleIndicatorOffline: {
    backgroundColor: colors.textSecondary,
  },
  toggleIndicatorOnline: {
    backgroundColor: colors.success,
  },
  motivationalText: {
    marginTop: 20,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    lineHeight: 24,
  },
  matchingInfoCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  matchingInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  matchingInfoBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  routeMatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#E8F4FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  routeMatchBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  routeMatchBannerBold: {
    fontWeight: '800',
    color: colors.primary,
  },
  earningsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  earningsLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 4,
  },
  deliveriesCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionButtons: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  viewJobsButtonSolo: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  viewJobsText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tierBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tierText: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: '600',
  },
  ratingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratingItem: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  recentSection: {
    paddingHorizontal: 20,
    marginBottom: 88,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    marginBottom: 8,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  activityList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    ...shadows.card,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  todayEarningsCard: {
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayLabel: {
    color: '#9E9E9E',
    fontSize: 12,
    fontWeight: '500',
  },
  todayAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  motivationalCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  motivationalSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: colors.textLight,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
});

export default DriverHome;
