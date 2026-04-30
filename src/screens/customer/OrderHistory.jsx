import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { BottomTabBar } from '../../components/ui';

function humanStatus(status) {
  if (!status) return '';
  return String(status).replace(/_/g, ' ');
}

function formatMoney(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

const OrderHistory = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOrders = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setLoading(false);
      setOrders([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getJson('/api/orders/customer?limit=50', { token: auth.token });
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (e) {
      setError(e.message || 'Could not load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const openOrder = (order) => {
    const isCompleted = order?.status === 'delivered' || order?.status === 'completed';
    if (isCompleted) {
      navigation.navigate('OrderDetail', { orderId: order.id });
      return;
    }
    navigation.navigate('Tracking', { orderId: order.id });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Order history</Text>
        <Text style={styles.sub}>
          Tap an order to view details or track.
        </Text>

        {error ? (
          <Text style={styles.errorInline}>{error}</Text>
        ) : null}
        {loading ? (
          <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.primary} />
        ) : orders.length === 0 ? (
          <Text style={styles.bodyMuted}>No orders yet.</Text>
        ) : (
          orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.card}
              onPress={() => openOrder(order)}
              activeOpacity={0.85}
            >
              <View style={styles.row}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {order.dropoff_address || 'Delivery'}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {humanStatus(order.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.footer}>
                <Text style={styles.footerMeta}>
                  {order.order_number}{' '}
                  {order.updated_at ? new Date(order.updated_at).toLocaleString() : ''}
                </Text>
                <Text style={styles.price}>{formatMoney(order.total_price)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <BottomTabBar navigation={navigation} variant="customer" active="history" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingBottom: 72,
  },
  scroll: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    marginBottom: spacing.xs,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sub: {
    marginBottom: spacing.lg,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  errorInline: {
    marginBottom: spacing.md,
    fontSize: 12,
    color: colors.danger,
  },
  bodyMuted: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  footerMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  price: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    maxWidth: '42%',
  },
  badgeText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default OrderHistory;
