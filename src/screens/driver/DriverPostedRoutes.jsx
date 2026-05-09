import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

export default function DriverPostedRoutes({ navigation, route }) {
  const justPosted = route.params?.justPosted === true;

  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setRoutes([]);
      setError('Not signed in.');
      return;
    }
    setError(null);
    try {
      const data = await getJson('/api/driver-routes/my', { token: auth.token });
      const list = data.routes || [];
      const now = Date.now();
      const upcoming = list
        .filter((r) => String(r.status) === 'active' && new Date(r.departure_time).getTime() > now)
        .sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time));
      setRoutes(upcoming);
    } catch (e) {
      setError(e.message || 'Could not load routes.');
      setRoutes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  const body = loading ? (
    <ActivityIndicator style={{ marginTop: 32 }} color="#00C853" size="large" />
  ) : error ? (
    <Text style={styles.errorText}>{error}</Text>
  ) : routes.length === 0 ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🗺️</Text>
      <Text style={styles.emptyTitle}>No routes yet</Text>
      <Text style={styles.emptySubtext}>
        Post your first route to start receiving parcel bookings
      </Text>
      <TouchableOpacity style={styles.postButton} onPress={() => navigation.navigate('PostRoute')}>
        <Text style={styles.postButtonText}>Post a route</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C853" />}
      showsVerticalScrollIndicator={false}
    >
      {routes.map((trip) => {
        const slotsFull =
          Number(trip.parcel_count || 0) >= Number(trip.max_parcels || 0);
        const isIntercity = trip.trip_type === 'intercity';

        return (
          <TouchableOpacity
            key={trip.id}
            style={styles.routeCard}
            onPress={() => {
              if (isIntercity) {
                navigation.navigate('TripDeliveryManager', { routeId: trip.id });
              }
            }}
            activeOpacity={isIntercity ? 0.7 : 1}
          >
            <View style={styles.cardTop}>
              <View
                style={[
                  styles.typeBadge,
                  isIntercity ? { backgroundColor: '#E8F5E9' } : { backgroundColor: '#F5F5F5' },
                ]}
              >
                <Text style={styles.typeBadgeText}>
                  {isIntercity ? '🚗 Intercity' : '📍 Local'}
                </Text>
              </View>

              <View
                style={[
                  styles.slotsBadge,
                  slotsFull ? { backgroundColor: '#FFF5F5' } : { backgroundColor: '#F5F5F5' },
                ]}
              >
                <Text style={styles.slotsText}>
                  {trip.parcel_count || 0}/{trip.max_parcels} parcels
                </Text>
              </View>
            </View>

            <View style={styles.routeBlock}>
              <View style={styles.routeRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {trip.from_address}
                </Text>
              </View>
              <View style={styles.connector} />
              <View style={styles.routeRow}>
                <View style={styles.dotBlack} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {trip.to_address}
                </Text>
              </View>
            </View>

            <Text style={styles.departureText}>
              🕐 Departs{' '}
              {new Date(trip.departure_time).toLocaleDateString('en-ZA', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>

            {isIntercity && (
              <View style={styles.manageBtn}>
                <Text style={styles.manageBtnText}>Manage parcels →</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Routes</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('PostRoute')}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {justPosted && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>✓ Route posted successfully!</Text>
        </View>
      )}

      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: '#FFFFFF',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  addButton: {
    padding: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00C853',
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#00C853',
  },
  successBannerText: {
    color: '#00C853',
    fontWeight: '700',
    fontSize: 14,
  },
  list: { padding: 16, paddingBottom: 48 },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  slotsBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  slotsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#757575',
  },
  routeBlock: { marginBottom: 10 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C853',
    marginRight: 10,
  },
  dotBlack: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#000',
    marginRight: 10,
  },
  connector: {
    width: 2,
    height: 12,
    backgroundColor: '#E0E0E0',
    marginLeft: 3,
  },
  routeText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    flex: 1,
  },
  departureText: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 10,
  },
  manageBtn: {
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  manageBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  postButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    marginHorizontal: 16,
    marginTop: 16,
    color: '#D32F2F',
    fontSize: 14,
  },
});
