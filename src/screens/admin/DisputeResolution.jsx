import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppText from '../../components/ui/AppText';
import AppButton from '../../components/ui/AppButton';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminLogoutIconButton from '../../components/admin/AdminLogoutIconButton';
import FullImageModal from '../../components/admin/FullImageModal';
import { getAuth } from '../../authStore';
import { getJson, patchJson } from '../../apiClient';
import { colors, spacing, radius, shadows, adminType } from '../../theme/theme';

const TYPE_LABELS = {
  lost_item: 'Lost item',
  damaged: 'Damaged',
  not_delivered: 'Not delivered',
  wrong_item: 'Wrong item',
  driver_behaviour: 'Driver behaviour',
  other: 'Other',
};

function hoursOpen(createdAt) {
  if (!createdAt) return 0;
  try {
    const diff = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, diff / 3600000);
  } catch {
    return 0;
  }
}

function formatHours(h) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${Math.floor(h)}h`;
}

const DisputeResolution = () => {
  const navigation = useNavigation();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [resolution, setResolution] = useState('refund_customer');
  const [notes, setNotes] = useState('');
  const [partialAmount, setPartialAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewUri, setPreviewUri] = useState(null);

  const load = useCallback(async () => {
    const auth = getAuth();
    if (!auth?.token) {
      setError('Not signed in');
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await getJson('/api/disputes?status=open', { token: auth.token });
      setDisputes(Array.isArray(data.disputes) ? data.disputes : []);
    } catch (e) {
      setError(e.message || 'Failed to load disputes');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openDetail = async (row) => {
    const auth = getAuth();
    if (!auth?.token) return;
    setDetailVisible(true);
    setDetail(null);
    setResolution('refund_customer');
    setNotes('');
    setPartialAmount('');
    setDetailLoading(true);
    try {
      const data = await getJson(`/api/disputes/${row.id}`, { token: auth.token });
      setDetail(data);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load dispute');
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setDetail(null);
  };

  const submit = async () => {
    if (!detail?.dispute?.id) return;
    const auth = getAuth();
    if (!auth?.token) return;

    const body = {
      resolution,
      resolution_notes: notes.trim() || undefined,
    };
    if (resolution === 'partial_refund') {
      const amt = parseFloat(partialAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        Alert.alert('Amount required', 'Enter a valid partial refund amount.');
        return;
      }
      body.refund_amount = amt;
    }

    setSubmitting(true);
    try {
      await patchJson(`/api/disputes/${detail.dispute.id}/resolve`, body, { token: auth.token });
      setToast('Decision sent');
      closeDetail();
      await load();
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to resolve');
    } finally {
      setSubmitting(false);
    }
  };

  const order = detail?.order;
  const dispute = detail?.dispute;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.root}>
        <AdminHeader mode="simple" title="Disputes" right={<AdminLogoutIconButton navigation={navigation} />} />

        {toast ? (
          <View style={styles.toast}>
            <AppText style={[adminType.body, { color: colors.textWhite }]}>{toast}</AppText>
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <AppText color="danger" style={{ padding: spacing.md }}>{error}</AppText>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {disputes.length === 0 ? (
              <AppText style={[adminType.body, { color: colors.textSecondary }]}>No open disputes.</AppText>
            ) : (
              disputes.map((row) => {
                const h = hoursOpen(row.created_at);
                const urgent = h > 12;
                return (
                  <Pressable
                    key={String(row.id)}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }, urgent && styles.cardUrgent]}
                    onPress={() => openDetail(row)}
                  >
                    <View style={styles.cardTop}>
                      <AppText style={[adminType.title, { color: colors.textPrimary }]}>#{row.id}</AppText>
                      <View style={[styles.pill, { backgroundColor: colors.dangerLight }]}>
                        <AppText style={[adminType.badge, { color: colors.danger }]}>
                          {TYPE_LABELS[row.dispute_type] || row.dispute_type}
                        </AppText>
                      </View>
                    </View>
                    <AppText style={[adminType.body, { color: colors.textSecondary, marginTop: 4 }]}>{row.order_number}</AppText>
                    <AppText style={[adminType.body, { color: colors.textPrimary, marginTop: 6 }]}>
                      {row.customer_name} vs {row.driver_name || 'Driver'}
                    </AppText>
                    <AppText style={[adminType.label, { color: urgent ? colors.danger : colors.textLight, marginTop: 6 }]}>
                      Open {formatHours(h)} · {urgent ? 'Needs attention' : 'In SLA'}
                    </AppText>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )}

        <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={closeDetail}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />
            <View style={styles.sheet}>
              <View style={styles.sheetTop}>
                <Pressable onPress={closeDetail} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="chevron-back" size={22} color={colors.textWhite} />
                  <AppText style={[adminType.title, { color: colors.textWhite }]}>
                    Dispute #{dispute?.id || '—'}
                  </AppText>
                </Pressable>
              </View>

              {detailLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 40 }} />
              ) : detail && dispute && order ? (
                <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                  {hoursOpen(dispute.created_at) > 12 ? (
                    <View style={styles.banner}>
                      <AppText style={[adminType.body, { color: colors.danger, fontWeight: '700' }]}>
                        Resolve within {Math.max(0, 24 - Math.floor(hoursOpen(dispute.created_at)))}h — over 12h open
                      </AppText>
                    </View>
                  ) : null}

                  <AppText style={[adminType.title, { marginBottom: 8 }]}>Evidence</AppText>
                  <View style={styles.photoRow}>
                    <Pressable style={styles.photoBox} onPress={() => order.pickup_photo_url && setPreviewUri(order.pickup_photo_url)}>
                      {order.pickup_photo_url ? (
                        <Image source={{ uri: order.pickup_photo_url }} style={styles.photoImg} />
                      ) : (
                        <View style={[styles.photoImg, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                          <AppText style={[adminType.label, { color: colors.textLight, textAlign: 'center' }]}>No pickup</AppText>
                        </View>
                      )}
                      <AppText style={[adminType.badge, { textAlign: 'center', marginTop: 4 }]}>Pickup</AppText>
                    </Pressable>
                    <Pressable style={styles.photoBox} onPress={() => order.delivery_photo_url && setPreviewUri(order.delivery_photo_url)}>
                      {order.delivery_photo_url ? (
                        <Image source={{ uri: order.delivery_photo_url }} style={styles.photoImg} />
                      ) : (
                        <View style={[styles.photoImg, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                          <AppText style={[adminType.label, { color: colors.textLight, textAlign: 'center' }]}>No delivery</AppText>
                        </View>
                      )}
                      <AppText style={[adminType.badge, { textAlign: 'center', marginTop: 4 }]}>Delivery</AppText>
                    </Pressable>
                  </View>

                  <AppText style={[adminType.title, { marginTop: spacing.md }]}>Customer claim</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary, marginTop: 4 }]}>{dispute.description}</AppText>

                  <AppText style={[adminType.title, { marginTop: spacing.md }]}>Parties</AppText>
                  <AppText style={[adminType.body, { color: colors.textPrimary }]}>
                    Customer: {detail.customer?.full_name}
                  </AppText>
                  <AppText style={[adminType.body, { color: colors.textSecondary }]}>
                    Driver: {detail.driver?.full_name || '—'}
                  </AppText>
                  <AppText style={[adminType.label, { color: colors.textSecondary, marginTop: 6 }]}>
                    Order {order.order_number} · {TYPE_LABELS[dispute.dispute_type] || dispute.dispute_type}
                  </AppText>

                  <AppText style={[adminType.title, { marginTop: spacing.lg, marginBottom: 8 }]}>Resolution</AppText>
                  {[
                    { value: 'refund_customer', label: 'Refund customer' },
                    { value: 'no_refund', label: 'No refund' },
                    { value: 'partial_refund', label: 'Partial refund' },
                  ].map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={styles.radioRow}
                      onPress={() => setResolution(opt.value)}
                    >
                      <View style={styles.radioOuter}>
                        {resolution === opt.value ? <View style={styles.radioInner} /> : null}
                      </View>
                      <AppText style={[adminType.body, { color: colors.textPrimary, flex: 1 }]}>{opt.label}</AppText>
                    </Pressable>
                  ))}

                  {resolution === 'partial_refund' ? (
                    <TextInput
                      style={styles.amountIn}
                      placeholder="Refund amount (R)"
                      placeholderTextColor={colors.textLight}
                      keyboardType="decimal-pad"
                      value={partialAmount}
                      onChangeText={setPartialAmount}
                    />
                  ) : null}

                  <AppText style={[adminType.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>Notes</AppText>
                  <TextInput
                    style={styles.notesIn}
                    placeholder="Add notes for the record…"
                    placeholderTextColor={colors.textLight}
                    multiline
                    value={notes}
                    onChangeText={setNotes}
                  />

                  <AppButton label="Send decision" onPress={submit} loading={submitting} style={{ marginTop: spacing.md }} />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.adminHeader },
  root: { flex: 1, backgroundColor: colors.adminContent },
  toast: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.adminCard,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardUrgent: { borderColor: colors.dangerLight },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '94%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTop: {
    backgroundColor: colors.adminHeader,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  banner: {
    backgroundColor: colors.dangerLight,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  photoRow: { flexDirection: 'row', gap: 12 },
  photoBox: { flex: 1 },
  photoImg: { width: '100%', height: 110, borderRadius: radius.sm, backgroundColor: colors.border },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  amountIn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  notesIn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    minHeight: 88,
    padding: 10,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.textPrimary,
  },
});

export default DisputeResolution;
