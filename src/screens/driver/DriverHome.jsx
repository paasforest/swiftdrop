import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson, patchJson } from '../../apiClient';
import { resetToLogin } from '../../navigationHelpers';
import { registerForPushNotificationsAsync } from '../../services/pushNotificationService';

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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{userName}</Text>
            <Text style={styles.driverRating}>⭐ {rating}</Text>
            <TouchableOpacity onPress={() => resetToLogin(navigation)} style={styles.inlineLogout}>
              <Text style={styles.inlineLogoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.driverPhoto}>
            <Text style={styles.driverAvatar}>🚗</Text>
          </View>
        </View>

        <View style={styles.toggleSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleToggleOnline}
            disabled={statusBusy}
            style={styles.toggleContainer}
          >
            <View
              style={[
                styles.toggleCircle,
                isOnline ? styles.toggleCircleOnline : styles.toggleCircleOffline,
                statusBusy && styles.toggleCircleBusy,
              ]}
            >
              {statusBusy ? (
                <ActivityIndicator color={isOnline ? '#fff' : '#333'} />
              ) : (
                <View
                  style={[
                    styles.toggleIndicator,
                    isOnline ? styles.toggleIndicatorOnline : styles.toggleIndicatorOffline,
                  ]}
                />
              )}
            </View>
            <Text style={[styles.toggleText, isOnline ? styles.toggleTextOnline : styles.toggleTextOffline]}>
              {statusBusy
                ? 'Updating…'
                : isOnline
                  ? 'You are online'
                  : 'You are offline — tap to go online'}
            </Text>
          </TouchableOpacity>
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
            <ActivityIndicator style={{ marginVertical: 20 }} color="#1A73E8" />
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
                    <Text style={styles.activityIconText}>📦</Text>
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

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navTextActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('JobOffer')}>
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navText}>Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Earnings')}>
          <Text style={styles.navIcon}>💰</Text>
          <Text style={styles.navText}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => resetToLogin(navigation)}>
          <Text style={styles.navIcon}>🚪</Text>
          <Text style={styles.navText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width,
    height,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  driverRating: {
    fontSize: 16,
    color: '#FFA500',
    marginBottom: 8,
  },
  inlineLogout: {
    alignSelf: 'flex-start',
  },
  inlineLogoutText: {
    color: '#d93025',
    fontSize: 14,
    fontWeight: '600',
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatar: {
    fontSize: 24,
  },
  toggleSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  toggleContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  toggleCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleCircleOffline: {
    backgroundColor: '#E0E0E0',
  },
  toggleCircleOnline: {
    backgroundColor: '#1A73E8',
  },
  toggleCircleBusy: {
    opacity: 0.85,
  },
  toggleIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  toggleIndicatorOffline: {
    backgroundColor: '#666666',
  },
  toggleIndicatorOnline: {
    backgroundColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  toggleTextOffline: {
    color: '#666666',
  },
  toggleTextOnline: {
    color: '#1A73E8',
    fontWeight: '600',
  },
  earningsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  earningsLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 8,
  },
  earningsAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  deliveriesCount: {
    fontSize: 14,
    color: '#666666',
  },
  actionButtons: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  postRouteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  postRouteText: {
    color: '#1A73E8',
    fontSize: 16,
    fontWeight: '600',
  },
  viewJobsButton: {
    backgroundColor: '#1A73E8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewJobsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ratingCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    color: '#1A1A1A',
  },
  tierBadge: {
    backgroundColor: '#1A73E8',
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
    color: '#1A1A1A',
    marginBottom: 4,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  recentSection: {
    paddingHorizontal: 20,
    marginBottom: 88,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  errorText: {
    color: '#d93025',
    marginBottom: 8,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityIconText: {
    fontSize: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#999999',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingBottom: 20,
    paddingTop: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
    color: '#666666',
    marginBottom: 4,
  },
  navIconActive: {
    fontSize: 24,
    color: '#1A73E8',
    marginBottom: 4,
  },
  navText: {
    fontSize: 12,
    color: '#666666',
  },
  navTextActive: {
    fontSize: 12,
    color: '#1A73E8',
    fontWeight: '600',
  },
});

export default DriverHome;
