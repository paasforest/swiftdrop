import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { colors, spacing, radius } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

function formatAppliedDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

function regLabel(t) {
  if (t === 'uber_bolt') return 'Uber / Bolt';
  if (t === 'new_driver') return 'New driver';
  return String(t || '—');
}

const Thumb = ({ uri, label }) => (
  <View style={styles.thumbWrap}>
    <Text style={styles.thumbLabel}>{label}</Text>
    {uri ? (
      <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
    ) : (
      <View style={styles.thumbPlaceholder}>
        <Text style={styles.thumbPlaceholderText}>—</Text>
      </View>
    )}
  </View>
);

const DriverReview = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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

  useEffect(() => {
    loadList();
  }, [loadList]);

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

  const handleApprove = async () => {
    if (!detail?.user_id) return;
    const auth = getAuth();
    if (!auth?.token) return;
    setActionBusy(true);
    setSuccessMsg(null);
    try {
      await postJson(`/api/admin/drivers/${detail.user_id}/approve`, {}, { token: auth.token });
      setSuccessMsg('Driver approved — they will receive an SMS notification');
      setDetail(null);
      setSelectedId(null);
      await loadList();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      Alert.alert('Error', e.message || 'Approval failed');
    } finally {
      setActionBusy(false);
    }
  };

  const openRejectModal = () => {
    setRejectReason('');
    setRejectModalVisible(true);
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
      await postJson(
        `/api/admin/drivers/${detail.user_id}/reject`,
        { reason: r },
        { token: auth.token }
      );
      setRejectModalVisible(false);
      setSuccessMsg('Application rejected');
      setDetail(null);
      setSelectedId(null);
      await loadList();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      Alert.alert('Error', e.message || 'Reject failed');
    } finally {
      setActionBusy(false);
    }
  };

  const d = detail;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver applications</Text>
        {successMsg ? <Text style={styles.successBanner}>{successMsg}</Text> : null}
      </View>

      <View style={styles.content}>
        <View style={styles.leftCol}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : listError ? (
            <Text style={styles.errText}>{listError}</Text>
          ) : (
            <ScrollView>
              {list.map((item) => (
                <TouchableOpacity
                  key={String(item.user_id)}
                  style={[
                    styles.driverCard,
                    selectedId === item.user_id && styles.driverCardSelected,
                  ]}
                  onPress={() => loadDetail(item.user_id)}
                >
                  <Text style={styles.driverName}>{item.full_name}</Text>
                  <Text style={styles.driverPhone}>{item.phone}</Text>
                  <Text style={styles.driverMeta}>{regLabel(item.registration_type)}</Text>
                  <Text style={styles.driverDate}>Applied: {formatAppliedDate(item.applied_at)}</Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {list.length === 0 && !loading ? (
                <Text style={styles.emptyText}>No pending applications.</Text>
              ) : null}
            </ScrollView>
          )}
        </View>

        <View style={styles.rightCol}>
          {!selectedId && !detailLoading && (
            <Text style={styles.hint}>Select a driver to review details</Text>
          )}
          {detailLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}
          {detailError ? <Text style={styles.errText}>{detailError}</Text> : null}

          {d && !detailLoading && (
            <ScrollView style={styles.detailScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>Application detail</Text>
                <TouchableOpacity onPress={() => { setSelectedId(null); setDetail(null); }} accessibilityLabel="Close">
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.rowTop}>
                {d.selfie_url ? (
                  <Image source={{ uri: d.selfie_url }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.profilePhotoPh} />
                )}
                <View style={styles.basicBlock}>
                  <Text style={styles.driverNameLarge}>{d.full_name}</Text>
                  <Text style={styles.metaLine}>{d.email}</Text>
                  <Text style={styles.metaLine}>{d.phone}</Text>
                  <Text style={styles.metaLine}>Registration: {regLabel(d.registration_type)}</Text>
                  <Text style={styles.metaLine}>Applied: {formatAppliedDate(d.applied_at)}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Documents & photos</Text>
              <View style={styles.thumbGrid}>
                <Thumb uri={d.selfie_url} label="Profile (selfie)" />
                <Thumb uri={d.id_document_url} label="ID document" />
                <Thumb uri={d.license_url} label="Driver licence" />
                <Thumb uri={d.vehicle_registration_url} label="Vehicle registration" />
                <Thumb uri={d.license_disc_url} label="Licence disc" />
                <Thumb uri={d.saps_clearance_url} label="SAPS clearance" />
                <Thumb uri={d.uber_profile_screenshot_url} label="Uber/Bolt screenshot" />
                <Thumb uri={d.vehicle_photo_url} label="Vehicle (main)" />
                <Thumb uri={d.vehicle_photo_back_url} label="Vehicle back" />
                <Thumb uri={d.vehicle_photo_side_url} label="Vehicle side" />
              </View>

              <Text style={styles.sectionTitle}>Vehicle</Text>
              <View style={styles.vehicleBox}>
                <Text style={styles.vehLine}>Make: {d.vehicle_make || '—'}</Text>
                <Text style={styles.vehLine}>Model: {d.vehicle_model || '—'}</Text>
                <Text style={styles.vehLine}>Year: {d.vehicle_year ?? '—'}</Text>
                <Text style={styles.vehLine}>Colour: {d.vehicle_color || '—'}</Text>
                <Text style={styles.vehLine}>Plate: {d.vehicle_plate || '—'}</Text>
              </View>

              <TouchableOpacity
                style={[styles.approveBtn, actionBusy && styles.btnDisabled]}
                onPress={handleApprove}
                disabled={actionBusy}
              >
                <Text style={styles.approveBtnText}>Approve Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectBtn, actionBusy && styles.btnDisabled]}
                onPress={openRejectModal}
                disabled={actionBusy}
              >
                <Text style={styles.rejectBtnText}>Reject Application</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      </View>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View style={styles.rejectBackdrop}>
          <View style={styles.rejectCard}>
            <Text style={styles.rejectTitle}>Rejection reason</Text>
            <TextInput
              style={styles.rejectInput}
              multiline
              placeholder="Explain why the application is rejected…"
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={styles.rejectActions}>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.rejectCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectConfirm} onPress={submitReject}>
                <Text style={styles.rejectConfirmText}>Submit reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    minHeight: height,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  successBanner: {
    marginTop: 8,
    color: colors.success,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    flexDirection: width > 640 ? 'row' : 'column',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  leftCol: {
    width: width > 640 ? 300 : '100%',
    maxHeight: width > 640 ? height - 120 : 220,
    marginRight: width > 640 ? 16 : 0,
  },
  rightCol: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 200,
  },
  driverCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  driverName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  driverPhone: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  driverMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  driverDate: { fontSize: 11, color: colors.textLight, marginTop: 4 },
  pendingBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: { color: colors.warning, fontWeight: '700', fontSize: 12 },
  emptyText: { color: colors.textSecondary, padding: 16 },
  errText: { color: colors.danger, padding: 12 },
  hint: { padding: 20, color: colors.textLight },
  detailScroll: { flex: 1, padding: 16 },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  rowTop: { flexDirection: 'row', marginBottom: 16 },
  profilePhoto: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.border },
  profilePhotoPh: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.border },
  basicBlock: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  driverNameLarge: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  metaLine: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 8, color: colors.textPrimary },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: '30%', minWidth: 90, marginBottom: 12 },
  thumbLabel: { fontSize: 10, color: colors.textSecondary, marginBottom: 4 },
  thumbImg: { width: '100%', height: 72, borderRadius: 8, backgroundColor: colors.background },
  thumbPlaceholder: {
    width: '100%',
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: { color: colors.textLight },
  vehicleBox: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  vehLine: { fontSize: 14, color: colors.textPrimary, marginBottom: 4 },
  approveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  approveBtnText: { color: colors.textWhite, fontWeight: '800', fontSize: 16 },
  rejectBtn: {
    backgroundColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectBtnText: { color: colors.textWhite, fontWeight: '800', fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
  rejectBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayMedium,
    justifyContent: 'center',
    padding: 20,
  },
  rejectCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
  },
  rejectTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10, color: colors.textPrimary },
  rejectInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 100,
    padding: 10,
    textAlignVertical: 'top',
    color: colors.textPrimary,
  },
  rejectActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    gap: 16,
  },
  rejectCancel: { color: colors.textSecondary, fontWeight: '700', padding: 8 },
  rejectConfirm: {
    backgroundColor: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  rejectConfirmText: { color: colors.textWhite, fontWeight: '800' },
});

export default DriverReview;
