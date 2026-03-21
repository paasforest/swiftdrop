import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

const { width, height } = Dimensions.get('window');

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'disputed', label: 'Disputed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function statusBadgeStyle(status) {
  const s = String(status || '').toLowerCase();
  if (['delivered', 'completed'].includes(s)) return { bg: '#E8F5E8', fg: '#16A34A' };
  if (s === 'disputed') return { bg: '#FFEBEE', fg: '#DC2626' };
  if (s === 'cancelled') return { bg: '#F5F5F5', fg: '#757575' };
  return { bg: '#E8F4FF', fg: '#1A73E8' };
}

const Deliveries = () => {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchDebounce = useRef(null);

  const [deliveries, setDeliveries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(searchDebounce.current);
  }, [searchInput]);

  const load = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setError('Not signed in');
      setLoading(false);
      return;
    }
    setError(null);
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: '20',
        status: selectedStatus,
      });
      if (search) qs.set('search', search);
      const data = await getJson(`/api/admin/deliveries?${qs.toString()}`, { token: auth.token });
      const rows = Array.isArray(data.deliveries) ? data.deliveries : [];
      setTotal(Number(data.total) || 0);
      if (page === 1) {
        setDeliveries(rows);
      } else {
        setDeliveries((prev) => [...prev, ...rows]);
      }
    } catch (e) {
      setError(e.message || 'Failed to load');
      if (page === 1) setDeliveries([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [page, selectedStatus, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (row) => {
    const auth = getAuth();
    if (!auth?.token) return;
    setSelectedId(row.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const o = await getJson(`/api/orders/${row.id}`, { token: auth.token });
      setDetail(o);
    } catch {
      setDetail(row);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const d = detail;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Deliveries</Text>
      </View>

      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Order # or customer name"
            placeholderTextColor="#999"
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.filterChip,
                selectedStatus === opt.key && styles.filterChipActive,
              ]}
              onPress={() => {
                setSelectedStatus(opt.key);
                setPage(1);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedStatus === opt.key && styles.filterChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#1A73E8" style={{ marginTop: 16 }} /> : null}

      <View style={styles.mainRow}>
        <ScrollView style={styles.tableScroll} horizontal>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell, { width: 120 }]}>Order</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 100 }]}>Customer</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 100 }]}>Driver</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 160 }]}>From</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 160 }]}>To</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 90 }]}>Status</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 80 }]}>Amount</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 130 }]}>Created</Text>
              <Text style={[styles.cell, styles.headerCell, { width: 72 }]}> </Text>
            </View>
            {deliveries.map((row) => {
              const st = statusBadgeStyle(row.status);
              return (
                <View key={String(row.id)} style={styles.tableRow}>
                  <Text style={[styles.cell, { width: 120 }]} numberOfLines={1}>
                    {row.order_number || `#${row.id}`}
                  </Text>
                  <Text style={[styles.cell, { width: 100 }]} numberOfLines={1}>
                    {row.customer_name || '—'}
                  </Text>
                  <Text style={[styles.cell, { width: 100 }]} numberOfLines={1}>
                    {row.driver_name || '—'}
                  </Text>
                  <Text style={[styles.cell, { width: 160 }]} numberOfLines={2}>
                    {row.pickup_address || '—'}
                  </Text>
                  <Text style={[styles.cell, { width: 160 }]} numberOfLines={2}>
                    {row.dropoff_address || '—'}
                  </Text>
                  <View style={{ width: 90, justifyContent: 'center' }}>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]} numberOfLines={1}>
                        {row.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.cell, { width: 80 }]}>
                    {formatMoney(row.payment_amount ?? row.total_price)}
                  </Text>
                  <Text style={[styles.cell, { width: 130, fontSize: 11 }]}>
                    {formatWhen(row.created_at)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.viewBtn, { width: 72 }]}
                    onPress={() => openDetail(row)}
                  >
                    <Text style={styles.viewBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {selectedId && (
          <View style={styles.detailPanel}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Delivery detail</Text>
              <TouchableOpacity onPress={closeDetail}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            {detailLoading ? (
              <ActivityIndicator color="#1A73E8" style={{ marginTop: 20 }} />
            ) : d ? (
              <ScrollView>
                <Text style={styles.dLine}>
                  <Text style={styles.dLab}>Order: </Text>
                  {d.order_number || d.id}
                </Text>
                <Text style={styles.dLine}>
                  <Text style={styles.dLab}>Customer: </Text>
                  {d.customer_name || '—'}
                </Text>
                <Text style={styles.dLine}>
                  <Text style={styles.dLab}>Driver: </Text>
                  {d.driver_name || '—'}
                </Text>
                <Text style={styles.dLine}>
                  <Text style={styles.dLab}>From: </Text>
                  {d.pickup_address}
                </Text>
                <Text style={styles.dLine}>
                  <Text style={styles.dLab}>To: </Text>
                  {d.dropoff_address}
                </Text>
                <Text style={styles.dLine}>
                  <Text style={styles.dLab}>Status: </Text>
                  {d.status}
                </Text>
                <Text style={styles.dLine}>
                  <Text style={styles.dLab}>Total: </Text>
                  {formatMoney(d.total_price)}
                </Text>
                <Text style={styles.dSection}>Photos</Text>
                <View style={styles.photoRow}>
                  <View style={styles.photoCol}>
                    <Text style={styles.photoLab}>Pickup</Text>
                    {d.pickup_photo_url ? (
                      <Image source={{ uri: d.pickup_photo_url }} style={styles.photoImg} />
                    ) : (
                      <Text style={styles.noPh}>No photo</Text>
                    )}
                  </View>
                  <View style={styles.photoCol}>
                    <Text style={styles.photoLab}>Delivery</Text>
                    {d.delivery_photo_url ? (
                      <Image source={{ uri: d.delivery_photo_url }} style={styles.photoImg} />
                    ) : (
                      <Text style={styles.noPh}>No photo</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.dSection}>OTP times</Text>
                <Text style={styles.dLine}>Pickup confirmed: {formatWhen(d.pickup_confirmed_at)}</Text>
                <Text style={styles.dLine}>Delivery confirmed: {formatWhen(d.delivery_confirmed_at)}</Text>
                <Text style={styles.dSection}>Payment</Text>
                <Text style={styles.dLine}>Commission: {formatMoney(d.commission_amount)}</Text>
                <Text style={styles.dLine}>Driver earnings: {formatMoney(d.driver_earnings)}</Text>
              </ScrollView>
            ) : null}
          </View>
        )}
      </View>

      {!loading && deliveries.length < total ? (
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setPage((p) => p + 1)}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <ActivityIndicator color="#1A73E8" />
          ) : (
            <Text style={styles.moreBtnText}>Load more</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    minHeight: height,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  filterBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#111' },
  chipsRow: { flexGrow: 0 },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  filterChipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  filterChipTextActive: { color: '#FFFFFF' },
  errorText: { color: '#B91C1C', paddingHorizontal: 16 },
  mainRow: { flex: 1, flexDirection: width > 700 ? 'row' : 'column' },
  tableScroll: { flex: 1 },
  table: { minWidth: width > 700 ? width - 420 : width - 32, paddingHorizontal: 8 },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 8,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    paddingVertical: 10,
  },
  cell: { fontSize: 11, color: '#333', paddingRight: 6 },
  headerCell: { fontWeight: '800', color: '#111', fontSize: 11 },
  badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 9, fontWeight: '700' },
  viewBtn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewBtnText: { color: '#FFF', fontWeight: '700', fontSize: 11 },
  detailPanel: {
    width: width > 700 ? 380 : '100%',
    maxHeight: width > 700 ? height - 100 : 320,
    backgroundColor: '#FFF',
    borderTopWidth: width > 700 ? 0 : 1,
    borderLeftWidth: width > 700 ? 1 : 0,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailTitle: { fontSize: 16, fontWeight: '800' },
  closeButton: { fontSize: 20, color: '#666' },
  dLine: { fontSize: 13, color: '#333', marginBottom: 6, lineHeight: 18 },
  dLab: { fontWeight: '700', color: '#555' },
  dSection: { fontWeight: '800', marginTop: 12, marginBottom: 6, color: '#111' },
  photoRow: { flexDirection: 'row' },
  photoCol: { flex: 1, marginRight: 12 },
  photoLab: { fontSize: 12, color: '#666', marginBottom: 4 },
  photoImg: { width: '100%', height: 100, borderRadius: 8, backgroundColor: '#F0F0F0' },
  noPh: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  moreBtn: {
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    margin: 16,
    borderRadius: 10,
  },
  moreBtnText: { color: '#1A73E8', fontWeight: '800' },
});

export default Deliveries;
