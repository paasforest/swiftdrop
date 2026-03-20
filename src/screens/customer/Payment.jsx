import React, { useMemo, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { getAuth } from '../../authStore';
import { postJson } from '../../apiClient';
import { WebView } from 'react-native-webview';

const { width, height } = Dimensions.get('window');

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R0.00';
  return `R${x.toFixed(2)}`;
}

const Payment = ({ navigation, route }) => {
  const params = route?.params || {};
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

  const closePayfast = () => {
    setPayfastModalVisible(false);
    setPaymentMessage('Payment cancelled');
    setPayfastUrl(null);
    setPayfastReturnUrl(null);
    setPayfastCancelUrl(null);
    setPendingOrderId(null);
    payHandledRef.current = false;
  };

  const handlePayfastSuccess = () => {
    if (payHandledRef.current) return;
    payHandledRef.current = true;
    setPayfastModalVisible(false);
    const orderId = pendingOrderId;
    setPendingOrderId(null);
    if (orderId) navigation.navigate('Tracking', { orderId });
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

  const paymentMethods = [
    {
      id: 'payfast',
      name: 'PayFast',
      icon: '💳',
      description: 'Pay with card/e-wallet'
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: '💳',
      description: 'Visa, Mastercard, etc.'
    },
    {
      id: 'eft',
      name: 'Instant EFT',
      icon: '🏦',
      description: 'Bank transfer'
    },
    {
      id: 'wallet',
      name: 'SwiftDrop Wallet',
      icon: '👛',
      description: 'R350 available',
      balance: 350
    }
  ];

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
  };

  const handlePay = async () => {
    try {
      if (!auth?.token) {
        navigation.navigate('Login');
        return;
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

      // Wallet payment: navigate immediately after deduction.
      navigation.navigate('Tracking', { orderId });
    } catch (e) {
      console.error('Pay error:', e.message);
      alert(e.message || 'Payment failed');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const total = useMemo(() => {
    if (delivery_total != null) return delivery_total;
    return null;
  }, [delivery_total]);

  const totalPriceText = total != null ? formatMoney(total) : '—';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Payment</Text>
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
          
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.paymentMethod,
                selectedPaymentMethod === method.id && styles.paymentMethodSelected
              ]}
              onPress={() => handlePaymentMethodSelect(method.id)}
            >
              <View style={styles.paymentLeft}>
                <Text style={styles.paymentIcon}>{method.icon}</Text>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentName}>{method.name}</Text>
                  <Text style={styles.paymentDescription}>{method.description}</Text>
                  {method.balance && (
                    <Text style={styles.balanceText}>Balance: R{method.balance}</Text>
                  )}
                </View>
              </View>
              <View style={styles.radioCircle}>
                {selectedPaymentMethod === method.id && (
                  <View style={styles.radioSelected} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Parking Notice */}
        <View style={styles.noticeBox}>
          <Text style={styles.noticeIcon}>🅿️</Text>
          <Text style={styles.noticeText}>
            Please ensure parking is available at the pickup address when the driver arrives.
          </Text>
        </View>
      </ScrollView>

      {/* Pay Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity style={styles.payButton} onPress={handlePay}>
          <Text style={styles.payButtonText}>
            Pay {totalPriceText} & Request Driver
          </Text>
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
              <Text style={styles.payfastCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {payfastLoading && (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#1A73E8" />
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
    width: width,
    height: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  backArrow: {
    fontSize: 24,
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 24,
  },
  orderSummary: {
    backgroundColor: '#F8F9FA',
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
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
    color: '#666666',
    width: 50,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  deliveryType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
  },
  estimatedTime: {
    fontSize: 14,
    color: '#666666',
  },
  priceBreakdown: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 16,
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 16,
    color: '#666666',
  },
  priceValue: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A73E8',
  },
  paymentSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentMethodSelected: {
    borderColor: '#1A73E8',
    backgroundColor: '#E8F4FF',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  paymentDescription: {
    fontSize: 14,
    color: '#666666',
  },
  balanceText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 2,
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
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1A73E8',
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    margin: 20,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  noticeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    paddingTop: 10,
  },
  payButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentMessageBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FFF1F1',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F6C7C7',
  },
  paymentMessageText: {
    color: '#d93025',
    fontWeight: '900',
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
    borderBottomColor: '#E0E0E0',
  },
  payfastHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1A1A1A',
  },
  payfastCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payfastCloseText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#d93025',
  },
  modalLoading: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  webview: {
    flex: 1,
  },
});

export default Payment;
