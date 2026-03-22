import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../../components/ui/AppText';
import AdminHeader from '../../components/admin/AdminHeader';
import FullImageModal from '../../components/admin/FullImageModal';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors, spacing, radius, shadows, adminType } from '../../theme/theme';

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Done' },
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

function tierLabel(t) {
  if (!t) return '—';
  return String(t).charAt(0).toUpperCase() + String(t).slice(1);
}

function statusBadgeStyle(status) {
  const s = String(status || '').toLowerCase();
  if (['delivered', 'completed'].includes(s)) return { bg: colors.successLight, fg: colors.success, label: 'Done' };
  if (s === 'disputed') return { bg: colors.dangerLight, fg: colors.danger, label: 'Disputed' };
  if (s === 'cancelled') return { bg: colors.background, fg: colors.textSecondary, label: 'Cancelled' };
  return { bg: colors.primaryLight, fg: colors.primary, label: 'Active' };
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

  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);

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
      if (page === 1) setDeliveries(rows);
      else setDeliveries((prev) => [...prev, ...rows]);
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
    setDetailVisible(true);
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
    setDetailVisible(false);
    setDetail(null);
  };

  const d = detail;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.root}>
        <AdminHeader mode="simple" title="Deliveries" />

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textLight} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search orders or customers..."
            placeholderTextColor={colors.textLight}
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {STATUS_OPTIONS.map((opt) => {
            const on = selectedStatus === opt.key;
            return (
              <Pressable key={opt.key} onPress={() => { setSelectedStatus(opt.key); setPage(1); }} style={styles.filterItem}>
                <AppText style={[adminType.body, { color: on ? colors.primary : colors.textSecondary, fontWeight: on ? '700' : '400' }]}>
                  {opt.label}
                </AppText>
                {on ? <View style={styles.filterUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        {error ? <AppText color="danger" style={{ paddingHorizontal: spacing.md }}>{error}</AppText> : null}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}

        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {deliveries.map((row) => {
            const st = statusBadgeStyle(row.status);
            return (
              <Pressable
                key={String(row.id)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                onPress={() => openDetail(row)}
              >
                <View style={styles.cardTop}>
                  <AppText style={[adminType.title, { color: colors.textPrimary }]}>
                    {row.order_number || `#${row.id}`}
                  </AppText>
                  <View style={[styles.pill, { backgroundColor: st.bg }]}>
                    <AppText style={[adminType.badge, { color: st.fg }]}>{st.label}</AppText>
                  </View>
                </View>
                <View style={styles.addrRow}>
                  <AppText style={[adminType.body, { flex: 1, color: colors.textSecondary }]} numberOfLines={2}>
                    {row.pickup_address || '—'}
                  </AppText>
                  <Ionicons name="arrow-forward" size={14} color={colors.textLight} style={{ marginHorizontal: 6 }} />
                  <AppText style={[adminType.body, { flex: 1, color: colors.textSecondary }]} numberOfLines={2}>
                    {row.dropoff_address || '—'}
                  </AppText>
                </View>
                <View style={styles.cardBottom}>
                  <AppText style={[adminType.label, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                    {row.driver_name || 'No driver'} · {tierLabel(row.delivery_tier)}
                  </AppText>
                  <AppText style={[adminType.title, { color: colors.textPrimary }]}>
                    {formatMoney(row.payment_amount ?? row.total_price)}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {!loading && deliveries.length < total ? (
          <Pressable style={styles.moreBtn} onPress={() => setPage((p) => p + 1)} disabled={loadingMore}>
            {loadingMore ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <AppText style={[adminType.body, { color: colors.primary, fontWeight: '700' }]}>Load more</AppText>
            )}
          </Pressable>
        ) : null}

        <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={closeDetail}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />
            <View style={styles.sheet}>
              <View style={styles.sheetGrab}>
                <View style={styles.grabBar} />
              </View>
              {detailLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
              ) : d ? (
                <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
                  <View style={styles.sheetHead}>
                    <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Delivery detail</AppText>
                    <Pressable onPress={closeDetail} hitSlop={12}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                  <AppText style={[adminType.label, { color: colors.textSecondary }]}>Order</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>{d.order_number || d.id}</AppText>
                  <AppText style={[adminType.label, { color: colors.textSecondary, marginTop: 8 }]}>Date</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>{formatWhen(d.created_at)}</AppText>
                  <AppText style={[adminType.label, { color: colors.textSecondary, marginTop: 8 }]}>Status</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>{d.status}</AppText>

                  <AppText style={[adminType.title, { marginTop: spacing.md }]}>Addresses</AppText>
                  <AppText style={[adminType.body, { color: colors.textSecondary }]}>From</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>{d.pickup_address}</AppText>
                  <AppText style={[adminType.body, { color: colors.textSecondary, marginTop: 6 }]}>To</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>{d.dropoff_address}</AppText>

                  <AppText style={[adminType.title, { marginTop: spacing.md }]}>Driver</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>{d.driver_name || '—'}</AppText>
                  <AppText style={[adminType.body, { color: colors.textSecondary }]}>{d.driver_phone || '—'}</AppText>

                  <AppText style={[adminType.title, { marginTop: spacing.md, marginBottom: 8 }]}>Photos</AppText>
                  <View style={styles.photoRow}>
                    <Pressable style={styles.photoBox} onPress={() => d.pickup_photo_url && setPreviewUri(d.pickup_photo_url)}>
                      {d.pickup_photo_url ? (
                        <Image source={{ uri: d.pickup_photo_url }} style={styles.photoImg} />
                      ) : (
                        <AppText style={[adminType.label, { color: colors.textLight }]}>No pickup</AppText>
                      )}
                      <AppText style={[adminType.badge, { textAlign: 'center', marginTop: 4 }]}>Pickup</AppText>
                    </Pressable>
                    <Pressable style={styles.photoBox} onPress={() => d.delivery_photo_url && setPreviewUri(d.delivery_photo_url)}>
                      {d.delivery_photo_url ? (
                        <Image source={{ uri: d.delivery_photo_url }} style={styles.photoImg} />
                      ) : (
                        <AppText style={[adminType.label, { color: colors.textLight }]}>No delivery</AppText>
                      )}
                      <AppText style={[adminType.badge, { textAlign: 'center', marginTop: 4 }]}>Delivery</AppText>
                    </Pressable>
                  </View>

                  <AppText style={[adminType.title, { marginTop: spacing.md }]}>OTP times</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>
                    Pickup: {formatWhen(d.pickup_confirmed_at)}
                  </AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>
                    Delivery: {formatWhen(d.delivery_confirmed_at)}
                  </AppText>

                  <AppText style={[adminType.title, { marginTop: spacing.md }]}>Price breakdown</AppText>
                  <View style={styles.kv}>
                    <Row label="Delivery fee" value={formatMoney(d.base_price)} />
                    <Row label="Parcel protection" value={formatMoney(d.insurance_fee)} />
                    <Row label="Total paid" value={formatMoney(d.total_price)} bold />
                    <Row label="Platform commission" value={formatMoney(d.commission_amount)} />
                    <Row label="Driver earnings" value={formatMoney(d.driver_earnings)} />
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        <FullImageModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />
      </View>
    </SafeAreaView>
  );
};

function Row({ label, value, bold }) {
  return (
    <View style={styles.kvRow}>
      <AppText style={[adminType.label, { color: colors.textSecondary }]}>{label}</AppText>
      <AppText style={[adminType.body, { color: colors.textPrimary, fontWeight: bold ? '700' : '400' }]}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.adminHeader },
  root: { flex: 1, backgroundColor: colors.adminContent },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.adminCard,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.textPrimary },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 12,
  },
  filterItem: { marginRight: 4 },
  filterUnderline: { height: 2, backgroundColor: colors.primary, marginTop: 4, borderRadius: 1 },
  list: { flex: 1, paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  addrRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  moreBtn: { padding: 14, alignItems: 'center', backgroundColor: colors.primaryLight, margin: spacing.md, borderRadius: radius.adminCard },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetGrab: { alignItems: 'center', paddingVertical: 8 },
  grabBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  photoRow: { flexDirection: 'row', gap: 12 },
  photoBox: { flex: 1 },
  photoImg: { width: '100%', height: 100, borderRadius: radius.sm, backgroundColor: colors.border },
  kv: {
    backgroundColor: colors.background,
    borderRadius: radius.adminCard,
    padding: spacing.sm,
    marginTop: 8,
  },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});

export default Deliveries;
