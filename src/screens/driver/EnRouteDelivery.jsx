import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions } from 'react-native';
import DriverLocationService from './DriverLocationService';
import { getAuth } from '../../authStore';
import { getJson } from '../../apiClient';

const { width, height } = Dimensions.get('window');

const EnRouteDelivery = ({ route, navigation }) => {
  const orderId = route?.params?.orderId;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!orderId) return;
      const auth = getAuth();
      if (!auth?.token) {
        setError('Not signed in');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getJson(`/api/orders/${orderId}`, { token: auth.token });
        if (!cancelled) setOrder(data);
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
  }, [orderId]);

  const handleBack = () => {
    console.log('Back pressed');
  };

  const statusText =
    order?.status === 'delivery_arrived'
      ? 'Arrived at destination'
      : order?.status === 'delivery_en_route'
        ? 'Delivering parcel'
        : order?.status
          ? String(order.status).replace(/_/g, ' ')
          : 'Delivering parcel';

  const canConfirmDelivery =
    order?.status === 'delivery_en_route' || order?.status === 'delivery_arrived';

  return (
    <SafeAreaView style={styles.container}>
      {orderId ? <DriverLocationService orderId={orderId} /> : null}
      {/* Map View */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          {/* Route Line */}
          <View style={styles.routeLine} />
          
          {/* Driver Position */}
          <View style={[styles.driverMarker, { left: 120, top: 180 }]}>
            <Text style={styles.driverIcon}>🚗</Text>
          </View>
          
          {/* Delivery Location */}
          <View style={[styles.deliveryMarker, { left: 220, top: 100 }]}>
            <View style={styles.deliveryDot} />
          </View>
        </View>

        {/* Top Overlay Bar */}
        <View style={styles.topOverlay}>
          <TouchableOpacity onPress={handleBack}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Delivery</Text>
          <View style={{ width: 70 }} />
        </View>
      </View>

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Status Badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {/* Delivery Address */}
        <View style={styles.addressSection}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.addressText}>
            {loading ? 'Loading…' : error ? '—' : order?.dropoff_address || '—'}
          </Text>
        </View>

        {canConfirmDelivery && (
          <TouchableOpacity
            style={styles.arrivedButton}
            onPress={() => navigation.navigate('DeliveryConfirm', { orderId })}
          >
            <Text style={styles.arrivedButtonText}>I have arrived at delivery</Text>
          </TouchableOpacity>
        )}
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
  mapContainer: {
    flex: 1,
    backgroundColor: '#E8F4F8',
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    position: 'relative',
  },
  routeLine: {
    position: 'absolute',
    width: 2,
    height: 150,
    backgroundColor: '#1A73E8',
    left: 170,
    top: 80,
    transform: [{ rotate: '-25deg' }],
  },
  driverMarker: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A73E8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  driverIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  deliveryMarker: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  deliveryDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
  },
  topOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backArrow: {
    fontSize: 24,
    color: '#1A73E8',
    fontWeight: 'bold',
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  cancelText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '500',
  },
  bottomPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  statusBadge: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  receiverSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  receiverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  receiverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
  },
  receiverDetails: {
    flex: 1,
  },
  receiverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  receiverPhone: {
    fontSize: 14,
    color: '#666666',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
  },
  contactIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  addressSection: {
    marginBottom: 24,
  },
  addressText: {
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  etaContainer: {
    backgroundColor: '#E8F4FF',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A73E8',
  },
  parcelSection: {
    marginBottom: 24,
  },
  parcelInfo: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
  },
  parcelText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  arrivedButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  arrivedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EnRouteDelivery;
