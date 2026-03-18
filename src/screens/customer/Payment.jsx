import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, ScrollView } from 'react-native';

const { width, height } = Dimensions.get('window');

const Payment = () => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet');

  const orderDetails = {
    from: '123 Main Street, Worcester',
    to: '456 Oak Avenue, Cape Town',
    deliveryType: 'Express',
    estimatedTime: '1-2 hours',
    deliveryFee: 200,
    insurance: 15,
    total: 215
  };

  const paymentMethods = [
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

  const handlePay = () => {
    console.log('Pay with method:', selectedPaymentMethod, orderDetails);
  };

  const handleBack = () => {
    console.log('Back pressed');
  };

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

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.addressSection}>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>From:</Text>
              <Text style={styles.addressText}>{orderDetails.from}</Text>
            </View>
            <View style={styles.addressRow}>
              <Text style={styles.addressLabel}>To:</Text>
              <Text style={styles.addressText}>{orderDetails.to}</Text>
            </View>
          </View>

          <View style={styles.deliveryInfo}>
            <Text style={styles.deliveryType}>{orderDetails.deliveryType}</Text>
            <Text style={styles.estimatedTime}>⏱ {orderDetails.estimatedTime}</Text>
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.priceBreakdown}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery fee</Text>
            <Text style={styles.priceValue}>R{orderDetails.deliveryFee}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Insurance</Text>
            <Text style={styles.priceValue}>R{orderDetails.insurance}</Text>
          </View>
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>R{orderDetails.total}</Text>
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
          <Text style={styles.payButtonText}>Pay R{orderDetails.total} & Request Driver</Text>
        </TouchableOpacity>
      </View>
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
});

export default Payment;
