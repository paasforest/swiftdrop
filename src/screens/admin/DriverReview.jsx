import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../../components/ui/AppText';
import AppButton from '../../components/ui/AppButton';
import AdminHeader from '../../components/admin/AdminHeader';
import FullImageModal from '../../components/admin/FullImageModal';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { colors, spacing, radius, shadows, adminType } from '../../theme/theme';

function timeAgo(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return '—';
  }
}

function regLabel(t) {
  if (t === 'uber_bolt') return 'Uber / Bolt';
  if (t === 'new_driver') return 'New driver';
  return String(t || '—');
}

function initials(name) {
  if (!name) return '?';
  return String(name)
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const DOC_SLOTS = [
  { key: 'selfie', label: 'Profile', field: 'selfie_url' },
  { key: 'id', label: 'ID', field: 'id_document_url' },
  { key: 'lic', label: 'Licence', field: 'license_url' },
  { key: 'veh', label: 'Vehicle reg', field: 'vehicle_registration_url' },
];

const DriverReview = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [previewUri, setPreviewUri] = useState(null);

  const loadList = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setListError('Not signed in');
      setLoading(false);
      return;
    }
    setListError(null);
    setLoading(true);
    try {
      const data = await getJson('/api/admin/drivers?status=pending', { token: auth.token });
      setList(Array.isArray(data.drivers) ? data.drivers : []);
    } catch (e) {
      setListError(e.message || 'Failed to load applications');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadList();
      const id = route.params?.preSelectedUserId;
      if (id) {
        loadDetail(id);
        navigation.setParams({ preSelectedUserId: undefined });
      }
    }, [loadList, route.params?.preSelectedUserId, navigation])
  );

  const loadDetail = async (userId) => {
    const auth = getAuth();
    if (!auth?.token) return;
    setSelectedId(userId);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await getJson(`/api/admin/drivers/${userId}`, { token: auth.token });
      setDetail(data.driver || null);
    } catch (e) {
      setDetailError(e.message || 'Failed to load driver');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const handleApprove = async () => {
    if (!detail?.user_id) return;
    const auth = getAuth();
    if (!auth?.token) return;
    setActionBusy(true);
    try {
      await postJson(`/api/admin/drivers/${detail.user_id}/approve`, {}, { token: auth.token });
      setToast('Driver approved');
      closeDetail();
      await loadList();
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      Alert.alert('Error', e.message || 'Approval failed');
    } finally {
      setActionBusy(false);
    }
  };

  const submitReject = async () => {
    if (!detail?.user_id) return;
    const r = rejectReason.trim();
    if (!r) {
      Alert.alert('Reason required', 'Please enter a rejection reason.');
      return;
    }
    const auth = getAuth();
    if (!auth?.token) return;
    setActionBusy(true);
    try {
      await postJson(`/api/admin/drivers/${detail.user_id}/reject`, { reason: r }, { token: auth.token });
      setRejectModalVisible(false);
      setToast('Application rejected');
      closeDetail();
      await loadList();
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      Alert.alert('Error', e.message || 'Reject failed');
    } finally {
      setActionBusy(false);
    }
  };

  const d = detail;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.root}>
        <AdminHeader mode="simple" title="Driver applications" />

        {toast ? (
          <View style={styles.toast}>
            <AppText style={[adminType.body, { color: colors.textWhite }]}>{toast}</AppText>
          </View>
        ) : null}

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : listError ? (
            <AppText color="danger">{listError}</AppText>
          ) : (
            list.map((item) => (
              <Pressable
                key={String(item.user_id)}
                style={({ pressed }) => [styles.card, selectedId === item.user_id && styles.cardOn, pressed && { opacity: 0.92 }]}
                onPress={() => loadDetail(item.user_id)}
              >
                <View style={styles.avatarSm}>
                  <AppText style={[adminType.badge, { color: colors.primary }]}>{initials(item.full_name)}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={[adminType.title, { color: colors.textPrimary }]}>{item.full_name}</AppText>
                  <AppText style={[adminType.body, { color: colors.textSecondary }]}>{item.phone}</AppText>
                  <View style={styles.rowBadges}>
                    <View style={[styles.badge, item.registration_type === 'uber_bolt' ? styles.badgeBlue : styles.badgeGrey]}>
                      <AppText style={[adminType.badge, { color: item.registration_type === 'uber_bolt' ? colors.primary : colors.textSecondary }]}>
                        {regLabel(item.registration_type)}
                      </AppText>
                    </View>
                    <AppText style={[adminType.label, { color: colors.textLight }]}>{timeAgo(item.applied_at)}</AppText>
                    <View style={styles.badgeAmber}>
                      <AppText style={[adminType.badge, { color: colors.warning }]}>Pending</AppText>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))
          )}
          {!loading && list.length === 0 && !listError ? (
            <AppText style={[adminType.body, { color: colors.textSecondary }]}>No pending applications.</AppText>
          ) : null}
        </ScrollView>

        <Modal visible={!!selectedId} animationType="slide" transparent onRequestClose={closeDetail}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={styles.sheetScrim} onPress={closeDetail} />
            <View style={styles.sheet}>
              <View style={styles.sheetGrab}>
                <View style={styles.grabBar} />
              </View>
              {detailLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
              ) : detailError ? (
                <AppText color="danger" style={{ padding: spacing.md }}>{detailError}</AppText>
              ) : d ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetInner}>
                  <View style={styles.sheetHead}>
                    <AppText style={[adminType.title, { color: colors.textPrimary, fontSize: 16 }]}>Application detail</AppText>
                    <Pressable onPress={closeDetail} hitSlop={12}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </Pressable>
                  </View>

                  <View style={styles.profileRow}>
                    {d.selfie_url ? (
                      <Image source={{ uri: d.selfie_url }} style={styles.bigPhoto} />
                    ) : (
                      <View style={[styles.bigPhoto, styles.ph]}>
                        <AppText style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>{initials(d.full_name)}</AppText>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>{d.full_name}</AppText>
                      <AppText style={[adminType.body, { color: colors.textSecondary, marginTop: 4 }]}>{d.phone}</AppText>
                      <AppText style={[adminType.body, { color: colors.textSecondary }]}>{d.email}</AppText>
                      <View style={[styles.badge, { marginTop: 8, alignSelf: 'flex-start' }, d.registration_type === 'uber_bolt' ? styles.badgeBlue : styles.badgeGrey]}>
                        <AppText style={[adminType.badge, { color: d.registration_type === 'uber_bolt' ? colors.primary : colors.textSecondary }]}>
                          {regLabel(d.registration_type)}
                        </AppText>
                      </View>
                    </View>
                  </View>

                  <AppText style={[adminType.title, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Documents</AppText>
                  <View style={styles.docGrid}>
                    {DOC_SLOTS.map((slot) => {
                      const uri = d[slot.field];
                      const ok = !!uri;
                      return (
                        <Pressable
                          key={slot.key}
                          style={[styles.docCell, ok ? styles.docOk : styles.docMiss]}
                          onPress={() => uri && setPreviewUri(uri)}
                          disabled={!uri}
                        >
                          {ok ? (
                            <>
                              <Image source={{ uri }} style={styles.docImg} resizeMode="cover" />
                              <View style={styles.check}>
                                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                              </View>
                            </>
                          ) : (
                            <AppText style={[adminType.label, { color: colors.textSecondary, textAlign: 'center' }]}>{slot.label}</AppText>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  <AppText style={[adminType.title, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Vehicle details</AppText>
                  <View style={styles.kv}>
                    {[
                      ['Make', d.vehicle_make],
                      ['Model', d.vehicle_model],
                      ['Year', d.vehicle_year],
                      ['Colour', d.vehicle_color],
                      ['Plate', d.vehicle_plate],
                    ].map(([k, v]) => (
                      <View key={k} style={styles.kvRow}>
                        <AppText style={[adminType.label, { color: colors.textSecondary }]}>{k}</AppText>
                        <AppText style={[adminType.body, { color: colors.textPrimary }]}>{v ?? '—'}</AppText>
                      </View>
                    ))}
                  </View>

                  <AppButton variant="success" label="Approve driver" onPress={handleApprove} loading={actionBusy} style={{ marginTop: spacing.md }} />
                  <AppButton
                    variant="outlineDanger"
                    label="Reject application"
                    onPress={() => { setRejectReason(''); setRejectModalVisible(true); }}
                    disabled={actionBusy}
                    style={{ marginTop: spacing.sm }}
                  />
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        <Modal visible={rejectModalVisible} transparent animationType="fade">
          <View style={styles.rejectBackdrop}>
            <View style={styles.rejectCard}>
              <AppText style={[adminType.title, { marginBottom: spacing.sm }]}>Rejection reason</AppText>
              <TextInput
                style={styles.rejectInput}
                multiline
                placeholder="Explain why the application is rejected…"
                placeholderTextColor={colors.textLight}
                value={rejectReason}
                onChangeText={setRejectReason}
              />
              <View style={styles.rejectActions}>
                <AppButton variant="outline" label="Cancel" fullWidth={false} onPress={() => setRejectModalVisible(false)} style={{ flex: 1, minWidth: 100 }} />
                <AppButton variant="danger" label="Submit reject" fullWidth={false} onPress={submitReject} loading={actionBusy} style={{ flex: 1, minWidth: 120 }} />
              </View>
            </View>
          </View>
        </Modal>

        <FullImageModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.adminHeader },
  root: { flex: 1, backgroundColor: colors.adminContent },
  scroll: { flex: 1 },
  scrollPad: { padding: spacing.md, paddingBottom: 32 },
  toast: {
    backgroundColor: colors.success,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardOn: { borderColor: colors.primary, borderWidth: 2 },
  avatarSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rowBadges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  badgeBlue: { backgroundColor: colors.primaryLight },
  badgeGrey: { backgroundColor: colors.background },
  badgeAmber: { backgroundColor: colors.warningLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetScrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetGrab: { alignItems: 'center', paddingVertical: 8 },
  grabBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetInner: { paddingHorizontal: spacing.md, paddingBottom: 32 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  profileRow: { flexDirection: 'row', gap: spacing.md },
  bigPhoto: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.border },
  ph: { alignItems: 'center', justifyContent: 'center' },
  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  docCell: {
    width: '47%',
    height: 50,
    borderRadius: radius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docOk: { backgroundColor: colors.successLight },
  docMiss: { backgroundColor: colors.background },
  docImg: { width: '100%', height: '100%' },
  check: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.surface, borderRadius: 8 },
  kv: {
    backgroundColor: colors.background,
    borderRadius: radius.adminCard,
    padding: spacing.sm,
  },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rejectBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayMedium,
    justifyContent: 'center',
    padding: spacing.md,
  },
  rejectCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    minHeight: 100,
    padding: 10,
    textAlignVertical: 'top',
    color: colors.textPrimary,
    fontSize: 14,
  },
  rejectActions: { flexDirection: 'row', gap: 12, marginTop: spacing.md },
});

export default DriverReview;
