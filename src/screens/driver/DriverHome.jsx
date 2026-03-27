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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '../../components/GradientHeader';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
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
const LOCATION_PING_INTERVAL_MS = 15000;
const OFFER_POLL_INTERVAL_MS = 5000;

const DriverHome = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const [routeMatchBanner, setRouteMatchBanner] = useState(null);
  const [todayStats, setTodayStats] = useState(null);

  const locationIntervalRef = useRef(null);
  const lastJobOfferNavigatedOrderIdRef = useRef(null);
  const locationSyncInFlightRef = useRef(false);
  const offerPollInFlightRef = useRef(false);

  const stopLocationUpdates = useCallback(() => {
    if (locationIntervalRef.current != null) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  const forceOffline = useCallback(
    async (reason) => {
      const auth = getAuth();
      stopLocationUpdates();
      setIsOnline(false);
      if (reason) setStatusNotice(reason);
      if (!auth?.token) return;
      try {
        await patchJson('/api/drivers/status', { is_online: false }, { token: auth.token, quiet: true });
      } catch {
        /* best-effort only */
      }
    },
    [stopLocationUpdates]
  );

  const sendLocationOnce = useCallback(async () => {
    if (locationSyncInFlightRef.current) return false;
    const auth = getAuth();
    if (!auth?.token) return;
    locationSyncInFlightRef.current = true;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return false;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await patchJson(
        '/api/drivers/location',
        { lat: pos.coords.latitude, lng: pos.coords.longitude, is_online: true },
        { token: auth.token }
      );
      return true;
    } finally {
      locationSyncInFlightRef.current = false;
    }
  }, []);

  const startLocationUpdates = useCallback(async ({ skipImmediate = false } = {}) => {
    stopLocationUpdates();
    try {
      if (!skipImmediate) {
        const ok = await sendLocationOnce();
        if (!ok) {
          await forceOffline('Location permission is required to stay online.');
          return;
        }
      }
    } catch {
      setStatusNotice('Live location sync is delayed. We will keep retrying.');
    }
    locationIntervalRef.current = setInterval(() => {
      sendLocationOnce()
        .then((ok) => {
          if (ok === false) {
            void forceOffline('Location permission is required to stay online.');
          }
        })
        .catch(() => {
          setStatusNotice('Live location sync is delayed. We will keep retrying.');
        });
    }, LOCATION_PING_INTERVAL_MS);
  }, [forceOffline, sendLocationOnce, stopLocationUpdates]);

  const syncOnlineStatusFromServer = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) return false;
    try {
      const data = await getJson('/api/drivers/status', { token: auth.token });
      const online = Boolean(data.is_online);
      setStatusNotice(null);
      setIsOnline(online);
      if (online) {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          await startLocationUpdates();
          return true;
        } else {
          await forceOffline('Location permission is required to stay online.');
          return false;
        }
      } else {
        stopLocationUpdates();
        return false;
      }
    } catch {
      if (!locationIntervalRef.current) {
        setIsOnline(false);
      }
      setStatusNotice('Could not verify live status from the server. Pull to refresh if this keeps happening.');
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

  useEffect(() => {
    if (!isOnline) {
      setRouteMatchBanner(null);
      lastJobOfferNavigatedOrderIdRef.current = null;
      return;
    }
    void loadRouteMatchBanner();
  }, [isOnline, loadRouteMatchBanner]);

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

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
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

      // Keep location updates running while the driver navigates through the driver flow.
      // We stop them only when going offline or when the screen unmounts completely.
      return undefined;
    }, [loadDashboard, syncOnlineStatusFromServer, fetchTodayStats, startLocationUpdates])
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
      if (offerPollInFlightRef.current) return;
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
        offerPollInFlightRef.current = true;
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
      } finally {
        offerPollInFlightRef.current = false;
      }
    };

    poll();
    const intervalId = setInterval(poll, OFFER_POLL_INTERVAL_MS);
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
  const statusPillLabel = statusBusy
    ? 'Syncing live status'
    : isOnline
      ? 'Online with live location'
      : 'Offline';

  const handleGoOffline = async () => {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      await forceOffline(null);
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
        setStatusNotice(null);
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
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const inWC =
        pos.coords.latitude >= -34.95 &&
        pos.coords.latitude <= -31.5 &&
        pos.coords.longitude >= 17.5 &&
        pos.coords.longitude <= 21.5;
      const inGP =
        pos.coords.latitude >= -26.75 &&
        pos.coords.latitude <= -25.2 &&
        pos.coords.longitude >= 27.25 &&
        pos.coords.longitude <= 29.05;
      if (!inWC && !inGP) {
        Alert.alert('Outside service area', 'Driver matching is currently available only in Western Cape and Gauteng.');
        return;
      }
      await patchJson(
        '/api/drivers/location',
        {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          is_online: true,
        },
        { token: auth.token }
      );
      setIsOnline(true);
      setStatusNotice(null);
      await startLocationUpdates({ skipImmediate: true });
    } catch (e) {
      Alert.alert('', e?.message || STATUS_ERR);
    } finally {
      setStatusBusy(false);
    }
  };

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
              onPress={async () => {
                await forceOffline(null);
                resetToLogin(navigation);
              }}
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
          <View style={[styles.statusPill, isOnline ? styles.statusPillOnline : styles.statusPillOffline]}>
            <View style={[styles.statusPillDot, isOnline ? styles.statusPillDotOnline : styles.statusPillDotOffline]} />
            <Text style={[styles.statusPillText, isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline]}>
              {statusPillLabel}
            </Text>
          </View>
          {statusNotice ? <Text style={styles.statusNotice}>{statusNotice}</Text> : null}
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillOnline: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  statusPillOffline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  statusPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusPillDotOnline: {
    backgroundColor: colors.success,
  },
  statusPillDotOffline: {
    backgroundColor: colors.textLight,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusPillTextOnline: {
    color: '#047857',
  },
  statusPillTextOffline: {
    color: colors.textSecondary,
  },
  statusNotice: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
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
