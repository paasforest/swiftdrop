import React, { useState, useCallback, useMemo } from 'react';
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

const FILTERS = ['All', 'Active', 'Delivered', 'Cancelled'];

const ACTIVE_STATUSES = new Set([
  'pending',
  'matching',
  'accepted',
  'pickup_en_route',
  'pickup_arrived',
  'collected',
  'delivery_en_route',
  'delivery_arrived',
]);

const DELIVERED_STATUSES = new Set(['delivered', 'completed']);

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

function formatStatus(status) {
  if (!status) return '';
  return String(status).replace(/_/g, ' ');
}

function getStatusStyle(status) {
  const s = String(status || '').toLowerCase();
  if (DELIVERED_STATUSES.has(s)) return { backgroundColor: '#E8F5E9' };
  if (s === 'cancelled') return { backgroundColor: '#FFF5F5' };
  return { backgroundColor: '#F5F5F5' };
}

function getStatusTextStyle(status) {
  const s = String(status || '').toLowerCase();
  if (DELIVERED_STATUSES.has(s)) return { color: '#00C853' };
  if (s === 'cancelled') return { color: '#FF3B30' };
  return { color: '#757575' };
}

function orderMatchesFilter(order, filter) {
  const s = String(order?.status || '').toLowerCase();
  if (filter === 'All') return true;
  if (filter === 'Active') return ACTIVE_STATUSES.has(s);
  if (filter === 'Delivered') return DELIVERED_STATUSES.has(s);
  if (filter === 'Cancelled') return s === 'cancelled';
  return true;
}

const OrderHistory = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

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

  const filteredOrders = useMemo(
    () => orders.filter((o) => orderMatchesFilter(o, activeFilter)),
    [orders, activeFilter]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>My deliveries</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {FILTERS.map((f) => {
          const selected = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>
            {orders.length === 0 ? 'No deliveries yet' : 'No deliveries in this filter'}
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.emptyButtonText}>Send your first parcel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredOrders.map((order) => (
            <TouchableOpacity
              key={String(order.id)}
              style={styles.orderCard}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
              activeOpacity={0.85}
            >
              <View style={styles.orderTop}>
                <Text style={styles.orderNumber}>#{order.order_number || order.id}</Text>
                <View style={[styles.statusBadge, getStatusStyle(order.status)]}>
                  <Text style={[styles.statusText, getStatusTextStyle(order.status)]}>
                    {formatStatus(order.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.routeBlock}>
                <Text style={styles.routeFrom} numberOfLines={1}>
                  📍 {order.pickup_address || '—'}
                </Text>
                <Text style={styles.routeTo} numberOfLines={1}>
                  🏁 {order.dropoff_address || '—'}
                </Text>
              </View>

              <View style={styles.orderFooter}>
                <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                <Text style={styles.orderPrice}>R{Number(order.total_price || 0).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <BottomTabBar navigation={navigation} variant="customer" active="history" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingBottom: 88,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#000000',
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  chipsScroll: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  chipsRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEEEEE',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#000000',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  errorText: {
    paddingHorizontal: 16,
    paddingTop: 8,
    color: '#FF3B30',
    fontSize: 13,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 16,
    marginBottom: 12,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  routeBlock: {
    marginBottom: 12,
  },
  routeFrom: {
    fontSize: 13,
    color: '#424242',
    marginBottom: 6,
  },
  routeTo: {
    fontSize: 13,
    color: '#424242',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default OrderHistory;
