import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, StatusBar } from 'react-native';
import { useRoute } from '@react-navigation/native';

function statusLabel(status) {
  const map = {
    driver_selected: 'Driver selected',
    collecting: 'Collecting',
    collected: 'Collected',
    delivering: 'Delivering',
    delivered: 'Delivered',
  };
  return map[status] || status;
}

/**
 * Customer view for an active delivery job after a driver is assigned.
 * Live GPS tracking can be wired here later; order-based Tracking remains separate.
 */
export default function JobTracking({ navigation }) {
  const route = useRoute();
  const job = route.params?.job;

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.missing}>Job not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{statusLabel(job.status)}</Text>
        </View>

        <Text style={styles.section}>Pickup</Text>
        <Text style={styles.address}>{job.pickup_address}</Text>

        <Text style={[styles.section, { marginTop: 16 }]}>Dropoff</Text>
        <Text style={styles.address}>{job.dropoff_address}</Text>

        {job.driver_name ? (
          <>
            <Text style={[styles.section, { marginTop: 16 }]}>Driver</Text>
            <Text style={styles.address}>{job.driver_name}</Text>
            {job.driver_phone ? (
              <Text style={styles.phone}>Phone: {job.driver_phone}</Text>
            ) : null}
          </>
        ) : null}

        <Text style={styles.hint}>
          Stay on this screen for updates. If you booked through the classic order flow, use Track from the home
          tab for live map tracking.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  missing: { textAlign: 'center', marginTop: 40, fontSize: 16, color: '#757575' },
  backLink: { alignSelf: 'center', marginTop: 16 },
  backLinkText: { fontSize: 15, fontWeight: '600', color: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backBtn: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
  section: { fontSize: 11, fontWeight: '800', color: '#9E9E9E', letterSpacing: 1 },
  address: { fontSize: 15, fontWeight: '600', color: '#000', marginTop: 6, lineHeight: 22 },
  phone: { fontSize: 14, color: '#333', marginTop: 8 },
  hint: { fontSize: 13, color: '#9E9E9E', marginTop: 28, lineHeight: 20 },
});
