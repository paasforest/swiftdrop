import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

const { width, height } = Dimensions.get('window');

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0';
  return `R${x.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setError('Not signed in');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await getJson('/api/admin/dashboard-stats', { token: auth.token });
      setStats(data);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const s = stats || {};

  const cards = [
    {
      key: 'active',
      label: 'Active deliveries',
      value: s.active_deliveries ?? '—',
      color: '#1A73E8',
      border: '#1A73E8',
    },
    {
      key: 'online',
      label: 'Online drivers',
      value: s.online_drivers ?? '—',
      color: '#16A34A',
      border: '#16A34A',
    },
    {
      key: 'revenue',
      label: 'Today revenue',
      value: formatMoney(s.today_revenue),
      color: '#EA580C',
      border: '#EA580C',
    },
    {
      key: 'disputes',
      label: 'Open disputes',
      value: s.open_disputes ?? '—',
      color: '#DC2626',
      border: '#DC2626',
      badge: Number(s.open_disputes) > 0,
    },
    {
      key: 'pending',
      label: 'Pending applications',
      value: s.pending_driver_applications ?? '—',
      color: '#CA8A04',
      border: '#EAB308',
    },
    {
      key: 'unmatched',
      label: 'Unmatched orders',
      value: s.unmatched_orders ?? '—',
      color: '#64748B',
      border: '#94A3B8',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard Overview</Text>
        <Text style={styles.headerDate}>{new Date().toLocaleDateString()}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1A73E8" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.kpiContainer}>
            {cards.map((c) => (
              <View
                key={c.key}
                style={[styles.kpiCard, { borderTopColor: c.border, borderTopWidth: 4 }]}
              >
                <View style={styles.kpiTop}>
                  <Text style={[styles.kpiNumber, { color: c.color }]}>{c.value}</Text>
                  {c.badge ? <View style={styles.alertDot} /> : null}
                </View>
                <Text style={styles.kpiLabel}>{c.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.mapContainer}>
            <Text style={styles.mapTitle}>Operations</Text>
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapSub}>
                Live map can be added here. Stats above refresh when you open this screen.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width: width,
    minHeight: height,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  headerDate: {
    fontSize: 14,
    color: '#666666',
  },
  errorText: {
    color: '#B91C1C',
    padding: 24,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: width > 500 ? '30%' : '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kpiNumber: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#666666',
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
    marginBottom: 4,
  },
  mapContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  mapPlaceholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    minHeight: 100,
    justifyContent: 'center',
  },
  mapSub: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
});

export default AdminOverview;
