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
import { getJson, patchJson, deleteJson } from '../../apiClient';
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

/** First segment of address for compact "city" line. */
function routeCityLine(addr) {
  if (!addr) return '—';
  const s = String(addr).split(',')[0].trim();
  return s || addr;
}

function formatRouteDeparture(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_ERR = 'Could not update status. Check connection.';

const DriverHome = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [myRoutes, setMyRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routeMatchBanner, setRouteMatchBanner] = useState(null);

  const locationIntervalRef = useRef(null);

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
    if (!auth?.token) return;
    try {
      const data = await getJson('/api/drivers/status', { token: auth.token });
      const online = Boolean(data.is_online);
      setIsOnline(online);
      if (online) {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          await startLocationUpdates();
        } else {
          try {
            await patchJson('/api/drivers/status', { is_online: false }, { token: auth.token });
          } catch {
            /* best-effort */
          }
          setIsOnline(false);
          stopLocationUpdates();
        }
      } else {
        stopLocationUpdates();
      }
    } catch {
      /* keep local toggle; dashboard error handles API down */
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

  const loadMyRoutes = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setMyRoutes([]);
      return;
    }
    setRoutesLoading(true);
    try {
      const data = await getJson('/api/driver-routes/my', { token: auth.token });
      setMyRoutes(Array.isArray(data.routes) ? data.routes : []);
    } catch {
      setMyRoutes([]);
    } finally {
      setRoutesLoading(false);
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
      if (o && o.matched_via === 'route' && o.dropoff_address) {
        setRouteMatchBanner({ destination: o.dropoff_address });
      } else {
        setRouteMatchBanner(null);
      }
    } catch {
      setRouteMatchBanner(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      loadMyRoutes();
      loadRouteMatchBanner();
      syncOnlineStatusFromServer();
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
    }, [loadDashboard, loadMyRoutes, loadRouteMatchBanner, syncOnlineStatusFromServer])
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
        if (current === 'JobOffer') return;

        const auth = getAuth();
        if (!auth?.token) return;
        const data = await getJson('/api/orders/pending-offer', { token: auth.token });
        if (data?.offer) {
          navigation.navigate('JobOffer');
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

  const handleCancelPostedRoute = (route) => {
    Alert.alert(
      'Cancel this route?',
      'You will no longer receive parcel offers for this trip.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, cancel route',
          style: 'destructive',
          onPress: async () => {
            try {
              const auth = getAuth();
              if (!auth?.token) return;
              await deleteJson(`/api/driver-routes/${route.id}`, { token: auth.token });
              setMyRoutes((prev) => prev.filter((r) => Number(r.id) !== Number(route.id)));
            } catch (e) {
              Alert.alert('Could not cancel', e.message || 'Try again.');
            }
          },
        },
      ]
    );
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

      <ScrollView showsVerticalScrollIndicator={false}>
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

        {routeMatchBanner ? (
          <TouchableOpacity
            style={styles.routeMatchBanner}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('JobOffer')}
          >
            <Ionicons name="navigate-circle" size={22} color={colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.routeMatchBannerText}>
              A parcel matches your route to{' '}
              <Text style={styles.routeMatchBannerBold}>
                {routeMatchBanner.destination.length > 48
                  ? `${routeMatchBanner.destination.slice(0, 45)}…`
                  : routeMatchBanner.destination}
              </Text>
              ! Check job offers.
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.myRoutesSection}>
          <Text style={styles.myRoutesTitle}>My Posted Routes</Text>
          {routesLoading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color={colors.primary} />
          ) : myRoutes.length === 0 ? (
            <View style={styles.myRoutesEmpty}>
              <Text style={styles.myRoutesEmptyTitle}>No active routes posted</Text>
              <Text style={styles.myRoutesEmptySub}>
                Post a route to earn on your upcoming trips
              </Text>
              <TouchableOpacity
                style={styles.myRoutesEmptyBtn}
                onPress={() => navigation.navigate('PostRoute')}
                activeOpacity={0.88}
              >
                <Text style={styles.myRoutesEmptyBtnText}>Post a Route</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.myRoutesList}>
              {myRoutes.map((r) => (
                <View key={String(r.id)} style={styles.routeCard}>
                  <View style={styles.routeCardBody}>
                    <Text style={styles.routeCardLine} numberOfLines={2}>
                      {routeCityLine(r.from_address)} → {routeCityLine(r.to_address)}
                    </Text>
                    <Text style={styles.routeCardTime}>{formatRouteDeparture(r.departure_time)}</Text>
                    <View style={styles.routeCardBadge}>
                      <Text style={styles.routeCardBadgeText}>Max {r.max_parcels ?? 1} parcels</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.routeCardCancel}
                    onPress={() => handleCancelPostedRoute(r)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Cancel route"
                  >
                    <Ionicons name="close-circle" size={28} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Today (completed)</Text>
          <Text style={styles.earningsAmount}>{formatMoney(todayEarnings)}</Text>
          <Text style={styles.deliveriesCount}>{todayDeliveries} deliveries completed today</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.postRouteButton}
            onPress={() => navigation.navigate('PostRoute')}
          >
            <Text style={styles.postRouteText}>Post a Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.viewJobsButton}
            onPress={() => navigation.navigate('JobOffer')}
          >
            <Text style={styles.viewJobsText}>View Available Jobs</Text>
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
            <Text style={styles.emptyText}>No assigned jobs yet. Check available jobs or post a route.</Text>
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
  myRoutesSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  myRoutesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  myRoutesEmpty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  myRoutesEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  myRoutesEmptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  myRoutesEmptyBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.md,
  },
  myRoutesEmptyBtnText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  myRoutesList: {},
  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  routeCardBody: {
    flex: 1,
    paddingRight: 8,
  },
  routeCardLine: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  routeCardTime: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  routeCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  routeCardBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  routeCardCancel: {
    paddingTop: 2,
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
  postRouteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  postRouteText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  viewJobsButton: {
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
