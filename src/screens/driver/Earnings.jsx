import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      const data = await getJson('/api/orders/driver?limit=50', { token: auth.token });
      setOrders(Array.isArray(data.orders) ? data.orders : []);
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
        <Text style={styles.subtitle}>From completed deliveries on your account.</Text>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Completed deliveries</Text>
          <Text style={styles.summaryValue}>{completed.length}</Text>
          <Text style={styles.summaryLabel}>Total Earned</Text>
          <Text style={styles.summaryMoney}>{formatMoney(totalEarnings)}</Text>
        </View>

        {loading ? <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

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
  back: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
});

export default Earnings;
