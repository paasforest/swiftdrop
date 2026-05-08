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
import { spacing, radius } from '../../theme/theme';

function formatDeparture(iso) {
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

export default function DriverPostedRoutes({ navigation }) {
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

  function badgeFor(r) {
    const n = Number(r.parcel_count) || 0;
    if (n > 0) {
      return `${n} booking${n === 1 ? '' : 's'} · Active`;
    }
    return 'Awaiting bookings';
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Posted routes</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        Upcoming trips you have posted. Tap a route to open parcel details.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#00C853" size="large" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : routes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No upcoming posted routes</Text>
          <Text style={styles.emptySub}>
            Post a trip from your dashboard — it will show here once departure is still in the future.
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('PostRoute')}
          >
            <Text style={styles.ctaText}>Post a route</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C853" />
          }
          showsVerticalScrollIndicator={false}
        >
          {routes.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={styles.card}
              onPress={() => navigation.navigate('TripDeliveryManager', { routeId: trip.id })}
              activeOpacity={0.85}
            >
              <Text style={styles.cardBadge}>
                {trip.trip_type === 'intercity' ? 'Intercity' : 'Local'} · {badgeFor(trip)}
              </Text>
              <Text style={styles.cardRoute} numberOfLines={3}>
                {trip.from_address} → {trip.to_address}
              </Text>
              <Text style={styles.cardMeta}>Departs {formatDeparture(trip.departure_time)}</Text>
              <Text style={styles.cardSlots}>
                Up to {trip.max_parcels ?? '—'} parcel slot{Number(trip.max_parcels) === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
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
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  subtitle: {
    fontSize: 14,
    color: '#757575',
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 20,
  },
  errorText: {
    marginHorizontal: spacing.md,
    marginTop: 16,
    color: '#D32F2F',
    fontSize: 14,
  },
  empty: {
    padding: spacing.lg,
    marginTop: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  cta: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: radius.md,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#616161',
    letterSpacing: 0.4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  cardRoute: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 22,
    marginBottom: 10,
  },
  cardMeta: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 4,
  },
  cardSlots: {
    fontSize: 12,
    color: '#9E9E9E',
  },
});
