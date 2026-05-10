import React, { useState, useCallback } from 'react';
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
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';

export default function JobApplicants({ navigation }) {
  const route = useRoute();
  const jobId = route.params?.jobId;
  const auth = getAuth();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const fetchApplications = useCallback(async () => {
    if (!jobId || !auth?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getJson(`/api/jobs/${jobId}/applications`, { token: auth.token });
      setApplications(data.applications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [jobId, auth?.token]);

  useFocusEffect(
    useCallback(() => {
      fetchApplications();
    }, [fetchApplications])
  );

  async function handleConfirmDriver(driverId, driverName) {
    Alert.alert('Confirm driver', `Choose ${driverName} for this delivery?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setConfirming(true);
          try {
            const result = await postJson(
              `/api/jobs/${jobId}/select-driver`,
              { driver_id: driverId },
              { token: auth.token }
            );
            Alert.alert(
              '✓ Driver confirmed!',
              `${driverName} will collect your parcel. Their contact details have been sent to you via SMS.`,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    if (result?.order_id != null) {
                      navigation.replace('Tracking', { orderId: result.order_id });
                    } else {
                      navigation.replace('Home');
                    }
                  },
                },
              ]
            );
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not confirm driver');
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose a driver</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#000" size="large" style={{ marginTop: 40 }} />
      ) : applications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>⏳</Text>
          <Text style={styles.emptyTitle}>No drivers yet</Text>
          <Text style={styles.emptySubtext}>
            Drivers near you have been notified. Check back soon.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            {applications.length} driver{applications.length !== 1 ? 's' : ''} applied
          </Text>

          {applications.map((app) => (
            <View key={String(app.application_id)} style={styles.driverCard}>
              <View style={styles.driverTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{app.driver_name?.[0] || 'D'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{app.driver_name}</Text>
                  <View style={styles.ratingRow}>
                    <Text style={styles.star}>★</Text>
                    <Text style={styles.rating}>{Number(app.driver_rating || 0).toFixed(1)}</Text>
                    <Text style={styles.deliveries}>· {app.driver_deliveries} deliveries</Text>
                  </View>
                </View>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              </View>

              <View style={styles.vehicleCard}>
                <Text style={styles.vehicleIcon}>🚗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleName}>
                    {app.vehicle_color} {app.vehicle_make} {app.vehicle_model}
                    {app.vehicle_year ? ` (${app.vehicle_year})` : ''}
                  </Text>
                  <Text style={styles.vehiclePlate}>Reg: {app.vehicle_plate}</Text>
                </View>
              </View>

              {app.route_from ? (
                <View style={styles.routeBadge}>
                  <Text style={styles.routeBadgeText}>
                    🛣️ {app.route_from} → {app.route_to}
                    {app.departure_time
                      ? ` · ${new Date(app.departure_time).toLocaleString('en-ZA', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleConfirmDriver(app.driver_id, app.driver_name)}
                disabled={confirming}
              >
                {confirming ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Choose this driver</Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000' },
  subtitle: { fontSize: 14, color: '#9E9E9E', marginBottom: 16, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },
  driverCard: {
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
  driverTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  driverName: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  star: { fontSize: 12, color: '#FFB800' },
  rating: { fontSize: 12, color: '#757575', marginLeft: 4 },
  deliveries: { fontSize: 12, color: '#9E9E9E', marginLeft: 4 },
  verifiedBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#00C853' },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  vehicleIcon: { fontSize: 20 },
  vehicleName: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 2 },
  vehiclePlate: { fontSize: 12, color: '#757575' },
  routeBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  routeBadgeText: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  confirmBtn: {
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
