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
import { useFocusEffect } from '@react-navigation/native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

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
        <Text style={styles.subtitle}>From completed jobs in your account (API data).</Text>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Completed jobs (loaded)</Text>
          <Text style={styles.summaryValue}>{completed.length}</Text>
          <Text style={styles.summaryLabel}>Sum of driver_earnings</Text>
          <Text style={styles.summaryMoney}>{formatMoney(totalEarnings)}</Text>
        </View>

        {loading ? <ActivityIndicator style={{ marginVertical: 24 }} color="#1A73E8" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.section}>Job history</Text>
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
              <Text style={styles.rowMoney}>{formatMoney(o.driver_earnings)}</Text>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
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
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
  },
  summary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666666',
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  summaryMoney: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF6B35',
  },
  error: {
    color: '#d93025',
    marginBottom: 12,
  },
  section: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1A1A1A',
  },
  empty: {
    color: '#666666',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: {
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  rowSub: {
    fontSize: 12,
    color: '#666666',
  },
  rowMoney: {
    fontWeight: '700',
    color: '#4CAF50',
    marginLeft: 12,
  },
  back: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    color: '#1A73E8',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Earnings;
