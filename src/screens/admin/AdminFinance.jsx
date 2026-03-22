import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AppText from '../../components/ui/AppText';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminLogoutIconButton from '../../components/admin/AdminLogoutIconButton';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, shadows, adminType } from '../../theme/theme';

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0';
  return `R${x.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const AdminFinance = () => {
  const [data, setData] = useState(null);
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
      const json = await getJson('/api/admin/finance/summary', { token: auth.token });
      setData(json);
    } catch (e) {
      setError(e.message || 'Failed to load finance');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pr = data?.platform_revenue || {};
  const ins = data?.insurance_pool || {};
  const dp = data?.driver_payouts || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.root}>
        <AdminHeader mode="simple" title="Finance" right={<AdminLogoutIconButton navigation={navigation} />} />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <AppText color="danger" style={{ padding: spacing.md }}>{error}</AppText>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.bucket, styles.bucketBlue]}>
              <AppText style={[adminType.title, { color: colors.textWhite, marginBottom: spacing.sm }]}>Platform revenue</AppText>
              <Row label="Today" value={formatMoney(pr.today)} light />
              <Row label="This week" value={formatMoney(pr.week)} light />
              <Row label="This month" value={formatMoney(pr.month)} light />
              <AppText style={[adminType.label, { color: 'rgba(255,255,255,0.85)', marginTop: spacing.sm }]}>All time</AppText>
              <AppText style={{ fontSize: 22, fontWeight: '800', color: colors.textWhite, marginTop: 4 }}>
                {formatMoney(pr.alltime)}
              </AppText>
            </View>

            <View style={[styles.bucket, styles.bucketGreen]}>
              <AppText style={[adminType.title, { color: colors.textWhite, marginBottom: spacing.sm }]}>Insurance pool</AppText>
              <AppText style={[adminType.label, { color: 'rgba(255,255,255,0.85)' }]}>Current balance</AppText>
              <AppText style={{ fontSize: 20, fontWeight: '800', color: colors.textWhite, marginBottom: spacing.sm }}>
                {formatMoney(ins.balance)}
              </AppText>
              <Row label="Total collected" value={formatMoney(ins.collected?.alltime)} light />
              <Row label="Total claimed" value={formatMoney(ins.claimed?.alltime)} light />
              <Row label="Claims count" value={String(ins.claims_count ?? 0)} light />
            </View>

            <View style={[styles.bucket, styles.bucketOrange]}>
              <AppText style={[adminType.title, { color: colors.textWhite, marginBottom: spacing.sm }]}>Driver payouts</AppText>
              <Row label="Pending payout" value={formatMoney(dp.pending_total)} light />
              <Row label="Paid today" value={formatMoney(dp.paid_today)} light />
              <Row label="Paid this month" value={formatMoney(dp.paid_this_month)} light />
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

function Row({ label, value, light }) {
  return (
    <View style={styles.row}>
      <AppText style={[adminType.body, { color: light ? 'rgba(255,255,255,0.9)' : colors.textPrimary }]}>{label}</AppText>
      <AppText style={[adminType.body, { fontWeight: '700', color: light ? colors.textWhite : colors.textPrimary }]}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.adminHeader },
  root: { flex: 1, backgroundColor: colors.adminContent },
  bucket: {
    borderRadius: radius.adminCard,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  bucketBlue: { backgroundColor: colors.primary },
  bucketGreen: { backgroundColor: colors.success },
  bucketOrange: { backgroundColor: colors.accent },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
});

export default AdminFinance;
