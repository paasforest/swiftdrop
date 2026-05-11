import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { BottomTabBar } from '../../components/ui';

const { width, height } = Dimensions.get('window');

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function humanStatus(status) {
  if (!status) return '';
  return String(status).replace(/_/g, ' ');
}

const Earnings = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletUpdatedAt, setWalletUpdatedAt] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [orderData, walletData, txData] = await Promise.all([
        getJson('/api/orders/driver?limit=50', { token: auth.token }),
        getJson('/api/wallet/balance', { token: auth.token }).catch(() => null),
        getJson('/api/wallet/transactions?page=1&limit=15', { token: auth.token }).catch(() => ({
          transactions: [],
        })),
      ]);
      setOrders(Array.isArray(orderData.orders) ? orderData.orders : []);
      const wb =
        walletData?.balance_numeric != null
          ? Number(walletData.balance_numeric)
          : Number(walletData?.balance);
      setWalletBalance(Number.isFinite(wb) ? wb : null);
      setWalletUpdatedAt(walletData?.updated_at ?? null);
      setTransactions(Array.isArray(txData.transactions) ? txData.transactions : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const completed = orders.filter((o) => ['delivered', 'completed'].includes(o.status));
  const totalEarnings = completed.reduce((s, o) => s + (Number(o.driver_earnings) || 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Earnings</Text>
        <Text style={styles.subtitle}>Wallet, payouts from deliveries, and recent wallet activity.</Text>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Wallet balance</Text>
          <Text style={styles.summaryMoney}>
            {walletBalance != null ? formatMoney(walletBalance) : '—'}
          </Text>
          {walletUpdatedAt ? (
            <Text style={styles.walletUpdated}>
              Updated {new Date(walletUpdatedAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
            </Text>
          ) : null}
          <Text style={styles.summaryLabel}>Completed deliveries</Text>
          <Text style={styles.summaryValue}>{completed.length}</Text>
          <Text style={styles.summaryLabel}>Lifetime earned (orders)</Text>
          <Text style={styles.summaryMoney}>{formatMoney(totalEarnings)}</Text>
        </View>

        {loading ? <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.section}>Recent wallet transactions</Text>
        {transactions.length === 0 && !loading ? (
          <Text style={styles.empty}>No wallet transactions yet.</Text>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txDesc}>{tx.description || tx.reference || tx.type}</Text>
                <Text style={styles.txMeta}>
                  {new Date(tx.created_at).toLocaleString('en-ZA', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {tx.balance_after != null ? ` · Balance R${Number(tx.balance_after).toFixed(2)}` : ''}
                </Text>
              </View>
              <Text style={[styles.txAmt, tx.type === 'credit' ? styles.txCredit : styles.txDebit]}>
                {tx.type === 'credit' ? '+' : '-'}
                {formatMoney(tx.amount)}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.section}>Delivery history</Text>
        {orders.length === 0 && !loading ? (
          <Text style={styles.empty}>No jobs yet.</Text>
        ) : (
          orders.map((o) => (
            <View key={o.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{o.order_number}</Text>
                <Text style={styles.rowSub} numberOfLines={2}>
                  {humanStatus(o.status)}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {o.dropoff_address || '—'}
                </Text>
              </View>
              <View style={styles.perDeliveryCol}>
                <Text style={styles.perDeliveryLabel}>Per Delivery</Text>
                <Text style={styles.rowMoney}>{formatMoney(o.driver_earnings)}</Text>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>
      <BottomTabBar navigation={navigation} variant="driver" active="earnings" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width,
    minHeight: height,
    paddingBottom: 72,
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryMoney: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  section: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.textPrimary,
  },
  empty: {
    color: colors.textSecondary,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 10,
    ...shadows.card,
  },
  rowTitle: {
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  perDeliveryCol: {
    alignItems: 'flex-end',
    marginLeft: 12,
    minWidth: 110,
  },
  perDeliveryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  rowMoney: {
    fontWeight: '700',
    color: colors.success,
    fontSize: 16,
  },
  walletUpdated: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 14,
    marginBottom: 10,
    ...shadows.card,
  },
  txDesc: {
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  txMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  txAmt: {
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 12,
  },
  txCredit: {
    color: colors.success,
  },
  txDebit: {
    color: colors.danger,
  },
  back: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
});

export default Earnings;
