import React, { useState, useCallback } from 'react';
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

const EarningsScreen = ({ navigation }) => {
  const auth = getAuth();
  const [summary, setSummary] = useState(null);
  const [today, setToday] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [])
  );

  async function fetchAll() {
    setLoading(true);
    try {
      const [s, t, tx] = await Promise.all([
        getJson('/api/driver/earnings/summary', { token: auth?.token }),
        getJson('/api/driver/earnings/today', { token: auth?.token }),
        getJson('/api/wallet/transactions?limit=20', { token: auth?.token }),
      ]);
      setSummary(s);
      setToday(t);
      setTransactions(tx.transactions || []);
    } catch (err) {
      console.error('Earnings fetch:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Balance card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>TOTAL EARNED</Text>
            <Text style={styles.balanceAmount}>
              R{Number(summary?.all_time_total || 0).toFixed(2)}
            </Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatLabel}>This week</Text>
                <Text style={styles.balanceStatValue}>
                  R{Number(summary?.week_total || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceStat}>
                <Text style={styles.balanceStatLabel}>This month</Text>
                <Text style={styles.balanceStatValue}>
                  R{Number(summary?.month_total || 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Today card */}
          <View style={styles.todayCard}>
            <View>
              <Text style={styles.todayLabel}>Today</Text>
              <Text style={styles.todayAmount}>
                R{Number(today?.total || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.todayDeliveries}>
              <Text style={styles.todayCount}>{today?.deliveries || 0}</Text>
              <Text style={styles.todayCountLabel}>deliveries</Text>
            </View>
          </View>

          {/* Transaction history */}
          <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>Complete deliveries to earn</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.transactionRow}>
                <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' ? '#E8F5E9' : '#FEE2E2' }]}>
                  <Text style={styles.txIconText}>{tx.type === 'credit' ? '↑' : '↓'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDescription}>{tx.description}</Text>
                  <Text style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={[styles.txAmount, tx.type === 'credit' ? styles.txCredit : styles.txDebit]}>
                  {tx.type === 'credit' ? '+' : '-'}R{Number(tx.amount).toFixed(2)}
                </Text>
              </View>
            ))
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000000' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#000000' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  balanceCard: {
    backgroundColor: '#000000', borderRadius: 20, margin: 16, padding: 24,
  },
  balanceLabel: {
    fontSize: 11, fontWeight: '700', color: '#9E9E9E',
    letterSpacing: 1.2, marginBottom: 8,
  },
  balanceAmount: { fontSize: 42, fontWeight: '800', color: '#FFFFFF', marginBottom: 20 },
  balanceRow: { flexDirection: 'row', alignItems: 'center' },
  balanceStat: { flex: 1 },
  balanceStatLabel: { fontSize: 11, color: '#9E9E9E', marginBottom: 4 },
  balanceStatValue: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  balanceDivider: {
    width: 1, height: 32, backgroundColor: '#333333', marginHorizontal: 16,
  },
  todayCard: {
    backgroundColor: '#F5F5F5', borderRadius: 16, marginHorizontal: 16,
    marginBottom: 24, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  todayLabel: { fontSize: 12, color: '#9E9E9E', marginBottom: 4 },
  todayAmount: { fontSize: 24, fontWeight: '800', color: '#000000' },
  todayDeliveries: { alignItems: 'flex-end' },
  todayCount: { fontSize: 32, fontWeight: '800', color: '#000000' },
  todayCountLabel: { fontSize: 12, color: '#9E9E9E' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#9E9E9E',
    letterSpacing: 1.2, paddingHorizontal: 16, marginBottom: 8,
  },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#BDBDBD', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#BDBDBD' },
  transactionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  txIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  txIconText: { fontSize: 16, fontWeight: '700', color: '#000000' },
  txDescription: { fontSize: 14, color: '#000000', marginBottom: 2 },
  txDate: { fontSize: 12, color: '#9E9E9E' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txCredit: { color: '#00C853' },
  txDebit: { color: '#FF3B30' },
});

export default EarningsScreen;
