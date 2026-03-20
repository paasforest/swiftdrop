import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

const { width, height } = Dimensions.get('window');

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function formatDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '';
  }
}

function Stars({ rating }) {
  const r = Number(rating);
  const safe = Number.isFinite(r) ? Math.round(r) : 0;
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={[styles.star, s <= safe ? styles.starFilled : styles.starEmpty]}>
          {s <= safe ? '★' : '☆'}
        </Text>
      ))}
    </View>
  );
}

const OrderDetail = ({ navigation, route }) => {
  const orderId = route?.params?.orderId;
  const [order, setOrder] = useState(null);
  const [rating, setRating] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orderId) {
        setLoading(false);
        setError('No order selected');
        return;
      }

      const auth = getAuth();
      if (!auth?.token) {
        navigation.navigate('Login');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const o = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (!cancelled) setOrder(o);

        const r = await getJson(`/api/ratings/customer/${orderId}`, { token: auth.token });
        if (!cancelled) setRating(r?.rating || null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load order');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, navigation]);

  const receiptText = useMemo(() => {
    if (!order) return '';
    const when = formatDate(order.updated_at || order.created_at);
    const lines = [
      'SwiftDrop Receipt',
      `Order: ${order.order_number || order.id}`,
      `Date: ${when}`,
      `From: ${order.pickup_address || '-'}`,
      `To: ${order.dropoff_address || '-'}`,
      `Driver: ${order.driver_name || '-'}`,
      `Pickup Photo: ${order.pickup_photo_url ? 'Yes' : 'No'}`,
      `Delivery Photo: ${order.delivery_photo_url ? 'Yes' : 'No'}`,
      `Base price: ${formatMoney(order.base_price)}`,
      `Insurance: ${formatMoney(order.insurance_fee)}`,
      `Commission: ${formatMoney(order.commission_amount)}`,
      `Total paid: ${formatMoney(order.total_price)}`,
    ];

    if (rating?.rating) {
      lines.push(`Customer rating: ${rating.rating}/5`);
      if (rating.comment) lines.push(`Comment: ${rating.comment}`);
    }

    return lines.join('\n');
  }, [order, rating]);

  const handleDownloadReceipt = () => {
    const url = `data:text/plain;charset=utf-8,${encodeURIComponent(receiptText)}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1A73E8" />
          <Text style={styles.hint}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>⚠️ {error || 'Order not found'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backArrowWrap} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.section}>
          <Text style={styles.orderNumber}>{order.order_number || `Order ${order.id}`}</Text>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.row}>
            <Text style={styles.label}>From</Text>
            <Text style={styles.value}>{order.pickup_address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>To</Text>
            <Text style={styles.value}>{order.dropoff_address}</Text>
          </View>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoRow}>
            <View style={styles.photoCol}>
              <Text style={styles.photoLabel}>Pickup</Text>
              {order.pickup_photo_url ? (
                <Image
                  source={{ uri: order.pickup_photo_url }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>No photo</Text>
                </View>
              )}
            </View>
            <View style={styles.photoCol}>
              <Text style={styles.photoLabel}>Delivery</Text>
              {order.delivery_photo_url ? (
                <Image
                  source={{ uri: order.delivery_photo_url }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>No photo</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={[styles.value, { flex: 0 }]}>{order.driver_name || '-'}</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <Stars rating={rating?.rating ?? order.driver_rating} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Breakdown</Text>
          <View style={styles.priceRow}>
            <Text style={styles.label}>Delivery fee</Text>
            <Text style={styles.value}>{formatMoney(order.base_price)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.label}>Insurance</Text>
            <Text style={styles.value}>{formatMoney(order.insurance_fee)}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.label}>Commission</Text>
            <Text style={styles.value}>{formatMoney(order.commission_amount)}</Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={[styles.label, { color: '#1A1A1A', fontWeight: '700' }]}>Total</Text>
            <Text style={[styles.value, { color: '#1A1A1A', fontWeight: '800' }]}>{formatMoney(order.total_price)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.receiptBtn} onPress={handleDownloadReceipt}>
            <Text style={styles.receiptBtnText}>Download Receipt</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    width,
    height,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  hint: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 18,
  },
  backBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  backArrowWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backArrowText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A73E8',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  orderDate: {
    marginTop: 6,
    fontSize: 13,
    color: '#666666',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '600',
    width: 70,
  },
  value: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  photoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  photoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoCol: {
    flex: 1,
  },
  photoLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '700',
    marginBottom: 8,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  photoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '700',
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  star: {
    fontSize: 18,
    marginRight: 2,
  },
  starFilled: {
    color: '#f4b400',
  },
  starEmpty: {
    color: '#c7c7c7',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  totalRow: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  receiptBtn: {
    backgroundColor: '#1A73E8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  receiptBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});

export default OrderDetail;

