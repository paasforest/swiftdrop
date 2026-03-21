import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, shadows } from '../../theme/theme';

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
      color: colors.primary,
      border: colors.primary,
    },
    {
      key: 'online',
      label: 'Online drivers',
      value: s.online_drivers ?? '—',
      color: colors.success,
      border: colors.success,
    },
    {
      key: 'revenue',
      label: 'Today revenue',
      value: formatMoney(s.today_revenue),
      color: colors.accent,
      border: colors.accent,
    },
    {
      key: 'disputes',
      label: 'Open disputes',
      value: s.open_disputes ?? '—',
      color: colors.danger,
      border: colors.danger,
      badge: Number(s.open_disputes) > 0,
    },
    {
      key: 'pending',
      label: 'Pending applications',
      value: s.pending_driver_applications ?? '—',
      color: colors.warning,
      border: colors.warning,
    },
    {
      key: 'unmatched',
      label: 'Unmatched orders',
      value: s.unmatched_orders ?? '—',
      color: colors.textSecondary,
      border: colors.textLight,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard Overview</Text>
        <Text style={styles.headerDate}>{new Date().toLocaleDateString()}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
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
    backgroundColor: colors.background,
    width: width,
    minHeight: height,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorText: {
    color: colors.danger,
    padding: spacing.lg,
  },
  kpiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: width > 500 ? '30%' : '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
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
    color: colors.textSecondary,
  },
  alertDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    marginBottom: 4,
  },
  mapContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  mapPlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 20,
    minHeight: 100,
    justifyContent: 'center',
  },
  mapSub: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default AdminOverview;
