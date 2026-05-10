import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { getJson, postJson } from '../../apiClient';
import { getAuth } from '../../authStore';

export default function BrowseJobs({ navigation }) {
  const [activeTab, setActiveTab] = useState('local');
  const [localJobs, setLocalJobs] = useState([]);
  const [intercityJobs, setIntercityJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [applying, setApplying] = useState(null);

  useEffect(() => {
    getDriverLocation();
  }, []);

  async function getDriverLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDriverLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch (err) {
      console.error('Location:', err);
    }
  }

  const fetchLocalJobs = useCallback(async () => {
    const token = getAuth()?.token;
    if (!driverLocation || !token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(driverLocation.lat),
        lng: String(driverLocation.lng),
        radius_km: '25',
      });
      const data = await getJson(`/api/jobs/available?${params}`, { token });
      setLocalJobs(data.jobs || []);
    } catch (err) {
      console.error('localJobs:', err);
    } finally {
      setLoading(false);
    }
  }, [driverLocation]);

  const fetchIntercityJobs = useCallback(async () => {
    const token = getAuth()?.token;
    if (!token) return;
    try {
      const data = await getJson('/api/jobs/intercity-matches', { token });
      setIntercityJobs(data.jobs || []);
    } catch (err) {
      console.error('intercityJobs:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (driverLocation) {
        fetchLocalJobs();
        fetchIntercityJobs();
      }
    }, [driverLocation, fetchLocalJobs, fetchIntercityJobs])
  );

  async function handleApply(job) {
    const token = getAuth()?.token;
    if (!token) {
      Alert.alert('Sign in required', 'Please log in again.');
      return;
    }
    setApplying(job.id);
    try {
      await postJson(
        `/api/jobs/${job.id}/apply`,
        {
          driver_route_id: job.matched_route_id ?? null,
        },
        { token }
      );
      Alert.alert(
        '✓ Applied!',
        'The customer has been notified. You will get an SMS if selected.',
        [{ text: 'OK' }]
      );
      if (activeTab === 'local') {
        setLocalJobs((prev) => prev.filter((j) => j.id !== job.id));
      } else {
        setIntercityJobs((prev) => prev.filter((j) => j.id !== job.id));
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not apply');
    } finally {
      setApplying(null);
    }
  }

  const estMinutes = (item) => Number(item.estimated_minutes) || 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery jobs</Text>
        <TouchableOpacity
          onPress={() => {
            fetchLocalJobs();
            fetchIntercityJobs();
          }}
          style={styles.refreshButton}
        >
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'local' && styles.tabActive]}
          onPress={() => setActiveTab('local')}
        >
          <Text style={[styles.tabText, activeTab === 'local' && styles.tabTextActive]}>
            📍 Local jobs
            {localJobs.length > 0 ? ` (${localJobs.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'intercity' && styles.tabActive]}
          onPress={() => setActiveTab('intercity')}
        >
          <Text style={[styles.tabText, activeTab === 'intercity' && styles.tabTextActive]}>
            🚗 My route matches
            {intercityJobs.length > 0 ? ` (${intercityJobs.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color="#000" size="large" style={{ marginTop: 40 }} />
      ) : !driverLocation ? (
        <View style={styles.locationNeeded}>
          <Text style={styles.locationIcon}>📍</Text>
          <Text style={styles.locationTitle}>Location needed</Text>
          <Text style={styles.locationSub}>We need your location to show nearby jobs</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={getDriverLocation}>
            <Text style={styles.locationBtnText}>Enable location</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={activeTab === 'local' ? localJobs : intercityJobs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{activeTab === 'local' ? '📦' : '🚗'}</Text>
              <Text style={styles.emptyTitle}>
                {activeTab === 'local' ? 'No local jobs near you' : 'No matching intercity jobs'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'local'
                  ? 'Check back soon — new jobs are posted regularly'
                  : 'Post an intercity trip to see matching parcel jobs'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.jobCard}>
              <View style={styles.jobCardTop}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {item.delivery_type === 'intercity' ? '🚗 Intercity' : '📍 Local'}
                  </Text>
                </View>
                <Text style={styles.jobDistance}>
                  {item.distance_from_driver_km != null && Number(item.distance_from_driver_km) >= 0
                    ? `${Math.round(Number(item.distance_from_driver_km))}km from you`
                    : ''}
                </Text>
              </View>

              <View style={styles.jobRoute}>
                <View style={styles.routeRow}>
                  <View style={styles.dotGreen} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>COLLECT FROM</Text>
                    <Text style={styles.routeAddress} numberOfLines={2}>
                      {item.pickup_address}
                    </Text>
                  </View>
                </View>
                <View style={styles.routeConnector} />
                <View style={styles.routeRow}>
                  <View style={styles.dotBlack} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>DELIVER TO</Text>
                    <Text style={styles.routeAddress} numberOfLines={2}>
                      {item.dropoff_address}
                    </Text>
                  </View>
                </View>
              </View>

              {item.route_from_city ? (
                <View style={styles.matchingRoute}>
                  <Text style={styles.matchingRouteText}>
                    ✓ Matches your trip: {item.route_from_city} → {item.route_to_city}
                  </Text>
                </View>
              ) : null}

              <View style={styles.jobDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailValue}>R{item.driver_earnings}</Text>
                  <Text style={styles.detailLabel}>Your earnings</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailItem}>
                  <Text style={styles.detailValue}>
                    {estMinutes(item) < 60
                      ? `${estMinutes(item)} min`
                      : `${Math.round(estMinutes(item) / 60)}h`}
                  </Text>
                  <Text style={styles.detailLabel}>Est. time</Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailItem}>
                  <Text style={styles.detailValue}>{item.parcel_size}</Text>
                  <Text style={styles.detailLabel}>Parcel size</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.applyBtn, applying === item.id && { opacity: 0.6 }]}
                onPress={() => handleApply(item)}
                disabled={applying === item.id}
              >
                {applying === item.id ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.applyBtnText}>Apply for this job</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
  backArrow: { fontSize: 22, color: '#000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  refreshButton: { padding: 8 },
  refreshText: { fontSize: 22, color: '#000' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#000000' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9E9E9E' },
  tabTextActive: { color: '#000000' },
  locationNeeded: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  locationIcon: { fontSize: 48, marginBottom: 16 },
  locationTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  locationSub: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', marginBottom: 24 },
  locationBtn: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  locationBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  jobCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  typeBadge: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: '#000' },
  jobDistance: { fontSize: 12, color: '#9E9E9E' },
  jobRoute: { marginBottom: 14 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C853',
    marginRight: 10,
    marginTop: 14,
  },
  dotBlack: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#000',
    marginRight: 10,
    marginTop: 14,
  },
  routeConnector: { width: 2, height: 16, backgroundColor: '#E0E0E0', marginLeft: 4 },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1,
    marginBottom: 2,
  },
  routeAddress: { fontSize: 14, color: '#000', fontWeight: '500', lineHeight: 20 },
  matchingRoute: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  matchingRouteText: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  jobDetails: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  detailItem: { flex: 1, alignItems: 'center' },
  detailValue: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 2 },
  detailLabel: { fontSize: 11, color: '#9E9E9E', fontWeight: '600' },
  detailDivider: { width: 1, height: 32, backgroundColor: '#E0E0E0' },
  applyBtn: {
    backgroundColor: '#00C853',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
