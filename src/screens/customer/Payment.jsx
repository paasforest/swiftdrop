import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { WebView } from 'react-native-webview';
import { colors, spacing, radius, shadows } from '../../theme/theme';
import { AppButton, AppText } from '../../components/ui';

const { width, height } = Dimensions.get('window');

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

const Payment = ({ navigation, route }) => {
  const params = route?.params || {};
  const {
    pickup_address,
    dropoff_address,
    delivery_tier,
    parcel_value,
    insurance_selected,
    delivery_total,
    delivery_base_price,
    delivery_insurance_fee,
  } = params;

  const total = useMemo(() => {
    if (delivery_total != null) return delivery_total;
    return null;
  }, [delivery_total]);

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('payfast');
  const auth = getAuth();
  const [payfastModalVisible, setPayfastModalVisible] = useState(false);
  const [payfastUrl, setPayfastUrl] = useState(null);
  const [payfastReturnUrl, setPayfastReturnUrl] = useState(null);
  const [payfastCancelUrl, setPayfastCancelUrl] = useState(null);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState(null);
  const [payfastLoading, setPayfastLoading] = useState(true);
  const payHandledRef = useRef(false);

  const [walletBalance, setWalletBalance] = useState(0);
  const [walletFormatted, setWalletFormatted] = useState('R0.00');
  const [walletBalanceLoading, setWalletBalanceLoading] = useState(true);
  const [walletBalanceError, setWalletBalanceError] = useState(null);

  const fetchWalletBalance = useCallback(async () => {
    if (!auth?.token) {
      setWalletBalance(0);
      setWalletFormatted('R0.00');
      setWalletBalanceLoading(false);
      return;
    }
    setWalletBalanceLoading(true);
    setWalletBalanceError(null);
    try {
      const data = await getJson('/api/wallet/balance', { token: auth.token });
      const b = Number(data.balance);
      setWalletBalance(Number.isFinite(b) ? b : 0);
      setWalletFormatted(typeof data.formatted === 'string' ? data.formatted : formatMoney(b));
    } catch (e) {
      setWalletBalanceError(e.message || 'Could not load wallet');
      setWalletBalance(0);
      setWalletFormatted('R0.00');
    } finally {
      setWalletBalanceLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  const closePayfast = () => {
    setPayfastModalVisible(false);
    setPaymentMessage('Payment cancelled');
    setPayfastUrl(null);
    setPayfastReturnUrl(null);
    setPayfastCancelUrl(null);
    setPendingOrderId(null);
    payHandledRef.current = false;
  };

  const navigateToDriverMatching = useCallback(
    (orderId, totalPrice) => {
      navigation.navigate('DriverMatching', {
        orderId: orderId,
        pickup_address,
        dropoff_address,
        delivery_tier,
        total_price: totalPrice != null ? totalPrice : delivery_total,
      });
    },
    [navigation, pickup_address, dropoff_address, delivery_tier, delivery_total]
  );

  const handlePayfastSuccess = () => {
    if (payHandledRef.current) return;
    payHandledRef.current = true;
    setPayfastModalVisible(false);
    const orderId = pendingOrderId;
    setPendingOrderId(null);
    if (orderId) navigateToDriverMatching(orderId, total);
  };

  const handlePayfastNavStateChange = (navState) => {
    const url = navState?.url ? String(navState.url) : '';
    if (!url) return;

    if (payfastReturnUrl && url.startsWith(payfastReturnUrl)) {
      handlePayfastSuccess();
      return;
    }

    if (payfastCancelUrl && url.startsWith(payfastCancelUrl)) {
      closePayfast();
      return;
    }
  };

  const paymentMethods = useMemo(
    () => [
      {
        id: 'payfast',
        name: 'PayFast',
        ionicon: 'card-outline',
        description: 'Pay with card/e-wallet',
      },
      {
        id: 'card',
        name: 'Credit/Debit Card',
        ionicon: 'card-outline',
        description: 'Visa, Mastercard, etc.',
      },
      {
        id: 'eft',
        name: 'Instant EFT',
        ionicon: 'phone-portrait-outline',
        description: 'Bank transfer',
      },
      {
        id: 'wallet',
        name: 'SwiftDrop Wallet',
        ionicon: 'wallet-outline',
        description: '',
        isWallet: true,
      },
    ],
    []
  );

  const orderTotalNumeric = useMemo(() => {
    if (delivery_total == null) return null;
    const t = Number(delivery_total);
    return Number.isFinite(t) ? t : null;
  }, [delivery_total]);

  const walletHasEnough =
    orderTotalNumeric != null && walletBalance >= orderTotalNumeric;
  const walletOptionDisabled =
    walletBalanceLoading || orderTotalNumeric == null || !walletHasEnough;

  useEffect(() => {
    if (selectedPaymentMethod === 'wallet' && walletOptionDisabled) {
      setSelectedPaymentMethod('payfast');
    }
  }, [selectedPaymentMethod, walletOptionDisabled]);

  const handlePaymentMethodSelect = (methodId) => {
    if (methodId === 'wallet' && walletOptionDisabled) return;
    setSelectedPaymentMethod(methodId);
  };

  const handlePay = async () => {
    try {
      if (!auth?.token) {
        navigation.navigate('Login');
        return;
      }

      if (selectedPaymentMethod === 'wallet') {
        if (orderTotalNumeric == null || walletBalance < orderTotalNumeric) {
          alert('Insufficient wallet balance for this order.');
          return;
        }
      }

      const res = await postJson(
        '/api/orders',
        {
          pickup_address: params.pickup_address,
          pickup_lat: params.pickup_lat,
          pickup_lng: params.pickup_lng,
          dropoff_address: params.dropoff_address,
          dropoff_lat: params.dropoff_lat,
          dropoff_lng: params.dropoff_lng,
          parcel_type: params.parcel_type,
          parcel_size: params.parcel_size,
          parcel_value: params.parcel_value,
          special_handling: params.special_handling,
          delivery_tier: params.delivery_tier,
          insurance_selected: params.insurance_selected,
          payment_method: selectedPaymentMethod,
        },
        { token: auth.token }
      );

      const orderId = res?.id;

      if (!orderId) throw new Error('Could not create order');

      // Gap 2: PayFast in-app WebView (wait for return_url)
      if (selectedPaymentMethod === 'payfast') {
        setPaymentMessage(null);
        setPendingOrderId(orderId);
        setPayfastLoading(true);

        const pay = await postJson(
          '/api/payments/payfast/initiate',
          {
            order_id: orderId,
            amount: res?.total_price ?? total,
            item_name: `SwiftDrop ${res?.order_number ?? `Order ${orderId}`}`,
          },
          { token: auth.token }
        );

        if (!pay?.payment_url) {
          alert(pay?.error || 'Could not initiate PayFast');
          setPayfastLoading(false);
          return;
        }

        setPayfastUrl(String(pay.payment_url));
        setPayfastReturnUrl(pay.return_url ? String(pay.return_url) : null);
        setPayfastCancelUrl(pay.cancel_url ? String(pay.cancel_url) : null);
        setPayfastModalVisible(true);
        setPayfastLoading(false);
        return;
      }

      // Wallet payment: refresh balance then driver matching screen.
      if (selectedPaymentMethod === 'wallet') {
        await fetchWalletBalance();
        navigateToDriverMatching(orderId, res?.total_price ?? total);
        return;
      }

      navigateToDriverMatching(orderId, res?.total_price ?? total);
    } catch (e) {
      console.error('Pay error:', e.message);
      alert(e.message || 'Payment failed');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const totalPriceText = total != null ? formatMoney(total) : '—';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </TouchableOpacity>
          <AppText variant="h3" color="textPrimary">
            Payment
          </AppText>
          <View style={styles.placeholder} />
        </View>

        {paymentMessage ? (
          <View style={styles.paymentMessageBox}>
            <Text style={styles.paymentMessageText}>{paymentMessage}</Text>
          </View>
        ) : null}

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.addressSection}>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>From:</Text>
              <Text style={styles.addressText}>{pickup_address || 'Pickup'}</Text>
            </View>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>To:</Text>
              <Text style={styles.addressText}>{dropoff_address || 'Delivery'}</Text>
            </View>
          </View>

          <View style={styles.deliveryInfo}>
            <Text style={styles.deliveryType}>{delivery_tier ? delivery_tier[0].toUpperCase() + delivery_tier.slice(1) : 'Delivery'}</Text>
            <Text style={styles.estimatedTime}>⏱ Pricing from your route</Text>
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.priceBreakdown}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery fee</Text>
            <Text style={styles.priceValue}>{delivery_base_price != null ? formatMoney(delivery_base_price) : '—'}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Insurance</Text>
            <Text style={styles.priceValue}>
              {delivery_insurance_fee != null ? formatMoney(delivery_insurance_fee) : '—'}
            </Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{totalPriceText}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Pay With</Text>
          
          {paymentMethods.map((method) => {
            const isWallet = method.isWallet;
            const disabled = isWallet && walletOptionDisabled;
            const walletDesc = isWallet
              ? walletBalanceLoading
                ? 'Loading wallet balance…'
                : walletBalanceError
                  ? walletBalanceError
                  : walletHasEnough
                    ? `— ${walletFormatted} available`
                    : 'Insufficient balance'
              : method.description;

            return (
              <TouchableOpacity
                key={method.id}
                activeOpacity={disabled ? 1 : 0.7}
                disabled={disabled}
                style={[
                  styles.paymentMethod,
                  selectedPaymentMethod === method.id && !disabled && styles.paymentMethodSelected,
                  disabled && styles.paymentMethodDisabled,
                ]}
                onPress={() => handlePaymentMethodSelect(method.id)}
              >
                <View style={styles.paymentLeft}>
                  <Ionicons
                    name={method.ionicon}
                    size={26}
                    color={disabled ? colors.textLight : colors.primary}
                    style={styles.paymentIcon}
                  />
                  <View style={styles.paymentInfo}>
                    <View style={styles.paymentNameRow}>
                      <Text
                        style={[
                          styles.paymentName,
                          disabled && styles.paymentTextMuted,
                        ]}
                      >
                        {method.name}
                      </Text>
                      {isWallet && walletHasEnough && !walletBalanceLoading ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={colors.success}
                          style={styles.walletCheckIcon}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.paymentDescription,
                        disabled && styles.paymentTextMuted,
                        isWallet && walletHasEnough && !walletBalanceLoading && styles.walletAvailableText,
                      ]}
                    >
                      {walletDesc}
                    </Text>
                    {isWallet && walletBalanceLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.walletLoadingIndicator}
                      />
                    ) : null}
                  </View>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    disabled && styles.radioCircleDisabled,
                  ]}
                >
                  {selectedPaymentMethod === method.id && !disabled ? (
                    <View style={styles.radioSelected} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Parking Notice */}
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={22} color={colors.warning} style={styles.noticeIcon} />
          <Text style={styles.noticeText}>
            Please ensure parking is available at the pickup address when the driver arrives.
          </Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.bottomContainer}>
        <AppButton
          label={`Pay ${totalPriceText} & request driver`}
          variant="accent"
          onPress={handlePay}
        />
      </View>

      <Modal
        visible={payfastModalVisible}
        animationType="slide"
        onRequestClose={closePayfast}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.payfastHeader}>
            <Text style={styles.payfastHeaderTitle}>PayFast Payment</Text>
            <TouchableOpacity style={styles.payfastCloseBtn} onPress={closePayfast}>
              <Ionicons name="close" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>

          {payfastLoading && (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalLoadingText}>Loading payment…</Text>
            </View>
          )}

          {payfastUrl ? (
            <WebView
              source={{ uri: payfastUrl }}
              onNavigationStateChange={handlePayfastNavStateChange}
              startInLoadingState
              style={styles.webview}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    width,
    minHeight: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  placeholder: {
    width: 24,
  },
  orderSummary: {
    backgroundColor: colors.background,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    ...shadows.card,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  addressSection: {
    marginBottom: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  addressLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 50,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  deliveryType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  estimatedTime: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  priceBreakdown: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  priceLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  paymentSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  paymentMethodSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentMethodDisabled: {
    opacity: 0.55,
    backgroundColor: colors.surface,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    marginRight: spacing.sm,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  walletCheckIcon: {
    marginLeft: 6,
  },
  paymentDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  paymentTextMuted: {
    color: colors.textLight,
  },
  walletAvailableText: {
    color: colors.success,
    fontWeight: '600',
  },
  walletLoadingIndicator: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleDisabled: {
    borderColor: colors.textLight,
    opacity: 0.7,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: colors.warningLight,
    margin: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  noticeIcon: {
    marginRight: spacing.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bottomContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  paymentMessageBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  paymentMessageText: {
    color: colors.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  payfastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 18,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  payfastHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  payfastCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoading: {
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
});

export default Payment;
