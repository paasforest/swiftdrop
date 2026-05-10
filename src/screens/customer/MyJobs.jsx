import React, { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { BottomTabBar } from '../../components/ui';

const IN_PROGRESS = ['collecting', 'collected', 'delivering'];

function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function statusLabel(status) {
  const map = {
    open: 'Open',
    driver_selected: 'Driver selected',
    collecting: 'Collecting',
    collected: 'Collected',
    delivering: 'Delivering',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  return map[status] || status;
}

export default function MyJobs({ navigation }) {
  const auth = getAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadJobs = useCallback(async () => {
    if (!auth?.token) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getJson('/api/jobs/my', { token: auth.token });
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (e) {
      console.error('MyJobs:', e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useFocusEffect(
    useCallback(() => {
      loadJobs();
    }, [loadJobs])
  );

  function filteredJobs() {
    if (filter === 'open') return jobs.filter((j) => j.status === 'open');
    if (filter === 'driver_selected') return jobs.filter((j) => j.status === 'driver_selected');
    if (filter === 'in_progress') return jobs.filter((j) => IN_PROGRESS.includes(j.status));
    return jobs;
  }

  function onPressJob(job) {
    if (job.status === 'open') {
      navigation.navigate('JobApplicants', { jobId: job.id });
      return;
    }
    navigation.navigate('JobTracking', { job });
  }

  const list = filteredJobs();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My jobs</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'all', label: 'All' },
          { key: 'open', label: 'Open' },
          { key: 'driver_selected', label: 'Driver selected' },
          { key: 'in_progress', label: 'In progress' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, filter === t.key && styles.tabActive]}
            onPress={() => setFilter(t.key)}
          >
            <Text style={[styles.tabText, filter === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#000" />
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No jobs here</Text>
          <Text style={styles.emptySub}>Post a job from Home to see it listed.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {list.map((job) => (
            <TouchableOpacity key={job.id} style={styles.card} onPress={() => onPressJob(job)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <Text style={styles.route} numberOfLines={1}>
                  📦 {String(job.pickup_address || '').split(',')[0]} →{' '}
                  {String(job.dropoff_address || '').split(',')[0]}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{statusLabel(job.status)}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {job.parcel_size} · {job.parcel_type || 'General'}
              </Text>
              {job.status === 'open' ? (
                <Text style={styles.apps}>
                  {Number(job.applications_count || 0)} application
                  {Number(job.applications_count || 0) === 1 ? '' : 's'}
                </Text>
              ) : job.driver_name ? (
                <Text style={styles.driver}>Driver: {job.driver_name}</Text>
              ) : null}
              <View style={styles.rowBottom}>
                <Text style={styles.time}>Posted {timeAgo(job.created_at)}</Text>
                <Text style={styles.price}>R{Number(job.total_price || 0).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <BottomTabBar navigation={navigation} variant="customer" active="myjobs" />
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
  backBtn: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000' },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  tabActive: { backgroundColor: '#000' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#757575' },
  tabTextActive: { color: '#FFF' },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#000', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#9E9E9E', textAlign: 'center' },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  route: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000', marginRight: 8 },
  badge: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#616161' },
  meta: { fontSize: 12, color: '#757575', marginBottom: 4 },
  apps: { fontSize: 12, color: '#00C853', fontWeight: '600', marginBottom: 4 },
  driver: { fontSize: 12, color: '#333', marginBottom: 4 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  time: { fontSize: 11, color: '#9E9E9E' },
  price: { fontSize: 14, fontWeight: '800', color: '#000' },
});
