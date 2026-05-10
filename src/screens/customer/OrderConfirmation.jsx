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
    departure_time,
  } = route?.params || {};

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  useEffect(() => {
    if (trip_type !== 'intercity') {
      const timer = setTimeout(() => {
        navigation.replace('DriverMatching', { orderId });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [navigation, trip_type, orderId]);

  const isIntercity = trip_type === 'intercity';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.successSection}>
        <Animated.View style={[styles.successCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.successIcon}>✓</Text>
        </Animated.View>
        <Text style={styles.successTitle}>Order placed!</Text>
        <Text style={styles.successSubtitle}>
          {isIntercity ? 'Your intercity booking is confirmed' : 'We are finding you a driver'}
        </Text>
      </View>

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

        {isIntercity && departure_time ? (
          <View style={styles.departureChip}>
            <Text style={styles.departureText}>
              🕐 Driver departs{' '}
              {new Date(departure_time).toLocaleString('en-ZA', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Total paid</Text>
          <Text style={styles.metaValue}>R{Number(total_price || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Delivery type</Text>
          <Text style={styles.metaValue}>
            {isIntercity ? 'Intercity' : (delivery_tier || 'Standard')}
          </Text>
        </View>
      </View>

      {isIntercity ? (
        <View style={styles.intercityInfo}>
          <View style={styles.departureCard}>
            <Text style={styles.departureLabel}>
              DEPARTURE
            </Text>
            <Text style={styles.departureTime}>
              {departure_time
                ? new Date(departure_time).toLocaleDateString('en-ZA', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : 'As scheduled'}
            </Text>
          </View>

          <View style={styles.infoSteps}>
            {[
              '✓ Slot reserved',
              '⏳ Driver will collect your parcel',
              '⏳ Delivered at destination',
            ].map((step, i) => (
              <View key={i} style={styles.infoStep}>
                <Text style={styles.infoStepText}>
                  {step}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.trackButton, styles.trackButtonFullBleed]}
            onPress={() => navigation.replace('Tracking', { orderId })}
          >
            <Text style={styles.trackButtonText}>
              Track my booking
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.trackButton}
          onPress={() => navigation.replace('DriverMatching', { orderId })}
        >
          <Text style={styles.trackButtonText}>Track my order</Text>
        </TouchableOpacity>
      )}

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
  departureChip: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
  },
  departureText: {
    fontSize: 13,
    color: '#00C853',
    fontWeight: '600',
  },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaLabel: { fontSize: 13, color: '#9E9E9E' },
  metaValue: { fontSize: 13, fontWeight: '600', color: '#000000' },
  intercityInfo: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  departureCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  departureLabel: {
    fontSize: 10, fontWeight: '700',
    color: '#9E9E9E', letterSpacing: 1.2,
    marginBottom: 6,
  },
  departureTime: {
    fontSize: 16, fontWeight: '700',
    color: '#000000', textAlign: 'center',
  },
  infoSteps: {
    marginBottom: 24,
  },
  infoStep: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  infoStepText: {
    fontSize: 14, color: '#333333',
  },
  trackButton: {
    backgroundColor: '#000000', borderRadius: 14, height: 56,
    marginHorizontal: 20, marginTop: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  trackButtonFullBleed: {
    marginHorizontal: 0,
    marginTop: 8,
  },
  trackButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default OrderConfirmation;
