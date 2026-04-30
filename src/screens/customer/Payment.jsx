import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '../../authStore';
import { getJson, postJson } from '../../apiClient';
import { WebView } from 'react-native-webview';

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

const Payment = ({ navigation, route }) => {
  const params = route?.params || {};
  const {
    pickup_address,
    pickup_lat,
    pickup_lng,
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
      navigation.replace('OrderConfirmation', {
        orderId,
        pickup_address,
        dropoff_address,
        total_price: totalPrice != null ? totalPrice : delivery_total,
        delivery_tier,
        trip_type: params.trip_type || 'local',
      });
    },
    [
      navigation,
      pickup_address,
      dropoff_address,
      delivery_tier,
      delivery_total,
      params.trip_type,
    ]
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
          assigned_driver_route_id: params.driver_route_id || null,
          trip_type: params.trip_type || 'local',
        },
        { token: auth.token }
      );

      const orderId = res?.id;
      if (!orderId) throw new Error('Could not create order');

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

  const totalPriceText = total != null ? formatMoney(total) : '—';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

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
            <Text style={styles.deliveryType}>
              {delivery_tier
                ? delivery_tier[0].toUpperCase() + delivery_tier.slice(1)
                : 'Delivery'}
            </Text>
            <Text style={styles.estimatedTime}>⏱ Pricing from your route</Text>
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.priceBreakdown}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery fee</Text>
            <Text style={styles.priceValue}>
              {delivery_base_price != null ? formatMoney(delivery_base_price) : '—'}
            </Text>
          </View>
          <View style={[styles.priceRow, { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }]}>
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
          <Text style={styles.sectionLabel}>PAY WITH</Text>

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
                    color={disabled ? '#BDBDBD' : '#000000'}
                    style={styles.paymentIcon}
                  />
                  <View style={styles.paymentInfo}>
                    <View style={styles.paymentNameRow}>
                      <Text
                        style={[styles.paymentName, disabled && styles.paymentTextMuted]}
                      >
                        {method.name}
                      </Text>
                      {isWallet && walletHasEnough && !walletBalanceLoading ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#00C853"
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
                        color="#000000"
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
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#F59E0B"
            style={styles.noticeIcon}
          />
          <Text style={styles.noticeText}>
            Please ensure parking is available at the pickup address when the driver arrives.
          </Text>
        </View>

      </ScrollView>

      {/* Pay Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.payButton} onPress={handlePay}>
          <Text style={styles.payButtonText}>Pay {totalPriceText}</Text>
        </TouchableOpacity>
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
              <Ionicons name="close" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {payfastLoading && (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#00C853" />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: { padding: 8 },
  backArrow: { fontSize: 22, color: '#000000' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  orderSummary: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  addressSection: {
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 14,
    color: '#9E9E9E',
    width: 50,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  deliveryType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  estimatedTime: {
    fontSize: 14,
    color: '#9E9E9E',
  },
  priceBreakdown: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 20,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 14,
    marginTop: 4,
  },
  priceLabel: {
    fontSize: 15,
    color: '#757575',
  },
  priceValue: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
  },
  paymentSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9E9E9E',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  paymentMethodSelected: {
    borderColor: '#000000',
    borderWidth: 2,
    backgroundColor: '#F5F5F5',
  },
  paymentMethodDisabled: {
    opacity: 0.55,
    backgroundColor: '#F5F5F5',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    marginRight: 12,
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
    color: '#000000',
  },
  walletCheckIcon: {
    marginLeft: 6,
  },
  paymentDescription: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  paymentTextMuted: {
    color: '#BDBDBD',
  },
  walletAvailableText: {
    color: '#00C853',
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
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleDisabled: {
    borderColor: '#BDBDBD',
    opacity: 0.7,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noticeIcon: {
    marginRight: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  bottomContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  payButton: {
    backgroundColor: '#00C853',
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentMessageBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  paymentMessageText: {
    color: '#DC2626',
    fontWeight: '700',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  payfastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  payfastHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  payfastCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoading: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
});

export default Payment;
