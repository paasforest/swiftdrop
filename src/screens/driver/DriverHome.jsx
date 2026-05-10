import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { registerForPushNotificationsAsync } from '../../services/pushNotificationService';
import { spacing, radius, shadows } from '../../theme/theme';
import { BottomTabBar } from '../../components/ui';

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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstNameOf(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'Driver';
  return fullName.trim().split(/\s+/)[0] || 'Driver';
}

function formatRouteDeparture(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-ZA', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const DriverHome = ({ navigation }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTrips, setActiveTrips] = useState([]);
  /** Full list from GET /api/driver-routes/my — used for "posted, awaiting bookings". */
  const [myRoutes, setMyRoutes] = useState([]);

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
      const [data, routesData] = await Promise.all([
        getJson('/api/orders/driver/dashboard', { token: auth.token }),
        getJson('/api/driver-routes/my', { token: auth.token }).catch(() => ({ routes: [] })),
      ]);
      setDashboard(data);
      const routes = routesData.routes || [];
      setMyRoutes(routes);
      const intercityWithParcels = routes.filter(
        (r) => r.trip_type === 'intercity' && Number(r.parcel_count) > 0
      );
      setActiveTrips(intercityWithParcels);
    } catch (e) {
      setError(e.message || 'Could not load dashboard');
      setDashboard(null);
      setMyRoutes([]);
      setActiveTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      const auth = getAuth();
      if (auth?.token) {
        registerForPushNotificationsAsync().catch(() => {});
      }
    }, [loadDashboard])
  );

  const userName = dashboard?.user?.full_name || getAuth()?.user?.full_name || 'Driver';
  const firstName = firstNameOf(userName);
  const rating =
    dashboard?.current_rating != null && !Number.isNaN(Number(dashboard.current_rating))
      ? Number(dashboard.current_rating).toFixed(1)
      : '—';
  const todayEarnings = dashboard?.today?.earnings ?? 0;
  const todayDeliveries = dashboard?.today?.deliveries ?? 0;
  const totalDone = dashboard?.total_deliveries_completed ?? 0;
  const recent = Array.isArray(dashboard?.recent_orders) ? dashboard.recent_orders : [];

  const postedAwaitingTrips = useMemo(() => {
    const now = Date.now();
    return (myRoutes || [])
      .filter((r) => {
        if (String(r.status) !== 'active') return false;
        if (Number(r.parcel_count) > 0) return false;
        const dep = new Date(r.departure_time);
        return !Number.isNaN(dep.getTime()) && dep.getTime() > now;
      })
      .sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time));
  }, [myRoutes]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Clean white header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {firstName}
          </Text>
          <Text style={styles.subtitle}>Ready to earn today?</Text>
        </View>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => navigation.navigate('DriverProfile')}
        >
          <Text style={styles.avatarText}>
            {firstName?.[0]?.toUpperCase() || 'D'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        <TouchableOpacity
          style={styles.browseJobsCard}
          onPress={() => navigation.navigate('BrowseJobs')}
          activeOpacity={0.88}
        >
          <View style={styles.browseJobsLeft}>
            <Text style={styles.browseJobsIcon}>📋</Text>
            <View>
              <Text style={styles.browseJobsTitle}>Browse delivery jobs</Text>
              <Text style={styles.browseJobsSub}>Local jobs near you + intercity matches</Text>
            </View>
          </View>
          <Text style={styles.browseJobsArrow}>→</Text>
        </TouchableOpacity>

        {/* Today's earnings */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Today (completed)</Text>
          <Text style={styles.earningsAmount}>{formatMoney(todayEarnings)}</Text>
          <Text style={styles.deliveriesCount}>{todayDeliveries} deliveries completed today</Text>
        </View>

        {/* Active intercity trip banners */}
        {activeTrips.map((trip) => (
          <TouchableOpacity
            key={trip.id}
            style={styles.tripBanner}
            onPress={() => navigation.navigate('TripDeliveryManager', { routeId: trip.id })}
          >
            <View>
              <Text style={styles.tripBannerTitle}>ACTIVE TRIP</Text>
              <Text style={styles.tripBannerRoute} numberOfLines={1}>
                {trip.from_city || trip.from_address?.split(',')[0]}
                {' → '}
                {trip.to_city || trip.to_address?.split(',')[0]}
              </Text>
            </View>
            <Text style={styles.tripBannerArrow}>→</Text>
          </TouchableOpacity>
        ))}

        {postedAwaitingTrips.length > 0 ? (
          <View style={styles.postedSection}>
            <Text style={styles.postedSectionTitle}>Your posted trips</Text>
            <Text style={styles.postedSectionHint}>
              Live on SwiftDrop — waiting for customers to book. Tap to view trip details.
            </Text>
            {postedAwaitingTrips.map((trip) => (
              <TouchableOpacity
                key={`posted-${trip.id}`}
                style={styles.postedTripCard}
                onPress={() => navigation.navigate('TripDeliveryManager', { routeId: trip.id })}
                activeOpacity={0.85}
              >
                <Text style={styles.postedTripBadge}>
                  {trip.trip_type === 'intercity' ? 'Intercity' : 'Local'} ·{' '}
                  {trip.max_parcels ?? '—'} slot{Number(trip.max_parcels) === 1 ? '' : 's'}
                </Text>
                <Text style={styles.postedTripRoute} numberOfLines={2}>
                  {trip.from_city || trip.from_address?.split(',')[0]}
                  {' → '}
                  {trip.to_city || trip.to_address?.split(',')[0]}
                </Text>
                <Text style={styles.postedTripMeta}>
                  Departs {formatRouteDeparture(trip.departure_time)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.postedRoutesNavButton}
            onPress={() => navigation.navigate('DriverPostedRoutes')}
          >
            <Text style={styles.postedRoutesNavButtonText}>Posted routes</Text>
          </TouchableOpacity>

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

        {/* Stats card */}
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

        {/* Recent jobs */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent jobs</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color="#00C853" />
          ) : recent.length === 0 ? (
            <Text style={styles.emptyText}>
              No assigned jobs yet. Check available jobs or post a route.
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
                    <Ionicons name="cube-outline" size={18} color="#000000" />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  subtitle: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  browseJobsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  browseJobsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  browseJobsIcon: { fontSize: 28 },
  browseJobsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  browseJobsSub: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  browseJobsArrow: {
    fontSize: 22,
    color: '#00C853',
    fontWeight: '700',
  },
  earningsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...shadows.card,
  },
  earningsLabel: {
    fontSize: 16,
    color: '#9E9E9E',
    marginBottom: spacing.sm,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  deliveriesCount: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  tripBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#00C853',
  },
  tripBannerTitle: {
    fontSize: 11, fontWeight: '700',
    color: '#00C853', letterSpacing: 1, marginBottom: 4,
  },
  tripBannerRoute: {
    fontSize: 14, fontWeight: '600', color: '#000000',
  },
  tripBannerArrow: {
    fontSize: 20, color: '#00C853', fontWeight: '700',
  },
  postedSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  postedSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  postedSectionHint: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 12,
    lineHeight: 18,
  },
  postedTripCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  postedTripBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#616161',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  postedTripRoute: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 20,
    marginBottom: 8,
  },
  postedTripMeta: {
    fontSize: 12,
    color: '#757575',
  },
  actionButtons: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  postedRoutesNavButton: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#00C853',
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  postedRoutesNavButtonText: {
    color: '#1B5E20',
    fontSize: 16,
    fontWeight: '700',
  },
  postRouteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  postRouteText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  viewJobsButton: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  viewJobsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
    color: '#000000',
  },
  tierBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tierText: {
    color: '#FFFFFF',
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
    color: '#000000',
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
  },
  recentSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 8,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#9E9E9E',
    marginBottom: 12,
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    ...shadows.card,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
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
    color: '#000000',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#BDBDBD',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00C853',
  },
});

export default DriverHome;
