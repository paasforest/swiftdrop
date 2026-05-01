import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';
import { colors } from '../../theme/theme';
import ReportProblemModal, { ReportProblemButton, shouldShowReportProblem } from '../../components/customer/ReportProblem';
import DriverAvatar from '../../components/customer/DriverAvatar';
import { formatDriverVehicleLine } from '../../utils/formatDriverVehicleLine';
import {
  formatDriverRatingDeliveriesLine,
  normalizeDriverDeliveriesCompleted,
} from '../../utils/driverTrustDisplay';

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
  const [myDisputes, setMyDisputes] = useState([]);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);

  const [showReport, setShowReport] = useState(false);

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

        try {
          const d = await getJson('/api/disputes/my', { token: auth.token });
          if (!cancelled) setMyDisputes(Array.isArray(d.disputes) ? d.disputes : []);
        } catch {
          if (!cancelled) setMyDisputes([]);
        }
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

  const insuranceNum = order ? Number(order.insurance_fee) : 0;
  const showParcelProtection = Number.isFinite(insuranceNum) && insuranceNum > 0;

  const buildReceiptMessage = useCallback(() => {
    if (!order) return '';
    const when = formatDate(order.created_at);
    const base = Number(order.base_price);
    const ins = Number(order.insurance_fee);
    const total = Number(order.total_price);
    const insLine =
      Number.isFinite(ins) && ins > 0
        ? `Parcel protection: ${formatMoney(ins)}\n`
        : '';
    return `
SWIFTDROP DELIVERY RECEIPT
==========================
Order: #${order.order_number || order.id}
Date: ${when}

FROM: ${order.pickup_address || '-'}
TO: ${order.dropoff_address || '-'}

Parcel: ${order.parcel_type || '—'} — ${order.parcel_size || '—'}
Driver: ${order.driver_name || '-'}

PAYMENT SUMMARY
Delivery fee: ${formatMoney(base)}
${insLine}─────────────────
TOTAL PAID: ${formatMoney(total)}

Status: Delivered ✓
Thank you for using SwiftDrop!
`.trim();
  }, [order]);

  const handleDownloadReceipt = async () => {
    if (!order) return;
    try {
      const message = buildReceiptMessage();
      await Share.share({
        message,
        title: 'SwiftDrop Receipt',
      });
    } catch (e) {
      Alert.alert('Share failed', e?.message || 'Could not open share sheet.');
    }
  };

  const hasOpenDisputeForOrder = useMemo(() => {
    if (!order?.id) return false;
    return myDisputes.some(
      (d) =>
        Number(d.order_id) === Number(order.id) && ['open', 'in_review'].includes(String(d.status))
    );
  }, [myDisputes, order?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.hint}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="alert-circle-outline" size={22} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.title}>{error || 'Order not found'}</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const driverVehicleLine = formatDriverVehicleLine(order);
  const driverDeliveriesCount = normalizeDriverDeliveriesCompleted(
    order?.driver_deliveries_completed
  );

  const showReportCta = shouldShowReportProblem(order) && !hasOpenDisputeForOrder;

  return (
    <SafeAreaView style={[styles.container, styles.flexFill]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={showReportCta ? styles.scrollWithReport : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backArrowWrap} onPress={() => navigation.goBack()}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.section}>
          <View style={styles.orderTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNumber}>{order.order_number || `Order ${order.id}`}</Text>
              <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
            </View>
            {hasOpenDisputeForOrder ? (
              <View style={styles.disputeBadge}>
                <Text style={styles.disputeBadgeText}>Dispute open</Text>
              </View>
            ) : null}
          </View>
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
          <View style={styles.driverRow}>
            <DriverAvatar
              uri={order.driver_photo}
              name={order.driver_name || 'Driver'}
              size={56}
              deliveriesCompleted={driverDeliveriesCount}
            />
            <View style={styles.driverCol}>
              <Text style={styles.driverNameLarge}>{order.driver_name || '-'}</Text>
              {driverVehicleLine ? (
                <Text style={styles.driverVehicleSubline}>{driverVehicleLine}</Text>
              ) : null}
              <Text style={styles.driverTrustSubline}>
                {formatDriverRatingDeliveriesLine(order)}
              </Text>
              <View style={{ marginTop: 6 }}>
                <Stars rating={rating?.rating ?? order.driver_rating} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price breakdown</Text>
          <View style={styles.priceRow}>
            <Text style={styles.labelWide}>Delivery fee</Text>
            <Text style={styles.value}>{formatMoney(order.base_price)}</Text>
          </View>
          {showParcelProtection ? (
            <View style={styles.priceRow}>
              <Text style={styles.labelWide}>Parcel protection</Text>
              <Text style={styles.value}>{formatMoney(order.insurance_fee)}</Text>
            </View>
          ) : null}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={[styles.labelWide, { color: colors.textPrimary, fontWeight: '700' }]}>Total</Text>
            <Text style={[styles.value, { color: colors.textPrimary, fontWeight: '800' }]}>
              {formatMoney(order.total_price)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.receiptBtn} onPress={handleDownloadReceipt}>
            <Text style={styles.receiptBtnText}>Download Receipt</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {showReportCta ? (
        <View style={styles.reportBar}>
          <ReportProblemButton onPress={() => setShowReport(true)} />
        </View>
      ) : null}

      <ReportProblemModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        orderId={orderId}
        orderStatus={order?.status}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width,
    height,
  },
  scrollWithReport: {
    paddingBottom: 96,
  },
  reportBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
    color: colors.textSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 18,
  },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backBtnText: {
    color: colors.textWhite,
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
    backgroundColor: colors.textWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backArrowText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  section: {
    backgroundColor: colors.textWhite,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  orderDate: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
  },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  disputeBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  disputeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.warning,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
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
    color: colors.textSecondary,
    fontWeight: '600',
    width: 70,
  },
  labelWide: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  driverCol: {
    flex: 1,
    marginLeft: 14,
  },
  driverNameLarge: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  driverVehicleSubline: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  driverTrustSubline: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  photoSection: {
    backgroundColor: colors.textWhite,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
  },
  photo: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  photoPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: colors.textMuted,
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
    color: colors.warning,
  },
  starEmpty: {
    color: colors.textMuted,
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
    borderTopColor: colors.border,
  },
  receiptBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  receiptBtnText: {
    color: colors.textWhite,
    fontWeight: '900',
  },
});

export default OrderDetail;

