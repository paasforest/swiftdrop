import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';

const OrderConfirmation = ({ navigation, route }) => {
  const {
    orderId,
    pickup_address,
    dropoff_address,
    total_price,
    delivery_tier,
    trip_type,
  } = route?.params || {};

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Success animation */}
      <View style={styles.successSection}>
        <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.successIcon}>✓</Text>
        </Animated.View>
        <Text style={styles.successTitle}>Order placed!</Text>
        <Text style={styles.successSubtitle}>We are finding you a driver</Text>
      </View>

      {/* Order summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>DELIVERY DETAILS</Text>

        <View style={styles.routeRow}>
          <View style={styles.dotGreen} />
          <Text style={styles.routeText} numberOfLines={1}>{pickup_address || 'Pickup'}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <View style={styles.dotBlack} />
          <Text style={styles.routeText} numberOfLines={1}>{dropoff_address || 'Dropoff'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Total paid</Text>
          <Text style={styles.metaValue}>R{Number(total_price || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Delivery type</Text>
          <Text style={styles.metaValue}>
            {trip_type === 'intercity' ? 'Intercity' : (delivery_tier || 'Standard')}
          </Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.trackButton}
        onPress={() => navigation.replace('DriverMatching', { orderId })}
      >
        <Text style={styles.trackButtonText}>Track my order</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  successSection: {
    alignItems: 'center', paddingTop: 60, paddingBottom: 32,
  },
  successCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#00C853',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successIcon: { fontSize: 48, color: '#FFFFFF', fontWeight: '700' },
  successTitle: { fontSize: 28, fontWeight: '800', color: '#000000', marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: '#9E9E9E' },
  summaryCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    marginHorizontal: 20, borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  summaryLabel: {
    fontSize: 11, fontWeight: '700', color: '#9E9E9E',
    letterSpacing: 1.2, marginBottom: 16,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dotGreen: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#00C853', marginRight: 12,
  },
  dotBlack: {
    width: 10, height: 10, borderRadius: 3,
    backgroundColor: '#000000', marginRight: 12,
  },
  routeConnector: {
    width: 2, height: 16, backgroundColor: '#E0E0E0', marginLeft: 4,
  },
  routeText: { fontSize: 14, color: '#000000', flex: 1 },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaLabel: { fontSize: 13, color: '#9E9E9E' },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#000000' },
  trackButton: {
    backgroundColor: '#000000', borderRadius: 14, height: 56,
    marginHorizontal: 20, marginTop: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  trackButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default OrderConfirmation;
