import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AppText from '../../components/ui/AppText';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminAvatar from '../../components/admin/AdminAvatar';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, shadows, adminType } from '../../theme/theme';

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0';
  return `R${x.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function initialsFromName(name) {
  if (!name) return '?';
  return String(name)
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function regBadgeLabel(t) {
  if (t === 'uber_bolt') return 'Uber / Bolt';
  if (t === 'new_driver') return 'New driver';
  return String(t || '—');
}

const AdminOverview = () => {
  const navigation = useNavigation();
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
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
      const [data, drivers] = await Promise.all([
        getJson('/api/admin/dashboard-stats', { token: auth.token }),
        getJson('/api/admin/drivers?status=pending', { token: auth.token }).catch(() => ({ drivers: [] })),
      ]);
      setStats(data);
      setPending(Array.isArray(drivers.drivers) ? drivers.drivers : []);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const s = stats || {};
  const auth = getAuth();
  const adminName = auth?.user?.full_name || 'Admin';

  const kpis = [
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
      key: 'rev',
      label: 'Today revenue',
      value: formatMoney(s.platform_revenue_today ?? 0),
      color: colors.accent,
      border: colors.accent,
    },
    {
      key: 'disputes',
      label: 'Open disputes',
      value: s.open_disputes ?? '—',
      color: colors.danger,
      border: colors.danger,
      dot: Number(s.open_disputes) > 0,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.root}>
        <AdminHeader
          mode="overview"
          subtitle={new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          right={<AdminAvatar name={adminName} size={28} />}
        />

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
          ) : error ? (
            <AppText color="danger" style={{ padding: spacing.md }}>{error}</AppText>
          ) : (
            <>
              <View style={styles.kpiGrid}>
                {kpis.map((c) => (
                  <View key={c.key} style={[styles.kpiCard, { borderLeftColor: c.border }]}>
                    <View style={styles.kpiTop}>
                      <AppText style={[adminType.title, { color: c.color }]}>{String(c.value)}</AppText>
                      {c.dot ? <View style={styles.alertDot} /> : null}
                    </View>
                    <AppText style={[adminType.label, { color: colors.textSecondary, marginTop: 4 }]}>{c.label}</AppText>
                  </View>
                ))}
              </View>

              <View style={styles.platformCard}>
                <AppText style={[adminType.label, { color: colors.textSecondary }]}>Total platform revenue</AppText>
                <AppText style={[styles.platformBig, { color: colors.success }]}>
                  {formatMoney(s.total_platform_revenue_alltime ?? 0)}
                </AppText>
                <AppText style={[adminType.label, { color: colors.textLight, marginTop: 4 }]}>Platform earned total</AppText>
              </View>

              <AppText style={[adminType.title, styles.sectionTitle]}>Pending approvals</AppText>
              {pending.length === 0 ? (
                <View style={styles.emptyCard}>
                  <AppText style={[adminType.body, { color: colors.textSecondary }]}>No pending applications.</AppText>
                </View>
              ) : (
                pending.map((item) => (
                  <Pressable
                    key={String(item.user_id)}
                    style={({ pressed }) => [styles.driverCard, pressed && { opacity: 0.92 }]}
                    onPress={() => navigation.navigate('Drivers', { preSelectedUserId: item.user_id })}
                  >
                    <View style={styles.avatarSm}>
                      <AppText style={[adminType.badge, styles.avatarTxt]}>{initialsFromName(item.full_name)}</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={[adminType.title, { color: colors.textPrimary }]}>{item.full_name}</AppText>
                      <AppText style={[adminType.body, { color: colors.textSecondary, marginTop: 2 }]}>{item.phone}</AppText>
                      <View style={styles.badgeRow}>
                        <View style={styles.badgeGrey}>
                          <AppText style={[adminType.badge, { color: colors.textSecondary }]}>{regBadgeLabel(item.registration_type)}</AppText>
                        </View>
                        <View style={styles.badgeAmber}>
                          <AppText style={[adminType.badge, { color: colors.warning }]}>Pending</AppText>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))
              )}

              <View style={[styles.insuranceCard, { marginTop: spacing.md }]}>
                <AppText style={[adminType.label, { color: colors.textSecondary }]}>Insurance pool balance</AppText>
                <AppText style={[adminType.title, { color: colors.primary, marginTop: 6, fontSize: 18 }]}>
                  {formatMoney(s.insurance_pool_balance ?? 0)}
                </AppText>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.adminHeader },
  root: { flex: 1, backgroundColor: colors.adminContent },
  scroll: { flex: 1, backgroundColor: colors.adminContent },
  scrollContent: { padding: spacing.md, paddingBottom: 32 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...shadows.card,
  },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  platformCard: {
    marginTop: spacing.md,
    backgroundColor: colors.successLight,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  platformBig: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.textPrimary },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  avatarSm: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarTxt: { color: colors.primary, fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badgeGrey: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeAmber: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  insuranceCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

export default AdminOverview;
