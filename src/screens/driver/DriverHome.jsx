import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson, patchJson } from '../../apiClient';
import { resetToLogin } from '../../navigationHelpers';
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

const STATUS_ERR = 'Could not update status. Check connection.';

const DriverHome = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      syncOnlineStatusFromServer();
      const auth = getAuth();
      if (auth?.token) {
        registerForPushNotificationsAsync().catch(() => {});
      }
    }, [loadDashboard, syncOnlineStatusFromServer])
  );

  useEffect(() => {
    return () => {
      stopLocationUpdates();
    };
  }, [stopLocationUpdates]);

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
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.avatarText}>
            {firstName?.[0]?.toUpperCase() || 'D'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Online / Offline toggle */}
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
                <ActivityIndicator color={isOnline ? '#FFFFFF' : '#9E9E9E'} />
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

        {/* Today's earnings */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Today (completed)</Text>
          <Text style={styles.earningsAmount}>{formatMoney(todayEarnings)}</Text>
          <Text style={styles.deliveriesCount}>{todayDeliveries} deliveries completed today</Text>
        </View>

        {/* Action buttons */}
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
    backgroundColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleCircleOnline: {
    backgroundColor: '#000000',
  },
  toggleGlowOnline: {
    shadowColor: '#00C853',
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
    backgroundColor: '#FFFFFF',
  },
  toggleIndicatorOffline: {
    backgroundColor: '#9E9E9E',
  },
  toggleIndicatorOnline: {
    backgroundColor: '#00C853',
  },
  motivationalText: {
    marginTop: 20,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
    paddingHorizontal: spacing.md,
    lineHeight: 24,
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
  actionButtons: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
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
